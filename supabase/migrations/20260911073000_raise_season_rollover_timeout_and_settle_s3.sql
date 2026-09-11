-- The season rollover is deliberately atomic and now processes substantially
-- more teams, riders, objectives, contracts, and finance rows than in S1.
-- PostgREST's inherited eight-second timeout is too short for that one bounded
-- maintenance operation, so grant only the rollover functions a larger budget.
begin;

-- Ten historical youth dismissals have a suspended professional identity that
-- is intentionally reused at J1. The generic rating copy used to copy those
-- identities first, before the youth-release branch inserted their S3 rating
-- again. Exclude this transitional status from the generic copy; the dedicated
-- release branch remains the sole source of their new-season rating.
do $patch_suspended_youth_rollover$
declare
  v_signature regprocedure :=
    'public.rollover_game_season(uuid,boolean)'::regprocedure;
  v_definition text;
  v_marker constant text := 'and rider.status <> ''retired''';
  v_replacement constant text :=
    'and rider.status not in (''retired'', ''suspended'')';
  v_occurrences integer;
begin
  select pg_catalog.pg_get_functiondef(v_signature)
  into v_definition;

  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_marker, ''))
  ) / length(v_marker);

  if v_occurrences <> 1 then
    raise exception
      'Le filtre des coureurs copiés au rollover est introuvable ou ambigu (% occurrences).',
      v_occurrences;
  end if;

  execute replace(v_definition, v_marker, v_replacement);
end;
$patch_suspended_youth_rollover$;

alter function public.rollover_game_season(uuid, boolean)
  set statement_timeout = '60s';

alter function public.settle_due_season_rollovers()
  set statement_timeout = '60s';

-- Recover the missed S2 -> S3 transition through the migration connection.
-- This transaction-local allowance protects the one-off recovery even if the
-- current production dataset needs more than the recurring 60-second budget.
set local statement_timeout = '5min';

select public.settle_due_season_rollovers();

notify pgrst, 'reload schema';

commit;
