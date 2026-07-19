begin;

-- Corrige la source du nom de course dans le message de conflit.
-- pg_get_functiondef conserve intégralement la fonction transactionnelle
-- déjà déployée et permet une correction ciblée sans réécrire sa logique.
do $migration$
declare
  v_function_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.save_current_team_race_roster(uuid,uuid[])'::regprocedure
  )
  into v_function_definition;

  v_function_definition := replace(
    v_function_definition,
    'other_race.display_name as race_name',
    'other_edition.display_name as race_name'
  );

  if v_function_definition not like
    '%other_edition.display_name as race_name%'
  then
    raise exception
      'La correction du nom de course n a pas pu être appliquée.';
  end if;

  execute v_function_definition;
end;
$migration$;

notify pgrst, 'reload schema';

commit;
