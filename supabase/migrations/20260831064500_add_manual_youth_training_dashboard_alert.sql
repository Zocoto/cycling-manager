begin;

-- Keep the Bureau on its single compact RPC: the manual youth reminder is
-- folded into the existing JSON payload instead of adding another page query.
do $migration$
declare
  v_definition text;
  v_previous_payload constant text := $previous$
      'items', source.items,
      'riderRecruitmentMatchCount', matches.rider_recruitment_match_count,
      'staffRecruitmentMatchCount', matches.staff_recruitment_match_count
    ) as items
$previous$;
  v_replacement_payload constant text := $replacement$
      'items', source.items,
      'riderRecruitmentMatchCount', matches.rider_recruitment_match_count,
      'staffRecruitmentMatchCount', matches.staff_recruitment_match_count,
      'juniorManualTrainingDueCount', (
        select count(*)::integer
        from public.youth_academy_riders as academy
        join current_context as context
          on context.team_id = academy.team_id
        where academy.status in ('active', 'recruited')
          and academy.training_mode = 'manual'
          and not exists (
            select 1
            from public.youth_academy_training_sessions as session
            where session.academy_rider_id = academy.id
              and session.season_id = context.season_id
              and session.season_day_id = context.season_day_id
              and session.slot = case
                when extract(
                  hour from now() at time zone 'Europe/Paris'
                ) < 12 then 'manual_am'
                else 'manual_pm'
              end
          )
      ),
      'juniorManualTrainingSlot', case
        when extract(hour from now() at time zone 'Europe/Paris') < 12
          then 'manual_am'
        else 'manual_pm'
      end
    ) as items
$replacement$;
begin
  select pg_get_functiondef(
    'public.get_current_dashboard_assistant_summary()'::regprocedure
  ) into v_definition;

  if strpos(v_definition, v_previous_payload) = 0 then
    raise exception
      'Le payload du résumé du Bureau est introuvable.';
  end if;

  execute replace(
    v_definition,
    v_previous_payload,
    v_replacement_payload
  );
end;
$migration$;

comment on function public.get_current_dashboard_assistant_summary() is
  'Résumé opérationnel compact du Bureau. Il inclut le rappel du créneau manuel courant des juniors sans requête supplémentaire.';

notify pgrst, 'reload schema';

commit;
