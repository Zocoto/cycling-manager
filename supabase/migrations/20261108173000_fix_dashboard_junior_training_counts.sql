begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

do $migration$
declare
  v_definition text := replace(
    pg_get_functiondef('public.get_current_dashboard_assistant_summary()'::regprocedure),
    E'\r\n',
    E'\n'
  );
  v_previous constant text := $junior$  junior_training as (
    select
      count(distinct academy_rider.id)::integer as rider_count,
      count(distinct session.id)::integer as session_count,
      coalesce(sum((
        select count(*)
        from jsonb_each(session.rating_changes) as rating_change(key, value)
        where jsonb_typeof(rating_change.value) = 'number'
          and (rating_change.value #>> '{}')::numeric > 0
      )), 0)::integer as progress_count
    from current_context as context
    left join public.youth_academy_riders as academy_rider
      on academy_rider.team_id = context.team_id
     and academy_rider.status = 'active'
    left join public.youth_academy_training_sessions as session
      on session.academy_rider_id = academy_rider.id
     and session.season_id = context.season_id
     and session.season_day_id = context.season_day_id
  ),$junior$;
  v_corrected text;
begin
  if length(v_definition) - length(replace(v_definition, v_previous, '')) <> length(v_previous) then
    raise exception 'Expected one junior_training CTE in the dashboard assistant summary';
  end if;

  -- Preserve the wire column used by the dashboard's trained-rider badge.
  v_corrected := replace(
    replace(
      v_previous,
      'count(distinct session.id)::integer as session_count',
      'count(distinct session.academy_rider_id)::integer as session_count'
    ),
    'academy_rider.status = ''active''',
    'academy_rider.status in (''active'', ''recruited'')'
  );
  execute replace(v_definition, v_previous, v_corrected);
end;
$migration$;

commit;
