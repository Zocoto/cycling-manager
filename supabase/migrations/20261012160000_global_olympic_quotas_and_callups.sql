begin;
set local lock_timeout='3s';
set local statement_timeout='15s';

-- A separate Olympic registry: no divisions, no Nations Cup heat or movement.
create table public.national_federation_olympic_events (
  season_id uuid primary key references public.seasons(id),
  race_edition_id uuid not null unique references public.race_editions(id),
  qualification_frozen_at timestamptz,
  field_limit integer not null default 220 check(field_limit=220)
);
create table public.national_federation_olympic_qualifications (
  season_id uuid not null references public.seasons(id),
  country_id uuid not null references public.countries(id),
  source_season_id uuid not null references public.seasons(id),
  qualification_rank integer not null,
  uci_rank integer not null,
  uci_points bigint not null,
  rider_strength numeric not null,
  qualification_score numeric not null,
  eligible_riders integer not null,
  rider_quota smallint not null check(rider_quota between 0 and 8),
  exception_reason text check(exception_reason in('existing_confirmed_selection','reallocated_for_confirmed_selection')),
  frozen_at timestamptz not null default now(),
  primary key(season_id,country_id)
);
alter table public.national_federation_olympic_events enable row level security;
alter table public.national_federation_olympic_qualifications enable row level security;
revoke all on public.national_federation_olympic_events,public.national_federation_olympic_qualifications from public,anon,authenticated;
grant select,insert,update on public.national_federation_olympic_events,public.national_federation_olympic_qualifications to service_role;

create table public.olympic_global_migration_audits(season_id uuid primary key references public.seasons(id),snapshot jsonb not null,created_at timestamptz not null default now());
alter table public.olympic_global_migration_audits enable row level security;
revoke all on public.olympic_global_migration_audits from public,anon,authenticated;
grant select,insert on public.olympic_global_migration_audits to service_role;

create or replace function public.get_federation_selection_rider_limit(p_country_id uuid,p_season_id uuid,p_slot_key text)
returns integer language sql stable security definer set search_path='' as $$
  select case when s.game_year>=4 and s.game_year%4=0 and p_slot_key='nc-hills'
    then coalesce((select q.rider_quota from public.national_federation_olympic_qualifications q
      where q.season_id=s.id and q.country_id=p_country_id),0)
    else slot.rider_limit end
  from public.seasons s cross join public.national_federation_selection_slots slot
  where s.id=p_season_id and slot.slot_key=p_slot_key;
$$;

create or replace function public.ensure_global_olympic_event(p_season_id uuid)
returns integer language plpgsql security definer set search_path='' set statement_timeout='15s' as $$
declare v_season public.seasons%rowtype; v_event uuid; v_race uuid; v_stage uuid;
  v_country uuid; v_category uuid; v_day uuid; v_departure timestamptz; v_source uuid;
  v_japan uuid; v_displaced uuid; v_japan_rank integer; v_japan_eligible integer;
