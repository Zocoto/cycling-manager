begin;

-- Preserve the existing directory query and expose a single public RPC that
-- appends riders without adding another browser/server round trip.
alter function public.search_game_directory(text, integer)
  rename to search_game_directory_without_riders;

revoke all
on function public.search_game_directory_without_riders(text, integer)
from public, authenticated;

create extension if not exists pg_trgm with schema extensions;

create index if not exists riders_active_full_name_trgm_idx
  on public.riders
  using gin (
    (lower(first_name || ' ' || last_name)) extensions.gin_trgm_ops
  )
  where status in ('active', 'free_agent');

create or replace function public.search_game_directory(
  p_query text,
  p_limit_per_category integer default 8
)
returns table (
  result_type text,
  entity_id uuid,
  public_identifier text,
  display_name text,
  avatar_key text,
  reputation_points integer,
  country_code text,
  country_name text,
  team_name text,
  team_id uuid,
  sponsor_name text,
  sporting_director_username text,
  sporting_director_name text,
  sporting_director_count bigint,
  team_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with search_input as (
    select
      lower(btrim(coalesce(p_query, ''))) as normalized_query,
      greatest(
        1,
        least(coalesce(p_limit_per_category, 8), 20)
      ) as result_limit
    where auth.uid() is not null
  ),
  active_season as (
    select season.id
    from public.seasons as season
    where season.status = 'active'
    limit 1
  ),
  active_rider_teams as (
    select
      contract.rider_id,
      team.id as team_id,
      team_season.display_name as team_name
    from active_season
    inner join public.rider_contracts as contract
      on contract.status = 'active'
    inner join public.teams as team
      on team.id = contract.team_id
      and team.status = 'active'
    inner join public.team_seasons as team_season
      on team_season.team_id = team.id
      and team_season.season_id = active_season.id
      and team_season.status = 'active'
  ),
  rider_results as (
    select
      'rider'::text as result_type,
      rider.id as entity_id,
      rider.id::text as public_identifier,
      concat(rider.first_name, ' ', rider.last_name)::text as display_name,
      rider.avatar_profile_key::text as avatar_key,
      coalesce(summary.points, 0)::integer as reputation_points,
      country.iso_alpha2::text as country_code,
      country.name::text as country_name,
      active_team.team_name::text as team_name,
      active_team.team_id as team_id,
      null::text as sponsor_name,
      null::text as sporting_director_username,
      null::text as sporting_director_name,
      null::bigint as sporting_director_count,
      null::bigint as team_count,
      case
        when lower(rider.first_name || ' ' || rider.last_name) = search_input.normalized_query
          then 0
        when left(
          lower(rider.first_name || ' ' || rider.last_name),
          char_length(search_input.normalized_query)
        ) = search_input.normalized_query
          then 1
        when left(lower(rider.last_name), char_length(search_input.normalized_query)) = search_input.normalized_query
          then 2
        else 3
      end as match_rank
    from search_input
    inner join public.riders as rider
      on rider.status in ('active', 'free_agent')
    inner join public.countries as country
      on country.id = rider.country_id
      and country.is_active = true
    left join active_rider_teams as active_team
      on active_team.rider_id = rider.id
    left join active_season
      on true
    left join public.rider_season_summaries as summary
      on summary.rider_id = rider.id
      and summary.season_id = active_season.id
    where char_length(search_input.normalized_query) >= 2
      and (
        lower(rider.first_name || ' ' || rider.last_name)
          like '%' || search_input.normalized_query || '%'
        or strpos(lower(country.name), search_input.normalized_query) > 0
        or lower(country.iso_alpha2) = search_input.normalized_query
        or strpos(lower(coalesce(active_team.team_name, '')), search_input.normalized_query) > 0
      )
    order by match_rank, rider.last_name, rider.first_name
    limit (select result_limit from search_input)
  )
  select
    directory.result_type,
    directory.entity_id,
    directory.public_identifier,
    directory.display_name,
    directory.avatar_key,
    directory.reputation_points,
    directory.country_code,
    directory.country_name,
    directory.team_name,
    directory.team_id,
    directory.sponsor_name,
    directory.sporting_director_username,
    directory.sporting_director_name,
    directory.sporting_director_count,
    directory.team_count
  from public.search_game_directory_without_riders(
    p_query,
    p_limit_per_category
  ) as directory
  union all
  select
    rider.result_type,
    rider.entity_id,
    rider.public_identifier,
    rider.display_name,
    rider.avatar_key,
    rider.reputation_points,
    rider.country_code,
    rider.country_name,
    rider.team_name,
    rider.team_id,
    rider.sponsor_name,
    rider.sporting_director_username,
    rider.sporting_director_name,
    rider.sporting_director_count,
    rider.team_count
  from rider_results as rider;
$$;

comment on function public.search_game_directory(text, integer) is
  'Recherche les joueurs, équipes, coureurs et nations sans exposer de données privées.';

comment on index public.riders_active_full_name_trgm_idx is
  'Accélère la recherche partielle des coureurs actifs par prénom et nom.';

revoke all
on function public.search_game_directory(text, integer)
from public;

grant execute
on function public.search_game_directory(text, integer)
to authenticated;

commit;
