begin;

alter table public.rider_contracts
  add column squad_status text;

alter table public.rider_contracts
  add constraint rider_contracts_squad_status_allowed
  check (
    squad_status is null or squad_status in (
      'absolute_leader',
      'co_leader',
      'road_captain',
      'lieutenant',
      'free_role',
      'stage_hunter',
      'prospect',
      'domestique',
      'bottle_carrier'
    )
  );

create index rider_contracts_active_squad_status_idx
  on public.rider_contracts (team_id, squad_status, rider_id)
  where status = 'active';

create function public.set_current_team_rider_squad_status(
  p_rider_id uuid,
  p_squad_status text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_team_id uuid;
  v_status text := nullif(btrim(p_squad_status), '');
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.';
  end if;

  if v_status is not null and v_status not in (
    'absolute_leader', 'co_leader', 'road_captain', 'lieutenant',
    'free_role', 'stage_hunter', 'prospect', 'domestique', 'bottle_carrier'
  ) then
    raise exception 'Statut d’effectif invalide.';
  end if;

  select assignment.team_id into v_team_id
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.teams as team
    on team.id = assignment.team_id and team.status = 'active'
  where director.auth_user_id = (select auth.uid())
    and director.status = 'active'
  limit 1;

  if v_team_id is null then
    raise exception 'Aucune équipe active ne vous est attribuée.';
  end if;

  update public.rider_contracts as contract
  set squad_status = v_status
  where contract.rider_id = p_rider_id
    and contract.team_id = v_team_id
    and contract.status = 'active';

  if not found then
    raise exception 'Seul le DS de l’équipe actuelle peut modifier ce statut.';
  end if;

  return v_status;
end;
$$;

revoke all on function public.set_current_team_rider_squad_status(uuid,text)
from public, anon;
grant execute on function public.set_current_team_rider_squad_status(uuid,text)
to authenticated;

alter function public.get_current_team_roster_with_potential()
  rename to get_current_team_roster_with_potential_before_squad_status;
revoke all
on function public.get_current_team_roster_with_potential_before_squad_status()
from public, anon, authenticated;
grant execute
on function public.get_current_team_roster_with_potential_before_squad_status()
to service_role;

create function public.get_current_team_roster_with_potential()
returns table (
  rider_id uuid, first_name text, last_name text, country_id uuid,
  country_name text, country_iso_alpha2 text, avatar_profile_key text,
  avatar_seed bigint, age integer, mountain integer, hills integer,
  flat integer, time_trial integer, cobbles integer, sprint integer,
  acceleration integer, downhill integer, endurance integer,
  resistance integer, recovery integer, breakaway integer, prologue integer,
  salary_per_season numeric, contract_currency text,
  contract_end_season_id uuid, contract_end_season_name text,
  potential_steps integer, squad_status text
)
language sql stable security definer set search_path = ''
as $$
  select roster.*, contract.squad_status
  from public.get_current_team_roster_with_potential_before_squad_status()
    as roster
  join public.rider_contracts as contract
    on contract.rider_id = roster.rider_id
   and contract.status = 'active';
$$;

revoke all on function public.get_current_team_roster_with_potential()
from public, anon;
grant execute on function public.get_current_team_roster_with_potential()
to authenticated;

alter function public.get_current_team_race_roster_options(uuid)
  rename to get_current_team_race_roster_options_before_squad_status;
revoke all
on function public.get_current_team_race_roster_options_before_squad_status(uuid)
from public, anon, authenticated;
grant execute
on function public.get_current_team_race_roster_options_before_squad_status(uuid)
to service_role;

create function public.get_current_team_race_roster_options(
  p_race_edition_id uuid
)
returns table (
  rider_id uuid, first_name text, last_name text, country_name text,
  country_iso_alpha2 text, avatar_profile_key text, avatar_seed bigint,
  age integer, mountain integer, hills integer, flat integer,
  time_trial integer, cobbles integer, sprint integer, breakaway integer,
  current_form numeric, is_selected boolean, current_race_role text,
  is_available boolean, unavailability_type text,
  unavailability_label text, unavailable_until timestamptz,
  conflicting_race_slug text, conflicting_race_name text,
  conflicting_start_day integer, conflicting_end_day integer,
  squad_status text
)
language sql stable security definer set search_path = ''
as $$
  select option.*, contract.squad_status
  from public.get_current_team_race_roster_options_before_squad_status(
    p_race_edition_id
  ) as option
  join public.rider_contracts as contract
    on contract.rider_id = option.rider_id
   and contract.status = 'active';
$$;

revoke all on function public.get_current_team_race_roster_options(uuid)
from public, anon;
grant execute on function public.get_current_team_race_roster_options(uuid)
to authenticated, service_role;

comment on column public.rider_contracts.squad_status is
  'Rôle public du coureur dans son équipe actuelle. Il est attribué uniquement par le DS propriétaire et ne pilote pas directement la tactique de course.';
comment on function public.set_current_team_rider_squad_status(uuid,text) is
  'Modifie le statut d’effectif du contrat actif après contrôle strict du DS propriétaire.';

notify pgrst, 'reload schema';

commit;
