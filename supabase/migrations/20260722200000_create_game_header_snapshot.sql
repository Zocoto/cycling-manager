begin;

create or replace function public.get_current_game_header_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'display_name', director.display_name,
    'team_id', team.id,
    'team_name', team_season.display_name,
    'team_short_name', team_season.short_name,
    'sponsor_catalog_key', sponsor.catalog_key,
    'selected_jersey_id', sponsor_contract.selected_jersey_id,
    'budget_per_season', sponsor_contract.budget_per_season,
    'currency_code', sponsor_contract.currency_code,
    'contract_duration_seasons', sponsor_contract.contract_duration_seasons
  )
  from public.sporting_directors as director
  left join lateral (
    select assignment.team_id
    from public.team_manager_assignments as assignment
    where assignment.sporting_director_id = director.id
      and assignment.role = 'general_manager'
      and assignment.status = 'active'
    order by assignment.created_at desc
    limit 1
  ) as current_assignment on true
  left join public.teams as team
    on team.id = current_assignment.team_id
  left join public.seasons as active_season
    on active_season.status = 'active'
  left join public.team_seasons as team_season
    on team_season.team_id = team.id
   and team_season.season_id = active_season.id
  left join lateral (
    select
      contract.sponsor_id,
      contract.selected_jersey_id,
      contract.budget_per_season,
      contract.currency_code,
      contract.contract_duration_seasons
    from public.team_sponsor_contracts as contract
    where contract.team_id = team.id
      and contract.role = 'principal'
      and contract.status = 'active'
    order by contract.created_at desc
    limit 1
  ) as sponsor_contract on true
  left join public.sponsors as sponsor
    on sponsor.id = sponsor_contract.sponsor_id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;
$$;

comment on function public.get_current_game_header_snapshot() is
  'Retourne en une lecture les données privées minimales du header de jeu pour réduire les allers-retours serveur.';

revoke all
on function public.get_current_game_header_snapshot()
from public, anon;

grant execute
on function public.get_current_game_header_snapshot()
to authenticated;

commit;
