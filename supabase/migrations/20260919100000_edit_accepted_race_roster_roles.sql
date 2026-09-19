begin;

-- Expose the role already attached to selected riders. The edit form can then
-- start from the persisted plan instead of silently resetting every rider to
-- automatic.
alter function public.get_current_team_race_roster_options(uuid)
  rename to get_current_team_race_roster_options_before_current_role;

revoke all
on function public.get_current_team_race_roster_options_before_current_role(uuid)
from public, anon, authenticated;

grant execute
on function public.get_current_team_race_roster_options_before_current_role(uuid)
to service_role;

create function public.get_current_team_race_roster_options(
  p_race_edition_id uuid
)
returns table (
  rider_id uuid,
  first_name text,
  last_name text,
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
  breakaway integer,
  current_form numeric,
  is_selected boolean,
  current_race_role text,
  is_available boolean,
  unavailability_type text,
  unavailability_label text,
  unavailable_until timestamptz,
  conflicting_race_slug text,
  conflicting_race_name text,
  conflicting_start_day integer,
  conflicting_end_day integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    option.rider_id,
    option.first_name,
    option.last_name,
    option.country_name,
    option.country_iso_alpha2,
    option.avatar_profile_key,
    option.avatar_seed,
    option.age,
    option.mountain,
    option.hills,
    option.flat,
    option.time_trial,
    option.cobbles,
    option.sprint,
    option.breakaway,
    option.current_form,
    option.is_selected,
    coalesce(current_roster.race_role, 'auto') as current_race_role,
    option.is_available,
    option.unavailability_type,
    option.unavailability_label,
    option.unavailable_until,
    option.conflicting_race_slug,
    option.conflicting_race_name,
    option.conflicting_start_day,
    option.conflicting_end_day
  from public.get_current_team_race_roster_options_before_current_role(
    p_race_edition_id
  ) as option
  left join lateral (
    select roster.race_role
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.race_editions as edition
      on edition.id = p_race_edition_id
    join public.team_seasons as team_season
      on team_season.team_id = assignment.team_id
     and team_season.season_id = edition.season_id
     and team_season.status in ('planned', 'active')
    join public.race_registrations as registration
      on registration.race_edition_id = edition.id
     and registration.team_season_id = team_season.id
     and registration.status = 'accepted'
    join public.race_rosters as roster
      on roster.race_registration_id = registration.id
     and roster.rider_id = option.rider_id
     and roster.status in ('selected', 'confirmed')
    where director.auth_user_id = auth.uid()
      and director.status = 'active'
    limit 1
  ) as current_roster on true;
$$;

revoke all
on function public.get_current_team_race_roster_options(uuid)
from public, anon;

grant execute
on function public.get_current_team_race_roster_options(uuid)
to authenticated, service_role;

comment on function public.get_current_team_race_roster_options(uuid) is
  'Retourne les coureurs éligibles avec leur rôle général actuellement enregistré lorsqu’ils sont déjà engagés.';

-- Keep the delta-based roster update and its accumulated safety checks, then
-- persist every submitted general role in the same transaction. Expected
-- roles provide optimistic concurrency control for role-only edits as well.
create function public.update_current_team_race_roster_with_roles(
  p_race_edition_id uuid,
  p_roster jsonb,
  p_expected_roster jsonb
)
returns table (
  registration_id uuid,
  registered_rider_count integer,
  added_rider_count integer,
  removed_rider_count integer,
  changed_role_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider_ids uuid[];
  v_expected_rider_ids uuid[];
  v_saved record;
  v_race_format text;
  v_changed_role_count integer := 0;
begin
  if p_roster is null
    or p_expected_roster is null
    or jsonb_typeof(p_roster) <> 'array'
    or jsonb_typeof(p_expected_roster) <> 'array'
    or jsonb_array_length(p_roster) = 0
    or jsonb_array_length(p_expected_roster) = 0
  then
    raise exception using errcode = 'P0001',
      message = 'La composition et les rôles transmis sont invalides.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_roster || p_expected_roster) as entry(value)
    where jsonb_typeof(entry.value) <> 'object'
      or not coalesce(entry.value ->> 'riderId', '')
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(entry.value ->> 'role', '') not in (
        'auto',
        'leader',
        'sprinter',
        'leader_sprinter',
        'protected_rider',
        'leadout',
        'free_agent',
        'domestique',
        'mountain_classification'
      )
  ) then
    raise exception using errcode = 'P0001',
      message = 'Un coureur ou un rôle transmis est invalide.';
  end if;

  select array_agg((entry.value ->> 'riderId')::uuid order by entry.ordinality)
  into v_rider_ids
  from jsonb_array_elements(p_roster)
    with ordinality as entry(value, ordinality);

  select array_agg((entry.value ->> 'riderId')::uuid order by entry.ordinality)
  into v_expected_rider_ids
  from jsonb_array_elements(p_expected_roster)
    with ordinality as entry(value, ordinality);

  if cardinality(v_rider_ids) <> (
      select count(distinct rider_id)
      from unnest(v_rider_ids) as selected(rider_id)
    )
    or cardinality(v_expected_rider_ids) <> (
      select count(distinct rider_id)
      from unnest(v_expected_rider_ids) as expected(rider_id)
    )
  then
    raise exception using errcode = 'P0001',
      message = 'La composition contient un coureur en double.';
  end if;

  if (
      select count(*)
      from jsonb_array_elements(p_roster) as entry(value)
      where entry.value ->> 'role' = 'leader'
    ) > 1
    or (
      select count(*)
      from jsonb_array_elements(p_roster) as entry(value)
      where entry.value ->> 'role' = 'protected_rider'
    ) > 1
    or (
      select count(*)
      from jsonb_array_elements(p_roster) as entry(value)
      where entry.value ->> 'role' in ('sprinter', 'leader_sprinter')
    ) > 1
  then
    raise exception using errcode = 'P0001',
      message = 'Un seul leader, coureur protégé et objectif de sprint peuvent être désignés.';
  end if;

  select race.race_format
  into v_race_format
  from public.race_editions as edition
  join public.races as race on race.id = edition.race_id
  where edition.id = p_race_edition_id;

  if v_race_format is distinct from 'stage_race'
    and exists (
      select 1
      from jsonb_array_elements(p_roster) as entry(value)
      where entry.value ->> 'role' = 'mountain_classification'
    )
  then
    raise exception using errcode = 'P0001',
      message = 'Le rôle classement montagne est réservé aux tours.';
  end if;

  select saved.* into v_saved
  from public.update_current_team_race_roster(
    p_race_edition_id,
    v_rider_ids,
    v_expected_rider_ids
  ) as saved;

  -- The delta RPC has locked the registration and checked the rider list.
  -- A stale role plan must still fail instead of overwriting a newer choice.
  if exists (
    select 1
    from jsonb_array_elements(p_expected_roster) as expected(value)
    left join public.race_rosters as roster
      on roster.race_registration_id = v_saved.registration_id
     and roster.rider_id = (expected.value ->> 'riderId')::uuid
    where roster.id is null
      or roster.race_role is distinct from expected.value ->> 'role'
  ) then
    raise exception using errcode = '40001',
      message = 'Les rôles ont changé entre-temps. Rechargez la page avant de modifier l’inscription.';
  end if;

  select count(*)::integer
  into v_changed_role_count
  from jsonb_array_elements(p_roster) as assigned(value)
  join public.race_rosters as roster
    on roster.race_registration_id = v_saved.registration_id
   and roster.rider_id = (assigned.value ->> 'riderId')::uuid
   and roster.status in ('selected', 'confirmed')
  where roster.race_role is distinct from assigned.value ->> 'role';

  -- Clear unique tactical roles first so swapping leader or sprinter does not
  -- encounter a transient unique-index conflict halfway through the update.
  update public.race_rosters as roster
  set race_role = 'auto'
  where roster.race_registration_id = v_saved.registration_id
    and roster.rider_id = any(v_rider_ids)
    and roster.status in ('selected', 'confirmed')
    and roster.race_role <> 'auto';

  update public.race_rosters as roster
  set race_role = assigned.role
  from (
    select
      (entry.value ->> 'riderId')::uuid as rider_id,
      entry.value ->> 'role' as role
    from jsonb_array_elements(p_roster) as entry(value)
  ) as assigned
  where roster.race_registration_id = v_saved.registration_id
    and roster.rider_id = assigned.rider_id
    and roster.status in ('selected', 'confirmed')
    and roster.race_role is distinct from assigned.role;

  return query
  select
    v_saved.registration_id,
    v_saved.registered_rider_count,
    v_saved.added_rider_count,
    v_saved.removed_rider_count,
    v_changed_role_count;
end;
$$;

revoke all
on function public.update_current_team_race_roster_with_roles(uuid, jsonb, jsonb)
from public, anon;

grant execute
on function public.update_current_team_race_roster_with_roles(uuid, jsonb, jsonb)
to authenticated;

comment on function public.update_current_team_race_roster_with_roles(uuid, jsonb, jsonb) is
  'Modifie atomiquement les engagés et leurs rôles généraux avant le gel de la startlist, avec contrôle de concurrence.';

notify pgrst, 'reload schema';

commit;
