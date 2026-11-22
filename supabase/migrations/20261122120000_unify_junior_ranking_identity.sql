begin;
set local lock_timeout = '1s';
set local statement_timeout = '10s';

-- A person may race as youth:<id> for a club and federation-youth:<id>
-- for a nation. Those are result-context keys, not separate people.
-- Keep the ledger unchanged, including its historical team/nation snapshots.
alter table public.development_ranking_entries
  add column ranked_rider_count integer,
  add constraint development_ranking_entries_ranked_rider_count_valid check (
    ranked_rider_count is null
    or (entity_type = 'team' and ranked_rider_count >= 0)
  );

comment on column public.development_ranking_entries.ranked_rider_count is
  'Distinct classified people credited to this team in the season, including riders who later changed teams.';

create or replace function public.refresh_development_rankings(
  p_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '5s'
set statement_timeout = '30s'
as $$
declare
  v_game_year integer;
  v_count integer := 0;
begin
  select game_year into v_game_year
  from public.seasons where id = p_season_id;
  if coalesce(v_game_year, 0) < 3 then return 0; end if;

  perform pg_advisory_xact_lock(
    hashtextextended('development-rankings:' || p_season_id::text, 0)
  );

  delete from public.development_ranking_entries
  where season_id = p_season_id;

  insert into public.development_ranking_entries (
    season_id, entity_type, entity_key, academy_rider_id,
    development_team_id, display_name, secondary_name, country_code,
    points, wins, podiums, race_count, ranked_rider_count
  )
  with source as materialized (
    select result.*,
      coalesce('youth:' || result.academy_rider_id::text, result.competitor_key) as rider_key,
      coalesce(development_team.display_name, virtual.team_name, result.team_name) as ranking_team_name,
      case when result.development_team_id is not null
        then result.development_team_id::text
        else 'virtual-team:' || coalesce(virtual.team_name, result.team_name, 'Indépendants')
      end as team_key,
      edition.end_day_number
    from public.development_race_results as result
    join public.development_race_editions as edition
      on edition.id = result.race_edition_id
     and edition.season_id = p_season_id
     and edition.status = 'completed'
    left join public.development_teams as development_team
      on development_team.id = result.development_team_id
    left join public.development_virtual_riders as virtual
      on result.competitor_key = 'virtual:' || virtual.id::text
  ), latest as (
    -- All displayed identity fields come from the same latest result, never
    -- independent MAX values or a present-day roster that rewrites history.
    select distinct on (rider_key)
      rider_key, academy_rider_id, development_team_id, rider_name,
      ranking_team_name, country_code
    from source
    order by rider_key, end_day_number desc, created_at desc,
      (result_scope = 'general') desc, id desc
  ), individuals as (
    select rider_key,
      sum(points)::integer as points,
      count(*) filter (where result_scope = 'general' and rank = 1)::integer as wins,
      count(*) filter (where result_scope = 'general' and rank <= 3)::integer as podiums,
      count(distinct race_edition_id) filter (where result_scope = 'general')::integer as race_count
    from source
    group by rider_key
  ), teams as (
    -- Aggregate the ledger directly: merging a person's individual row must
    -- not move all their old points to the latest club displayed beside them.
    select team_key, development_team_id,
      max(ranking_team_name) as display_name,
      sum(points)::integer as points,
      count(*) filter (where result_scope = 'general' and rank = 1)::integer as wins,
      count(*) filter (where result_scope = 'general' and rank <= 3)::integer as podiums,
      count(distinct (rider_key, race_edition_id))
        filter (where result_scope = 'general')::integer as race_count,
      count(distinct rider_key)::integer as ranked_rider_count
    from source
    group by team_key, development_team_id
  ), nation_riders as (
    -- A naturalization changes future results, not the nation that earned
    -- earlier points. Rank each distinct person once within each nation.
    select country_code, rider_key, max(rider_name) as display_name,
      sum(points)::integer as points,
      count(*) filter (where result_scope = 'general' and rank = 1)::integer as wins,
      count(*) filter (where result_scope = 'general' and rank <= 3)::integer as podiums
    from source
    where country_code is not null
    group by country_code, rider_key
  ), ranked_nation_riders as (
    select nation_riders.*,
      row_number() over (
        partition by country_code
        order by points desc, wins desc, display_name, rider_key
      ) as nation_rank
    from nation_riders
  ), nations as (
    select ranked.country_code,
      coalesce(country.name, ranked.country_code) as display_name,
      sum(ranked.points) filter (where ranked.nation_rank <= 5)::integer as points,
      sum(ranked.wins) filter (where ranked.nation_rank <= 5)::integer as wins,
      sum(ranked.podiums) filter (where ranked.nation_rank <= 5)::integer as podiums,
      count(*) filter (where ranked.nation_rank <= 5)::integer as race_count
    from ranked_nation_riders as ranked
    left join public.countries as country on country.iso_alpha2 = ranked.country_code
    group by ranked.country_code, country.name
  )
  select p_season_id, 'individual', individual.rider_key,
    latest.academy_rider_id, latest.development_team_id, latest.rider_name,
    latest.ranking_team_name, latest.country_code,
    individual.points, individual.wins, individual.podiums, individual.race_count,
    null::integer
  from individuals as individual
  join latest using (rider_key)
  union all
  select p_season_id, 'team', team_key, null::uuid, development_team_id,
    display_name, null::text, null::text, points, wins, podiums, race_count,
    ranked_rider_count
  from teams
  union all
  select p_season_id, 'nation', country_code, null::uuid, null::uuid,
    display_name, 'Top 5 juniors', country_code, points, wins, podiums, race_count,
    null::integer
  from nations;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.refresh_development_rankings(uuid)
  from public, anon, authenticated;
grant execute on function public.refresh_development_rankings(uuid)
  to service_role;

comment on function public.refresh_development_rankings(uuid) is
  'Atomically rebuilds junior rankings by academy identity, preserving historical team and nation credit and serializing each season.';

-- Existing season snapshots are intentionally not rebuilt here. A reviewed
-- per-season refresh can be applied separately; finalized awards stay intact.
notify pgrst, 'reload schema';
commit;
