begin;

create or replace function public.start_current_team_youth_scouting(
  p_scout_contract_id uuid,
  p_country_id uuid,
  p_duration_days integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_mission_id uuid;
begin
  if p_scout_contract_id is null or p_country_id is null then
    raise exception 'Le scout et le pays sont obligatoires.';
  end if;
  if p_duration_days not between 3 and 7 then
    raise exception 'La mission doit durer entre 3 et 7 jours.';
  end if;

  perform public.sync_active_season_day();

  select
    assignment.team_id,
    season.id as season_id,
    season.current_day_number
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;
  if v_context.current_day_number + p_duration_days > 28 then
    raise exception 'Cette mission se terminerait après la fin de la saison.';
  end if;
  if not exists (
    select 1 from public.countries
    where id = p_country_id and is_active
  ) then
    raise exception 'Ce pays ne peut pas être scouté.';
  end if;
  if not exists (
    select 1
    from public.staff_contracts as contract
    join public.staff_members as member on member.id = contract.staff_member_id
    where contract.id = p_scout_contract_id
      and contract.team_id = v_context.team_id
      and contract.status = 'active'
      and member.role = 'scout'
  ) then
    raise exception 'Ce scout ne fait pas partie du staff actif de votre équipe.';
  end if;
  if exists (
    select 1 from public.youth_scouting_missions
    where scout_contract_id = p_scout_contract_id and status = 'active'
  ) then
    raise exception 'Ce scout est déjà en mission.';
  end if;

  insert into public.youth_scouting_missions (
    team_id,
    season_id,
    scout_contract_id,
    country_id,
    start_day_number,
    duration_days,
    completes_day_number
  ) values (
    v_context.team_id,
    v_context.season_id,
    p_scout_contract_id,
    p_country_id,
    v_context.current_day_number,
    p_duration_days,
    v_context.current_day_number + p_duration_days
  ) returning id into v_mission_id;

  return v_mission_id;
end;
$$;

revoke all on function public.start_current_team_youth_scouting(
  uuid,
  uuid,
  integer
) from public, anon;
grant execute on function public.start_current_team_youth_scouting(
  uuid,
  uuid,
  integer
) to authenticated, service_role;

comment on function public.start_current_team_youth_scouting(
  uuid,
  uuid,
  integer
) is
  'Lance une mission de scouting junior de trois à sept jours pour le Directeur Sportif connecté.';

notify pgrst, 'reload schema';

commit;
