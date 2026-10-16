begin;
set local lock_timeout='3s';
set local statement_timeout='15s';

-- Keep the road edition, frozen ranking, exceptional S4 quotas and accepted
-- selections intact. The new discipline has its own invitation and consent.
alter table public.national_federation_olympic_events
  add column time_trial_race_edition_id uuid unique references public.race_editions(id);
alter table public.national_federation_olympic_qualifications
  add column time_trial_rider_quota smallint not null default 0
  check(time_trial_rider_quota between 0 and 2);

create or replace function public.federation_selection_slot_is_available(p_slot_key text,p_game_year integer)
returns boolean language sql immutable strict set search_path='' as $$
  select p_slot_key<>'nc-junior-road' and (p_game_year<4 or p_game_year%4<>0
    or p_slot_key not in('nc-mountain','nc-sprint','nc-cobbles'));
$$;
create or replace function public.federation_selection_slot_label(p_slot_key text,p_label text,p_game_year integer)
returns text language sql immutable strict set search_path='' as $$
  select case when p_game_year>=4 and p_game_year%4=0 then case p_slot_key
    when 'nc-hills' then 'Jeux quadriennaux · Course en ligne'
    when 'nc-time-trial' then 'Jeux quadriennaux · Contre-la-montre'
    else p_label end else p_label end;
$$;
create or replace function public.get_federation_selection_rider_limit(p_country_id uuid,p_season_id uuid,p_slot_key text)
returns integer language sql stable security definer set search_path='' as $$
  select case when s.game_year>=4 and s.game_year%4=0 and p_slot_key in('nc-hills','nc-time-trial')
    then coalesce((select case p_slot_key when 'nc-time-trial' then q.time_trial_rider_quota else q.rider_quota end
      from public.national_federation_olympic_qualifications q where q.season_id=s.id and q.country_id=p_country_id),0)
    else slot.rider_limit end
  from public.seasons s cross join public.national_federation_selection_slots slot
  where s.id=p_season_id and slot.slot_key=p_slot_key;
$$;
create or replace function public.federation_selection_automatic_callup_is_due(p_season_id uuid,p_slot_key text,
  p_competition_code text,p_departure_at timestamptz,p_now timestamptz)
returns boolean language sql stable security definer set search_path='' as $$
  select case when s.game_year>=4 and s.game_year%4=0 and p_slot_key in('nc-hills','nc-time-trial')
    then p_now>=p_departure_at-interval '7 days' and p_now<p_departure_at-interval '24 hours'
    else public.federation_professional_call_up_is_due(p_competition_code,p_departure_at,p_now) end
  from public.seasons s where s.id=p_season_id;
$$;

-- Surgical patches retain the newer prequalification/calendar and performance
-- fixes. Fail closed if an expected definition has changed unexpectedly.
do $patch$
declare p record; definition text;
begin
  for p in select * from (values
    ('public.get_national_federation_selection_target(uuid,uuid,text)',
      $b$o.race_edition_id=edition.id
            and q.country_id=p_country_id and q.rider_quota>0 and slot.slot_key='nc-hills'$b$,
      $a$q.country_id=p_country_id and (
            (o.race_edition_id=edition.id and q.rider_quota>0 and slot.slot_key='nc-hills')
            or (o.time_trial_race_edition_id=edition.id and q.time_trial_rider_quota>0 and slot.slot_key='nc-time-trial'))$a$),
    ('public.get_national_federation_selection_schedule(uuid,uuid)',
      $b$slot.slot_key='nc-hills' then interval '24 hours'$b$,
      $a$slot.slot_key in('nc-hills','nc-time-trial') then interval '24 hours'$a$),
    ('public.get_national_federation_nations_cup_standings(uuid)',
      $b$where o.race_edition_id=edition.id)$b$,
      $a$where o.race_edition_id=edition.id or o.time_trial_race_edition_id=edition.id)$a$)
  ) as patches(signature,before_text,after_text) loop
    definition:=pg_get_functiondef(p.signature::regprocedure);
    if (length(definition)-length(replace(definition,p.before_text,'')))/length(p.before_text)<>1 then
      raise exception 'Unexpected Olympic ITT patch target: %',p.signature;
    end if;
    execute replace(definition,p.before_text,p.after_text);
  end loop;
end;
$patch$;

