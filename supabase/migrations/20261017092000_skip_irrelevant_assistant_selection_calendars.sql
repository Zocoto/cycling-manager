begin;
set local application_name = 'site-latency-delivery-20261017';
set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- Conservative candidate gate, not a second selection/qualification engine.
-- The reminder starts at most two days before closing; professional closing
-- is at most 24h before departure, juniors close at their Paris departure.
-- Exact slots, quotas, qualification and publication still use the resolver.
create or replace function private.has_upcoming_federation_selection_reminder(
  p_country_id uuid, p_season_id uuid
)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.race_editions edition
    join public.races race on race.id = edition.race_id
    join public.stages stage on stage.race_edition_id = edition.id
    join public.countries country on country.id = p_country_id
    where edition.season_id = p_season_id
      and edition.status not in ('completed','cancelled')
      and race.competition_type in ('continental_championship','world_championship','nations_cup')
      and (race.competition_type <> 'continental_championship'
        or race.championship_continent_code = country.continent_code)
      and stage.departure_at > now()
      and stage.departure_at <= now() + interval '3 days'
  ) or exists (
    select 1 from public.development_race_editions edition
    join public.season_days day on day.season_id = edition.season_id
      and day.day_number = edition.start_day_number
    join public.countries country on country.id = p_country_id
    where edition.season_id = p_season_id
      and edition.status not in ('completed','cancelled')
      and edition.competition_type in ('continental_road','continental_time_trial',
        'world_road','world_time_trial','nations_cup_junior')
      and (edition.competition_type not in ('continental_road','continental_time_trial')
        or edition.championship_continent_code = country.continent_code)
      and (day.calendar_date::timestamp at time zone 'Europe/Paris') > now()
      and (day.calendar_date::timestamp at time zone 'Europe/Paris') <= now() + interval '2 days'
  );
$$;
revoke all on function private.has_upcoming_federation_selection_reminder(uuid,uuid) from public,anon,authenticated;

do $migration$
declare
  v_definition text;
  v_anchor text := E'  ),\n  active_contracts as materialized (';
  v_old text := $old$        from current_context as context
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
        ) as schedule$old$;
begin
  select replace(pg_get_functiondef('public.get_current_dashboard_assistant_summary()'::regprocedure),chr(13),'') into v_definition;
  if position('assistant_selection_window_gate_v1' in v_definition) > 0 then return; end if;
  if position(v_anchor in v_definition) = 0 or position(v_old in v_definition) = 0
    or position('selection_list.country_id = term.country_id' in v_definition) = 0 then
    raise exception 'Unexpected assistant selection reminder source: review before applying';
  end if;
  v_definition := replace(v_definition, v_anchor, $replacement$  ),
  -- assistant_selection_window_gate_v1: materialization prevents the planner
  -- from expanding the heavyweight schedule before presidency/window checks.
  manual_reminder_context as materialized (
    select context.*, term.country_id
    from current_context as context
    join public.national_federation_terms as term
      on term.president_director_id = context.sporting_director_id
      and term.governance_mode = 'elected'
      and term.start_game_year <= context.game_year
      and term.end_game_year >= context.game_year
    join public.national_federation_selection_preferences as preference
      on preference.country_id = term.country_id
      and preference.season_id = context.season_id
      and preference.automatic_selection = false
    where private.has_upcoming_federation_selection_reminder(term.country_id, context.season_id)
  ),
  active_contracts as materialized ($replacement$);
  v_definition := replace(v_definition, v_old, $replacement$        from manual_reminder_context as context
        join public.countries as country on country.id = context.country_id
        cross join lateral public.get_national_federation_selection_schedule(
          context.country_id, context.season_id
        ) as schedule$replacement$);
  v_definition := replace(v_definition, 'selection_list.country_id = term.country_id',
    'selection_list.country_id = context.country_id');
  execute v_definition;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
