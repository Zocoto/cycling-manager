begin;

-- La trêve restitue la moitié de la forme manquante, remet la fatigue à zéro
-- et clôt toutes les blessures des coureurs présents dans la saison suivante.
-- Le calcul part toujours du dernier état de la saison source : la fonction
-- reste donc idempotente si une transition est rejouée dans la transaction.
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

  return jsonb_build_object(
    'recoveredRiderCount', v_recovered_rider_count,
    'healedInjuryCount', v_healed_injury_count
  );
end;
$$;

-- Le rollover atomique est déjà en production. On remplace uniquement son
-- ancien reset uniforme à 75 par l'appel à la règle de trêve ci-dessus.
do $migration$
declare
  v_definition text;
  v_old_block text := $old$
  insert into public.rider_condition_states (
    rider_id, season_day_id, form, fatigue, source
  )
  select rating.rider_id, day.id, 75, 0, 'season_rollover'
  from public.rider_season_ratings as rating
  join public.season_days as day
    on day.season_id = v_target.id and day.day_number = 1
  where rating.season_id = v_target.id
  on conflict (rider_id, season_day_id) do nothing;
$old$;
  v_new_block text := $new$
  perform public.apply_season_break_recovery(v_source.id, v_target.id);
$new$;
begin
  select pg_catalog.pg_get_functiondef(
    'public.rollover_game_season(uuid,boolean)'::regprocedure
  ) into v_definition;

  if position(v_new_block in v_definition) = 0 then
    if position(v_old_block in v_definition) = 0 then
      raise exception 'Le bloc de forme du rollover de saison est introuvable.';
    end if;

    execute replace(v_definition, v_old_block, v_new_block);
  end if;
end;
$migration$;

revoke all on function public.apply_season_break_recovery(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.apply_season_break_recovery(uuid, uuid)
  to service_role;

comment on function public.apply_season_break_recovery(uuid, uuid) is
  'Récupère 50 % de la forme manquante, annule la fatigue et guérit les blessures lors du passage à la saison suivante.';

commit;
