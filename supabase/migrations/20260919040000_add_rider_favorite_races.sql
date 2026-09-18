-- Three season-long race affinities per professional rider. Recompute from
-- completed seasons only: the bonus cannot change halfway through a tour.
create table public.rider_favorite_races (
  season_id uuid not null references public.seasons(id) on delete cascade,
  rider_id uuid not null references public.riders(id) on delete cascade,
  race_id uuid not null references public.races(id) on delete cascade,
  preference_rank smallint not null check (preference_rank between 1 and 3),
  race_name text not null,
  race_slug text not null,
  country_name text not null,
  country_code text not null,
  category_code text not null,
  dominant_profile text not null,
  geography_code text not null check (
    geography_code in ('home', 'neighbor', 'continent', 'elsewhere')
  ),
  history_seasons integer not null default 0,
  history_podiums integer not null default 0,
  history_victories integer not null default 0,
  calculated_at timestamptz not null default now(),
  primary key (season_id, rider_id, preference_rank),
  unique (season_id, rider_id, race_id)
);

create index rider_favorite_races_simulation_idx
  on public.rider_favorite_races (season_id, race_id, rider_id);

alter table public.rider_favorite_races enable row level security;
revoke all on public.rider_favorite_races from public, anon, authenticated;
grant select on public.rider_favorite_races to service_role;

