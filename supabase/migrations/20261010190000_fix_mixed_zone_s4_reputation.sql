begin;
set local lock_timeout = '5s';
set local statement_timeout = '8s';

-- S4 removed the director's reputation ceiling. Patch only this obsolete
-- calculation, preserving ownership, locks, event limits and atomicity.
do $migration$
declare
  v_definition text;
  v_cap_pattern constant text :=
    'v_new_reputation[[:space:]]*:=[[:space:]]*least\([[:space:]]*1000[[:space:]]*,[[:space:]]*greatest\(0[[:space:]]*,[[:space:]]*v_context\.reputation_points[[:space:]]*\+[[:space:]]*v_reputation_delta\)[[:space:]]*\);';
begin
  v_definition := pg_get_functiondef(
    'public.submit_post_race_interview_with_event(uuid,uuid,jsonb,text,text)'::regprocedure
  );
  if position('mixed_zone_s4_reputation_v1' in v_definition) > 0 then
    return;
  end if;
  if v_definition !~ v_cap_pattern
    or v_definition !~ 'v_new_reputation[[:space:]]+integer;'
    or v_definition !~ 'v_applied_reputation_delta[[:space:]]+integer[[:space:]]*:=[[:space:]]*0;' then
    raise exception 'Unexpected mixed-zone reputation calculation; migration stopped.';
  end if;

  v_definition := regexp_replace(v_definition,
    'v_new_reputation[[:space:]]+integer;', 'v_new_reputation numeric(12, 2);');
  v_definition := regexp_replace(v_definition,
    'v_applied_reputation_delta[[:space:]]+integer[[:space:]]*:=[[:space:]]*0;',
    'v_applied_reputation_delta numeric(12, 2) := 0;');
  v_definition := regexp_replace(v_definition, v_cap_pattern,
    '-- mixed_zone_s4_reputation_v1: open progression, exact decimal delta.' || chr(10) ||
    '      v_new_reputation := greatest(0::numeric, v_context.reputation_points + v_reputation_delta);');
  execute v_definition;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
