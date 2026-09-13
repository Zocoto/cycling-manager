begin;

-- The reminder stays inside the existing compact dashboard payload. It is
-- computed on every Bureau read, so it disappears immediately after the
-- president publishes the last outstanding list for a given deadline.
do $migration$
declare
  v_definition text;
  v_previous_payload constant text := $previous$
      'equipmentPartnerSignatureAvailable', (
$previous$;
  v_replacement_payload constant text := $replacement$
      'federationSelectionReminder', (
        select jsonb_build_object(
          'count', count(schedule.slot_key)::integer,
          'nextLabel', (
            array_agg(
              schedule.label
              order by schedule.closes_at, schedule.slot_key
            )
          )[1],
          'nextClosesAt', min(schedule.closes_at),
          'countryCode', min(lower(country.iso_alpha2))
        )
        from current_context as context
        join public.national_federation_terms as term
          on term.president_director_id = context.sporting_director_id
         and term.governance_mode = 'elected'
         and term.start_game_year <= context.game_year
         and term.end_game_year >= context.game_year
        join public.countries as country
          on country.id = term.country_id
        join public.national_federation_selection_preferences as preference
          on preference.country_id = term.country_id
         and preference.season_id = context.season_id
         and preference.automatic_selection = false
        cross join lateral public.get_national_federation_selection_schedule(
          term.country_id,
          context.season_id
        ) as schedule
        where schedule.is_open
          and schedule.closes_at is not null
          and now() >= schedule.closes_at - interval '2 days'
          and not exists (
            select 1
            from public.national_federation_selection_lists as selection_list
            where selection_list.country_id = term.country_id
              and selection_list.season_id = context.season_id
              and selection_list.slot_key = schedule.slot_key
              and selection_list.published_at is not null
              and not exists (
                select 1
                from public.national_federation_selection_members as member
                where member.selection_list_id = selection_list.id
                  and member.response_status = 'draft'
              )
          )
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
      'Le payload du résumé du Bureau est introuvable pour le rappel de convocations fédérales.';
  end if;

  if length(v_definition) - length(replace(
    v_definition,
    v_previous_payload,
    ''
  )) <> length(v_previous_payload) then
    raise exception
      'Le point d’insertion du rappel de convocations fédérales n’est pas unique.';
  end if;

  execute replace(
    v_definition,
    v_previous_payload,
    v_replacement_payload
  );
end;
$migration$;

comment on function public.get_current_dashboard_assistant_summary() is
  'Résumé opérationnel compact du Bureau. Il rappelle aussi au président en mode manuel les listes fédérales non publiées à moins de deux jours de leur échéance.';

notify pgrst, 'reload schema';

commit;
