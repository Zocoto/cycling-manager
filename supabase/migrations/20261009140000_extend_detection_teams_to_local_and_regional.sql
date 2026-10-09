begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

-- Reuse the existing scheduled, serialized and idempotent settlement.
-- Only extend its category filter and geographical preference; do not reset
-- editions, registrations, results or rewards and do not run gameplay here.
do $migration$
declare
  v_signature regprocedure := pg_catalog.to_regprocedure(
    'public.settle_due_free_agent_detection_teams(timestamp with time zone)'
  );
  v_definition text;
  v_index integer;
  v_old_fragments text[] := array[
    $old$category.code in ('national', 'continental', 'world')$old$,
    E'case v_edition.category_code\n            when ''national'' then',
    $old$when 'continental' then$old$
  ];
  v_new_fragments text[] := array[
    $new$category.code in ('local', 'regional', 'national', 'continental', 'world')$new$,
    E'case\n            when v_edition.category_code in (''local'', ''national'') then',
    $new$when v_edition.category_code in ('regional', 'continental') then$new$
  ];
begin
  if v_signature is null then
    raise exception 'The existing detection-team settlement is missing.';
  end if;
  v_definition := replace(
    pg_catalog.pg_get_functiondef(v_signature), chr(13) || chr(10), chr(10)
  );

  if position(v_new_fragments[1] in v_definition) > 0 then
    -- A retry must recognize the complete patch, not a partial category change.
    for v_index in 1..array_length(v_new_fragments, 1) loop
      if position(v_new_fragments[v_index] in v_definition) = 0 then
        raise exception 'The detection-team extension is only partially installed.';
      end if;
    end loop;
    return;
  end if;

  for v_index in 1..array_length(v_old_fragments, 1) loop
    if (
      length(v_definition)
      - length(replace(v_definition, v_old_fragments[v_index], ''))
    ) / length(v_old_fragments[v_index]) <> 1 then
      raise exception 'Unexpected detection-team settlement anchor %; no changes applied.', v_index;
    end if;
    v_definition := replace(
      v_definition, v_old_fragments[v_index], v_new_fragments[v_index]
    );
  end loop;

  -- CREATE OR REPLACE preserves the existing signature, owner and ACL.
  execute v_definition;
end;
$migration$;

comment on function public.settle_due_free_agent_detection_teams(timestamptz) is
  'Complète une fois les courses standard Locales, Régionales, Nationales, Continentales et Mondiales à cinq équipes après la clôture, si une équipe de joueur et assez d’agents libres disponibles sont présents.';

notify pgrst, 'reload schema';
commit;