begin
  select * into v_season from public.seasons where id=p_season_id;
  if v_season.game_year<4 or v_season.game_year%4<>0 then return 0; end if;
  perform pg_advisory_xact_lock(hashtextextended('olympic-programme:'||p_season_id::text,0));
  select race_edition_id into v_event from public.national_federation_olympic_events where season_id=p_season_id;
  if v_event is null then
    select coalesce((select a.country_id from public.national_federation_hosting_awards a
      where a.target_game_year=v_season.game_year and a.event_type='quadrennial_games_pro'
        and a.status in('scheduled','settled') order by a.selected_at desc limit 1),c.id)
      into v_country from public.countries c where c.iso_alpha2='CH' and c.is_active;
    select id into v_category from public.race_categories where code='world' and is_active;
    select id,(calendar_date::timestamp+time '18:00') at time zone 'Europe/Paris' into v_day,v_departure
      from public.season_days where season_id=p_season_id and day_number=24;
    if v_country is null or v_category is null or v_day is null then
      raise exception 'Calendrier olympique incomplet.';
    end if;
    -- Preserve the S4 D1 edition URL and stage ID; it becomes the only global event.
    select race_edition_id into v_event from public.national_federation_nations_cup_heats
      where season_id=p_season_id and slot_key='nc-hills' and pool_key='d1';
    if v_event is null then
      insert into public.races(country_id,name,short_name,race_format,status,slug,competition_type)
      values(v_country,'Jeux quadriennaux · Course en ligne','JQ Route','one_day','active','jeux-quadriennaux-route','nations_cup')
      on conflict(slug) do update set status='active' returning id into v_race;
      insert into public.race_editions(race_id,season_id,race_category_id,edition_number,display_name,status,
        registration_closes_at,withdrawal_closes_at,minimum_reputation,registration_policy,field_limit,host_country_id)
      values(v_race,p_season_id,v_category,v_season.game_year,'Jeux quadriennaux · Course en ligne','registration_open',
        v_departure-interval '24 hours',v_departure-interval '24 hours',0,'closed',220,v_country)
      returning id into v_event;
      insert into public.stages(race_edition_id,season_day_id,stage_number,name,stage_type,distance_km,status,departure_at,profile_type,day_slot)
      values(v_event,v_day,1,'Jeux quadriennaux · Course en ligne','road',194,'planned',v_departure,'mixed','late')
      returning id into v_stage;
      insert into public.stage_segments(stage_id,segment_number,distance_km,terrain_type,surface_type,average_gradient_pct)
      select v_stage,p.* from public.get_federation_professional_event_profile_segments('nc-hills',v_season.game_year) p;
    else
      update public.race_editions set display_name='Jeux quadriennaux · Course en ligne',field_limit=220 where id=v_event;
      update public.stages set name='Jeux quadriennaux · Course en ligne' where race_edition_id=v_event;
    end if;
    insert into public.national_federation_olympic_events(season_id,race_edition_id) values(p_season_id,v_event);
  end if;
  -- Freeze at J4 (20 days before J24), once only. Use last season's final national
  -- UCI points so that early-season zeroes cannot erase the sporting hierarchy.
  if coalesce(v_season.current_day_number,0)<4 or exists(select 1 from public.national_federation_olympic_events
    where season_id=p_season_id and qualification_frozen_at is not null) then return 1; end if;
  select id into v_source from public.seasons where game_year=v_season.game_year-1;
  v_source:=coalesce(v_source,p_season_id);
  with uci as materialized (
    select country_id,sum(uci_points)::bigint points from public.get_national_championship_country_rankings(v_source) group by country_id
  ), rated as (
    select r.country_id,r.id, .26*s.mountain+.18*s.hills+.16*s.cobbles+.15*s.endurance
      +.10*s.resistance+.09*s.sprint+.06*s.acceleration strength
    from public.riders r join public.rider_season_ratings s on s.rider_id=r.id and s.season_id=p_season_id
    where r.status in('active','free_agent')
  ), ranked_riders as (
    select *,row_number() over(partition by country_id order by strength desc,id) pos from rated
  ), nations as (
    select c.id country_id,coalesce(u.points,0) points,count(r.id)::integer eligible,
      coalesce(sum(r.strength) filter(where r.pos<=4),0)/4 strength
    from public.countries c left join uci u on u.country_id=c.id left join ranked_riders r on r.country_id=c.id
    where c.is_active group by c.id,u.points
  ), scored as (
    select *,rank() over(order by points desc)::integer uci_rank,
      .70*percent_rank() over(order by points)+.30*percent_rank() over(order by strength) score
    from nations where eligible>0
  ), ordered as (
    select *,row_number() over(order by score desc,points desc,strength desc,country_id)::integer position from scored
  )
  insert into public.national_federation_olympic_qualifications(season_id,country_id,source_season_id,qualification_rank,
    uci_rank,uci_points,rider_strength,qualification_score,eligible_riders,rider_quota)
  select p_season_id,country_id,v_source,position,uci_rank,points,strength,score,eligible,
    least(eligible,case when position<=10 then 8 when position<=30 then 4 when position<=60 then 2 else 0 end)::smallint
  from ordered;
  -- Owner-approved, S4-only transition: Japan already has a manually confirmed
  -- callup. Keep its real qualifying rank, grant two places and exchange the last
  -- two-place invitation, never alter a result or make a permanent wildcard rule.
  if v_season.game_year=4 then
    select q.country_id,q.qualification_rank,q.eligible_riders into v_japan,v_japan_rank,v_japan_eligible
      from public.national_federation_olympic_qualifications q join public.countries c on c.id=q.country_id
      where q.season_id=p_season_id and c.iso_alpha2='JP';
    if v_japan_rank>60 and exists(select 1 from public.national_federation_selection_lists l
      join public.national_federation_selection_members m on m.selection_list_id=l.id
      where l.country_id=v_japan and l.season_id=p_season_id and l.slot_key='nc-hills'
        and l.manually_submitted_at is not null and m.response_status='confirmed'
        and m.owner_team_id is not null and m.owner_director_id is not null) then
      select country_id into v_displaced from public.national_federation_olympic_qualifications
        where season_id=p_season_id and qualification_rank=60 and rider_quota=2;
      if v_displaced is null or v_japan_eligible<2 then
        raise exception 'Les deux places olympiques du Japon ne peuvent pas être échangées comme validé.';
      end if;
      update public.national_federation_olympic_qualifications set rider_quota=0,exception_reason='reallocated_for_confirmed_selection'
        where season_id=p_season_id and country_id=v_displaced;
      update public.national_federation_olympic_qualifications set rider_quota=2,exception_reason='existing_confirmed_selection'
        where season_id=p_season_id and country_id=v_japan;
    end if;
  end if;
  if (select sum(rider_quota) from public.national_federation_olympic_qualifications where season_id=p_season_id)>220 then
    raise exception 'Le plafond olympique de 220 coureurs est dépassé.';
  end if;
  update public.national_federation_olympic_events set qualification_frozen_at=now() where season_id=p_season_id;
  return 1;
