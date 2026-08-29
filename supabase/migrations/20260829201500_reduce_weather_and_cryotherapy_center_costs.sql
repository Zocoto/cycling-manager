begin;

-- La fonction de construction centralise les contrôles, le débit et les
-- bonus d'architecte. On ne change ici que les deux prix d'entrée ; la grille
-- commune 100/60/70/80/90 % continue de calculer les niveaux suivants.
do $migration$
declare
  v_function_body text;
  v_updated_body text;
begin
  select procedure.prosrc
  into strict v_function_body
  from pg_proc as procedure
  where procedure.oid =
    'public.start_current_team_infrastructure_project(text,uuid,uuid)'::regprocedure;

  v_updated_body := regexp_replace(
    v_function_body,
    'when[[:space:]]+''cryotherapy_center''[[:space:]]+then[[:space:]]+v_base_cost[[:space:]]*:=[[:space:]]*250000;',
    E'when \'cryotherapy_center\' then\n      v_base_cost := 150000;'
  );

  if v_updated_body = v_function_body then
    raise exception
      'Impossible de localiser le tarif actuel du centre de cryothérapie.';
  end if;

  v_function_body := v_updated_body;
  v_updated_body := regexp_replace(
    v_function_body,
    'when[[:space:]]+''weather_center''[[:space:]]+then[[:space:]]+v_base_cost[[:space:]]*:=[[:space:]]*500000;',
    E'when \'weather_center\' then\n      v_base_cost := 50000;'
  );

  if v_updated_body = v_function_body then
    raise exception
      'Impossible de localiser le tarif actuel du centre météo.';
  end if;

  execute format(
    $definition$
      create or replace function public.start_current_team_infrastructure_project(
        p_infrastructure_code text,
        p_country_id uuid default null,
        p_architect_contract_id uuid default null
      )
      returns uuid
      language plpgsql
      security definer
      set search_path = public
      as %L
    $definition$,
    v_updated_body
  );
end;
$migration$;

commit;
