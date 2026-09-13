begin;

-- Keep the reminder in the existing compact dashboard RPC. The indexed
-- (team_id, season_id) existence check is the same source of truth used by
-- the Development Team creation workflow and adds no client round-trip.
do $migration$
declare
  v_definition text;
  v_previous_payload constant text := $previous$
      'equipmentPartnerSignatureAvailable', (
$previous$;
  v_replacement_payload constant text := $replacement$
      'developmentTeamSetup', (
        select jsonb_build_object(
          'required',
            context.current_day_number between 1 and 7
            and not exists (
              select 1
              from public.development_teams as development_team
              where development_team.team_id = context.team_id
                and development_team.season_id = context.season_id
            ),
          'currentDayNumber', context.current_day_number,
          'closesDayNumber', 7
        )
        from current_context as context
      ),
      'equipmentPartnerSignatureAvailable', (
$replacement$;
begin
  select replace(
    pg_get_functiondef(
      'public.get_current_dashboard_assistant_summary()'::regprocedure
    ),
    E'\r\n',
    E'\n'
  )
  into v_definition;

  if strpos(v_definition, v_previous_payload) = 0 then
    raise exception
      'Le payload du résumé du Bureau est introuvable pour l’alerte DevTeam.';
  end if;

  if length(v_definition) - length(replace(
    v_definition,
    v_previous_payload,
    ''
  )) <> length(v_previous_payload) then
    raise exception
      'Le point d’insertion de l’alerte DevTeam n’est pas unique.';
  end if;

  execute replace(
    v_definition,
    v_previous_payload,
    v_replacement_payload
  );
end;
$migration$;

comment on function public.get_current_dashboard_assistant_summary() is
  'Résumé opérationnel compact du Bureau. De J1 à J7, il rappelle aussi la composition de la DevTeam tant qu’aucune équipe de la saison n’est enregistrée.';

notify pgrst, 'reload schema';

commit;