alter function public.get_federation_professional_event_profile_segments(text,integer) rename to get_federation_professional_event_profile_segments_before_itt;
revoke all on function public.get_federation_professional_event_profile_segments_before_itt(text,integer) from public,anon,authenticated,service_role;
create function public.get_federation_professional_event_profile_segments(p_slot_key text,p_game_year integer)
returns table(segment_number smallint,distance_km numeric,terrain_type text,surface_type text,average_gradient_pct numeric)
language sql immutable strict security definer set search_path='' as $$
  select * from public.get_federation_professional_event_profile_segments_before_itt(p_slot_key,p_game_year)
  union all
  select p.* from (values (1::smallint,8::numeric,'flat','asphalt',0::numeric),
    (2::smallint,4::numeric,'climb','asphalt',2::numeric),(3::smallint,4::numeric,'descent','asphalt',-2::numeric),
    (4::smallint,12::numeric,'flat','asphalt',0::numeric),(5::smallint,8::numeric,'flat','asphalt',0::numeric))
    p(segment_number,distance_km,terrain_type,surface_type,average_gradient_pct)
  where p_slot_key='nc-time-trial' and p_game_year>=4 and p_game_year%4=0;
$$;
revoke all on function public.get_federation_professional_event_profile_segments(text,integer) from public,anon,authenticated;
grant execute on function public.get_federation_professional_event_profile_segments(text,integer) to service_role;

alter function public.ensure_global_olympic_event(uuid) rename to ensure_global_olympic_road_event_before_itt;
-- The road generator remains private; only the wrapper is called by the
-- existing automatic season/calendar paths.
revoke all on function public.ensure_global_olympic_road_event_before_itt(uuid) from public,anon,authenticated,service_role;
create function public.ensure_global_olympic_event(p_season_id uuid)
returns integer language plpgsql security definer set search_path='' set statement_timeout='15s' as $$
declare v_road integer; v_season public.seasons%rowtype; v_event uuid; v_race uuid;
  v_country uuid; v_category uuid; v_day uuid; v_departure timestamptz; v_stage uuid;
begin
  v_road:=public.ensure_global_olympic_road_event_before_itt(p_season_id);
  if coalesce(v_road,0)=0 then return 0; end if;
  select * into v_season from public.seasons where id=p_season_id;
  -- The road generator already holds the season-wide programme lock.
  select time_trial_race_edition_id into v_event from public.national_federation_olympic_events
    where season_id=p_season_id for update;
  if v_event is null then
    select e.host_country_id,e.race_category_id into v_country,v_category
      from public.race_editions e join public.national_federation_olympic_events o on o.race_edition_id=e.id
      where o.season_id=p_season_id;
    select id,(calendar_date::timestamp+time '14:00') at time zone 'Europe/Paris' into v_day,v_departure
      from public.season_days where season_id=p_season_id and day_number=24;
    if v_day is null or v_country is null or v_category is null then raise exception 'Calendrier olympique CLM incomplet.'; end if;
    insert into public.races(country_id,name,short_name,race_format,status,slug,competition_type)
      values(v_country,'Jeux quadriennaux · Contre-la-montre','JQ CLM','one_day','active','jeux-quadriennaux-clm','nations_cup')
      on conflict(slug) do update set status='active' returning id into v_race;
    insert into public.race_editions(race_id,season_id,race_category_id,edition_number,display_name,status,
      registration_closes_at,withdrawal_closes_at,minimum_reputation,registration_policy,field_limit,host_country_id)
      values(v_race,p_season_id,v_category,v_season.game_year,'Jeux quadriennaux · Contre-la-montre','registration_open',
        v_departure-interval '24 hours',v_departure-interval '24 hours',0,'closed',120,v_country)
      returning id into v_event;
    insert into public.stages(race_edition_id,season_day_id,stage_number,name,stage_type,distance_km,status,departure_at,profile_type,day_slot)
      values(v_event,v_day,1,'Jeux quadriennaux · Contre-la-montre','individual_time_trial',36,'planned',v_departure,'time_trial','early')
      returning id into v_stage;
    insert into public.stage_segments(stage_id,segment_number,distance_km,terrain_type,surface_type,average_gradient_pct)
      select v_stage,p.* from public.get_federation_professional_event_profile_segments('nc-time-trial',v_season.game_year) p;
    update public.national_federation_olympic_events set time_trial_race_edition_id=v_event where season_id=p_season_id;
  end if;
  update public.national_federation_olympic_qualifications set time_trial_rider_quota=
    least(eligible_riders,case when qualification_rank<=20 then 2 when qualification_rank<=100 then 1 else 0 end)::smallint
    where season_id=p_season_id and time_trial_rider_quota is distinct from
      least(eligible_riders,case when qualification_rank<=20 then 2 when qualification_rank<=100 then 1 else 0 end)::smallint;
  if (select sum(time_trial_rider_quota) from public.national_federation_olympic_qualifications where season_id=p_season_id)>120 then
    raise exception 'Le plafond olympique CLM de 120 coureurs est dépassé.';
  end if;
  return 2;
