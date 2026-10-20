begin;

set local lock_timeout = '3s';
set local statement_timeout = '8s';
set local application_name = 'cyclostratege-preparation-rebalance-20261020';

-- New preparations only. Existing bonuses, dates and official race snapshots
-- retain their original values; no rider rating is permanently modified.
create or replace function public.get_performance_preparation_policy(
  p_level integer
)
returns table (
  rating_bonus numeric,
  bonus_days integer,
  capacity integer
)
language sql
immutable
set search_path = ''
as $$
  select policy.rating_bonus, policy.bonus_days, policy.capacity
  from (values
    (1, 1.0::numeric, 3, 1),
    (2, 1.5::numeric, 4, 1),
    (3, 2.0::numeric, 4, 2),
    (4, 2.5::numeric, 5, 2),
    (5, 3.0::numeric, 6, 3)
  ) as policy(level, rating_bonus, bonus_days, capacity)
  where policy.level = p_level;
$$;

-- Capacity is now checked under a lock on the team's facility instead of a
-- unique slot. Keep the same selective access path for the occupancy count.
drop index if exists public.rider_performance_preparations_facility_active_idx;
create index if not exists rider_performance_preparations_facility_planned_idx
  on public.rider_performance_preparations(team_id, preparation_type)
  where status = 'planned';

