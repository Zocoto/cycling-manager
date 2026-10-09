begin;
set local lock_timeout = '3s';
set local statement_timeout = '30s';

-- Keep all existing ranking, injury and scheduling rules. An entry made when
-- a rider was free (or with their former team) must not survive a DS withdrawal.
do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_owner_anchor constant text := '        and candidate.country_id = race.country_id';
  v_scope_anchor constant text := '    and registration.team_season_id = p_team_season_id';
begin
  foreach v_signature in array array[
    'public.sync_national_championship_registrations(uuid,timestamptz)'::regprocedure,
    'public.sync_team_national_championship_registrations(uuid,uuid,timestamptz)'::regprocedure
  ] loop
    select replace(pg_get_functiondef(v_signature), chr(13), '') into v_definition;
    if (length(v_definition) - length(replace(v_definition, v_owner_anchor, '')))
      <> length(v_owner_anchor) then
      raise exception 'Unexpected CN ownership check in %; migration aborted', v_signature;
    end if;
    v_definition := replace(v_definition, v_owner_anchor,
      v_owner_anchor || E'\n        and candidate.team_season_id is not distinct from registration.team_season_id');

    if v_signature = 'public.sync_team_national_championship_registrations(uuid,uuid,timestamptz)'::regprocedure then
      if (length(v_definition) - length(replace(v_definition, v_scope_anchor, '')))
        <> length(v_scope_anchor) then
        raise exception 'Unexpected scoped CN cleanup; migration aborted';
      end if;
      -- Remain team-scoped: include only this team's entries and this team's
      -- current riders, not every other manager's selections.
      v_definition := replace(v_definition, v_scope_anchor, $scope$
    and (
      registration.team_season_id = p_team_season_id
      or exists (
        select 1
        from public.team_seasons as managed_team
        join public.rider_contracts as managed_contract
          on managed_contract.team_id = managed_team.team_id
         and managed_contract.status = 'active'
        where managed_team.id = p_team_season_id
          and managed_team.season_id = p_season_id
          and managed_contract.rider_id = roster.rider_id
      )
    )$scope$);
    end if;
    execute v_definition;
  end loop;
end;
$migration$;

-- The individual withdrawal must use the same explicit preference as the
-- unified grid, otherwise a later synchronizer can reselect the rider.
create or replace function public.withdraw_current_team_national_championship_rider(
  p_race_edition_id uuid,
  p_rider_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_team_season_id uuid;
  v_departure_at timestamptz;
begin
  if v_auth_user_id is null then
    raise exception using errcode = '42501',
      message = 'Vous devez être connecté pour retirer un coureur.';
  end if;

  select team_season.id, stage.departure_at
  into v_team_season_id, v_departure_at
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.status in ('planned', 'active')
  join public.seasons as season
    on season.id = team_season.season_id
   and season.status = 'active'
  join public.rider_contracts as contract
    on contract.team_id = assignment.team_id
   and contract.rider_id = p_rider_id
   and contract.status = 'active'
  join public.riders as rider
    on rider.id = contract.rider_id
   and rider.status = 'active'
  join public.race_editions as edition
    on edition.id = p_race_edition_id
   and edition.season_id = season.id
   and edition.status not in ('completed', 'cancelled')
  join public.races as race
    on race.id = edition.race_id
   and race.country_id = rider.country_id
   and race.competition_type in ('national_road', 'national_time_trial')
  join public.stages as stage
    on stage.race_edition_id = edition.id
   and stage.stage_number = 1
  where director.auth_user_id = v_auth_user_id
    and director.status = 'active'
  limit 1;

  if v_team_season_id is null then
    raise exception using errcode = '42501',
      message = 'Ce coureur ne fait pas partie de votre effectif actif pour ce championnat.';
  end if;
  if v_departure_at is null or now() >= v_departure_at then
    raise exception using errcode = 'P0001',
      message = 'Le championnat a déjà débuté : ce coureur ne peut plus être retiré.';
  end if;

  insert into public.national_championship_rider_preferences (
    race_edition_id, rider_id, team_season_id, is_selected, updated_at
  ) values (p_race_edition_id, p_rider_id, v_team_season_id, false, now())
  on conflict (race_edition_id, rider_id) do update set
    team_season_id = excluded.team_season_id,
    is_selected = false,
    updated_at = excluded.updated_at;

  insert into public.national_championship_rider_withdrawals (
    race_edition_id, rider_id, team_season_id, withdrawn_at
  ) values (p_race_edition_id, p_rider_id, v_team_season_id, now())
  on conflict (race_edition_id, rider_id) do update set
    team_season_id = excluded.team_season_id,
    withdrawn_at = excluded.withdrawn_at;

  -- This rider's entries in this edition only, including former/free teams.
  -- Repeated withdrawals are safe even if no current-team entry was created.
  update public.race_rosters as roster
  set status = 'withdrawn'
  from public.race_registrations as registration
  where registration.id = roster.race_registration_id
    and registration.race_edition_id = p_race_edition_id
    and roster.rider_id = p_rider_id
    and roster.status in ('selected', 'confirmed');
end;
$$;

revoke all on function public.withdraw_current_team_national_championship_rider(uuid,uuid) from public, anon;
grant execute on function public.withdraw_current_team_national_championship_rider(uuid,uuid) to authenticated, service_role;

-- Repair only explicit withdrawals that still block riders in future CN.
-- Do not resynchronize the entire world or withdraw any ordinary-race entries.
update public.race_rosters as roster
set status = 'withdrawn'
from public.race_registrations as registration
join public.race_editions as edition on edition.id = registration.race_edition_id
join public.seasons as season on season.id = edition.season_id and season.status = 'active'
join public.races as race on race.id = edition.race_id
join public.stages as stage on stage.race_edition_id = edition.id and stage.stage_number = 1
where roster.race_registration_id = registration.id
  and roster.status in ('selected', 'confirmed')
  and edition.status not in ('completed', 'cancelled')
  and stage.departure_at > now()
  and race.competition_type in ('national_road', 'national_time_trial')
  and (
    exists (
      select 1 from public.national_championship_rider_preferences as preference
      where preference.race_edition_id = edition.id
        and preference.rider_id = roster.rider_id
        and preference.is_selected = false
    )
    or (
      not exists (
        select 1 from public.national_championship_rider_preferences as preference
        where preference.race_edition_id = edition.id and preference.rider_id = roster.rider_id
      )
      and exists (
        select 1 from public.national_championship_rider_withdrawals as withdrawal
        where withdrawal.race_edition_id = edition.id and withdrawal.rider_id = roster.rider_id
      )
    )
  );

notify pgrst, 'reload schema';
commit;
