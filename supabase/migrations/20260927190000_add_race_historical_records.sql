begin;

create or replace function public.get_race_historical_records(
  p_race_id uuid
)
returns table (
  record_type text,
  leaderboard_rank integer,
  rider_id uuid,
  rider_first_name text,
  rider_last_name text,
  victory_count integer,
  game_years integer[],
  latest_game_year integer,
  latest_team_name text
)
language sql
stable
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
  with target_race as (
    select race.id, race.race_format
    from public.races as race
    where race.id = p_race_id
  ), overall_victories as (
    select
      roster.rider_id,
      rider.first_name,
      rider.last_name,
      season.game_year,
      coalesce(
        team_season.display_name,
        registration.historical_team_name,
        'Équipe historique'
      ) as team_name
    from target_race
    join public.race_editions as edition
      on edition.race_id = target_race.id
     and edition.status = 'completed'
    join public.seasons as season
      on season.id = edition.season_id
    join public.race_results as result
      on result.race_edition_id = edition.id
     and result.final_rank = 1
     and result.status = 'classified'
    join public.race_rosters as roster
      on roster.id = result.race_roster_id
    join public.riders as rider
      on rider.id = roster.rider_id
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    left join public.team_seasons as team_season
      on team_season.id = registration.team_season_id
  ), overall_aggregates as (
    select
      victory.rider_id,
      max(victory.first_name) as first_name,
      max(victory.last_name) as last_name,
      count(*)::integer as victory_count,
      array_agg(
        distinct victory.game_year
        order by victory.game_year desc
      )::integer[] as game_years,
      max(victory.game_year)::integer as latest_game_year,
      (array_agg(
        victory.team_name
        order by victory.game_year desc, victory.team_name
      ))[1] as latest_team_name
    from overall_victories as victory
    group by victory.rider_id
  ), ranked_overall as (
    select
      'overall'::text as record_type,
      dense_rank() over (
        order by aggregate.victory_count desc
      )::integer as leaderboard_rank,
      aggregate.*
    from overall_aggregates as aggregate
  ), stage_victories as (
    select
      roster.rider_id,
      rider.first_name,
      rider.last_name,
      season.game_year,
      stage.stage_number,
      coalesce(
        team_season.display_name,
        registration.historical_team_name,
        'Équipe historique'
      ) as team_name
    from target_race
    join public.race_editions as edition
      on edition.race_id = target_race.id
     and edition.status = 'completed'
    join public.seasons as season
      on season.id = edition.season_id
    join public.stages as stage
      on stage.race_edition_id = edition.id
    join public.stage_results as result
      on result.stage_id = stage.id
     and result.rank = 1
     and result.status = 'finished'
    join public.race_rosters as roster
      on roster.id = result.race_roster_id
    join public.riders as rider
      on rider.id = roster.rider_id
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    left join public.team_seasons as team_season
      on team_season.id = registration.team_season_id
    where target_race.race_format = 'stage_race'
  ), stage_aggregates as (
    select
      victory.rider_id,
      max(victory.first_name) as first_name,
      max(victory.last_name) as last_name,
      count(*)::integer as victory_count,
      array_agg(
        distinct victory.game_year
        order by victory.game_year desc
      )::integer[] as game_years,
      max(victory.game_year)::integer as latest_game_year,
      (array_agg(
        victory.team_name
        order by victory.game_year desc,
          victory.stage_number desc,
          victory.team_name
      ))[1] as latest_team_name
    from stage_victories as victory
    group by victory.rider_id
  ), ranked_stages as (
    select
      'stage'::text as record_type,
      dense_rank() over (
        order by aggregate.victory_count desc
      )::integer as leaderboard_rank,
      aggregate.*
    from stage_aggregates as aggregate
  )
  select
    ranked.record_type,
    ranked.leaderboard_rank,
    ranked.rider_id,
    ranked.first_name,
    ranked.last_name,
    ranked.victory_count,
    ranked.game_years,
    ranked.latest_game_year,
    ranked.latest_team_name
  from (
    select * from ranked_overall
    union all
    select * from ranked_stages
  ) as ranked
  order by
    case ranked.record_type when 'overall' then 1 else 2 end,
    ranked.leaderboard_rank,
    ranked.latest_game_year desc,
    ranked.last_name,
    ranked.first_name;
$$;

revoke all on function public.get_race_historical_records(uuid)
from public, anon;

grant execute on function public.get_race_historical_records(uuid)
to authenticated, service_role;

comment on function public.get_race_historical_records(uuid) is
  'Classe les records historiques de victoires finales et, pour les tours, de victoires d’étapes à partir des résultats officiels.';

notify pgrst, 'reload schema';

commit;
