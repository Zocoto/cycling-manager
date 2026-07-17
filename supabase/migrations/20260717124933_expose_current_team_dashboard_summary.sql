begin;

-- ============================================================
-- RÉSUMÉ DE L'ÉQUIPE DU DIRECTEUR SPORTIF CONNECTÉ
--
-- Cette fonction expose uniquement les informations nécessaires
-- à l'affichage du tableau de bord :
-- - l'équipe actuellement dirigée ;
-- - son nom pour la saison active ;
-- - le nombre de coureurs sous contrat pendant cette saison ;
-- - les informations principales de la saison.
--
-- Elle évite d'ouvrir directement les tables protégées par RLS.
-- ============================================================

create or replace function public.get_current_team_dashboard_summary()
returns table (
  team_id uuid,
  team_name text,
  rider_count integer,
  season_id uuid,
  season_name text,
  season_day_number integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  authenticated_user_id uuid;
begin
  authenticated_user_id := auth.uid();

  if authenticated_user_id is null then
    raise exception 'Utilisateur non authentifié.';
  end if;

  return query
  with current_context as (
    select
      teams.id as team_id,
      team_seasons.display_name as team_name,
      seasons.id as season_id,
      seasons.name as season_name,
      seasons.current_day_number as season_day_number,
      seasons.game_year as season_game_year
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
    inner join public.team_seasons
      on team_seasons.team_id = teams.id
      and team_seasons.season_id = seasons.id
      and team_seasons.status = 'active'
    where sporting_directors.auth_user_id =
      authenticated_user_id
    limit 1
  ),
  active_contracts as (
    select
      rider_contracts.team_id,
      count(distinct rider_contracts.rider_id)::integer
        as rider_count
    from public.rider_contracts
    inner join public.seasons as contract_start_season
      on contract_start_season.id =
        rider_contracts.start_season_id
    inner join public.seasons as contract_end_season
      on contract_end_season.id =
        rider_contracts.end_season_id
    inner join current_context
      on current_context.team_id =
        rider_contracts.team_id
    where rider_contracts.status = 'active'
      and contract_start_season.game_year <=
        current_context.season_game_year
      and contract_end_season.game_year >=
        current_context.season_game_year
    group by rider_contracts.team_id
  )
  select
    current_context.team_id,
    current_context.team_name,
    coalesce(active_contracts.rider_count, 0)::integer,
    current_context.season_id,
    current_context.season_name,
    current_context.season_day_number
  from current_context
  left join active_contracts
    on active_contracts.team_id =
      current_context.team_id;
end;
$$;

comment on function public.get_current_team_dashboard_summary() is
  'Retourne le résumé de l’équipe et de l’effectif du Directeur Sportif authentifié pour la saison active.';

revoke all
on function public.get_current_team_dashboard_summary()
from public;

grant execute
on function public.get_current_team_dashboard_summary()
to authenticated;

commit;