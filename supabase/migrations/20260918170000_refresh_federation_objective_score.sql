begin;

-- The API reads this audit table with the service key. A missing SELECT grant
-- previously made the whole federation objective panel fall back to zero.
grant select on table public.rider_naturalizations to service_role;

create or replace function public.get_national_federation_race_creation_score_base(
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
  v_country_code text;
  v_nation_rank integer := 173;
  v_rank_target integer := 24;
  v_reference_teams integer := 0;
  v_current_teams integer := 0;
  v_member_target integer := 1;
  v_naturalizations integer := 0;
  v_naturalization_target integer := 1;
  v_published_selections integer := 0;
  v_nations_cup_rank integer;
  v_nations_cup_overall_rank integer;
  v_nations_cup_events integer := 0;
  v_nations_cup_pool_size integer := 0;
  v_nations_cup_target integer := 1;
  v_world_rank integer;
  v_continental_rank integer;
  v_junior_rank integer;
  v_school_count integer := 0;
  v_team_uci_rank integer;
  v_rider_uci_rank integer;
  v_team_uci_target integer := 35;
  v_rider_uci_target integer := 200;
  v_variants text[] := array[
    'naturalizations', 'championships', 'continental',
    'junior_championships', 'cycling_school', 'team_uci', 'rider_uci'
  ];
  v_offset integer;
  v_variant text;
  v_completed_objectives integer := 0;
  v_existing_races integer := 0;
  v_ranking_points integer := 0;
  v_objective_points integer := 0;
  v_calendar_penalty integer := 0;
  v_total integer := 0;
begin
  select * into v_season from public.seasons where id = p_season_id;
  select iso_alpha2 into v_country_code
  from public.countries
  where id = p_country_id and is_active = true;
  if v_season.id is null or v_country_code is null then
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
  v_team_uci_target := case when v_nation_rank <= 16 then 20 else 35 end;
  v_rider_uci_target := case
    when v_nation_rank <= 16 then 50
    when v_nation_rank <= 48 then 100
    else 200
  end;

  select id into v_previous_season_id
  from public.seasons where game_year = v_season.game_year - 1;
  select count(*)::integer into v_reference_teams
  from public.team_seasons
  where season_id = coalesce(v_previous_season_id, p_season_id)
    and registration_country_id = p_country_id
    and status in ('planned', 'active', 'completed');
  select count(*)::integer into v_current_teams
  from public.team_seasons
  where season_id = p_season_id
    and registration_country_id = p_country_id
    and status in ('planned', 'active', 'completed');
  v_member_target := v_reference_teams
    + case when v_reference_teams >= 8 then 2 else 1 end;
  if v_current_teams >= v_member_target then
    v_completed_objectives := v_completed_objectives + 1;
  end if;

  v_naturalization_target := least(
    3, greatest(1, ceil(greatest(1, v_reference_teams)::numeric / 4)::integer)
  );
  select count(*)::integer into v_naturalizations
  from public.rider_naturalizations
  where season_id = p_season_id and to_country_id = p_country_id;

  select count(*)::integer into v_published_selections
  from public.national_federation_selection_lists
  where country_id = p_country_id
    and season_id = p_season_id
    and manually_submitted_at is not null
    and status in ('pending_confirmation', 'finalized');
  if v_published_selections >= 5 then
    v_completed_objectives := v_completed_objectives + 1;
  end if;

  with standings as materialized (
    select * from public.get_national_federation_nations_cup_standings(p_season_id)
  )
  select
    case when own.group_code is null then own.division_rank else own.group_rank end,
    own.overall_rank,
    own.events_count,
    (select count(*)::integer from standings as peer
     where peer.division = own.division
       and peer.group_code is not distinct from own.group_code)
  into v_nations_cup_rank, v_nations_cup_overall_rank,
       v_nations_cup_events, v_nations_cup_pool_size
  from standings as own where own.country_id = p_country_id;
  v_nations_cup_events := coalesce(v_nations_cup_events, 0);
  v_nations_cup_target := greatest(
    1, least(5, ceil(coalesce(v_nations_cup_pool_size, 0) * 0.6)::integer)
  );
  if v_nations_cup_events > 0 and (
    (v_season.game_year % 4 = 0 and v_nations_cup_overall_rank <= v_rank_target)
    or (v_season.game_year % 4 <> 0 and v_nations_cup_rank <= v_nations_cup_target)
  ) then
    v_completed_objectives := v_completed_objectives + 1;
  end if;

  select min(result.final_rank)::integer into v_world_rank
  from public.race_results as result
  join public.race_editions as edition
    on edition.id = result.race_edition_id and edition.season_id = p_season_id
  join public.races as race
    on race.id = edition.race_id and race.competition_type = 'world_championship'
  join public.race_rosters as roster on roster.id = result.race_roster_id
  join public.riders as rider
    on rider.id = roster.rider_id and rider.country_id = p_country_id
  where result.status = 'classified';

  if v_season.game_year <= 3 then
    if v_naturalizations >= v_naturalization_target then
      v_completed_objectives := v_completed_objectives + 1;
    end if;
    if v_world_rank is not null and v_world_rank <= v_rank_target then
      v_completed_objectives := v_completed_objectives + 1;
    end if;
  else
    -- Same stable, season-specific two-slot selection as the UI. The array
    -- order is version 1 and must stay fixed for seasons already started.
    v_offset := (get_byte(uuid_send(p_country_id), 0) + v_season.game_year)
      % array_length(v_variants, 1);

    foreach v_variant in array array[
      v_variants[v_offset + 1],
      v_variants[((v_offset + 3) % array_length(v_variants, 1)) + 1]
    ] loop
      if v_variant = 'naturalizations' then
        if v_naturalizations >= v_naturalization_target then
          v_completed_objectives := v_completed_objectives + 1;
        end if;
      elsif v_variant = 'championships' then
        if v_world_rank is not null and v_world_rank <= v_rank_target then
          v_completed_objectives := v_completed_objectives + 1;
        end if;
      elsif v_variant = 'continental' then
        select min(result.final_rank)::integer into v_continental_rank
        from public.race_results as result
        join public.race_editions as edition
          on edition.id = result.race_edition_id and edition.season_id = p_season_id
        join public.races as race
          on race.id = edition.race_id
         and race.competition_type = 'continental_championship'
        join public.race_rosters as roster on roster.id = result.race_roster_id
        join public.riders as rider
          on rider.id = roster.rider_id and rider.country_id = p_country_id
        where result.status = 'classified';
        if v_continental_rank is not null and v_continental_rank <= v_rank_target then
          v_completed_objectives := v_completed_objectives + 1;
        end if;
      elsif v_variant = 'junior_championships' then
        select min(result.rank)::integer into v_junior_rank
        from public.development_race_results as result
        join public.development_race_editions as edition
          on edition.id = result.race_edition_id
         and edition.season_id = p_season_id
         and edition.competition_type in (
           'continental_road', 'continental_time_trial',
           'world_road', 'world_time_trial'
         )
        where result.country_code = v_country_code
          and result.result_scope = 'general';
        if v_junior_rank is not null and v_junior_rank <= v_rank_target then
          v_completed_objectives := v_completed_objectives + 1;
        end if;
      elsif v_variant = 'cycling_school' then
        select count(*)::integer into v_school_count
        from public.international_youth_centers as center
        join public.team_seasons as team_season
          on team_season.team_id = center.team_id
         and team_season.season_id = p_season_id
         and team_season.registration_country_id = p_country_id
         and team_season.status in ('planned', 'active', 'completed')
        where center.country_id = p_country_id
          and center.completed_at >= v_season.starts_on
          and center.completed_at < v_season.ends_on + 1;
        if v_school_count > 0 then
          v_completed_objectives := v_completed_objectives + 1;
        end if;
      elsif v_variant = 'team_uci' then
        with ranked as (
          select registration_country_id,
            row_number() over (order by points desc, display_name, team_id) as rank
          from public.team_seasons
          where season_id = p_season_id and status <> 'withdrawn' and points > 0
        )
        select min(rank)::integer into v_team_uci_rank
        from ranked where registration_country_id = p_country_id;
        if v_team_uci_rank is not null and v_team_uci_rank <= v_team_uci_target then
          v_completed_objectives := v_completed_objectives + 1;
        end if;
      elsif v_variant = 'rider_uci' then
        with ranked as (
          select rider.country_id,
            row_number() over (
              order by summary.points desc,
                rider.first_name || ' ' || rider.last_name, rider.id
            ) as rank
          from public.rider_season_summaries as summary
          join public.riders as rider on rider.id = summary.rider_id
          where summary.season_id = p_season_id and summary.points > 0
        )
        select min(rank)::integer into v_rider_uci_rank
        from ranked where country_id = p_country_id;
        if v_rider_uci_rank is not null and v_rider_uci_rank <= v_rider_uci_target then
          v_completed_objectives := v_completed_objectives + 1;
        end if;
      end if;
    end loop;
  end if;

  select count(*)::integer into v_existing_races
  from public.races
  where country_id = p_country_id
    and competition_type = 'standard'
    and status = 'active';
  v_ranking_points := greatest(0, 41 - v_nation_rank);
  v_objective_points := v_completed_objectives * 15;
  v_calendar_penalty := v_existing_races * 10;
  v_total := greatest(0, least(100,
    v_ranking_points + v_objective_points - v_calendar_penalty
  ));

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