end;
$$;

-- New invitations close at H-24; accepted responses remain possible until H-1.
create or replace function public.get_olympic_nation_standings(p_season_id uuid)
returns table(country_id uuid,country_code text,country_name text,qualification_rank integer,uci_rank integer,
  rider_quota integer,registered_riders integer,pending_riders integer,best_finish integer,exception_reason text)
language sql stable security definer set search_path='' as $$
  select q.country_id,c.iso_alpha2::text,c.name::text,q.qualification_rank,q.uci_rank,q.rider_quota::integer,
    (select count(*)::integer from public.race_registrations g join public.race_rosters r on r.race_registration_id=g.id
      join public.riders rider on rider.id=r.rider_id where g.race_edition_id=o.race_edition_id
        and g.status='accepted' and r.status in('selected','confirmed') and rider.country_id=q.country_id),
    (select count(*)::integer from public.national_federation_selection_lists l
      join public.national_federation_selection_members m on m.selection_list_id=l.id
      where l.season_id=q.season_id and l.country_id=q.country_id and l.slot_key='nc-hills' and m.response_status='pending'),
    (select min(result.final_rank)::integer from public.race_results result
      join public.race_rosters r on r.id=result.race_roster_id join public.riders rider on rider.id=r.rider_id
      where result.race_edition_id=o.race_edition_id and result.status='classified' and rider.country_id=q.country_id),q.exception_reason
  from public.national_federation_olympic_qualifications q join public.countries c on c.id=q.country_id
  join public.national_federation_olympic_events o on o.season_id=q.season_id
  where q.season_id=p_season_id order by q.qualification_rank;
$$;
revoke all on function public.get_olympic_nation_standings(uuid) from public,anon,authenticated;
grant execute on function public.get_olympic_nation_standings(uuid) to service_role;

create or replace function public.federation_selection_automatic_callup_is_due(p_season_id uuid,p_slot_key text,
  p_competition_code text,p_departure_at timestamptz,p_now timestamptz)
returns boolean language sql stable security definer set search_path='' as $$
  select case when s.game_year>=4 and s.game_year%4=0 and p_slot_key='nc-hills'
    then p_now>=p_departure_at-interval '7 days' and p_now<p_departure_at-interval '24 hours'
    else public.federation_professional_call_up_is_due(p_competition_code,p_departure_at,p_now) end
  from public.seasons s where s.id=p_season_id;
