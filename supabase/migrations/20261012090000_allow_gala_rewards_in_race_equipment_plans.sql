-- Gala prizes are finite owned items, including when planning a race or tour.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_expected integer;
  v_count integer;
  v_old constant text := 'item.acquisition_channel = ''commercial''';
  v_new constant text := 'item.acquisition_channel in (''commercial'', ''event_reward'')';
begin
  foreach v_signature in array array[
    'public.save_current_team_race_equipment_plan(uuid,uuid,jsonb,boolean)'::regprocedure,
    'public.prevent_reserved_race_equipment_inventory_reduction()'::regprocedure
  ] loop
    v_definition := pg_catalog.pg_get_functiondef(v_signature);
    v_expected := case when v_signature =
      'public.save_current_team_race_equipment_plan(uuid,uuid,jsonb,boolean)'::regprocedure
      then 2 else 1 end;
    v_count := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
    if v_count = v_expected then
      execute replace(v_definition, v_old, v_new);
    elsif v_count <> 0 or
      (length(v_definition) - length(replace(v_definition, v_new, ''))) / length(v_new) <> v_expected then
      raise exception 'Unexpected equipment checks in %; review before enabling gala rewards.', v_signature;
    end if;
  end loop;
end;
$migration$;

commit;
