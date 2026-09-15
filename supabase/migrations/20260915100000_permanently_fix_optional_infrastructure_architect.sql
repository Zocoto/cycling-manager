-- An architect is optional for every team infrastructure project.
--
-- A previous hotfix initialized the polymorphic v_architect RECORD. Later
-- migrations redefined the whole RPC from an older copy and silently removed
-- that initialization. PostgreSQL then tried to resolve v_architect.level in
-- the INSERT even when no architect had been selected.
--
-- Remove the fragile RECORD from the active RPC altogether. Scalar variables
-- are nullable by construction, so a future change to an SQL expression cannot
-- reproduce "record v_architect is not assigned yet" on the no-architect path.

do $migration$
declare
  v_definition text;
  v_patched_definition text;
begin
  select replace(
    pg_catalog.pg_get_functiondef(
      'public.start_current_team_infrastructure_project(text,uuid,uuid)'::regprocedure
    ),
    chr(13),
    ''
  )
  into v_definition;

  -- Idempotency for repaired environments.
  if position('v_architect_id uuid;' in v_definition) > 0
    and position('v_architect record;' in v_definition) = 0
    and position('v_architect.' in v_definition) = 0
  then
    return;
  end if;

  if position('  v_architect record;' in v_definition) = 0
    or position(E'    into v_architect\n' in v_definition) = 0
    or position('    if v_architect is null then' in v_definition) = 0
    or position('    v_architect_specialty := v_architect.specialty;' in v_definition) = 0
    or position('v_architect.level' in v_definition) = 0
  then
    raise exception
      'Unexpected infrastructure construction function shape; optional architect fix aborted.';
  end if;

  v_patched_definition := replace(
    v_definition,
    '  v_architect record;',
    E'  v_architect_id uuid;\n  v_architect_level integer;'
  );
  v_patched_definition := replace(
    v_patched_definition,
    E'    into v_architect\n',
    E'    into v_architect_id, v_architect_level, v_architect_specialty\n'
  );
  v_patched_definition := replace(
    v_patched_definition,
    '    if v_architect is null then',
    '    if v_architect_id is null then'
  );
  v_patched_definition := replace(
    v_patched_definition,
    E'    v_architect_specialty := v_architect.specialty;\n',
    ''
  );
  v_patched_definition := replace(
    v_patched_definition,
    'v_architect.level',
    'v_architect_level'
  );

  execute v_patched_definition;

  -- Deployment-time postcondition: do not leave a partially repaired RPC.
  select replace(
    pg_catalog.pg_get_functiondef(
      'public.start_current_team_infrastructure_project(text,uuid,uuid)'::regprocedure
    ),
    chr(13),
    ''
  )
  into v_definition;

  if position('v_architect_id uuid;' in v_definition) = 0
    or position('v_architect_level integer;' in v_definition) = 0
    or position('v_architect record;' in v_definition) > 0
    or position('v_architect.' in v_definition) > 0
  then
    raise exception
      'Optional architect postcondition failed; infrastructure RPC was not repaired.';
  end if;
end;
$migration$;

comment on function public.start_current_team_infrastructure_project(text, uuid, uuid)
is 'Lance un chantier d équipe avec architecte facultatif; le chemin sans architecte utilise le coût et la durée standards.';

notify pgrst, 'reload schema';