end;
$$;
revoke all on function public.ensure_global_olympic_event(uuid) from public,anon,authenticated;
grant execute on function public.ensure_global_olympic_event(uuid) to service_role;

create function public.get_olympic_time_trial_nation_standings(p_season_id uuid)
returns table(country_id uuid,country_code text,country_name text,qualification_rank integer,uci_rank integer,
  rider_quota integer,registered_riders integer,pending_riders integer,best_finish integer,exception_reason text)
language sql stable security definer set search_path='' as $$
  select q.country_id,c.iso_alpha2::text,c.name::text,q.qualification_rank,q.uci_rank,q.time_trial_rider_quota::integer,
    (select count(*)::integer from public.race_registrations g join public.race_rosters r on r.race_registration_id=g.id
      join public.riders rider on rider.id=r.rider_id where g.race_edition_id=o.time_trial_race_edition_id
        and g.status='accepted' and r.status in('selected','confirmed') and rider.country_id=q.country_id),
    (select count(*)::integer from public.national_federation_selection_lists l
      join public.national_federation_selection_members m on m.selection_list_id=l.id
      where l.season_id=q.season_id and l.country_id=q.country_id and l.slot_key='nc-time-trial' and m.response_status='pending'),
    (select min(result.final_rank)::integer from public.race_results result
      join public.race_rosters r on r.id=result.race_roster_id join public.riders rider on rider.id=r.rider_id
      where result.race_edition_id=o.time_trial_race_edition_id and result.status='classified' and rider.country_id=q.country_id),null::text
  from public.national_federation_olympic_qualifications q join public.countries c on c.id=q.country_id
  join public.national_federation_olympic_events o on o.season_id=q.season_id
  where q.season_id=p_season_id order by q.qualification_rank;
$$;
revoke all on function public.get_olympic_time_trial_nation_standings(uuid) from public,anon,authenticated;
grant execute on function public.get_olympic_time_trial_nation_standings(uuid) to service_role;

create or replace function public.guard_olympic_roster()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_season uuid; v_country uuid; v_quota integer; v_slot text; v_edition uuid;
begin
  if new.status not in('selected','confirmed') then return new; end if;
  select o.season_id,g.race_edition_id,
    case when o.time_trial_race_edition_id=g.race_edition_id then 'nc-time-trial' else 'nc-hills' end
    into v_season,v_edition,v_slot from public.race_registrations g
    join public.national_federation_olympic_events o on g.race_edition_id in(o.race_edition_id,o.time_trial_race_edition_id)
    where g.id=new.race_registration_id;
  if v_season is null then return new; end if;
  select country_id into v_country from public.riders where id=new.rider_id;
  perform pg_advisory_xact_lock(hashtextextended('olympic-quota:'||v_season::text||':'||v_country::text,0));
  v_quota:=public.get_federation_selection_rider_limit(v_country,v_season,v_slot);
  if coalesce(v_quota,0)<1 or not exists(select 1 from public.national_federation_selection_lists l
    join public.national_federation_selection_members m on m.selection_list_id=l.id
    where l.country_id=v_country and l.season_id=v_season and l.slot_key=v_slot
      and m.professional_rider_id=new.rider_id and m.response_status='confirmed') then
    raise exception 'Inscription olympique sans accord confirmé ou sans quota.';
  end if;
  if exists(select 1 from public.race_rosters r join public.race_registrations g on g.id=r.race_registration_id
    where g.race_edition_id=v_edition and r.rider_id=new.rider_id and r.status in('selected','confirmed')
      and g.status='accepted' and r.id<>new.id) then
    raise exception 'Ce coureur est déjà inscrit à cette épreuve des Jeux.';
  end if;
  if (select count(*) from public.race_rosters r join public.race_registrations g on g.id=r.race_registration_id
    join public.riders rider on rider.id=r.rider_id
    where g.race_edition_id=v_edition and rider.country_id=v_country and r.status in('selected','confirmed')
      and g.status='accepted' and r.id<>new.id)>=v_quota then
    raise exception 'Le quota olympique de cette nation est atteint.';
  end if;
  return new;
end;
$$;

-- Only the active edition needs immediate installation. Future programmes use
-- ensure_professional_nations_cup -> ensure_global_olympic_event automatically.
do $$ declare s record; begin
  for s in select id from public.seasons where status='active' and game_year>=4 and game_year%4=0 loop
    perform public.ensure_global_olympic_event(s.id);
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
