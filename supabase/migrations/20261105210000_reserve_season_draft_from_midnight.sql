begin;
set local lock_timeout='1s';
set local statement_timeout='8s';
set local application_name='cyclostratege-draft-midnight-20261105';

-- Reservation is distinct from the 08h participant/preference opening.
alter table public.season_draft_editions add column pool_reserved_at timestamptz;

create function public.reserve_season_draft_pool(p_edition_id uuid,p_minimum integer default 100)
returns void language plpgsql security definer set search_path='' set lock_timeout='500ms' set statement_timeout='6s' as $$
declare v_edition public.season_draft_editions%rowtype; v_limit integer; v_existing integer;
begin
  select * into v_edition from public.season_draft_editions where id=p_edition_id for update;
  if not found or v_edition.status<>'scheduled' or v_edition.initialized_at is not null then return; end if;
  if not exists(select 1 from public.seasons s where s.id=v_edition.season_id and s.status='active'
      and clock_timestamp()>=(s.starts_on::timestamp at time zone 'Europe/Paris'))
    or not exists(select 1 from public.season_rollover_settlements where target_season_id=v_edition.season_id) then return; end if;
  if v_edition.pool_reserved_at is null and not exists(select 1 from public.season_draft_settings
      where singleton and enabled and first_game_year<=v_edition.game_year) then return; end if;
  -- Known eligible humans form the initial upper bound; newcomers can only
  -- append additional riders at 08h, never replace or reorder the frozen pool.
  select greatest(100,coalesce(p_minimum,100),count(distinct d.id)::integer) into v_limit
  from public.team_seasons ts join public.teams t on t.id=ts.team_id and t.status='active'
  join public.team_manager_assignments a on a.team_id=ts.team_id and a.role='general_manager' and a.status='active'
  join public.sporting_directors d on d.id=a.sporting_director_id and d.status='active' and d.onboarding_completed
  where ts.season_id=v_edition.season_id and ts.status='active' and d.auth_user_id is not null and d.created_at<=v_edition.opens_at
    and not exists(select 1 from public.alpha_bot_managers bot where bot.sporting_director_id=d.id or bot.auth_user_id=d.auth_user_id)
    and greatest(d.created_at,coalesce((select max(coalesce(activity.last_seen_at,
      activity.activity_on::timestamp at time zone 'Europe/Paris')) from public.player_daily_activity activity
      where activity.auth_user_id=d.auth_user_id and activity.activity_on>=(v_edition.opens_at at time zone 'Europe/Paris')::date-7
        and activity.activity_on<=(v_edition.opens_at at time zone 'Europe/Paris')::date),d.created_at))>v_edition.opens_at-interval '7 days';
  select count(*)::integer into v_existing from public.season_draft_riders where edition_id=v_edition.id;
  if v_edition.pool_reserved_at is not null and v_existing>=v_limit then return; end if;
  -- The all-information snapshot is confined to the selected pool, not the market.
  with candidates as materialized (
    select r.id,rt.age,r.potential_steps,
      public.calculate_season_draft_score(to_jsonb(rt),r.potential_steps,rt.age) score
    from public.riders r join public.rider_season_ratings rt on rt.rider_id=r.id and rt.season_id=v_edition.season_id
    where r.status='free_agent'
      and not exists(select 1 from public.rider_contracts rc where rc.rider_id=r.id and rc.status in ('active','planned'))
      and not exists(select 1 from public.transfer_market_listings l where l.rider_id=r.id and l.status='open')
      and not exists(select 1 from public.season_draft_riders p where p.edition_id=v_edition.id and p.rider_id=r.id)
    order by score desc,r.potential_steps desc,rt.age,r.id
    limit greatest(0,v_limit-v_existing) for update of r
  )
  insert into public.season_draft_riders(edition_id,rider_id,pool_rank,score,snapshot)
  select v_edition.id,candidate.id,v_existing+row_number() over(order by candidate.score desc,candidate.potential_steps desc,candidate.age,candidate.id),candidate.score,
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

  update public.season_draft_editions set pool_reserved_at=coalesce(pool_reserved_at,clock_timestamp()),
    pool_count=(select count(*) from public.season_draft_riders where edition_id=v_edition.id),version=version+1 where id=v_edition.id;
end;
$$;

-- The receipt is written last by rollover_game_season: ratings, released
-- riders, promotions and invariants are complete, but nothing is committed yet.
create function public.reserve_season_draft_on_rollover()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_season public.seasons%rowtype; v_previous uuid; v_edition uuid;
begin
  select * into v_season from public.seasons where id=new.target_season_id and status='active';
  if not found or clock_timestamp()<(v_season.starts_on::timestamp at time zone 'Europe/Paris')
    or not exists(select 1 from public.season_draft_settings where singleton and enabled and first_game_year<=v_season.game_year) then return new; end if;
  select id into v_previous from public.seasons where game_year=v_season.game_year-1;
  if v_previous is null then return new; end if;
  insert into public.season_draft_editions(game_year,season_id,previous_season_id,announcement_at,opens_at,starts_at)
  values(v_season.game_year,v_season.id,v_previous,
    ((v_season.starts_on-1)::timestamp at time zone 'Europe/Paris'),
    (v_season.starts_on+time '08:00') at time zone 'Europe/Paris',(v_season.starts_on+time '14:00') at time zone 'Europe/Paris')
  on conflict(game_year) do update set season_id=coalesce(season_draft_editions.season_id,excluded.season_id)
  returning id into v_edition;
  perform public.reserve_season_draft_pool(v_edition,100);
  return new;
end;
$$;
create trigger season_draft_reserve_on_rollover after insert on public.season_rollover_settlements
for each row execute function public.reserve_season_draft_on_rollover();

