begin;

do $migration$
declare
  v_signature constant regprocedure :=
    'public.get_current_national_federation_race_preparation(text)'::regprocedure;
  v_definition text;
  v_patched_definition text;
  v_column text;
begin
  select replace(pg_catalog.pg_get_functiondef(v_signature), chr(13), '')
  into v_definition;
  v_patched_definition := v_definition;

  foreach v_column in array array[
    'mountain', 'hills', 'flat', 'time_trial', 'cobbles', 'sprint',
    'acceleration', 'downhill', 'endurance', 'resistance', 'recovery',
    'breakaway', 'prologue'
  ]
  loop
    v_patched_definition := replace(
      v_patched_definition,
      '    rating.' || v_column || ',',
      '    rating.' || v_column || '::integer,'
    );
  end loop;

  if v_patched_definition <> v_definition then
    execute v_patched_definition;
  end if;
end;
$migration$;

notify pgrst, 'reload schema';

commit;
