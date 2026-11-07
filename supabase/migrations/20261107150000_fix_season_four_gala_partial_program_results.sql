begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';
set local application_name = 'cyclostratege-gala-s4-partial-program-results';

-- Registration now works race by race. A club without a composition for this
-- profile was not on its startlist. An incomplete submitted lineup is invalid.
do $patch$
declare
  v_definition text;
  v_old constant text := '    where registration.season_id=v_season and registration.program=v_program and (';
  v_new constant text := $new$    where registration.season_id=v_season and registration.program=v_program
      and exists(select 1 from public.season_gala_registration_riders entered
        where entered.registration_id=registration.id and entered.profile=v_profile)
      and ($new$;
begin
  select replace(pg_get_functiondef('public.settle_season_four_gala_results(text,jsonb)'::regprocedure),chr(13),'')
    into v_definition;
  if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 1 then
    raise exception 'Unexpected Gala S4 lineup validation definition.';
  end if;
  execute replace(v_definition,v_old,v_new);
end;
$patch$;

commit;
