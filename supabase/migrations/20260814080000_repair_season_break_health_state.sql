begin;

-- Heal first: the fatigue-floor trigger keeps form at zero while an active
-- fatigue injury exists. The first implementation wrote the J1 condition
-- before closing injuries, so exhausted riders could not receive the break.
create or replace function public.apply_season_break_recovery(
  p_source_season_id uuid,
  p_target_season_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_game_year integer;
  v_target_game_year integer;
  v_target_day_id uuid;
  v_recovered_rider_count integer := 0;
  v_healed_injury_count integer := 0;
begin
  select season.game_year into v_source_game_year
  from public.seasons as season
  where season.id = p_source_season_id;

  select season.game_year into v_target_game_year
  from public.seasons as season
  where season.id = p_target_season_id;

  if v_source_game_year is null or v_target_game_year is null
    or v_target_game_year <> v_source_game_year + 1 then
    raise exception 'La récupération de trêve exige deux saisons consécutives.';
  end if;

  select day.id into v_target_day_id
  from public.season_days as day
  where day.season_id = p_target_season_id
    and day.day_number = 1;

  if v_target_day_id is null then
    raise exception 'Le premier jour de la saison cible est introuvable.';
  end if;

  update public.rider_injuries as injury
  set status = 'recovered',
    recovered_at = coalesce(injury.recovered_at, now()),
    updated_at = now()
  where injury.status = 'active'
    and exists (
      select 1
      from public.rider_season_ratings as rating
      where rating.rider_id = injury.rider_id
        and rating.season_id = p_target_season_id
    );
  get diagnostics v_healed_injury_count = row_count;

  with latest_source_conditions as (
    select distinct on (state.rider_id)
      state.rider_id,
      state.form
    from public.rider_condition_states as state
    join public.season_days as condition_day
      on condition_day.id = state.season_day_id
    where condition_day.season_id = p_source_season_id
    order by state.rider_id, condition_day.day_number desc, state.updated_at desc
  )
  insert into public.rider_condition_states (
    rider_id, season_day_id, form, fatigue, source
  )
  select
    rating.rider_id,
    v_target_day_id,
    least(
      100,
      round(
        coalesce(previous_condition.form, 75)
          + (100 - coalesce(previous_condition.form, 75)) * 0.5,
        2
      )
    ),
    0,
    'season_break'
  from public.rider_season_ratings as rating
  left join latest_source_conditions as previous_condition
    on previous_condition.rider_id = rating.rider_id
  where rating.season_id = p_target_season_id
  on conflict (rider_id, season_day_id) do update set
    form = excluded.form,
    fatigue = excluded.fatigue,
    source = excluded.source,
    updated_at = now();
  get diagnostics v_recovered_rider_count = row_count;

  return jsonb_build_object(
    'recoveredRiderCount', v_recovered_rider_count,
    'healedInjuryCount', v_healed_injury_count
  );
end;
$$;

-- Recovered injuries are historical records. They must neither block daily
-- recovery nor keep producing fracture penalties in a later season.
do $migration$
declare
  v_definition text;
  v_previous_definition text;
  v_match_count integer;
begin
  select pg_catalog.pg_get_functiondef(
    'public.settle_current_health_and_form()'::regprocedure
  ) into v_definition;

  if position(
    'where injury.rider_id = v_rider.id' || chr(10) ||
      '          and injury.status = ''active'''
    in v_definition
  ) = 0 then
    select count(*)::integer into v_match_count
    from pg_catalog.regexp_matches(
      v_definition,
      'where[[:space:]]+injury\.rider_id[[:space:]]*=[[:space:]]*v_rider\.id[[:space:]]+and[[:space:]]+injury\.started_at[[:space:]]*<',
      'gi'
    );
    if v_match_count <> 1 then
      raise exception
        'Le filtre médical quotidien correspond à % bloc(s), attendu: 1.',
        v_match_count;
    end if;

    v_previous_definition := v_definition;
    v_definition := pg_catalog.regexp_replace(
      v_definition,
      '(where[[:space:]]+injury\.rider_id[[:space:]]*=[[:space:]]*v_rider\.id[[:space:]]+)(and[[:space:]]+injury\.started_at[[:space:]]*<)',
      E'\\1and injury.status = ''active''\n          \\2',
      'i'
    );
    if v_definition = v_previous_definition then
      raise exception 'Impossible de filtrer les blessures quotidiennes guéries.';
    end if;
  end if;

  if position(
    'where injury.status = ''active''' || chr(10) ||
      '      and injury.form_loss_per_day > 0'
    in v_definition
  ) = 0 then
    select count(*)::integer into v_match_count
    from pg_catalog.regexp_matches(
      v_definition,
      'where[[:space:]]+injury\.form_loss_per_day[[:space:]]*>[[:space:]]*0[[:space:]]+and[[:space:]]+injury\.started_at[[:space:]]*<=[[:space:]]*now\(\)',
      'gi'
    );
    if v_match_count <> 1 then
      raise exception
        'Le filtre des pénalités médicales correspond à % bloc(s), attendu: 1.',
        v_match_count;
    end if;

    v_previous_definition := v_definition;
    v_definition := pg_catalog.regexp_replace(
      v_definition,
      '(where[[:space:]]+)(injury\.form_loss_per_day[[:space:]]*>[[:space:]]*0[[:space:]]+and[[:space:]]+injury\.started_at[[:space:]]*<=[[:space:]]*now\(\))',
      E'\\1injury.status = ''active''\n      and \\2',
      'i'
    );
    if v_definition = v_previous_definition then
      raise exception 'Impossible de filtrer les pénalités des blessures guéries.';
    end if;
  end if;

  execute v_definition;
end;
$migration$;

-- One-time, tightly scoped repair of the rollover that opened the active
-- season. It touches only untouched J1 break rows clamped at zero and removes
-- penalties produced after the rollover by injuries already marked recovered.
do $repair$
declare
  v_source_season_id uuid;
  v_target_season_id uuid;
  v_target_day_id uuid;
  v_settled_at timestamptz;
begin
  select settlement.source_season_id,
    settlement.target_season_id,
    settlement.settled_at
  into v_source_season_id, v_target_season_id, v_settled_at
  from public.season_rollover_settlements as settlement
  join public.seasons as target_season
    on target_season.id = settlement.target_season_id
   and target_season.status = 'active'
  order by settlement.settled_at desc
  limit 1;

  if v_source_season_id is null then
    return;
  end if;

  select day.id into v_target_day_id
  from public.season_days as day
  where day.season_id = v_target_season_id
    and day.day_number = 1;

  update public.rider_injuries as injury
  set status = 'recovered',
    recovered_at = coalesce(injury.recovered_at, v_settled_at),
    updated_at = now()
  where injury.status = 'active'
    and exists (
      select 1
      from public.rider_season_ratings as rating
      where rating.rider_id = injury.rider_id
        and rating.season_id = v_target_season_id
    );

  with latest_source_conditions as (
    select distinct on (state.rider_id)
      state.rider_id,
      state.form
    from public.rider_condition_states as state
    join public.season_days as condition_day
      on condition_day.id = state.season_day_id
    where condition_day.season_id = v_source_season_id
    order by state.rider_id, condition_day.day_number desc, state.updated_at desc
  )
  update public.rider_condition_states as target_state
  set form = least(
      100,
      round(
        source_state.form + (100 - source_state.form) * 0.5,
        2
      )
    ),
    fatigue = 0,
    source = 'season_break',
    updated_at = now()
  from latest_source_conditions as source_state
  where target_state.rider_id = source_state.rider_id
    and target_state.season_day_id = v_target_day_id
    and target_state.source = 'season_break'
    and target_state.form = 0
    and source_state.form = 0
    and target_state.updated_at <= v_settled_at;

  with stale_penalties as (
    select effect.rider_id,
      sum(effect.form_delta) as total_delta
    from public.rider_injury_form_effects as effect
    join public.rider_injuries as injury
      on injury.id = effect.rider_injury_id
    where effect.season_day_id = v_target_day_id
      and effect.applied_at >= v_settled_at
      and injury.status = 'recovered'
      and injury.recovered_at <= effect.applied_at
    group by effect.rider_id
  )
  update public.rider_condition_states as target_state
  set form = greatest(
      0,
      least(100, target_state.form - stale_penalty.total_delta)
    ),
    source = 'season_break',
    updated_at = now()
  from stale_penalties as stale_penalty
  where target_state.rider_id = stale_penalty.rider_id
    and target_state.season_day_id = v_target_day_id
    and target_state.source = 'injury';

  delete from public.rider_injury_form_effects as effect
  using public.rider_injuries as injury
  where injury.id = effect.rider_injury_id
    and effect.season_day_id = v_target_day_id
    and effect.applied_at >= v_settled_at
    and injury.status = 'recovered'
    and injury.recovered_at <= effect.applied_at;
end;
$repair$;

revoke all on function public.apply_season_break_recovery(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.apply_season_break_recovery(uuid, uuid)
  to service_role;

comment on function public.apply_season_break_recovery(uuid, uuid) is
  'Guérit d abord les blessures, récupère 50 % de la forme manquante et annule la fatigue lors du passage à la saison suivante.';

commit;
