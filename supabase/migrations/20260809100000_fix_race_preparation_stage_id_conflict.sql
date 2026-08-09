begin;

do $migration$
declare
  v_function_definition text;
  v_ambiguous_clause constant text :=
    'on conflict (race_registration_id, stage_id)';
  v_constraint_clause constant text :=
    'on conflict on constraint race_stage_strategies_pkey';
begin
  select pg_get_functiondef(
    'public.save_current_team_race_preparation(uuid,uuid,jsonb,jsonb)'::regprocedure
  )
  into v_function_definition;

  if position(v_ambiguous_clause in v_function_definition) > 0 then
    execute replace(
      v_function_definition,
      v_ambiguous_clause,
      v_constraint_clause
    );
  elsif position(v_constraint_clause in v_function_definition) = 0 then
    raise exception
      'La clause ON CONFLICT de save_current_team_race_preparation est introuvable.';
  end if;
end;
$migration$;

comment on function public.save_current_team_race_preparation(
  uuid,
  uuid,
  jsonb,
  jsonb
) is
  'Enregistre atomiquement la préparation sans ambiguïté entre la colonne stage_id et le champ de retour homonyme.';

commit;