create or replace function public.refresh_due_rider_favorite_races(
  p_batch_size integer default 5000
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season_id uuid;
  v_game_year integer;
  v_inserted integer := 0;
begin
  select season.id, season.game_year
    into v_season_id, v_game_year
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_season_id is null then
    return 0;
  end if;

  -- One refresh at a time; racing and profile reads never wait for a refresh.
  if not pg_catalog.pg_try_advisory_xact_lock(1903, 3) then
    return 0;
  end if;

  with pending as materialized (
    select
      rating.*,
      rider.country_id,
      rider_country.continent_code as rider_continent_code
    from public.rider_season_ratings as rating
    join public.riders as rider on rider.id = rating.rider_id
    join public.countries as rider_country on rider_country.id = rider.country_id
    where rating.season_id = v_season_id
      and rider.status <> 'retired'
      and not exists (
        select 1
        from public.rider_favorite_races as favorite
        where favorite.season_id = v_season_id
          and favorite.rider_id = rating.rider_id
      )
    order by rating.rider_id
    limit least(greatest(coalesce(p_batch_size, 5000), 1), 5000)
  ),
  race_options as materialized (
    select
      race.id as race_id,
      edition.display_name as race_name,
      race.slug as race_slug,
      host_country.id as host_country_id,
      host_country.name as country_name,
      host_country.iso_alpha2 as country_code,
      host_country.continent_code as race_continent_code,
      category.code as category_code,
      mode() within group (order by stage.profile_type) as dominant_profile,
      count(*) as stage_count,
      count(*) filter (where stage.profile_type = 'flat') as flat_count,
      count(*) filter (where stage.profile_type = 'sprint') as sprint_count,
      count(*) filter (where stage.profile_type = 'hilly') as hilly_count,
      count(*) filter (where stage.profile_type = 'mountain') as mountain_count,
      count(*) filter (where stage.profile_type = 'cobbles') as cobbles_count,
      count(*) filter (where stage.profile_type = 'time_trial') as time_trial_count,
      count(*) filter (where stage.profile_type = 'mixed') as mixed_count
    from public.race_editions as edition
    join public.races as race on race.id = edition.race_id
    join public.race_categories as category on category.id = edition.race_category_id
    join public.countries as host_country
      on host_country.id = coalesce(edition.host_country_id, race.country_id)
    join public.stages as stage on stage.race_edition_id = edition.id
    where edition.season_id = v_season_id
      and edition.status <> 'cancelled'
      and race.status = 'active'
      and race.competition_type = 'standard'
      and category.code <> 'regional'
    group by race.id, edition.display_name, race.slug, host_country.id,
      host_country.name, host_country.iso_alpha2,
      host_country.continent_code, category.code
  ),
  race_history as materialized (
    select
      roster.rider_id,
      past_edition.race_id,
      count(distinct past_season.game_year)::integer as appearances,
      count(*) filter (where result.final_rank <= 3)::integer as podiums,
      count(*) filter (where result.final_rank = 1)::integer as victories,
      min(past_season.game_year) as first_year,
      max(past_season.game_year) as last_year
    from pending as rider
    join public.race_rosters as roster on roster.rider_id = rider.rider_id
    join public.race_results as result on result.race_roster_id = roster.id
    join public.race_editions as past_edition
      on past_edition.id = result.race_edition_id
    join public.seasons as past_season
      on past_season.id = past_edition.season_id
    where past_season.game_year < v_game_year
      and result.status <> 'did_not_start'
    group by roster.rider_id, past_edition.race_id
  ),
  affinities as (
    select
      rider.rider_id,
      race_option.*,
      coalesce(history.appearances, 0) as history_seasons,
      coalesce(history.podiums, 0) as history_podiums,
      coalesce(history.victories, 0) as history_victories,
      case
        when rider.country_id = race_option.host_country_id then 'home'
        when exists (
          select 1
          from public.country_adjacencies as adjacency
          where adjacency.country_id = rider.country_id
            and adjacency.adjacent_country_id = race_option.host_country_id
        ) then 'neighbor'
        when rider.rider_continent_code is not null
          and rider.rider_continent_code = race_option.race_continent_code
          then 'continent'
        else 'elsewhere'
      end as geography_code,
      round((
        race_option.flat_count * (rider.flat + rider.endurance) / 2.0
        + race_option.sprint_count * (rider.sprint + rider.acceleration) / 2.0
        + race_option.hilly_count * (rider.hills + rider.acceleration) / 2.0
        + race_option.mountain_count * (rider.mountain + rider.endurance) / 2.0
        + race_option.cobbles_count * (rider.cobbles + rider.resistance) / 2.0
        + race_option.time_trial_count * (rider.time_trial + rider.prologue) / 2.0
        + race_option.mixed_count * (rider.mountain + rider.hills + rider.flat) / 3.0
      ) / greatest(race_option.stage_count, 1) / 2.0)::integer as profile_score,
      case race_option.category_code
        when 'elite' then 16
        when 'world' then 12
        when 'continental' then 8
        when 'national' then 4
        else 0
      end as prestige_score,
      least(greatest(coalesce(history.appearances, 0) - 1, 0) * 5, 15)
        + least(coalesce(history.podiums, 0) * 7, 21)
        + least(coalesce(history.victories, 0) * 10, 20)
        + case
            when history.appearances >= 2
              and history.last_year - history.first_year + 1 = history.appearances
              then 5
            else 0
          end as history_score
    from pending as rider
    cross join race_options as race_option
    left join race_history as history
      on history.rider_id = rider.rider_id
     and history.race_id = race_option.race_id
  ),
  ranked as (
    select
      affinity.*,
      row_number() over (
        partition by affinity.rider_id
        order by
          affinity.profile_score + affinity.prestige_score + affinity.history_score
          + case affinity.geography_code
              when 'home' then 22
              when 'neighbor' then 12
              when 'continent' then 5
              else 0
            end desc,
          md5(affinity.rider_id::text || ':' || affinity.race_id::text)
      ) as preference_rank
    from affinities as affinity
  )
  insert into public.rider_favorite_races (
    season_id, rider_id, race_id, preference_rank, race_name, race_slug,
    country_name, country_code, category_code, dominant_profile,
    geography_code, history_seasons, history_podiums, history_victories
  )
  select
    v_season_id, ranked.rider_id, ranked.race_id,
    ranked.preference_rank::smallint, ranked.race_name, ranked.race_slug,
    ranked.country_name, ranked.country_code, ranked.category_code,
    ranked.dominant_profile, ranked.geography_code, ranked.history_seasons,
    ranked.history_podiums, ranked.history_victories
  from ranked
  where ranked.preference_rank <= 3
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

revoke all on function public.refresh_due_rider_favorite_races(integer)
  from public, anon, authenticated;
grant execute on function public.refresh_due_rider_favorite_races(integer)
  to service_role;

-- Current-season backfill. The daily maintenance job handles new riders and
-- each subsequent season, so no score is recomputed on page views or stages.
do $backfill$
declare
  v_inserted integer;
begin
  loop
    v_inserted := public.refresh_due_rider_favorite_races(5000);
    exit when v_inserted = 0;
  end loop;
end;
$backfill$;
