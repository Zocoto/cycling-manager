begin;
set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- Keep the dashboard's existing request, using the same latest scheduled
-- programme as the 0% training alert.
do $patch$
declare
  v_definition text := replace(
    pg_get_functiondef('public.get_current_dashboard_assistant_summary()'::regprocedure),
    chr(13), ''
  );
  v_plan_anchor constant text := $anchor$      plan.rider_id,
      plan.intensity
    from public.rider_training_plan_versions as plan$anchor$;
  v_json_anchor constant text := $anchor$'equipmentPartnerSignatureAvailable', ($anchor$;
begin
  if position('trainingCapAlerts' in v_definition) > 0
    or length(v_definition) - length(replace(v_definition, v_plan_anchor, '')) <> length(v_plan_anchor)
    or length(v_definition) - length(replace(v_definition, v_json_anchor, '')) <> length(v_json_anchor)
  then
    raise exception 'Unexpected dashboard summary; training cap alert update cancelled.';
  end if;

  v_definition := replace(v_definition, v_plan_anchor, $replacement$      plan.rider_id,
      plan.intensity,
      plan.domain
    from public.rider_training_plan_versions as plan$replacement$);

  execute replace(v_definition, v_json_anchor, $replacement$'trainingCapAlerts', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'riderId', rider.id,
            'riderName', rider.first_name || ' ' || rider.last_name,
            'stat', primary_stat.code,
            'cap', ceiling.value
          ) order by rider.last_name, rider.first_name, rider.id
        ), '[]'::jsonb)
        from current_context as context
        cross join latest_training_plans as plan
        join public.riders as rider on rider.id = plan.rider_id and rider.status = 'active'
        join public.rider_season_ratings as rating
          on rating.rider_id = rider.id and rating.season_id = context.season_id
        -- The first stat of each focused training domain in lib/game/training.ts.
        join lateral (values
          ('climber', 'mountain', rating.mountain),
          ('puncheur', 'hills', rating.hills),
          ('northern_classics', 'cobbles', rating.cobbles),
          ('rouleur', 'timeTrial', rating.time_trial),
          ('breakaway', 'breakaway', rating.breakaway),
          ('sprinter', 'sprint', rating.sprint)
        ) as primary_stat(domain, code, grade) on primary_stat.domain = plan.domain
        cross join lateral (
          select public.get_rider_potential_stat_cap(rider.potential_steps) as value
        ) as ceiling
        where plan.intensity > 0 and primary_stat.grade >= ceiling.value
      ),
      'equipmentPartnerSignatureAvailable', ($replacement$);
end;
$patch$;

notify pgrst, 'reload schema';
commit;
