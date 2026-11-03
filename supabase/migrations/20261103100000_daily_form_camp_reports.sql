begin;

set local lock_timeout = '3s';
set local statement_timeout = '15s';

-- The dashboard starts from the connected team's small camp cohort, then uses
-- the existing unique (rider_id, season_day_id) ledger lookup. Never scan all
-- riders or settle gameplay while reading a report.
create index if not exists rider_form_camps_daily_report_team_idx
  on public.rider_form_camps
    (team_season_id, season_id, rider_id, start_day_number, end_day_number)
  where camp_type in ('classic', 'premium');

create or replace function private.get_team_daily_form_camp_report(
  p_team_season_id uuid,
  p_season_day_id uuid
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with eligible_camps as materialized (
    select camp.id, camp.rider_id, camp.camp_type, camp.status,
      camp.start_day_number, camp.end_day_number, camp.created_at,
      camp.completed_at, camp.interruption_requested_at,
      camp.interruption_effective_day_number, day.day_number
    from public.rider_form_camps as camp
    join public.team_seasons as team_season
      on team_season.id = camp.team_season_id
     and team_season.season_id = camp.season_id
    join public.season_days as day
      on day.id = p_season_day_id
     and day.season_id = camp.season_id
    where camp.team_season_id = p_team_season_id
      and camp.camp_type in ('classic', 'premium')
      and day.day_number between camp.start_day_number and camp.end_day_number
  ),
  recorded_camps as (
    -- An interrupted camp can later become cancelled; its already earned
    -- historical gains remain valid. A future camp cancelled before its first
    -- day must not be mistaken for a later replacement camp's ledger effect.
    -- DISTINCT ON also prevents malformed overlapping old camps multiplying a
    -- single ledger effect. Normal booking already forbids such overlaps.
    select distinct on (effect.id)
      effect.id, camp.rider_id, camp.camp_type,
      camp.start_day_number, camp.end_day_number,
      effect.form_before, effect.form_after,
      greatest(0, effect.form_after - effect.form_before) as actual_form_gain
    from eligible_camps as camp
    join public.rider_daily_condition_effects as effect
      on effect.rider_id = camp.rider_id
     and effect.season_day_id = p_season_day_id
     and effect.effect_type = 'form_camp'
    where camp.created_at <= effect.applied_at
      and (
        camp.status <> 'cancelled'
        or (
          camp.interruption_requested_at is not null
          and camp.day_number < camp.interruption_effective_day_number
        )
        or camp.completed_at > effect.applied_at
      )
    order by effect.id, (camp.status = 'cancelled'), camp.created_at desc, camp.id
  )
  select jsonb_build_object(
    'riders', coalesce(jsonb_agg(jsonb_build_object(
      'riderId', report.rider_id,
      'firstName', rider.first_name,
      'lastName', rider.last_name,
      'campType', report.camp_type,
      'startDayNumber', report.start_day_number,
      'endDayNumber', report.end_day_number,
      'formBefore', report.form_before,
      'formAfter', report.form_after,
      'formDelta', report.actual_form_gain
    ) order by rider.last_name, rider.first_name, rider.id), '[]'::jsonb),
    'riderCount', count(*)::integer,
    'totalFormGain', coalesce(sum(report.actual_form_gain), 0)
  )
  from recorded_camps as report
  join public.riders as rider on rider.id = report.rider_id;
$$;

revoke all on function private.get_team_daily_form_camp_report(uuid, uuid)
  from public, anon, authenticated;

create or replace function public.get_current_team_daily_form_camp_report(
  p_day_number integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '3000ms'
as $$
declare
  v_context record;
  v_day record;
  v_day_number integer;
  v_report jsonb := jsonb_build_object(
    'riders', '[]'::jsonb, 'riderCount', 0, 'totalFormGain', 0
  );
begin
  select team_season.id as team_season_id,
    team_season.display_name as team_name,
    season.id as season_id, season.name as season_name,
    coalesce(season.current_day_number, 1)::integer as current_day_number
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.teams as team
    on team.id = assignment.team_id and team.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = team.id
   and team_season.season_id = season.id
   and team_season.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then return null; end if;

  -- A camp day is settled overnight and its gain applies on the next game day.
  -- J1 therefore has no completed camp day, even if future ledger data exists.
  v_day_number := greatest(1, least(
    coalesce(p_day_number, v_context.current_day_number - 1),
    greatest(1, v_context.current_day_number - 1)
  ));
  select day.id, day.calendar_date
  into v_day
  from public.season_days as day
  where day.season_id = v_context.season_id
    and day.day_number = v_day_number;

  if v_day is null then return null; end if;

  if v_context.current_day_number > 1 then
    v_report := private.get_team_daily_form_camp_report(
      v_context.team_season_id, v_day.id
    );
  end if;

  return v_report || jsonb_build_object(
    'teamName', v_context.team_name,
    'seasonName', v_context.season_name,
    'dayNumber', v_day_number,
    'currentDayNumber', v_context.current_day_number,
    'calendarDate', v_day.calendar_date
  );
end;
$$;

revoke all on function public.get_current_team_daily_form_camp_report(integer)
  from public, anon, service_role;
grant execute on function public.get_current_team_daily_form_camp_report(integer)
  to authenticated;

-- Add a compact report to the existing initial assistant response. Keep all
-- existing columns/alerts and the existing 3-second execution budget unchanged.
do $patch$
declare
  v_definition text;
  v_anchor constant text := $anchor$'equipmentPartnerSignatureAvailable', ($anchor$;
begin
  v_definition := pg_get_functiondef(
    'public.get_current_dashboard_assistant_summary()'::regprocedure
  );
  if position('formCampReport' in v_definition) > 0 or
    (length(v_definition) - length(replace(v_definition, v_anchor, '')))
      / length(v_anchor) <> 1 then
    raise exception 'Unexpected dashboard function; form camp report update cancelled.';
  end if;
  execute replace(v_definition, v_anchor,
    $replacement$'formCampReport', (
        select jsonb_build_object(
          'dayNumber', previous_day.day_number,
          'riderCount', report.data -> 'riderCount',
          'totalFormGain', report.data -> 'totalFormGain'
        )
        from current_context as context
        join public.season_days as previous_day
          on previous_day.season_id = context.season_id
         and previous_day.day_number = context.current_day_number - 1
        cross join lateral (
          select private.get_team_daily_form_camp_report(
            context.team_season_id, previous_day.id
          ) as data
          offset 0
        ) as report
        where (report.data ->> 'riderCount')::integer > 0
      ),
      'equipmentPartnerSignatureAvailable', ($replacement$
  );
end;
$patch$;

comment on function public.get_current_team_daily_form_camp_report(integer) is
  'Read-only form-camp report for the connected team and a completed game day; actual gains only, no settlement.';

notify pgrst, 'reload schema';
commit;
