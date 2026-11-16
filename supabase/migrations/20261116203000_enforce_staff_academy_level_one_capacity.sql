begin;
set local lock_timeout = '1s';
set local statement_timeout = '10s';

-- The same bonus calculation is used for enrollment, the Academy card,
-- and the dashboard reminder. Existing trainings keep their original dates.
do $migration$
declare
  v_definition text := replace(pg_get_functiondef(
    'public.get_team_staff_academy_educator_bonuses(uuid)'::regprocedure
  ), E'\r\n', E'\n');
  v_previous text := E'''extraCapacity'', case when coalesce(bool_or(\n'
    || E'      talent_code = ''educator_parallel_training'' and level >= 3\n'
    || '    ), false) then 1 else 0 end';
  v_replacement text := E'''extraCapacity'', case when coalesce(bool_or(\n'
    || E'      talent_code = ''educator_parallel_training'' and level >= 3\n'
    || E'    ), false) and exists (\n'
    || E'      select 1 from public.team_infrastructures as academy\n'
    || E'      where academy.team_id = p_team_id\n'
    || E'        and academy.infrastructure_code = ''staff_academy''\n'
    || E'        and academy.level >= 2\n'
    || '    ) then 1 else 0 end';
begin
  if length(v_definition) - length(replace(v_definition, v_previous, '')) <> length(v_previous) then
    raise exception 'Unexpected staff academy capacity calculation';
  end if;
  execute replace(v_definition, v_previous, v_replacement);
end;
$migration$;

commit;
