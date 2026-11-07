begin;
set local statement_timeout = '5s';
set local lock_timeout = '500ms';

create or replace function public.get_current_team_calendar_sponsor_objective_races()
returns table (race_edition_id uuid, sponsor_role text)
language sql
stable
security definer
set search_path = ''
as $$
  select principal.race_edition_id, 'principal'::text
  from public.get_current_team_sponsor_objective_races() as principal

  union all

  select distinct objective.race_edition_id, 'secondary'::text
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.secondary_sponsor_contracts as contract
    on contract.team_id = assignment.team_id
   and contract.season_id = season.id
   and contract.status = 'active'
  join public.secondary_sponsor_objectives as objective
    on objective.offer_id = contract.offer_id
   and objective.status = 'active'
  join public.race_editions as edition
    on edition.id = objective.race_edition_id
   and edition.season_id = season.id
  where director.auth_user_id = auth.uid()
    and director.status = 'active';
$$;

revoke all on function public.get_current_team_calendar_sponsor_objective_races()
  from public, anon;
grant execute on function public.get_current_team_calendar_sponsor_objective_races()
  to authenticated, service_role;

commit;
