begin;

set local lock_timeout = '3s';
set local statement_timeout = '8s';
set local application_name = 'cyclostratege-preparation-context-window-20261020';

-- Keep the legacy one-argument RPC, including its OID and dependencies. The
-- three-argument core has no defaults: named PostgREST requests cannot become
-- ambiguous during a rolling application deployment. Clone its current body
-- so physiological data, titles and future metadata columns are not lost.
do $migration$
declare
  v_legacy_oid oid := pg_catalog.to_regprocedure(
    'public.get_race_calendar_rider_context(uuid[])'
  );
  v_core_oid oid := pg_catalog.to_regprocedure(
    'public.get_race_calendar_rider_context(uuid[],integer,integer)'
  );
  v_legacy_definition text;
  v_core_definition text;
  v_return_type text;
  v_patch_count integer;
  v_signature text :=
    'public.get_race_calendar_rider_context(p_rider_ids uuid[])';
  v_core_signature text :=
    'public.get_race_calendar_rider_context(p_rider_ids uuid[], p_min_game_day integer, p_max_game_day integer)';
  v_predicate_pattern text :=
    'preparation\.rider_id\s*=\s*rider\.id\s+and\s+preparation\.status\s*<>\s*''cancelled''';
  v_core_marker text := '/* performance-preparation-context-window-v1 */';
  v_legacy_marker text := '/* performance-preparation-context-legacy-v1 */';
begin
  if v_legacy_oid is null then
    raise exception 'Missing legacy race rider context RPC; refusing to replace unknown metadata.';
  end if;
  v_legacy_definition := pg_catalog.pg_get_functiondef(v_legacy_oid);
  v_return_type := pg_catalog.pg_get_function_result(v_legacy_oid);
  if (
    select count(*) from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'public.rider_performance_preparations'::regclass
      and attribute.attname in ('bonus_start_game_day', 'bonus_end_game_day')
      and attribute.atttypid = 'integer'::regtype
      and attribute.attnotnull and not attribute.attisdropped
  ) <> 2 then
    raise exception 'Preparation window bounds require two non-null integer day columns.';
  end if;

  if v_core_oid is null then
    if position(v_legacy_marker in v_legacy_definition) > 0
      or position(v_core_marker in v_legacy_definition) > 0
    then
      raise exception 'Unexpected partial rider context migration.';
    end if;
    if not exists (
      select 1 from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_language as language on language.oid = procedure.prolang
      where procedure.oid = v_legacy_oid
        and language.lanname = 'sql'
        and procedure.prosecdef
        and procedure.provolatile = 's'
        and procedure.pronargdefaults = 0
    ) then
      raise exception 'Unexpected legacy rider context RPC attributes.';
    end if;
    if (length(v_legacy_definition)
        - length(replace(v_legacy_definition, v_signature, '')))
        / length(v_signature) <> 1
    then
      raise exception 'Unexpected legacy rider context RPC signature.';
    end if;
    select count(*)::integer into v_patch_count
    from pg_catalog.regexp_matches(v_legacy_definition, v_predicate_pattern, 'g');
    if v_patch_count <> 1 then
      raise exception 'Expected exactly one preparation predicate, found %.', v_patch_count;
    end if;

    v_core_definition := replace(
      v_legacy_definition, v_signature, v_core_signature
    );
    -- Integer extremes preserve unbounded legacy calls. COALESCE keeps the
    -- end-date comparison sargable even when SQL uses a generic cached plan.
    v_core_definition := pg_catalog.regexp_replace(
      v_core_definition,
      v_predicate_pattern,
      E'\\&\n      /* performance-preparation-context-window-v1 */\n'
        || '      and preparation.bonus_end_game_day >= coalesce(p_min_game_day, -2147483648)'
        || E'\n'
        || '      and preparation.bonus_start_game_day <= coalesce(p_max_game_day, 2147483647)'
    );
    execute v_core_definition;
    v_core_oid := pg_catalog.to_regprocedure(
      'public.get_race_calendar_rider_context(uuid[],integer,integer)'
    );

    execute format(
      'create or replace function public.get_race_calendar_rider_context(p_rider_ids uuid[])'
        || E'\nreturns %s\nlanguage sql stable security definer set search_path = ''''\nas %L',
      v_return_type,
      v_legacy_marker || E'\nselect * from public.get_race_calendar_rider_context('
        || 'p_rider_ids, null::integer, null::integer);'
    );
    v_legacy_definition := pg_catalog.pg_get_functiondef(v_legacy_oid);
  end if;

  -- Idempotent only for this exact installation. A conflicting overload or a
  -- modified compatibility wrapper must fail closed rather than be overwritten.
  v_core_definition := pg_catalog.pg_get_functiondef(v_core_oid);
  if position(v_core_marker in v_core_definition) = 0
    or position(v_legacy_marker in v_legacy_definition) = 0
    or position(v_core_signature in v_core_definition) = 0
    or position(
      'preparation.bonus_end_game_day >= coalesce(p_min_game_day, -2147483648)'
      in v_core_definition
    ) = 0
    or position(
      'preparation.bonus_start_game_day <= coalesce(p_max_game_day, 2147483647)'
      in v_core_definition
    ) = 0
    or pg_catalog.pg_get_function_result(v_core_oid) <> v_return_type
    or exists (
      select 1 from pg_catalog.pg_proc as procedure
      where procedure.oid in (v_legacy_oid, v_core_oid)
        and procedure.pronargdefaults <> 0
    )
  then
    raise exception 'Unexpected installed rider context core or compatibility wrapper.';
  end if;
  select count(*)::integer into v_patch_count
  from pg_catalog.regexp_matches(v_core_definition, v_predicate_pattern, 'g');
  if v_patch_count <> 1 then
    raise exception 'Installed rider context core must contain exactly one preparation predicate.';
  end if;
end;
$migration$;

-- Equality on rider_id followed by the lower end-date bound avoids scanning
-- every expired season before building a small preparation JSON array.
create index if not exists rider_performance_preparations_rider_window_idx
  on public.rider_performance_preparations(
    rider_id, bonus_end_game_day, bonus_start_game_day
  )
  where status <> 'cancelled';

revoke all on function public.get_race_calendar_rider_context(uuid[])
  from public, anon, authenticated;
grant execute on function public.get_race_calendar_rider_context(uuid[])
  to service_role;
revoke all on function public.get_race_calendar_rider_context(uuid[], integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_race_calendar_rider_context(uuid[], integer, integer)
  to service_role;

comment on function public.get_race_calendar_rider_context(uuid[], integer, integer) is
  'Contexte backend compact. Bornes inclusives des bonus de préparation, sans modification des données et sans dépendance à la date courante.';
comment on function public.get_race_calendar_rider_context(uuid[]) is
  'Compatibilité anciens builds : délègue au contexte trois arguments sans bornes. Aucun défaut de paramètre ni ambiguïté PostgREST.';

notify pgrst, 'reload schema';

commit;
