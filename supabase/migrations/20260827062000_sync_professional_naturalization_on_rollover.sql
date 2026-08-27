begin;

-- Professional naturalization is country-bound. When a new season activates,
-- a continuing rider must stop accumulating for the previous sponsor country
-- and start (or resume) the counter for the new team country at J1. Recruits
-- signed during the current season use their real contract joining day.
create or replace function public.sync_active_professional_naturalization_progress(
  p_season_id uuid,
  p_previous_season_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season public.seasons%rowtype;
  v_previous_season_id uuid;
  v_synced integer := 0;
begin
  select *
  into v_season
  from public.seasons as season
  where season.id = p_season_id;

  if v_season.id is null then
    return 0;
  end if;

  v_previous_season_id := p_previous_season_id;
  if v_previous_season_id is null then
    select season.id
    into v_previous_season_id
    from public.seasons as season
    where season.game_year = v_season.game_year - 1
    limit 1;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'professional-naturalization-season:' || p_season_id::text,
      0
    )
  );

  -- Freeze a counter that still targets another country at the exact boundary
  -- where the rider started representing the current team country.
  with rider_context as (
    select distinct on (rider.id)
      rider.id as rider_id,
      rider.country_id as rider_country_id,
      team_season.registration_country_id as target_country_id,
      case
        when contract.start_season_id = v_season.id then v_season.id
        else coalesce(v_previous_season_id, v_season.id)
      end as cutoff_season_id,
      case
        when contract.start_season_id = v_season.id
          then coalesce(contract.joined_day_number, 1)
        when v_previous_season_id is not null then 28
        else 1
      end as cutoff_day_number
    from public.rider_contracts as contract
    join public.riders as rider
      on rider.id = contract.rider_id
     and rider.status = 'active'
    join public.team_seasons as team_season
      on team_season.team_id = contract.team_id
     and team_season.season_id = v_season.id
     and team_season.status = 'active'
    where contract.status = 'active'
    order by rider.id, contract.signed_at desc nulls last,
      contract.created_at desc
  )
  update public.rider_naturalization_country_progress as progress
  set accumulated_days = greatest(
        progress.accumulated_days,
        coalesce(
          public.get_rider_country_progress_days(
            progress.rider_id,
            progress.country_id,
            context.cutoff_season_id,
            context.cutoff_day_number
          ),
          progress.accumulated_days
        )
      ),
      active_since_season_id = null,
      active_since_day_number = null,
      updated_at = now()
  from rider_context as context
  where progress.rider_id = context.rider_id
    and progress.active_since_season_id is not null
    and (
      progress.country_id <> context.target_country_id
      or context.rider_country_id = context.target_country_id
      or exists (
        select 1
        from public.rider_national_championship_titles as title
        where title.rider_id = context.rider_id
          and title.championship_type in ('road', 'time_trial')
      )
    );

  -- Start or resume the relevant country without overwriting a counter that is
  -- already correctly running across multiple seasons.
  with rider_context as (
    select distinct on (rider.id)
      rider.id as rider_id,
      rider.country_id as rider_country_id,
      contract.team_id,
      team_season.registration_country_id as target_country_id,
      case
        when contract.start_season_id = v_season.id
          then coalesce(contract.joined_day_number, 1)
        else 1
      end as start_day_number
    from public.rider_contracts as contract
    join public.riders as rider
      on rider.id = contract.rider_id
     and rider.status = 'active'
    join public.team_seasons as team_season
      on team_season.team_id = contract.team_id
     and team_season.season_id = v_season.id
     and team_season.status = 'active'
    where contract.status = 'active'
    order by rider.id, contract.signed_at desc nulls last,
      contract.created_at desc
  ), eligible as (
    select context.*
    from rider_context as context
    where context.rider_country_id <> context.target_country_id
      and not exists (
        select 1
        from public.rider_national_championship_titles as title
        where title.rider_id = context.rider_id
          and title.championship_type in ('road', 'time_trial')
      )
      and not exists (
        select 1
        from public.rider_naturalization_country_progress as running
        where running.rider_id = context.rider_id
          and running.country_id = context.target_country_id
          and running.active_since_season_id is not null
      )
  )
  insert into public.rider_naturalization_country_progress as progress (
    rider_id,
    country_id,
    accumulated_days,
    active_since_season_id,
    active_since_day_number,
    last_team_id,
    updated_at
  )
  select
    eligible.rider_id,
    eligible.target_country_id,
    0,
    v_season.id,
    least(28, greatest(1, eligible.start_day_number)),
    eligible.team_id,
    now()
  from eligible
  on conflict (rider_id, country_id) do update
  set active_since_season_id = excluded.active_since_season_id,
      active_since_day_number = excluded.active_since_day_number,
      last_team_id = excluded.last_team_id,
      updated_at = now();

  get diagnostics v_synced = row_count;
  return v_synced;
end;
$$;

-- Keep contract lifecycle behaviour and add the missing rollover synchronization
-- after planned contracts have been activated.
create or replace function public.settle_expiring_rider_contracts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_season_id uuid;
begin
  if new.status = 'completed' and old.status <> 'completed' then
    update public.rider_contracts as contract
    set status = 'completed'
    where contract.end_season_id = new.id
      and contract.status = 'active';

    update public.riders as rider
    set status = 'free_agent'
    where rider.status <> 'retired'
      and exists (
        select 1
        from public.rider_contracts as expired_contract
        where expired_contract.rider_id = rider.id
          and expired_contract.end_season_id = new.id
          and expired_contract.status = 'completed'
      )
      and not exists (
        select 1
        from public.rider_contracts as successor
        where successor.rider_id = rider.id
          and successor.status in ('active', 'planned')
      );
  end if;

  if new.status = 'active' and old.status <> 'active' then
    update public.rider_contracts as contract
    set status = 'active'
    where contract.start_season_id = new.id
      and contract.status = 'planned';

    update public.riders as rider
    set status = 'active'
    where exists (
      select 1
      from public.rider_contracts as contract
      where contract.rider_id = rider.id
        and contract.start_season_id = new.id
        and contract.status = 'active'
    );

    select season.id
    into v_previous_season_id
    from public.seasons as season
    where season.game_year = new.game_year - 1
    limit 1;

    perform public.sync_active_professional_naturalization_progress(
      new.id,
      v_previous_season_id
    );
  end if;

  return new;
end;
$$;

revoke all on function public.sync_active_professional_naturalization_progress(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.sync_active_professional_naturalization_progress(uuid, uuid)
  to service_role;
revoke all on function public.settle_expiring_rider_contracts()
  from public, anon, authenticated;

-- Repair the active season now. This is idempotent and preserves every paused
-- per-country counter as well as infrastructure-specific duration overrides.
do $repair$
declare
  v_active_season_id uuid;
  v_previous_season_id uuid;
  v_game_year integer;
begin
  select season.id, season.game_year
  into v_active_season_id, v_game_year
  from public.seasons as season
  where season.status = 'active'
  order by season.game_year desc
  limit 1;

  if v_active_season_id is null then
    return;
  end if;

  select season.id
  into v_previous_season_id
  from public.seasons as season
  where season.game_year = v_game_year - 1
  limit 1;

  perform public.sync_active_professional_naturalization_progress(
    v_active_season_id,
    v_previous_season_id
  );
end;
$repair$;

notify pgrst, 'reload schema';

commit;
