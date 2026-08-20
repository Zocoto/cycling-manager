begin;

-- Une prolongation conserve une ligne distincte afin que son nouveau salaire
-- ne s'applique qu'a la saison suivante. L'effectif doit néanmoins exposer
-- l'échéance globale couverte par le contrat actif et sa prolongation.
create or replace function public.get_current_team_roster()
returns table (
  rider_id uuid,
  first_name text,
  last_name text,
  country_id uuid,
  country_name text,
  country_iso_alpha2 text,
  avatar_profile_key text,
  avatar_seed bigint,
  age integer,
  mountain integer,
  hills integer,
  flat integer,
  time_trial integer,
  cobbles integer,
  sprint integer,
  acceleration integer,
  downhill integer,
  endurance integer,
  resistance integer,
  recovery integer,
  breakaway integer,
  prologue integer,
  salary_per_season numeric,
  contract_currency text,
  contract_end_season_id uuid,
  contract_end_season_name text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  authenticated_user_id uuid := auth.uid();
begin
  if authenticated_user_id is null then
    raise exception 'Utilisateur non authentifie.';
  end if;

  return query
  with current_context as (
    select
      teams.id::uuid as current_team_id,
      seasons.id::uuid as current_season_id,
      seasons.game_year::integer as current_game_year
    from public.sporting_directors
    inner join public.team_manager_assignments
      on team_manager_assignments.sporting_director_id =
        sporting_directors.id
      and team_manager_assignments.role = 'general_manager'
      and team_manager_assignments.status = 'active'
    inner join public.teams
      on teams.id = team_manager_assignments.team_id
      and teams.status = 'active'
    inner join public.seasons
      on seasons.status = 'active'
    where sporting_directors.auth_user_id = authenticated_user_id
    limit 1
  )
  select
    riders.id::uuid,
    riders.first_name::text,
    riders.last_name::text,
    riders.country_id::uuid,
    countries.name::text,
    countries.iso_alpha2::text,
    riders.avatar_profile_key::text,
    riders.avatar_seed::bigint,
    rider_season_ratings.age::integer,
    rider_season_ratings.mountain::integer,
    rider_season_ratings.hills::integer,
    rider_season_ratings.flat::integer,
    rider_season_ratings.time_trial::integer,
    rider_season_ratings.cobbles::integer,
    rider_season_ratings.sprint::integer,
    rider_season_ratings.acceleration::integer,
    rider_season_ratings.downhill::integer,
    rider_season_ratings.endurance::integer,
    rider_season_ratings.resistance::integer,
    rider_season_ratings.recovery::integer,
    rider_season_ratings.breakaway::integer,
    rider_season_ratings.prologue::integer,
    rider_contracts.salary_per_season::numeric,
    rider_contracts.currency::text,
    effective_contract_end_season.id::uuid,
    effective_contract_end_season.name::text
  from current_context
  inner join public.rider_contracts
    on rider_contracts.team_id = current_context.current_team_id
    and rider_contracts.status = 'active'
  inner join public.seasons as contract_start_season
    on contract_start_season.id = rider_contracts.start_season_id
  inner join public.seasons as active_contract_end_season
    on active_contract_end_season.id = rider_contracts.end_season_id
  left join lateral (
    select successor.end_season_id
    from public.rider_contracts as successor
    inner join public.seasons as successor_end_season
      on successor_end_season.id = successor.end_season_id
    where successor.rider_id = rider_contracts.rider_id
      and successor.team_id = rider_contracts.team_id
      and successor.id <> rider_contracts.id
      and successor.status = 'planned'
      and successor.acquisition_type = 'renewal'
    order by
      successor_end_season.game_year desc,
      successor.signed_at desc nulls last,
      successor.id
    limit 1
  ) as renewal on true
  inner join public.seasons as effective_contract_end_season
    on effective_contract_end_season.id = coalesce(
      renewal.end_season_id,
      rider_contracts.end_season_id
    )
  inner join public.riders
    on riders.id = rider_contracts.rider_id
    and riders.status = 'active'
  inner join public.rider_season_ratings
    on rider_season_ratings.rider_id = riders.id
    and rider_season_ratings.season_id = current_context.current_season_id
  inner join public.countries
    on countries.id = riders.country_id
  where contract_start_season.game_year::integer <=
      current_context.current_game_year
    and active_contract_end_season.game_year::integer >=
      current_context.current_game_year
  order by riders.last_name asc, riders.first_name asc;
end;
$$;

comment on function public.get_current_team_roster() is
  'Retourne l effectif actuel et l échéance globale de chaque contrat, prolongations planifiées incluses.';

revoke all
on function public.get_current_team_roster()
from public, anon;

grant execute
on function public.get_current_team_roster()
to authenticated;

notify pgrst, 'reload schema';

commit;
