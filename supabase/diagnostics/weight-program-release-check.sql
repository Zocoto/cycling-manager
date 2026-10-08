set statement_timeout = '5s';
select clock_timestamp() as database_time,
  to_regprocedure('public.apply_current_team_nutrition_plan(jsonb,jsonb)') is not null as nutrition_plan_installed,
  has_function_privilege('authenticated','public.apply_current_team_nutrition_plan(jsonb,jsonb)','execute') as authenticated_allowed,
  has_function_privilege('anon','public.apply_current_team_nutrition_plan(jsonb,jsonb)','execute') as anonymous_allowed,
  (select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.rider_weight_events'::regclass
    and conname='rider_weight_events_source_allowed') as weight_event_sources,
  (select count(*) from public.initial_rider_underweight_corrections where entity_kind='rider') as professionals_corrected,
  (select count(*) from public.initial_rider_underweight_corrections where entity_kind='candidate') as candidates_corrected,
  (select count(*) from public.initial_rider_underweight_corrections where entity_kind='academy') as academy_corrected,
  (select count(*) from public.initial_rider_underweight_corrections
    where weight_after_kg-baseline_after_kg <> weight_before_kg-baseline_before_kg) as changed_player_weight_deltas,
  (select count(*) from public.initial_rider_underweight_corrections
    where baseline_after_kg < public.get_rider_initial_minimum_power_weight_kg(natural_profile,height_cm)) as incorrect_baselines,
  (select count(*) from supabase_migrations.schema_migrations
    where version in ('20261008153000','20261008160000','20261008163000')) as registered_migrations;
