-- Architects are optional for every infrastructure project.
--
-- The project functions use a polymorphic RECORD for the selected architect.
-- When no architect is selected, that record was never assigned, although its
-- level field was still referenced by the INSERT expression. PostgreSQL can
-- resolve PL/pgSQL record fields before evaluating the SQL CASE and raise
-- "record v_architect is not assigned yet". Give the record a nullable shape
-- up front so a NULL architect always keeps the standard cost and duration.

do $migration$
declare
  v_function_name text;
  v_signature regprocedure;
  v_definition text;
  v_patched_definition text;
  v_anchor constant text := E'\nbegin\n  if p_infrastructure_code';
  v_crlf_anchor constant text := E'\r\nbegin\r\n  if p_infrastructure_code';
  v_replacement constant text := E'\nbegin\n  -- Initialize the optional architect record before any field is referenced.\n  select\n    null::uuid as id,\n    null::integer as level,\n    null::text as architect_specialty,\n    null::text as specialty\n  into v_architect;\n\n  if p_infrastructure_code';
  v_crlf_replacement constant text := E'\r\nbegin\r\n  -- Initialize the optional architect record before any field is referenced.\r\n  select\r\n    null::uuid as id,\r\n    null::integer as level,\r\n    null::text as architect_specialty,\r\n    null::text as specialty\r\n  into v_architect;\r\n\r\n  if p_infrastructure_code';
begin
  foreach v_function_name in array array[
    'start_current_team_infrastructure_project',
    'start_current_team_infrastructure_project_legacy_20260812',
    'start_current_team_infrastructure_project_legacy_20260811'
  ]
  loop
    v_signature := to_regprocedure(
      format('public.%I(text,uuid,uuid)', v_function_name)
    );

    if v_signature is null then
      raise exception 'Infrastructure function % is missing.', v_function_name;
    end if;

    select pg_get_functiondef(v_signature)
    into v_definition;

    if position('Initialize the optional architect record' in v_definition) > 0 then
      continue;
    end if;

    if position('v_architect record;' in v_definition) = 0 then
      raise exception 'Infrastructure function % has an unexpected definition.',
        v_function_name;
    end if;

    if position(v_anchor in v_definition) > 0 then
      v_patched_definition := replace(
        v_definition,
        v_anchor,
        v_replacement
      );
    elsif position(v_crlf_anchor in v_definition) > 0 then
      v_patched_definition := replace(
        v_definition,
        v_crlf_anchor,
        v_crlf_replacement
      );
    else
      raise exception 'Infrastructure function % has an unexpected definition.',
        v_function_name;
    end if;

    execute v_patched_definition;
  end loop;
end;
$migration$;
