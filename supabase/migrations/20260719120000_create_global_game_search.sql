begin;

-- ============================================================
-- RECHERCHE GLOBALE DU JEU
--
-- La fonction utilise security definer afin de rechercher dans les
-- tables protégées par RLS, mais ne retourne volontairement que les
-- informations publiques nécessaires aux cartes de résultats.
-- ============================================================

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
  current_teams as (
    select
      team.id,
      team_season.display_name,
      country.id as country_id,
      country.iso_alpha2 as country_code,
      country.name as country_name,
      director.id as sporting_director_id,
      director.username as sporting_director_username,
      director.display_name as sporting_director_name,
      sponsor.name as sponsor_name
    from active_season
    inner join public.team_seasons as team_season
      on team_season.season_id = active_season.id
      and team_season.status = 'active'
    inner join public.teams as team
      on team.id = team_season.team_id
      and team.status = 'active'
    inner join public.countries as country
      on country.id = team_season.registration_country_id
      and country.is_active = true
    left join public.team_manager_assignments as assignment
      on assignment.team_id = team.id
      and assignment.role = 'general_manager'
      and assignment.status = 'active'
    left join public.sporting_directors as director
      on director.id = assignment.sporting_director_id
      and director.status = 'active'
    left join public.team_sponsor_contracts as sponsor_contract
      on sponsor_contract.team_id = team.id
      and sponsor_contract.role = 'principal'
      and sponsor_contract.status = 'active'
    left join public.sponsors as sponsor
      on sponsor.id = sponsor_contract.sponsor_id
  ),
  director_results as (
    select
      'sporting_director'::text as result_type,
      director.id as entity_id,
      director.username as public_identifier,
      director.display_name,
      director.avatar_key,
      director.reputation_points,
      country.iso_alpha2 as country_code,
      country.name as country_name,
      current_team.display_name as team_name,
      current_team.id as team_id,
      null::text as sponsor_name,
      null::text as sporting_director_username,
      null::text as sporting_director_name,
      null::bigint as sporting_director_count,
      null::bigint as team_count,
      case
        when lower(director.username) = search_input.normalized_query
          or lower(director.display_name) = search_input.normalized_query
          then 0
        when left(lower(director.username), char_length(search_input.normalized_query)) = search_input.normalized_query
          or left(lower(director.display_name), char_length(search_input.normalized_query)) = search_input.normalized_query
          then 1
        when strpos(lower(director.username), search_input.normalized_query) > 0
          or strpos(lower(director.display_name), search_input.normalized_query) > 0
          then 2
        else 3
      end as match_rank
    from search_input
    inner join public.sporting_directors as director
      on director.status = 'active'
    inner join public.countries as country
      on country.id = director.country_id
      and country.is_active = true
    left join current_teams as current_team
      on current_team.sporting_director_id = director.id
    where char_length(search_input.normalized_query) >= 2
      and (
        strpos(lower(director.username), search_input.normalized_query) > 0
        or strpos(lower(director.display_name), search_input.normalized_query) > 0
        or strpos(lower(country.name), search_input.normalized_query) > 0
        or lower(country.iso_alpha2) = search_input.normalized_query
        or lower(country.iso_alpha3) = search_input.normalized_query
        or strpos(lower(coalesce(country.nationality_label, '')), search_input.normalized_query) > 0
        or strpos(lower(coalesce(current_team.display_name, '')), search_input.normalized_query) > 0
      )
    order by match_rank, director.display_name, director.username
    limit (select result_limit from search_input)
  ),
  team_results as (
    select
      'team'::text as result_type,
      current_team.id as entity_id,
      current_team.id::text as public_identifier,
      current_team.display_name,
      null::text as avatar_key,
      null::integer as reputation_points,
      current_team.country_code,
      current_team.country_name,
      null::text as team_name,
      current_team.id as team_id,
      current_team.sponsor_name,
      current_team.sporting_director_username,
      current_team.sporting_director_name,
      null::bigint as sporting_director_count,
      null::bigint as team_count,
      case
        when lower(current_team.display_name) = search_input.normalized_query
          or current_team.id::text = search_input.normalized_query
          then 0
        when left(lower(current_team.display_name), char_length(search_input.normalized_query)) = search_input.normalized_query
          then 1
        when strpos(lower(current_team.display_name), search_input.normalized_query) > 0
          then 2
        else 3
      end as match_rank
    from search_input
    inner join current_teams as current_team
      on true
    where char_length(search_input.normalized_query) >= 2
      and (
        strpos(lower(current_team.display_name), search_input.normalized_query) > 0
        or current_team.id::text = search_input.normalized_query
        or strpos(lower(current_team.country_name), search_input.normalized_query) > 0
        or lower(current_team.country_code) = search_input.normalized_query
        or strpos(lower(coalesce(current_team.sponsor_name, '')), search_input.normalized_query) > 0
        or strpos(lower(coalesce(current_team.sporting_director_username, '')), search_input.normalized_query) > 0
        or strpos(lower(coalesce(current_team.sporting_director_name, '')), search_input.normalized_query) > 0
      )
    order by match_rank, current_team.display_name
    limit (select result_limit from search_input)
  ),
  director_counts as (
    select
      director.country_id,
      count(*)::bigint as sporting_director_count
    from public.sporting_directors as director
    where director.status = 'active'
    group by director.country_id
  ),
  team_counts as (
    select
      current_team.country_id,
      count(*)::bigint as team_count
    from current_teams as current_team
    group by current_team.country_id
  ),
  country_results as (
    select
      'country'::text as result_type,
      country.id as entity_id,
      lower(country.iso_alpha2) as public_identifier,
      country.name as display_name,
      null::text as avatar_key,
      null::integer as reputation_points,
      country.iso_alpha2 as country_code,
      country.name as country_name,
      null::text as team_name,
      null::uuid as team_id,
      null::text as sponsor_name,
      null::text as sporting_director_username,
      null::text as sporting_director_name,
      coalesce(
        director_counts.sporting_director_count,
        0
      )::bigint as sporting_director_count,
      coalesce(
        team_counts.team_count,
        0
      )::bigint as team_count,
      case
        when lower(country.name) = search_input.normalized_query
          or lower(country.iso_alpha2) = search_input.normalized_query
          or lower(country.iso_alpha3) = search_input.normalized_query
          then 0
        when left(lower(country.name), char_length(search_input.normalized_query)) = search_input.normalized_query
          then 1
        else 2
      end as match_rank
    from search_input
    inner join public.countries as country
      on country.is_active = true
    left join director_counts
      on director_counts.country_id = country.id
    left join team_counts
      on team_counts.country_id = country.id
    where char_length(search_input.normalized_query) >= 2
      and (
        strpos(lower(country.name), search_input.normalized_query) > 0
        or lower(country.iso_alpha2) = search_input.normalized_query
        or lower(country.iso_alpha3) = search_input.normalized_query
        or strpos(lower(coalesce(country.nationality_label, '')), search_input.normalized_query) > 0
      )
    order by match_rank, country.name
    limit (select result_limit from search_input)
  )
  select
    result_type,
    entity_id,
    public_identifier,
    display_name,
    avatar_key,
    reputation_points,
    country_code,
    country_name,
    team_name,
    team_id,
    sponsor_name,
    sporting_director_username,
    sporting_director_name,
    sporting_director_count,
    team_count
  from director_results
  union all
  select
    result_type,
    entity_id,
    public_identifier,
    display_name,
    avatar_key,
    reputation_points,
    country_code,
    country_name,
    team_name,
    team_id,
    sponsor_name,
    sporting_director_username,
    sporting_director_name,
    sporting_director_count,
    team_count
  from team_results
  union all
  select
    result_type,
    entity_id,
    public_identifier,
    display_name,
    avatar_key,
    reputation_points,
    country_code,
    country_name,
    team_name,
    team_id,
    sponsor_name,
    sporting_director_username,
    sporting_director_name,
    sporting_director_count,
    team_count
  from country_results;
$$;

comment on function public.search_game_directory(text, integer) is
  'Recherche les Directeurs Sportifs, équipes et nations sans exposer de données privées.';

revoke all
on function public.search_game_directory(text, integer)
from public;

grant execute
on function public.search_game_directory(text, integer)
to authenticated;

commit;