$$;
revoke all on function public.get_federation_selection_rider_limit(uuid,uuid,text),public.ensure_global_olympic_event(uuid),
  public.federation_selection_automatic_callup_is_due(uuid,text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.get_federation_selection_rider_limit(uuid,uuid,text),public.ensure_global_olympic_event(uuid),
  public.federation_selection_automatic_callup_is_due(uuid,text,text,timestamptz,timestamptz) to service_role;

do $patch$
declare p record; definition text; actual integer;
begin
  for p in select * from (values
    ('public.ensure_professional_nations_cup(uuid)', $before$  perform public.seed_nations_cup_assignments_for_season(v_season.id);$before$, $after$  if v_season.game_year>=4 and v_season.game_year%4=0 then
    return public.ensure_global_olympic_event(v_season.id);
  end if;
  perform public.seed_nations_cup_assignments_for_season(v_season.id);$after$, 1),
    ('public.get_national_federation_selection_target(uuid,uuid,text)', $before$(slot.competition_code = 'nations_cup' and exists (
        select 1
        from public.national_federation_nations_cup_assignments as assignment
        join public.national_federation_nations_cup_heats as heat
          on heat.season_id = assignment.season_id
         and heat.division = assignment.division
         and heat.group_code is not distinct from assignment.group_code
         and heat.slot_key = slot.slot_key
         and heat.race_edition_id = edition.id
        where assignment.country_id = p_country_id
          and assignment.season_id = p_season_id
      ))$before$, $after$(slot.competition_code = 'nations_cup' and (
        exists(select 1 from public.national_federation_olympic_events o
          join public.national_federation_olympic_qualifications q on q.season_id=o.season_id
          where o.season_id=p_season_id and o.race_edition_id=edition.id
            and q.country_id=p_country_id and q.rider_quota>0 and slot.slot_key='nc-hills')
        or ((select s.game_year%4<>0 from public.seasons s where s.id=p_season_id) and exists (
        select 1
        from public.national_federation_nations_cup_assignments as assignment
        join public.national_federation_nations_cup_heats as heat
          on heat.season_id = assignment.season_id
         and heat.division = assignment.division
         and heat.group_code is not distinct from assignment.group_code
         and heat.slot_key = slot.slot_key
         and heat.race_edition_id = edition.id
        where assignment.country_id = p_country_id
          and assignment.season_id = p_season_id
      ))))$after$, 1),
    ('public.get_national_federation_selection_schedule(uuid,uuid)', $before$          else interval '1 hour'$before$, $after$          when season.game_year>=4 and season.game_year%4=0 and slot.slot_key='nc-hills' then interval '24 hours'
          else interval '1 hour'$after$, 1),
    ('public.save_national_federation_preselection(text,text,uuid[])', $before$v_slot.rider_limit$before$, $after$public.get_federation_selection_rider_limit(v_identity.country_id,v_season.id,v_slot.slot_key)$after$, 2),
    ('public.sync_national_federation_championship_lineup(uuid)', $before$limit v_slot.rider_limit$before$, $after$limit public.get_federation_selection_rider_limit(v_list.country_id,v_list.season_id,v_slot.slot_key)$after$, 1),
    ('public.publish_national_federation_preselection(text,text)', $before$  update public.national_federation_selection_lists
  set manually_submitted_at$before$, $after$  if (select count(*) from public.national_federation_selection_members
      where selection_list_id=v_list.id and response_status in('draft','pending','confirmed'))
      > public.get_federation_selection_rider_limit(v_list.country_id,v_list.season_id,v_list.slot_key) then
    raise exception 'Le quota de cette épreuve est dépassé.';
  end if;
  update public.national_federation_selection_lists
  set manually_submitted_at$after$, 1),
    ('public.prepare_due_automatic_federation_professional_lineups(timestamp with time zone)', $before$while v_selected < v_slot.rider_limit loop$before$, $after$while v_selected < public.get_federation_selection_rider_limit(v_country.id,v_season.id,v_slot.slot_key) loop$after$, 1),
    ('public.refill_national_federation_professional_selection(uuid,timestamp with time zone)', $before$while v_selected < v_slot.rider_limit loop$before$, $after$while v_selected < public.get_federation_selection_rider_limit(v_list.country_id,v_list.season_id,v_slot.slot_key) loop$after$, 1),
    ('public.prepare_due_automatic_federation_professional_lineups(timestamp with time zone)', $before$public.federation_professional_call_up_is_due(
           v_slot.competition_code, v_departure_at, p_now
         )$before$, $after$public.federation_selection_automatic_callup_is_due(
           v_season.id,v_slot.slot_key,v_slot.competition_code,v_departure_at,p_now
         )$after$, 1),
    ('public.refill_national_federation_professional_selection(uuid,timestamp with time zone)', $before$public.federation_professional_call_up_is_due(
       v_slot.competition_code, v_departure_at, p_now
     )$before$, $after$public.federation_selection_automatic_callup_is_due(
           v_season.id,v_slot.slot_key,v_slot.competition_code,v_departure_at,p_now
         )$after$, 1),
    ('public.seed_nations_cup_assignments_for_season(uuid)', $before$where season.game_year = v_target.game_year - 1
  limit 1;$before$, $after$where season.game_year < v_target.game_year
    and season.game_year%4<>0
  order by season.game_year desc limit 1;$after$, 1),
    ('public.seed_nations_cup_assignments_for_season(uuid)', $before$(case when v_source.game_year % 4 = 0 then 1 else 5 end)$before$, $after$5$after$, 2),
    ('public.get_national_federation_nations_cup_standings(uuid)', $before$and race.competition_type = 'nations_cup'$before$, $after$and race.competition_type = 'nations_cup'
     and not exists(select 1 from public.national_federation_olympic_events o where o.race_edition_id=edition.id)$after$, 1),
    ('public.get_national_federation_race_creation_score_base(uuid,uuid)', $before$  v_nations_cup_events := coalesce(v_nations_cup_events, 0);$before$, $after$  if v_season.game_year>=4 and v_season.game_year%4=0 then
    select best_finish,case when best_finish is null then 0 else 1 end
      into v_nations_cup_overall_rank,v_nations_cup_events
      from public.get_olympic_nation_standings(p_season_id) where country_id=p_country_id;
  end if;
  v_nations_cup_events := coalesce(v_nations_cup_events, 0);$after$, 1)
  ) patches(signature,previous,replacement,expected_count) loop
    select replace(pg_get_functiondef(p.signature::regprocedure),chr(13),'') into definition;
    actual:=(length(definition)-length(replace(definition,p.previous,'')))/length(p.previous);
    if actual<>p.expected_count then raise exception 'Olympic anchor drift: %',p.signature; end if;
    execute replace(definition,p.previous,p.replacement);
  end loop;
end;
$patch$;

-- Preserve every existing call/member ID. Only the obsolete Olympic heats are
-- cancelled. Move their registration itself, not riders' unrelated registrations.
do $convert$
declare v_season uuid; v_global uuid;
begin
  select id into v_season from public.seasons where status='active' and game_year=4;
  if v_season is null then return; end if;
  insert into public.olympic_global_migration_audits(season_id,snapshot)
  select v_season,jsonb_build_object(
    'assignments',coalesce((select jsonb_agg(to_jsonb(a)) from public.national_federation_nations_cup_assignments a where a.season_id=v_season),'[]'::jsonb),
    'members',coalesce((select jsonb_agg(to_jsonb(m)) from public.national_federation_selection_members m
      join public.national_federation_selection_lists l on l.id=m.selection_list_id
      where l.season_id=v_season and l.slot_key='nc-hills'),'[]'::jsonb),
    'links',coalesce((select jsonb_agg(to_jsonb(link)) from public.national_federation_selection_race_links link
      join public.national_federation_selection_lists l on l.id=link.selection_list_id
      where l.season_id=v_season and l.slot_key='nc-hills'),'[]'::jsonb),
    'rosters',coalesce((select jsonb_agg(to_jsonb(r)) from public.race_rosters r
      join public.national_federation_selection_race_links link on link.race_registration_id=r.race_registration_id
      join public.national_federation_selection_lists l on l.id=link.selection_list_id
      where l.season_id=v_season and l.slot_key='nc-hills'),'[]'::jsonb)
  );
  perform e.id from public.race_editions e join public.national_federation_nations_cup_heats h on h.race_edition_id=e.id
    where h.season_id=v_season and h.slot_key='nc-hills' for update of e nowait;
  perform s.id from public.stages s join public.national_federation_nations_cup_heats h on h.race_edition_id=s.race_edition_id
    where h.season_id=v_season and h.slot_key='nc-hills' for update of s nowait;
  if exists(select 1 from public.national_federation_nations_cup_heats h join public.race_editions e on e.id=h.race_edition_id
    join public.stages s on s.race_edition_id=e.id where h.season_id=v_season and h.slot_key='nc-hills'
    and (e.status not in('planned','registration_open','registration_closed','cancelled') or s.status not in('planned','cancelled')
      or s.departure_at<=now() or exists(select 1 from public.stage_results r where r.stage_id=s.id)
      or exists(select 1 from public.race_results r where r.race_edition_id=e.id)
      or exists(select 1 from public.official_stage_simulations r where r.stage_id=s.id)
      or exists(select 1 from public.official_stage_simulation_claims r where r.stage_id=s.id))) then
    raise exception 'Course olympique commencée ou simulée : conversion interdite.';
  end if;
  perform public.ensure_global_olympic_event(v_season);
  select race_edition_id into v_global from public.national_federation_olympic_events where season_id=v_season;
  -- A pre-existing agreement must never be discarded because of qualification.
  if exists(select 1 from public.national_federation_selection_lists l
    join public.national_federation_selection_members m on m.selection_list_id=l.id
    where l.season_id=v_season and l.slot_key='nc-hills' and m.response_status in('draft','pending','confirmed')
    group by l.country_id having count(*)>public.get_federation_selection_rider_limit(l.country_id,v_season,'nc-hills')) then
    raise exception 'Une sélection olympique existante dépasse le nouveau quota : intervention ciblée requise.';
  end if;
  update public.race_registrations g set race_edition_id=v_global
    from public.national_federation_selection_race_links link,public.national_federation_selection_lists l
    where link.selection_list_id=l.id and l.season_id=v_season and l.slot_key='nc-hills' and g.id=link.race_registration_id;
  update public.national_federation_selection_race_links link set race_edition_id=v_global,synced_at=now()
    from public.national_federation_selection_lists l where l.id=link.selection_list_id and l.season_id=v_season and l.slot_key='nc-hills';
  update public.stages s set status='cancelled' from public.national_federation_nations_cup_heats h
    where h.season_id=v_season and h.slot_key='nc-hills' and h.race_edition_id<>v_global and s.race_edition_id=h.race_edition_id;
  update public.race_editions e set status='cancelled' from public.national_federation_nations_cup_heats h
    where h.season_id=v_season and h.slot_key='nc-hills' and h.race_edition_id<>v_global and e.id=h.race_edition_id;
end;
$convert$;

-- Defense in depth: every Olympic starter must have an explicit confirmed call,
-- including callers outside the selection sync. No automatic overbooking.
create function public.guard_olympic_roster() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_season uuid; v_country uuid; v_quota integer;
begin
  if new.status not in('selected','confirmed') then return new; end if;
  select o.season_id into v_season from public.race_registrations g
    join public.national_federation_olympic_events o on o.race_edition_id=g.race_edition_id
    where g.id=new.race_registration_id;
  if v_season is null then return new; end if;
  select country_id into v_country from public.riders where id=new.rider_id;
  perform pg_advisory_xact_lock(hashtextextended('olympic-quota:'||v_season::text||':'||v_country::text,0));
  v_quota:=public.get_federation_selection_rider_limit(v_country,v_season,'nc-hills');
  if v_quota<1 or not exists(select 1 from public.national_federation_selection_lists l
    join public.national_federation_selection_members m on m.selection_list_id=l.id
    where l.country_id=v_country and l.season_id=v_season and l.slot_key='nc-hills'
      and m.professional_rider_id=new.rider_id and m.response_status='confirmed') then
    raise exception 'Inscription olympique sans accord confirmé ou sans quota.';
  end if;
  if exists(select 1 from public.race_rosters r join public.race_registrations g on g.id=r.race_registration_id
    join public.national_federation_olympic_events o on o.race_edition_id=g.race_edition_id
    where o.season_id=v_season and r.rider_id=new.rider_id and r.status in('selected','confirmed')
      and g.status='accepted' and r.id<>new.id) then
    raise exception 'Ce coureur est déjà inscrit aux Jeux.';
  end if;
  if (select count(*) from public.race_rosters r join public.race_registrations g on g.id=r.race_registration_id
    join public.national_federation_olympic_events o on o.race_edition_id=g.race_edition_id
    join public.riders rider on rider.id=r.rider_id
    where o.season_id=v_season and rider.country_id=v_country and r.status in('selected','confirmed')
      and g.status='accepted' and r.id<>new.id)>=v_quota then
    raise exception 'Le quota olympique de cette nation est atteint.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_olympic_roster() from public,anon,authenticated;
create trigger guard_olympic_roster before insert or update of status,rider_id,race_registration_id
on public.race_rosters for each row execute function public.guard_olympic_roster();

notify pgrst,'reload schema';
commit;
