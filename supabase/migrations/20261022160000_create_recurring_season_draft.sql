begin;
set local lock_timeout = '1s';
set local statement_timeout = '8s';
set local application_name = 'cyclostratege-season-draft-20261022';

-- No current-season draft, retrospective award or season rollover at install.
create table public.season_draft_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default true,
  first_game_year integer not null,
  minimum_pool_size integer not null default 100 check (minimum_pool_size = 100),
  pick_seconds integer not null default 300 check (pick_seconds = 300)
);
insert into public.season_draft_settings(first_game_year)
select game_year + 1 from public.seasons where status = 'active';

create table public.season_draft_editions (
  id uuid primary key default gen_random_uuid(),
  game_year integer not null unique,
  season_id uuid unique references public.seasons(id) on delete restrict,
  previous_season_id uuid not null references public.seasons(id) on delete restrict,
  announcement_at timestamptz not null,
  opens_at timestamptz not null,
  starts_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','preparing','running','completed','cancelled')),
  initialized_at timestamptz,
  closed_at timestamptz,
  current_position integer,
  pick_deadline timestamptz,
  participant_count integer not null default 0,
  pool_count integer not null default 0,
  version integer not null default 0,
  check (announcement_at < opens_at and opens_at < starts_at),
  check ((current_position is null) = (pick_deadline is null))
);
create table public.season_draft_participants (
  edition_id uuid not null references public.season_draft_editions(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete restrict,
  sporting_director_id uuid not null references public.sporting_directors(id) on delete restrict,
  position integer not null check (position > 0),
  team_name text not null,
  director_name text not null,
  previous_points integer not null,
  registered_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','picked','passed')),
  preferences uuid[] not null default '{}',
  auto_enabled boolean not null default false,
  selected_rider_id uuid references public.riders(id) on delete restrict,
  selected_contract_id uuid references public.rider_contracts(id) on delete restrict,
  resolution_reason text,
  resolved_at timestamptz,
  primary key (edition_id, team_id),
  unique (edition_id, sporting_director_id),
  unique (edition_id, position),
  check ((status = 'pending') = (resolved_at is null)),
  check ((status = 'picked') = (selected_rider_id is not null and selected_contract_id is not null))
);
create index season_draft_pending_idx on public.season_draft_participants(edition_id,position) where status='pending';
create index season_draft_selected_rider_idx on public.season_draft_participants(selected_rider_id) where status='picked';
create table public.season_draft_riders (
  edition_id uuid not null references public.season_draft_editions(id) on delete restrict,
  rider_id uuid not null references public.riders(id) on delete restrict,
  pool_rank integer not null,
  score numeric(8,3) not null,
  salary_per_season numeric(12,2) not null default 0,
  snapshot jsonb not null,
  selected_team_id uuid references public.teams(id) on delete restrict,
  primary key (edition_id,rider_id),
  unique (edition_id,pool_rank)
);
create index season_draft_rider_reservation_idx on public.season_draft_riders(rider_id,edition_id);

alter table public.season_draft_settings enable row level security;
alter table public.season_draft_editions enable row level security;
alter table public.season_draft_participants enable row level security;
alter table public.season_draft_riders enable row level security;
revoke all on public.season_draft_settings, public.season_draft_editions, public.season_draft_participants, public.season_draft_riders from public,anon,authenticated;
grant all on public.season_draft_settings, public.season_draft_editions, public.season_draft_participants, public.season_draft_riders to service_role;

-- An additive CHECK, without scanning or repricing any existing contract.
do $constraint$
declare v_expression text;
begin
  select pg_get_expr(conbin,conrelid) into v_expression from pg_constraint
  where conrelid='public.rider_contracts'::regclass and conname='rider_contracts_acquisition_type_allowed';
  if v_expression is null then raise exception 'Contract acquisition constraint missing'; end if;
  alter table public.rider_contracts drop constraint rider_contracts_acquisition_type_allowed;
  execute 'alter table public.rider_contracts add constraint rider_contracts_acquisition_type_allowed check (('
    ||v_expression||') or acquisition_type = ''season_draft'') not valid';
end;
$constraint$;

create function public.calculate_season_draft_score(p_rating jsonb,p_potential integer,p_age integer)
returns numeric language sql immutable set search_path='' as $$
  with r as (select (p_rating->>'mountain')::numeric mo,(p_rating->>'hills')::numeric val,
    (p_rating->>'flat')::numeric pla,(p_rating->>'time_trial')::numeric clm,
    (p_rating->>'cobbles')::numeric pav,(p_rating->>'sprint')::numeric spr,
    (p_rating->>'acceleration')::numeric acc,(p_rating->>'endurance')::numeric endurance,
    (p_rating->>'resistance')::numeric res,(p_rating->>'recovery')::numeric rec)
  select round(.60 * greatest(.55*mo+.20*endurance+.15*res+.10*rec,
    .55*val+.20*acc+.15*res+.10*endurance,.65*spr+.20*acc+.15*pla,
    .60*pav+.20*pla+.10*res+.10*endurance,.65*clm+.15*pla+.10*res+.10*endurance,
    .35*pla+.30*endurance+.20*res+.15*rec)
    + .25 * (least(8,greatest(1,p_potential))*12.5) * case
      when p_age<=23 then 1 when p_age<=26 then .85 when p_age<=29 then .60 when p_age<=32 then .35 else .10 end
    + .15 * ((mo+val+pla+clm+pav+spr+acc+endurance+res+rec
      +(p_rating->>'downhill')::numeric+(p_rating->>'breakaway')::numeric+(p_rating->>'prologue')::numeric)/13),3)
  from r;
$$;

create function public.season_draft_message(p_edition uuid,p_team uuid,p_reference text,p_subject text,p_body text)
returns void language sql security definer set search_path='' as $$
  insert into public.sporting_director_messages(sporting_director_id,season_id,team_season_id,
    message_type,sender_name,subject,preview,body,action_href,action_label,source_reference,is_important)
  select participant.sporting_director_id,edition.season_id,ts.id,'system','Commission de la draft',
    p_subject,left(p_body,180),p_body,'/jeu/draft','Ouvrir la draft',
    'season-draft:'||edition.id::text||':'||p_reference,true
  from public.season_draft_participants participant
  join public.season_draft_editions edition on edition.id=participant.edition_id
  left join public.team_seasons ts on ts.team_id=participant.team_id and ts.season_id=edition.season_id
  where participant.edition_id=p_edition and participant.team_id=p_team
  on conflict (sporting_director_id,source_reference) do nothing;
$$;

-- Reservation guards cover every recruitment/listing path, including bots.
-- Lock the rider too: an auction insert and pool creation cannot cross unnoticed.
create function public.guard_season_draft_reservation()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_reservation record;
begin
  if tg_table_name='rider_contracts' and new.status not in ('active','planned') then return new; end if;
  if tg_table_name='transfer_market_listings' and new.status<>'open' then return new; end if;
  if not exists(select 1 from public.season_draft_editions where status in ('preparing','running')) then return new; end if;
  perform 1 from public.riders where id=new.rider_id for update;
  select pool.selected_team_id,edition.season_id into v_reservation
  from public.season_draft_riders pool join public.season_draft_editions edition on edition.id=pool.edition_id
  where pool.rider_id=new.rider_id and edition.status in ('preparing','running') limit 1;
  if not found then return new; end if;
  if tg_table_name='rider_contracts' then
    if tg_op='UPDATE' and new.team_id=old.team_id and new.status=old.status then return new; end if;
    if new.acquisition_type='season_draft' and new.team_id=v_reservation.selected_team_id
      and new.start_season_id=v_reservation.season_id and new.end_season_id=v_reservation.season_id then return new; end if;
  end if;
  raise exception 'Ce coureur est réservé à la draft de début de saison.' using errcode='23514';
end;
$$;
create trigger aa_season_draft_contract_reservation before insert or update of team_id,status on public.rider_contracts
for each row execute function public.guard_season_draft_reservation();
create trigger aa_season_draft_listing_reservation before insert or update of status,rider_id on public.transfer_market_listings
for each row execute function public.guard_season_draft_reservation();

-- Keep the draft-specific resale lock even after a renewal or mutual release.
create function public.guard_season_draft_resale()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_team uuid;
begin
  select p.team_id into v_team from public.season_draft_participants p
  join public.season_draft_editions e on e.id=p.edition_id
  join public.seasons s on s.id=e.season_id and s.status='active'
  where p.selected_rider_id=new.rider_id and p.status='picked' limit 1;
  if not found then return new; end if;
  if tg_table_name='transfer_market_listings' then
    if new.status='open' then raise exception 'Un coureur drafté ne peut pas être revendu pendant cette saison.' using errcode='23514'; end if;
  elsif new.status in ('active','planned') and new.team_id<>v_team then
    raise exception 'Un coureur drafté ne peut pas changer d’équipe pendant cette saison.' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger ab_season_draft_contract_resale before insert or update of team_id,status on public.rider_contracts
for each row execute function public.guard_season_draft_resale();
create trigger ab_season_draft_listing_resale before insert or update of status,rider_id on public.transfer_market_listings
for each row execute function public.guard_season_draft_resale();

create function public.initialize_season_draft(p_edition_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_edition public.season_draft_editions%rowtype; v_cutoff timestamptz; v_count integer;
begin
  select * into v_edition from public.season_draft_editions where id=p_edition_id for update;
  if v_edition.initialized_at is not null or v_edition.status<>'scheduled' or now()<v_edition.opens_at then return; end if;
  if not exists(select 1 from public.seasons s where s.id=v_edition.season_id and s.status='active')
    or not exists(select 1 from public.season_rollover_settlements where target_season_id=v_edition.season_id) then return; end if;
  v_cutoff := v_edition.opens_at;
  insert into public.season_draft_participants(edition_id,team_id,sporting_director_id,position,
    team_name,director_name,previous_points,registered_at)
  select v_edition.id,ts.team_id,d.id,row_number() over(order by coalesce(previous.points,0),d.created_at,d.id),
    ts.display_name,d.display_name,coalesce(previous.points,0),d.created_at
  from public.team_seasons ts join public.teams t on t.id=ts.team_id and t.status='active'
  join public.team_manager_assignments a on a.team_id=ts.team_id and a.role='general_manager' and a.status='active'
  join public.sporting_directors d on d.id=a.sporting_director_id and d.status='active' and d.onboarding_completed
  left join public.team_seasons previous on previous.team_id=ts.team_id and previous.season_id=v_edition.previous_season_id
  where ts.season_id=v_edition.season_id and ts.status='active' and d.auth_user_id is not null
    and d.created_at<=v_cutoff
    and not exists(select 1 from public.alpha_bot_managers bot where bot.sporting_director_id=d.id or bot.auth_user_id=d.auth_user_id)
    and greatest(d.created_at,coalesce((select max(coalesce(activity.last_seen_at,
      activity.activity_on::timestamp at time zone 'Europe/Paris')) from public.player_daily_activity activity
      where activity.auth_user_id=d.auth_user_id and activity.activity_on >= (v_cutoff at time zone 'Europe/Paris')::date-7
        and activity.activity_on <= (v_cutoff at time zone 'Europe/Paris')::date),d.created_at)) > v_cutoff-interval '7 days';
  get diagnostics v_count = row_count;
  if v_count=0 then
    update public.season_draft_editions set status='completed',initialized_at=now(),closed_at=now(),version=version+1 where id=v_edition.id;
    return;
  end if;
  -- The all-information snapshot is confined to the selected pool, not the market.
  with candidates as materialized (
    select r.id,rt.age,r.potential_steps,
      public.calculate_season_draft_score(to_jsonb(rt),r.potential_steps,rt.age) score
    from public.riders r join public.rider_season_ratings rt on rt.rider_id=r.id and rt.season_id=v_edition.season_id
    where r.status='free_agent'
      and not exists(select 1 from public.rider_contracts rc where rc.rider_id=r.id and rc.status in ('active','planned'))
      and not exists(select 1 from public.transfer_market_listings l where l.rider_id=r.id and l.status='open')
    order by score desc,r.potential_steps desc,rt.age,r.id
    limit greatest(100,v_count) for update of r skip locked
  )
  insert into public.season_draft_riders(edition_id,rider_id,pool_rank,score,snapshot)
  select v_edition.id,candidate.id,row_number() over(order by candidate.score desc,candidate.potential_steps desc,candidate.age,candidate.id),candidate.score,
      jsonb_build_object('firstName',r.first_name,'lastName',r.last_name,'countryCode',c.iso_alpha2,
        'countryName',c.name,'age',rt.age,'potentialSteps',r.potential_steps,
        'avatarProfileKey',r.avatar_profile_key,'avatarSeed',r.avatar_seed::text,
        'heightCm',to_jsonb(r)->'height_cm','weightKg',to_jsonb(r)->'weight_kg',
        'careerRaceDays',coalesce((to_jsonb(r)->>'career_race_days')::integer,0),
        'ratings',jsonb_build_object('mountain',rt.mountain,'hills',rt.hills,'flat',rt.flat,'timeTrial',rt.time_trial,
          'cobbles',rt.cobbles,'sprint',rt.sprint,'acceleration',rt.acceleration,'downhill',rt.downhill,
          'endurance',rt.endurance,'resistance',rt.resistance,'recovery',rt.recovery,'breakaway',rt.breakaway,'prologue',rt.prologue),
        'abilities',coalesce((select jsonb_agg(a.ability_code order by a.ability_code) from public.rider_special_abilities a where a.rider_id=r.id),'[]'::jsonb),
        'injuryUntil',(select max(i.expected_recovery_at) from public.rider_injuries i where i.rider_id=r.id and i.status='active' and i.expected_recovery_at>now()))
    from candidates candidate join public.riders r on r.id=candidate.id
    join public.rider_season_ratings rt on rt.rider_id=r.id and rt.season_id=v_edition.season_id
    join public.countries c on c.id=r.country_id;
  -- Batch salary quotes once: never recalculate the whole salary population per rider.
  update public.season_draft_riders pool set salary_per_season=quote.salary_per_season
  from public.calculate_rider_season_salary_quotes((select array_agg(rider_id) from public.season_draft_riders where edition_id=v_edition.id),v_edition.season_id) quote
  where pool.edition_id=v_edition.id and pool.rider_id=quote.rider_id;
  update public.season_draft_editions set status='preparing',initialized_at=now(),participant_count=v_count,
    pool_count=(select count(*) from public.season_draft_riders where edition_id=v_edition.id),version=version+1 where id=v_edition.id;
  perform public.season_draft_message(v_edition.id,p.team_id,'opening','La draft est ouverte : préparez vos choix',
    'Vous choisissez en position '||p.position||'. Les sélections commencent à J1 à 14 h, heure de Paris. Préparez et validez votre liste : le premier coureur disponible sera recruté automatiquement à votre tour. Sans liste validée, vous aurez 5 minutes pour choisir, puis votre tour sera passé. Le salaire reste à la charge de l’équipe.')
  from public.season_draft_participants p where p.edition_id=v_edition.id;
end;
$$;

create function public.try_season_draft_pick(p_edition uuid,p_team uuid,p_rider uuid)
returns text language plpgsql security definer set search_path='' as $$
declare v_edition public.season_draft_editions%rowtype; v_pool public.season_draft_riders%rowtype;
  v_participant public.season_draft_participants%rowtype; v_ts uuid; v_year integer; v_contract uuid; v_salary numeric;
begin
  select * into v_edition from public.season_draft_editions where id=p_edition for update;
  select * into v_participant from public.season_draft_participants where edition_id=p_edition and team_id=p_team for update;
  if v_edition.status<>'running' or v_participant.status<>'pending' or v_participant.position<>v_edition.current_position
    or now()>=v_edition.pick_deadline then return 'not_turn'; end if;
  select * into v_pool from public.season_draft_riders where edition_id=p_edition and rider_id=p_rider for update;
  if not found or v_pool.selected_team_id is not null then return 'unavailable'; end if;
  if not exists(select 1 from public.team_manager_assignments a join public.sporting_directors d on d.id=a.sporting_director_id
    where a.team_id=p_team and a.sporting_director_id=v_participant.sporting_director_id and a.status='active' and a.role='general_manager' and d.status='active') then return 'inactive_team'; end if;
  select ts.id,s.game_year into v_ts,v_year from public.team_seasons ts
  join public.seasons s on s.id=ts.season_id and s.status='active'
  where ts.team_id=p_team and ts.season_id=v_edition.season_id and ts.status='active' for update of ts;
  if not found then return 'inactive_team'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('team-roster:'||p_team::text,0));
  perform 1 from public.riders where id=p_rider and status='free_agent' for update;
  if not found or exists(select 1 from public.rider_contracts where rider_id=p_rider and status in ('active','planned')) then return 'unavailable'; end if;
  if not public.can_team_reserve_roster_rider(p_team,v_year,p_rider) then return 'roster_full'; end if;
  -- Mirror the existing salary discounts, while retaining the normal insert triggers.
  v_salary := round(v_pool.salary_per_season*(1-.03*coalesce(public.get_team_specialization_power(p_team,'recruitment_data_room','deal_room'),0)),2);
  if public.is_team_homegrown_rider(p_team,p_rider) and exists(select 1 from public.rider_special_abilities where rider_id=p_rider and ability_code='homegrown') then v_salary:=round(v_salary/2,2); end if;
  if greatest(0,coalesce(public.get_projected_transfer_budget(v_ts),0)-coalesce(public.get_team_transfer_reserved_budget(p_team,null,null),0))<v_salary then return 'budget'; end if;
  update public.season_draft_riders set selected_team_id=p_team where edition_id=p_edition and rider_id=p_rider;
  insert into public.rider_contracts(rider_id,team_id,start_season_id,end_season_id,salary_per_season,
    currency,currency_code,status,signed_at,acquisition_type,transfer_locked_season_id,transfer_fee)
  values(p_rider,p_team,v_edition.season_id,v_edition.season_id,v_pool.salary_per_season,'EUR','EUR','active',now(),'season_draft',v_edition.season_id,0)
  returning id,salary_per_season into v_contract,v_salary;
  update public.riders set status='active' where id=p_rider;
  update public.season_draft_participants set status='picked',selected_rider_id=p_rider,selected_contract_id=v_contract,
    resolved_at=now(),resolution_reason='selected' where edition_id=p_edition and team_id=p_team;
  update public.season_draft_editions set current_position=null,pick_deadline=null,version=version+1 where id=p_edition;
  perform public.season_draft_message(p_edition,p_team,'result','Votre recrutement de draft est confirmé',
    (v_pool.snapshot->>'firstName')||' '||(v_pool.snapshot->>'lastName')||' rejoint votre équipe jusqu’à la fin de la saison. Aucune indemnité ni prime de signature. Salaire : '||v_salary||' € pour la saison. Revente interdite pendant cette saison.');
  return 'picked';
end;
$$;

create function public.advance_season_draft(p_edition uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_edition public.season_draft_editions%rowtype; v_player public.season_draft_participants%rowtype;
  v_rider uuid; v_result text; v_step integer; v_auto record;
begin
  select * into v_edition from public.season_draft_editions where id=p_edition for update;
  if v_edition.status not in ('preparing','running') or now()<v_edition.starts_at then return; end if;
  update public.season_draft_editions set status='running' where id=p_edition and status='preparing';
  -- Bounded bursts: large automatic lists never monopolise the database.
  for v_step in 1..10 loop
    select * into v_edition from public.season_draft_editions where id=p_edition;
    select * into v_player from public.season_draft_participants
    where edition_id=p_edition and status='pending' order by position limit 1 for update;
    if not found then
      update public.season_draft_editions set status='completed',closed_at=now(),current_position=null,pick_deadline=null,version=version+1 where id=p_edition;
      return;
    end if;
    if not exists(select 1 from public.season_draft_riders where edition_id=p_edition and selected_team_id is null) then
      update public.season_draft_participants set status='passed',resolved_at=now(),resolution_reason='pool_empty'
      where edition_id=p_edition and team_id=v_player.team_id;
      perform public.season_draft_message(p_edition,v_player.team_id,'result','Draft : aucun coureur disponible',
        'Le vivier est épuisé. Aucun recrutement ni prélèvement n’a été effectué.');
      update public.season_draft_editions set current_position=null,pick_deadline=null,version=version+1 where id=p_edition;
      continue;
    end if;
    if v_edition.current_position is distinct from v_player.position then
      update public.season_draft_editions set current_position=v_player.position,pick_deadline=now()+interval '5 minutes',version=version+1 where id=p_edition
      returning * into v_edition;
      perform public.season_draft_message(p_edition,v_player.team_id,'turn','Draft : c’est votre tour !',
        'Vous avez 5 minutes pour choisir votre coureur. Si votre sélection automatique est validée, le premier choix disponible et compatible est recruté sans attendre.');
    end if;
    v_result:=null;
    if v_player.auto_enabled and now()<v_edition.pick_deadline then
      select greatest(0,public.get_projected_transfer_budget(ts.id)-coalesce(public.get_team_transfer_reserved_budget(ts.team_id,null,null),0)) budget,
        coalesce(public.get_team_specialization_power(ts.team_id,'recruitment_data_room','deal_room'),0)*3 discount,
        public.get_team_roster_commitment_count(ts.team_id,v_edition.game_year)<public.get_team_roster_limit(ts.team_id) total_room,
        public.get_team_non_homegrown_roster_commitment_count(ts.team_id,v_edition.game_year)<public.get_team_roster_base_limit(ts.team_id) external_room
      into v_auto from public.team_seasons ts where ts.team_id=v_player.team_id and ts.season_id=v_edition.season_id;
      for v_rider in
        select pool.rider_id from unnest(v_player.preferences) with ordinality preference(rider_id,priority)
        join public.season_draft_riders pool on pool.edition_id=p_edition and pool.rider_id=preference.rider_id and pool.selected_team_id is null
        where v_auto.total_room and (v_auto.external_room or public.is_team_homegrown_rider(v_player.team_id,pool.rider_id))
          and round(round(pool.salary_per_season*(1-v_auto.discount/100),2) / case
            when public.is_team_homegrown_rider(v_player.team_id,pool.rider_id) and exists(select 1 from public.rider_special_abilities a where a.rider_id=pool.rider_id and a.ability_code='homegrown') then 2 else 1 end,2)<=v_auto.budget
        order by preference.priority
      loop
        v_result:=public.try_season_draft_pick(p_edition,v_player.team_id,v_rider);
        exit when v_result='picked';
        exit when v_result='inactive_team';
      end loop;
      if v_result='picked' then continue; end if;
    end if;
    if now()<v_edition.pick_deadline then return; end if;
    update public.season_draft_participants set status='passed',resolved_at=now(),resolution_reason='timeout'
    where edition_id=p_edition and team_id=v_player.team_id;
    perform public.season_draft_message(p_edition,v_player.team_id,'result','Draft : votre tour est terminé',
      'Le délai de 5 minutes est écoulé sans choix réalisable. Votre tour a été passé. Aucun recrutement ni prélèvement n’a été imposé.');
    update public.season_draft_editions set current_position=null,pick_deadline=null,version=version+1 where id=p_edition;
  end loop;
end;
$$;

create function public.process_season_draft()
returns void language plpgsql security definer set search_path='' set statement_timeout='8s' set lock_timeout='500ms' as $$
declare v_season public.seasons%rowtype; v_settings public.season_draft_settings%rowtype;
  v_edition public.season_draft_editions%rowtype; v_target_year integer; v_start date; v_previous uuid;
begin
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('season-draft-worker',0)) then return; end if;
  select * into v_settings from public.season_draft_settings where singleton;
  select * into v_season from public.seasons where status='active' limit 1;
  if v_season.id is null then return; end if;
  -- A suspended recurrence does not cancel a draft already opened.
  if v_settings.enabled and (now() at time zone 'Europe/Paris')::date in (v_season.starts_on,v_season.starts_on+27) then
    v_target_year:=v_season.game_year+case when (now() at time zone 'Europe/Paris')::date=v_season.starts_on+27 then 1 else 0 end;
    if v_target_year>=v_settings.first_game_year then
      v_start:=v_season.starts_on+case when v_target_year>v_season.game_year then 28 else 0 end;
      select id into v_previous from public.seasons where game_year=v_target_year-1;
      if v_previous is not null then
        insert into public.season_draft_editions(game_year,season_id,previous_season_id,announcement_at,opens_at,starts_at)
        values(v_target_year,(select id from public.seasons where game_year=v_target_year),v_previous,
          ((v_start-1)::timestamp at time zone 'Europe/Paris'),
          (v_start+time '08:00') at time zone 'Europe/Paris',(v_start+time '14:00') at time zone 'Europe/Paris')
        on conflict(game_year) do update set season_id=coalesce(season_draft_editions.season_id,excluded.season_id);
      end if;
    end if;
  end if;
  select * into v_edition from public.season_draft_editions
  where status in ('scheduled','preparing','running') and opens_at<=now() order by game_year limit 1 for update skip locked;
  if not found then return; end if;
  if v_edition.status='scheduled' and not v_settings.enabled then return; end if;
  if v_edition.season_id is null then
    update public.season_draft_editions set season_id=(select id from public.seasons where game_year=v_edition.game_year) where id=v_edition.id;
  end if;
  -- Never reopen a missed draft from an old season after a long outage.
  if v_edition.game_year<v_season.game_year then
    update public.season_draft_editions set status='cancelled',closed_at=now(),current_position=null,pick_deadline=null,version=version+1 where id=v_edition.id;
    return;
  end if;
  perform public.initialize_season_draft(v_edition.id);
  perform public.advance_season_draft(v_edition.id);
end;
$$;

create function public.save_current_season_draft_preferences(p_edition uuid,p_riders uuid[],p_auto boolean)
returns void language plpgsql security definer set search_path='' set lock_timeout='1s' set statement_timeout='6s' as $$
declare v_edition public.season_draft_editions%rowtype; v_player public.season_draft_participants%rowtype;
begin
  select * into v_edition from public.season_draft_editions where id=p_edition for update;
  select p.* into v_player from public.season_draft_participants p join public.sporting_directors d on d.id=p.sporting_director_id
  join public.team_manager_assignments a on a.team_id=p.team_id and a.sporting_director_id=d.id and a.role='general_manager' and a.status='active'
  where p.edition_id=p_edition and d.auth_user_id=auth.uid() and d.status='active' for update of p;
  if not found then raise exception 'Vous ne participez pas à cette draft.'; end if;
  if v_player.status<>'pending' or v_edition.status not in ('preparing','running') or now()<v_edition.opens_at
    or (v_edition.current_position=v_player.position and now()>=v_edition.pick_deadline) then raise exception 'Votre sélection ne peut plus être modifiée.'; end if;
  if p_riders is null or p_auto is null or cardinality(p_riders)>v_edition.pool_count
    or cardinality(p_riders)<>(select count(distinct rider) from unnest(p_riders) rider)
    or exists(select 1 from unnest(p_riders) rider where not exists(select 1 from public.season_draft_riders pool where pool.edition_id=p_edition and pool.rider_id=rider))
    or (p_auto and cardinality(p_riders)=0) then raise exception 'La liste de préférences est invalide.'; end if;
  update public.season_draft_participants set preferences=p_riders,auto_enabled=p_auto where edition_id=p_edition and team_id=v_player.team_id;
  perform public.advance_season_draft(p_edition);
end;
$$;

create function public.select_current_season_draft_rider(p_edition uuid,p_rider uuid default null,p_pass boolean default false)
returns void language plpgsql security definer set search_path='' set lock_timeout='1s' set statement_timeout='6s' as $$
declare v_edition public.season_draft_editions%rowtype; v_player public.season_draft_participants%rowtype; v_result text;
begin
  select * into v_edition from public.season_draft_editions where id=p_edition for update;
  select p.* into v_player from public.season_draft_participants p join public.sporting_directors d on d.id=p.sporting_director_id
  join public.team_manager_assignments a on a.team_id=p.team_id and a.sporting_director_id=d.id and a.role='general_manager' and a.status='active'
  where p.edition_id=p_edition and d.auth_user_id=auth.uid() and d.status='active' for update of p;
  if not found then raise exception 'Vous ne participez pas à cette draft.'; end if;
  if v_player.status<>'pending' then return; end if;
  if p_pass is null then raise exception 'Choix invalide.'; end if;
  if p_pass then
    if v_edition.status not in ('preparing','running') then raise exception 'La draft n’est pas ouverte.'; end if;
    update public.season_draft_participants set status='passed',resolved_at=now(),resolution_reason='voluntary' where edition_id=p_edition and team_id=v_player.team_id;
    if v_edition.current_position=v_player.position then
      update public.season_draft_editions set current_position=null,pick_deadline=null where id=p_edition;
    end if;
    perform public.season_draft_message(p_edition,v_player.team_id,'result','Votre renoncement à la draft est enregistré',
      'Vous avez choisi de passer votre tour. Aucun recrutement ni prélèvement n’a été effectué.');
  else
    if v_edition.status<>'running' or v_edition.current_position<>v_player.position or now()>=v_edition.pick_deadline then
      raise exception 'Ce n’est pas votre tour ou votre délai est écoulé.'; end if;
    v_result:=public.try_season_draft_pick(p_edition,v_player.team_id,p_rider);
    if v_result<>'picked' then
      raise exception '%',case v_result when 'budget' then 'La trésorerie projetée ne permet pas d’assumer ce salaire.'
        when 'roster_full' then 'Votre effectif est plein. Libérez une place avant de recruter.'
        when 'inactive_team' then 'Votre équipe n’est plus éligible.' else 'Ce coureur n’est plus disponible.' end;
    end if;
  end if;
  update public.season_draft_editions set version=version+1 where id=p_edition;
  perform public.advance_season_draft(p_edition);
end;
$$;

create function public.get_season_draft_view(p_full boolean default true)
returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='3s' as $$
declare v_edition public.season_draft_editions%rowtype; v_director uuid; v_season public.seasons%rowtype;
  v_settings public.season_draft_settings%rowtype; v_mine jsonb; v_queue jsonb; v_riders jsonb; v_finance jsonb;
begin
  select id into v_director from public.sporting_directors where auth_user_id=auth.uid() and status='active';
  if v_director is null then raise exception 'Connexion requise.'; end if;
  select * into v_season from public.seasons where status='active' limit 1;
  select * into v_settings from public.season_draft_settings where singleton;
  select * into v_edition from public.season_draft_editions
  where game_year>=v_season.game_year+case when (now() at time zone 'Europe/Paris')::date>=v_season.starts_on+27 then 1 else 0 end
  order by game_year limit 1;
  if not found then
    return jsonb_build_object('edition',null,'serverNow',now(),'firstGameYear',v_settings.first_game_year,'enabled',v_settings.enabled);
  end if;
  select jsonb_build_object('teamId',p.team_id,'position',p.position,'status',p.status,'preferences',p.preferences,
    'autoEnabled',p.auto_enabled,'reason',p.resolution_reason,'selectedRiderId',p.selected_rider_id) into v_mine
  from public.season_draft_participants p where edition_id=v_edition.id and sporting_director_id=v_director;
  if p_full then
    select coalesce(jsonb_agg(jsonb_build_object('teamId',p.team_id,'teamName',p.team_name,'directorName',p.director_name,
      'position',p.position,'previousPoints',p.previous_points,'status',p.status,'selectedRiderId',p.selected_rider_id,
      'selectedName',case when pool.rider_id is not null then (pool.snapshot->>'firstName')||' '||(pool.snapshot->>'lastName') end,
      'reason',p.resolution_reason) order by p.position),'[]'::jsonb) into v_queue
    from public.season_draft_participants p left join public.season_draft_riders pool on pool.edition_id=p.edition_id and pool.rider_id=p.selected_rider_id
    where p.edition_id=v_edition.id;
    if now()>=v_edition.opens_at then
      select coalesce(jsonb_agg(pool.snapshot||jsonb_build_object('id',pool.rider_id,'poolRank',pool.pool_rank,
        'score',pool.score,'salaryPerSeason',pool.salary_per_season,'selectedTeamId',pool.selected_team_id) order by pool.pool_rank),'[]'::jsonb)
      into v_riders from public.season_draft_riders pool where pool.edition_id=v_edition.id;
    end if;
    if v_mine is not null then
      select jsonb_build_object('budget',greatest(0,public.get_projected_transfer_budget(ts.id)-coalesce(public.get_team_transfer_reserved_budget(ts.team_id,null,null),0)),
        'rosterCount',public.get_team_roster_commitment_count(ts.team_id,v_edition.game_year),
        'rosterLimit',public.get_team_roster_limit(ts.team_id),
        'nonHomegrownCount',public.get_team_non_homegrown_roster_commitment_count(ts.team_id,v_edition.game_year),
        'nonHomegrownLimit',public.get_team_roster_base_limit(ts.team_id),
        'salaryDiscountPercent',3*coalesce(public.get_team_specialization_power(ts.team_id,'recruitment_data_room','deal_room'),0),
        'homegrownRiderIds',coalesce((select jsonb_agg(pool.rider_id) from public.season_draft_riders pool
          where pool.edition_id=v_edition.id and public.is_team_homegrown_rider(ts.team_id,pool.rider_id)),'[]'::jsonb)) into v_finance
      from public.team_seasons ts where ts.team_id=(v_mine->>'teamId')::uuid and ts.season_id=v_edition.season_id;
    end if;
  end if;
  return jsonb_build_object('serverNow',now(),'firstGameYear',v_settings.first_game_year,'enabled',v_settings.enabled,
    'edition',jsonb_build_object('id',v_edition.id,'gameYear',v_edition.game_year,'status',v_edition.status,
      'announcementAt',v_edition.announcement_at,'opensAt',v_edition.opens_at,'startsAt',v_edition.starts_at,
      'closedAt',v_edition.closed_at,'currentPosition',v_edition.current_position,'deadline',v_edition.pick_deadline,
      'participantCount',v_edition.participant_count,'poolCount',v_edition.pool_count,'version',v_edition.version),
    'mine',v_mine,'finance',v_finance,'participants',v_queue,'riders',v_riders);
end;
$$;

revoke all on function public.calculate_season_draft_score(jsonb,integer,integer),public.season_draft_message(uuid,uuid,text,text,text),
  public.guard_season_draft_reservation(),public.guard_season_draft_resale(),public.initialize_season_draft(uuid),
  public.try_season_draft_pick(uuid,uuid,uuid),public.advance_season_draft(uuid),public.process_season_draft(),
  public.save_current_season_draft_preferences(uuid,uuid[],boolean),public.select_current_season_draft_rider(uuid,uuid,boolean),
  public.get_season_draft_view(boolean) from public,anon,authenticated;
grant execute on function public.process_season_draft(),public.initialize_season_draft(uuid),public.advance_season_draft(uuid),
  public.calculate_season_draft_score(jsonb,integer,integer) to service_role;
grant execute on function public.get_season_draft_view(boolean),public.save_current_season_draft_preferences(uuid,uuid[],boolean),
  public.select_current_season_draft_rider(uuid,uuid,boolean) to authenticated;
select cron.schedule('season-opening-draft','* * * * *',$job$select public.process_season_draft();$job$);
notify pgrst,'reload schema';
commit;
