begin;

create or replace function public.get_current_chat_federation_context()
returns table (
  country_id uuid,
  country_code text,
  country_name text,
  sporting_director_id uuid,
  team_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    country.id,
    country.iso_alpha2,
    country.name,
    director.id,
    team.id
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.teams as team
    on team.id = assignment.team_id
   and team.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = team.id
   and team_season.season_id = season.id
   and team_season.status in ('planned', 'active')
  join public.countries as country
    on country.id = team_season.registration_country_id
   and country.is_active = true
  where director.auth_user_id = (select auth.uid())
    and director.status = 'active'
  limit 1;
$$;

revoke all on function public.get_current_chat_federation_context()
  from public, anon;
grant execute on function public.get_current_chat_federation_context()
  to authenticated, service_role;

comment on function public.get_current_chat_federation_context() is
  'Retourne la federation sportive active du DS pour charger son salon a la demande depuis le hub de chat.';

create or replace function public.get_current_global_chat_last_read_at()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select receipt.last_read_at
  from public.global_chat_read_receipts as receipt
  join public.sporting_directors as director
    on director.id = receipt.sporting_director_id
  where director.auth_user_id = (select auth.uid())
    and director.status = 'active'
  limit 1;
$$;

revoke all on function public.get_current_global_chat_last_read_at()
  from public, anon;
grant execute on function public.get_current_global_chat_last_read_at()
  to authenticated, service_role;

comment on function public.get_current_global_chat_last_read_at() is
  'Expose au DS son dernier repere de lecture afin d ouvrir le chat sur les messages manques.';

commit;