create or replace function public.start_current_team_rider_performance_preparation(
  p_rider_id uuid,
  p_preparation_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
set lock_timeout = '3s'
as $$
declare
  v_context record;
  v_policy record;
  v_level integer;
  v_game_day integer;
  v_bonus_start integer;
  v_bonus_end integer;
  v_bonus numeric;
  v_occupied integer;
  v_camp uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;
  if p_rider_id is null or p_preparation_type is null
    or p_preparation_type not in ('indoor_track', 'wind_tunnel')
  then
    raise exception 'Type de préparation invalide.';
  end if;

  perform public.sync_active_season_day();
  select
    assignment.team_id,
    season.id as season_id,
    season.game_year,
    season.current_day_number,
    team_season.id as team_season_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;
  if not found then
    raise exception 'Aucune équipe active.';
  end if;
  if v_context.current_day_number > 26 then
    raise exception 'Cette préparation de deux jours doit commencer avant la fin de la saison.';
  end if;
  v_game_day := v_context.game_year * 28 + v_context.current_day_number - 1;

  -- Free only this team's due slots. Do not settle every team's preparations
  -- when one sporting director submits a request.
  update public.rider_performance_preparations as preparation
  set status = 'completed'
  where preparation.team_id = v_context.team_id
    and preparation.status = 'planned'
    and preparation.preparation_end_game_day < v_game_day;

  -- Always acquire rider then facility. The rider lock prevents simultaneous
  -- indoor/wind-tunnel camps; the facility lock serializes its capacity check.
  perform 1
  from public.riders as rider
  where rider.id = p_rider_id
    and exists (
      select 1 from public.rider_contracts as contract
      where contract.rider_id = rider.id
        and contract.team_id = v_context.team_id
        and contract.status = 'active'
    )
  for update;
  if not found or not exists (
    select 1
    from public.rider_contracts as contract
    where contract.rider_id = p_rider_id
      and contract.team_id = v_context.team_id
      and contract.status = 'active'
  ) then
    raise exception 'Ce coureur n’appartient pas à votre équipe.';
  end if;

  select infrastructure.level
  into v_level
  from public.team_infrastructures as infrastructure
  where infrastructure.team_id = v_context.team_id
    and infrastructure.infrastructure_code = p_preparation_type
  for update;
  if not found or v_level < 1 then
    if p_preparation_type = 'indoor_track' then
      raise exception 'Construisez d’abord la Piste indoor.';
    else
      raise exception 'Construisez d’abord la Soufflerie.';
    end if;
  end if;

  select policy.rating_bonus, policy.bonus_days, policy.capacity
  into v_policy
  from public.get_performance_preparation_policy(v_level) as policy;
  if not found then
    raise exception 'Niveau d’installation invalide.';
  end if;
  v_bonus := least(3.3, greatest(1, round(
    v_policy.rating_bonus
      * public.get_team_infrastructure_efficiency_multiplier(
        v_context.team_id,
        p_preparation_type
      ),
    2
  )));
  v_bonus_start := v_game_day + 3;
  v_bonus_end := v_game_day + 2 + v_policy.bonus_days;

  if exists (
    select 1 from public.rider_injuries as injury
    where injury.rider_id = p_rider_id and injury.status <> 'recovered'
  ) then
    raise exception 'Ce coureur est actuellement blessé.';
  end if;
  if exists (
    select 1 from public.rider_form_camps as camp
    where camp.rider_id = p_rider_id
      and camp.season_id = v_context.season_id
      and camp.status <> 'cancelled'
      and camp.start_day_number <= v_context.current_day_number + 2
      and camp.end_day_number >= v_context.current_day_number + 1
  ) then
    raise exception 'Ce coureur est déjà indisponible pendant cette période.';
  end if;
  if exists (
    select 1
    from public.race_rosters as roster
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
     and registration.status = 'accepted'
    join public.stages as stage
      on stage.race_edition_id = registration.race_edition_id
    join public.season_days as day on day.id = stage.season_day_id
    where roster.rider_id = p_rider_id
      and day.season_id = v_context.season_id
      and day.day_number between v_context.current_day_number + 1
        and v_context.current_day_number + 2
  ) then
    raise exception 'Ce coureur est engagé en course pendant cette préparation.';
  end if;

  -- A transfer must not allow stacking two bonuses of the same type. Distinct
  -- types may still coexist once their preparation camps no longer overlap.
  if exists (
    select 1 from public.rider_performance_preparations as preparation
    where preparation.rider_id = p_rider_id
      and preparation.preparation_type = p_preparation_type
      and preparation.status <> 'cancelled'
      and preparation.bonus_start_game_day <= v_bonus_end
      and preparation.bonus_end_game_day >= v_bonus_start
  ) then
    raise exception 'Ce coureur bénéficie déjà d’une préparation de ce type sur cette période.';
  end if;

  select count(*)::integer
  into v_occupied
  from public.rider_performance_preparations as preparation
  where preparation.team_id = v_context.team_id
    and preparation.preparation_type = p_preparation_type
    and preparation.status = 'planned';
  if v_occupied >= v_policy.capacity then
    raise exception 'Toutes les places de cette installation sont occupées (%/%).',
      v_occupied, v_policy.capacity;
  end if;

  insert into public.rider_form_camps (
    rider_id, team_season_id, season_id, camp_type,
    start_day_number, end_day_number, form_gain_per_day, price_per_day, total_price
  ) values (
    p_rider_id, v_context.team_season_id, v_context.season_id,
    case when p_preparation_type = 'indoor_track'
      then 'indoor_preparation' else 'wind_tunnel_preparation' end,
    v_context.current_day_number + 1, v_context.current_day_number + 2, 0, 0, 0
  ) returning id into v_camp;

  insert into public.rider_performance_preparations (
    team_id, team_season_id, season_id, rider_id, form_camp_id,
    preparation_type, building_level, preparation_start_game_day,
    preparation_end_game_day, bonus_start_game_day, bonus_end_game_day, rating_bonus
  ) values (
    v_context.team_id, v_context.team_season_id, v_context.season_id,
    p_rider_id, v_camp, p_preparation_type, v_level,
    v_game_day + 1, v_game_day + 2, v_bonus_start, v_bonus_end, v_bonus
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.get_performance_preparation_policy(integer)
  from public, anon;
grant execute on function public.get_performance_preparation_policy(integer)
  to authenticated, service_role;
revoke all on function public.start_current_team_rider_performance_preparation(uuid, text)
  from public, anon;
grant execute on function public.start_current_team_rider_performance_preparation(uuid, text)
  to authenticated, service_role;

comment on function public.get_performance_preparation_policy(integer) is
  'Nouveaux stages piste/soufflerie : bonus 1/1,5/2/2,5/3, durée 3/4/4/5/6 jours, capacité 1/1/2/2/3 selon le niveau.';
comment on function public.start_current_team_rider_performance_preparation(uuid, text) is
  'Préparation gratuite de deux jours, capacité sérialisée, efficacité architecte et interdiction des bonus de même type qui se chevauchent. Aucun changement rétroactif.';

commit;
