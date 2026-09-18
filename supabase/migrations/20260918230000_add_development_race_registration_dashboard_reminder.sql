begin;

-- Reuse the compact DS dashboard RPC. Both the race calendar and the existing
-- registration tables are indexed by season/team, so this adds no round-trip.
do $migration$
declare
  v_definition text;
  v_previous_payload constant text := replace($previous$
      'equipmentPartnerSignatureAvailable', (
$previous$, E'\r\n', E'\n');
  v_replacement_payload constant text := replace($replacement$
      'developmentRaceRegistrationReminder', (
        select jsonb_build_object(
          'count', count(edition.id)::integer,
          'nextName', (
            array_agg(edition.name order by edition.name, edition.id)
          )[1],
          'nextEditionId', (
            array_agg(edition.id::text order by edition.name, edition.id)
          )[1]
        )
        from current_context as context
        join public.development_teams as development_team
          on development_team.team_id = context.team_id
         and development_team.season_id = context.season_id
         and development_team.status = 'active'
        join public.development_race_editions as edition
          on edition.season_id = context.season_id
         and edition.start_day_number = context.current_day_number + 1
         and edition.status = 'planned'
         and edition.selection_mode = 'manual'
        where (
          edition.competition_type not in ('national_road', 'national_time_trial')
          or exists (
            select 1
            from public.youth_academy_riders as rider
            join public.countries as country on country.id = rider.country_id
            where rider.team_id = context.team_id
              and rider.status in ('active', 'recruited')
              and country.iso_alpha2 = edition.country_code
          )
        )
          and not exists (
            select 1
            from public.development_race_registrations as registration
            join public.development_race_registration_riders as selected
              on selected.registration_id = registration.id
            where registration.development_team_id = development_team.id
              and registration.race_edition_id = edition.id
              and registration.status = 'registered'
          )
      ),
      'equipmentPartnerSignatureAvailable', (
$replacement$, E'\r\n', E'\n');
begin
  select replace(
    pg_get_functiondef(
      'public.get_current_dashboard_assistant_summary()'::regprocedure
    ),
    E'\r\n',
    E'\n'
  ) into v_definition;

  if strpos(v_definition, v_previous_payload) = 0 then
    raise exception
      'Le payload du résumé du Bureau est introuvable pour le rappel des courses juniors.';
  end if;

  if length(v_definition) - length(replace(
    v_definition,
    v_previous_payload,
    ''
  )) <> length(v_previous_payload) then
    raise exception
      'Le point d’insertion du rappel des courses juniors n’est pas unique.';
  end if;

  execute replace(
    v_definition,
    v_previous_payload,
    v_replacement_payload
  );
end;
$migration$;

comment on function public.get_current_dashboard_assistant_summary() is
  'Résumé compact du Bureau. Il rappelle à un DS ayant une DevTeam active les courses juniors manuelles de J+1 sans coureur engagé.';

notify pgrst, 'reload schema';

commit;
