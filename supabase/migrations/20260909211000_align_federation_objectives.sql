begin;

-- The score used for federation race creation and for the next-season
-- objective grant must mirror the five objectives shown in the interface.
create or replace function public.get_national_federation_race_creation_score(
  p_country_id uuid,
  p_season_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '15s'
as $$
declare
  v_season public.seasons%rowtype;
  v_previous_season_id uuid;
  v_nation_rank integer := 173;
  v_rank_target integer := 24;
  v_reference_teams integer := 0;
  v_current_teams integer := 0;
  v_member_target integer := 1;
  v_naturalizations integer := 0;
  v_naturalization_target integer := 1;
  v_published_selections integer := 0;
  v_nations_cup_rank integer;
  v_championship_rank integer;
  v_completed_objectives integer := 0;
  v_existing_races integer := 0;
  v_ranking_points integer := 0;
  v_objective_points integer := 0;
  v_calendar_penalty integer := 0;
  v_total integer := 0;
begin
  select * into v_season from public.seasons where id = p_season_id;
  if v_season.id is null or not exists (
    select 1 from public.countries as country
    where country.id = p_country_id and country.is_active = true
  ) then
    raise exception 'La saison ou la fédération est introuvable.';
  end if;

  with country_points as (
    select ranking.country_id, sum(ranking.uci_points)::bigint as points
    from public.get_national_championship_country_rankings(p_season_id) as ranking
    group by ranking.country_id
  ), ranked as (
    select country_id,
      row_number() over (order by points desc, country_id)::integer as rank
    from country_points
  )
  select coalesce(rank, 173) into v_nation_rank
  from ranked where country_id = p_country_id;
  v_nation_rank := coalesce(v_nation_rank, 173);
  v_rank_target := case
    when v_nation_rank <= 16 then 8
    when v_nation_rank <= 48 then 16
    else 24
  end;

  select season.id into v_previous_season_id
  from public.seasons as season
  where season.game_year = v_season.game_year - 1;
  select count(*)::integer into v_reference_teams
  from public.team_seasons as team_season
  where team_season.season_id = coalesce(v_previous_season_id, p_season_id)
    and team_season.registration_country_id = p_country_id
    and team_season.status in ('planned', 'active', 'completed');
  select count(*)::integer into v_current_teams
  from public.team_seasons as team_season
  where team_season.season_id = p_season_id
    and team_season.registration_country_id = p_country_id
    and team_season.status in ('planned', 'active', 'completed');
  v_member_target := v_reference_teams
    + case when v_reference_teams >= 8 then 2 else 1 end;
  if v_current_teams >= v_member_target then
    v_completed_objectives := v_completed_objectives + 1;
  end if;

  v_naturalization_target := least(
    3,
    greatest(1, ceil(greatest(1, v_reference_teams)::numeric / 4)::integer)
  );
  select count(*)::integer into v_naturalizations
  from public.rider_naturalizations as naturalization
  where naturalization.season_id = p_season_id
    and naturalization.to_country_id = p_country_id;
  if v_naturalizations >= v_naturalization_target then
    v_completed_objectives := v_completed_objectives + 1;
  end if;

  select count(*)::integer into v_published_selections
  from public.national_federation_selection_lists as selection_list
  where selection_list.country_id = p_country_id
    and selection_list.season_id = p_season_id
    and selection_list.created_by_director_id is not null
    and selection_list.status in ('pending_confirmation', 'finalized');
  if v_published_selections >= 5 then
    v_completed_objectives := v_completed_objectives + 1;
  end if;

  select standing.overall_rank into v_nations_cup_rank
  from public.get_national_federation_nations_cup_standings(p_season_id)
    as standing
  where standing.country_id = p_country_id
    and standing.events_count > 0;
  if v_nations_cup_rank is not null and v_nations_cup_rank <= v_rank_target then
    v_completed_objectives := v_completed_objectives + 1;
  end if;

  select min(result.final_rank)::integer into v_championship_rank
  from public.race_results as result
  join public.race_editions as edition
    on edition.id = result.race_edition_id and edition.season_id = p_season_id
  join public.races as race
    on race.id = edition.race_id
   and race.competition_type in ('world_championship', 'continental_championship')
  join public.race_rosters as roster on roster.id = result.race_roster_id
  join public.riders as rider
    on rider.id = roster.rider_id and rider.country_id = p_country_id
  where result.status = 'classified';
  if v_championship_rank is not null and v_championship_rank <= v_rank_target then
    v_completed_objectives := v_completed_objectives + 1;
  end if;

  select count(*)::integer into v_existing_races
  from public.races as race
  where race.country_id = p_country_id
    and race.competition_type = 'standard'
    and race.status = 'active';

  v_ranking_points := greatest(0, 41 - v_nation_rank);
  v_objective_points := v_completed_objectives * 15;
  v_calendar_penalty := v_existing_races * 10;
  v_total := greatest(
    0,
    least(100, v_ranking_points + v_objective_points - v_calendar_penalty)
  );

  return jsonb_build_object(
    'nationRank', nullif(v_nation_rank, 173),
    'rankingPoints', v_ranking_points,
    'completedObjectiveCount', v_completed_objectives,
    'objectivePoints', v_objective_points,
    'existingRaceCount', v_existing_races,
    'calendarPenalty', v_calendar_penalty,
    'total', v_total,
    'threshold', 60,
    'eligible', v_total >= 60
  );
end;
$$;

notify pgrst, 'reload schema';

commit;