create or replace function public.guard_season_draft_reservation()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_reservation record; v_rider_status text;
begin
  if tg_table_name='rider_contracts' then
    if new.status not in ('active','planned') then return new; end if;
    if tg_op='UPDATE' and new.rider_id=old.rider_id and new.team_id=old.team_id and old.status in ('active','planned') then return new; end if;
  elsif new.status<>'open' then return new; end if;
  -- Always lock before checking a pool: a transaction waiting on rollover
  -- must see its newly committed reservation, not an earlier empty snapshot.
  select status into v_rider_status from public.riders where id=new.rider_id for update;
  select pool.selected_team_id,edition.season_id into v_reservation
  from public.season_draft_riders pool join public.season_draft_editions edition on edition.id=pool.edition_id
  where pool.rider_id=new.rider_id and (edition.status in ('preparing','running')
    or (edition.status='scheduled' and edition.pool_reserved_at is not null)) limit 1;
  if found then
    if tg_table_name='rider_contracts' then
      if new.acquisition_type='season_draft' and new.team_id=v_reservation.selected_team_id
        and new.start_season_id=v_reservation.season_id and new.end_season_id=v_reservation.season_id then return new; end if;
    end if;
    raise exception 'Ce coureur est réservé à la draft de début de saison.' using errcode='23514';
  end if;
  -- Backstop only the short window before a due midnight pool is ready.
  -- Existing engagements/renewals and internally generated/promoted riders
  -- must remain usable by rollover itself.
  if v_rider_status='free_agent' and exists(
    select 1 from public.seasons s cross join public.season_draft_settings cfg
    left join public.season_draft_editions e on e.game_year=s.game_year
    where s.status in ('active','planned') and cfg.singleton and cfg.enabled and s.game_year>=cfg.first_game_year
      and s.starts_on=(clock_timestamp() at time zone 'Europe/Paris')::date
      and coalesce(e.status,'scheduled')='scheduled' and e.pool_reserved_at is null
  ) then
    if tg_table_name='rider_contracts' then
      if new.acquisition_type in ('initial','academy') or exists(select 1 from public.rider_contracts rc
        where rc.rider_id=new.rider_id and rc.team_id=new.team_id and rc.status in ('active','planned')) then return new; end if;
    end if;
    raise exception 'Le vivier de la draft est en cours de réservation. Réessayez dans quelques instants.' using errcode='23514';
  end if;
  return new;
end;
$$;

drop trigger aa_season_draft_contract_reservation on public.rider_contracts;
create trigger aa_season_draft_contract_reservation before insert or update of rider_id,team_id,status on public.rider_contracts
for each row execute function public.guard_season_draft_reservation();

create or replace function public.initialize_season_draft(p_edition_id uuid)
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
  perform public.reserve_season_draft_pool(v_edition.id,v_count);
  -- Reveal current 08h details without replacing midnight IDs, scores or ranks.
  update public.season_draft_riders pool set snapshot=jsonb_build_object('firstName',r.first_name,'lastName',r.last_name,'countryCode',c.iso_alpha2,
        'countryName',c.name,'age',rt.age,'potentialSteps',r.potential_steps,
        'avatarProfileKey',r.avatar_profile_key,'avatarSeed',r.avatar_seed::text,
        'heightCm',to_jsonb(r)->'height_cm','weightKg',to_jsonb(r)->'weight_kg',
        'careerRaceDays',coalesce((to_jsonb(r)->>'career_race_days')::integer,0),
        'ratings',jsonb_build_object('mountain',rt.mountain,'hills',rt.hills,'flat',rt.flat,'timeTrial',rt.time_trial,
          'cobbles',rt.cobbles,'sprint',rt.sprint,'acceleration',rt.acceleration,'downhill',rt.downhill,
          'endurance',rt.endurance,'resistance',rt.resistance,'recovery',rt.recovery,'breakaway',rt.breakaway,'prologue',rt.prologue),
        'abilities',coalesce((select jsonb_agg(a.ability_code order by a.ability_code) from public.rider_special_abilities a where a.rider_id=r.id),'[]'::jsonb),
        'injuryUntil',(select max(i.expected_recovery_at) from public.rider_injuries i where i.rider_id=r.id and i.status='active' and i.expected_recovery_at>now()))
  from public.riders r join public.rider_season_ratings rt on rt.rider_id=r.id and rt.season_id=v_edition.season_id
  join public.countries c on c.id=r.country_id
  where pool.edition_id=v_edition.id and pool.rider_id=r.id;
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

create or replace function public.process_season_draft()
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
  where status in ('scheduled','preparing','running') and (((opens_at at time zone 'Europe/Paris')::date)::timestamp at time zone 'Europe/Paris')<=now() order by game_year limit 1 for update skip locked;
  if not found then return; end if;
  if v_edition.status='scheduled' and not v_settings.enabled and v_edition.pool_reserved_at is null then return; end if;
  if v_edition.season_id is null then
    update public.season_draft_editions set season_id=(select id from public.seasons where game_year=v_edition.game_year) where id=v_edition.id;
  end if;
  -- Never reopen a missed draft from an old season after a long outage.
  if v_edition.game_year<v_season.game_year then
    update public.season_draft_editions set status='cancelled',closed_at=now(),current_position=null,pick_deadline=null,version=version+1 where id=v_edition.id;
    return;
  end if;
  perform public.reserve_season_draft_pool(v_edition.id,100);
  perform public.initialize_season_draft(v_edition.id);
  perform public.advance_season_draft(v_edition.id);
end;
$$;

revoke all on function public.reserve_season_draft_pool(uuid,integer),public.reserve_season_draft_on_rollover() from public,anon,authenticated;
grant execute on function public.reserve_season_draft_pool(uuid,integer) to service_role;
commit;
