begin;
set local statement_timeout = '5s';
set local lock_timeout = '500ms';

-- The exceptional S5 renewals activated the two contracts directly and
-- retained the amateur names captured on the contracts.
update public.team_seasons as team_season
set display_name = sponsor.name,
    short_name = coalesce(nullif(btrim(sponsor.short_name), ''), sponsor.name)
from public.team_sponsor_contracts as contract
join public.sponsors as sponsor on sponsor.id = contract.sponsor_id
join public.seasons as season on season.id = contract.start_season_id
  and season.id = contract.end_season_id and season.game_year = 5 and season.status = 'active'
join public.teams as team on team.id = contract.team_id and team.status = 'active'
join public.alpha_bot_managers as bot on bot.team_id = team.id
join public.sporting_directors as director on director.id = bot.sporting_director_id
  and director.auth_user_id = bot.auth_user_id and director.status = 'active'
join public.team_manager_assignments as assignment on assignment.team_id = team.id
  and assignment.sporting_director_id = director.id
  and assignment.role = 'general_manager' and assignment.status = 'active'
where contract.id in ('476e16f2-d644-41b0-9715-c4ac64ed9872', '10e6063e-7928-43b8-a361-b9c2d0239413')
  and contract.role = 'principal' and contract.status = 'active'
  and team_season.team_id = team.id and team_season.season_id = season.id and team_season.status = 'active'
  and team_season.display_name = contract.previous_team_display_name
  and team_season.short_name is not distinct from contract.previous_team_short_name
  and not exists (
    select 1 from public.secondary_sponsor_contracts as secondary
    where secondary.team_id = team.id and secondary.season_id = season.id and secondary.status = 'active'
  );

commit;
