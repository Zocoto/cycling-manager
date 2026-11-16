begin;
set local lock_timeout = '3s';
set local statement_timeout = '10s';

alter table public.rider_contracts
  add column squad_protected_leader_id uuid,
  drop constraint rider_contracts_squad_status_allowed,
  add constraint rider_contracts_squad_status_allowed check (
    squad_status is null or squad_status in (
      'absolute_leader', 'co_leader', 'road_captain', 'lieutenant', 'free_role',
      'stage_hunter', 'prospect', 'domestique', 'bottle_carrier', 'close_guard'
    )
  ),
  add constraint rider_contracts_squad_protected_leader_required check (
    case when squad_status = 'close_guard' then
      squad_protected_leader_id is not null and squad_protected_leader_id <> rider_id
    else squad_protected_leader_id is null end
  );

create index rider_contracts_active_squad_protected_leader_idx
  on public.rider_contracts (team_id, squad_protected_leader_id)
  where status = 'active' and squad_protected_leader_id is not null;

comment on column public.rider_contracts.squad_protected_leader_id is
  'Active same-team absolute leader or co-leader protected by this close guard.';

create function private.apply_current_team_rider_squad_statuses(
  p_updates jsonb,
  p_check_expected boolean
)
returns integer
language plpgsql volatile security definer
set search_path = ''
set statement_timeout = '3s'
set lock_timeout = '500ms'
as $$
declare
  v_team_id uuid;
  v_requested integer;
  v_locked integer := 0;
  v_changed integer;
  v_row record;
  v_allowed constant text[] := array[
    'absolute_leader', 'co_leader', 'road_captain', 'lieutenant', 'free_role',
    'stage_hunter', 'prospect', 'domestique', 'bottle_carrier', 'close_guard'
  ];
  v_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_updates) is distinct from 'array' then
    raise exception 'La sélection de statuts d’effectif est invalide.' using errcode = '22023';
  end if;
  v_requested := jsonb_array_length(p_updates);
  if v_requested not between 1 and 200 then
    raise exception 'Sélectionnez entre 1 et 200 coureurs.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_updates) entry
    where jsonb_typeof(entry) is distinct from 'object'
  ) then
    raise exception 'La sélection de statuts d’effectif est invalide.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_updates) entry
    where not (entry ?& array['riderId', 'squadStatus', 'expectedStatus'])
      or entry - array['riderId', 'squadStatus', 'expectedStatus', 'protectedLeaderId', 'expectedProtectedLeaderId'] <> '{}'::jsonb
      or (entry ? 'protectedLeaderId') <> (entry ? 'expectedProtectedLeaderId')
      or jsonb_typeof(entry->'riderId') is distinct from 'string'
      or coalesce(entry->>'riderId', '') !~* v_uuid
      or (entry->'squadStatus' <> 'null'::jsonb and (
        jsonb_typeof(entry->'squadStatus') is distinct from 'string' or not ((entry->>'squadStatus') = any(v_allowed))
      ))
      or (entry->'expectedStatus' <> 'null'::jsonb and (
        jsonb_typeof(entry->'expectedStatus') is distinct from 'string' or not ((entry->>'expectedStatus') = any(v_allowed))
      ))
      or (entry->>'protectedLeaderId' is not null and (
        jsonb_typeof(entry->'protectedLeaderId') is distinct from 'string' or entry->>'protectedLeaderId' !~* v_uuid
      ))
      or (entry->>'expectedProtectedLeaderId' is not null and (
        jsonb_typeof(entry->'expectedProtectedLeaderId') is distinct from 'string' or entry->>'expectedProtectedLeaderId' !~* v_uuid
      ))
  ) then
    raise exception 'Un coureur ou un statut d’effectif est invalide.' using errcode = '22023';
  end if;
  if (select count(distinct (entry->>'riderId')::uuid) from jsonb_array_elements(p_updates) entry) <> v_requested then
    raise exception 'Un coureur ne peut apparaître qu’une fois dans la sélection.' using errcode = '22023';
  end if;

  select assignment.team_id into v_team_id
  from public.sporting_directors director
  join public.team_manager_assignments assignment on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.teams team on team.id = assignment.team_id and team.status = 'active'
  where director.auth_user_id = (select auth.uid()) and director.status = 'active'
  limit 1 for share of director, assignment, team;
  if v_team_id is null then
    raise exception 'Aucune équipe active ne vous est attribuée.' using errcode = '42501';
  end if;

  -- Role saves are rare. Lock the active roster in a stable order so a role
  -- edit and its leader validation cannot cross another save or team change.
  for v_row in
    select updates."riderId" as requested_rider_id, contract.squad_status,
      contract.squad_protected_leader_id,
      updates."squadStatus" as requested_status, updates."protectedLeaderId" as requested_leader_id,
      updates."expectedStatus" as expected_status, updates."expectedProtectedLeaderId" as expected_leader_id
    from public.rider_contracts contract
    left join jsonb_to_recordset(p_updates) updates(
      "riderId" uuid, "squadStatus" text, "protectedLeaderId" uuid,
      "expectedStatus" text, "expectedProtectedLeaderId" uuid
    ) on updates."riderId" = contract.rider_id
    where contract.team_id = v_team_id and contract.status = 'active'
    order by contract.rider_id
    for no key update of contract
  loop
    if v_row.requested_rider_id is null then continue; end if;
    v_locked := v_locked + 1;
    if p_check_expected
      and (v_row.squad_status, v_row.squad_protected_leader_id)
        is distinct from (v_row.requested_status, v_row.requested_leader_id)
      and (v_row.squad_status, v_row.squad_protected_leader_id)
        is distinct from (v_row.expected_status, v_row.expected_leader_id)
    then
      raise exception 'Les statuts d’effectif ont changé. Rechargez l’effectif avant de valider.' using errcode = '40001';
    end if;
  end loop;
  if v_locked <> v_requested then
    raise exception 'Seul le DS de l’équipe actuelle peut modifier ces statuts. Un contrat actif a changé.' using errcode = '42501';
  end if;

  -- A leader and its guards can be edited together. Validate the proposed
  -- role when present, including an explicit reset to NULL.
  if exists (
    with updates as (
      select * from jsonb_to_recordset(p_updates) as update_row(
        "riderId" uuid, "squadStatus" text, "protectedLeaderId" uuid
      )
    )
    select 1 from updates guard
    where (guard."squadStatus" is distinct from 'close_guard' and guard."protectedLeaderId" is not null)
       or (guard."squadStatus" = 'close_guard' and (
         guard."protectedLeaderId" = guard."riderId" or not exists (
           select 1 from public.rider_contracts leader
           left join updates proposed on proposed."riderId" = leader.rider_id
           where leader.team_id = v_team_id and leader.status = 'active'
             and leader.rider_id = guard."protectedLeaderId"
             and (case when proposed."riderId" is null then leader.squad_status
               else proposed."squadStatus" end) in ('absolute_leader', 'co_leader')
         )
       ))
  ) then
    raise exception 'Choisissez un co-leader ou un leader absolu de votre équipe.' using errcode = '22023';
  end if;

  update public.rider_contracts contract
  set squad_status = updates."squadStatus", squad_protected_leader_id = updates."protectedLeaderId"
  from jsonb_to_recordset(p_updates) updates("riderId" uuid, "squadStatus" text, "protectedLeaderId" uuid)
  where contract.rider_id = updates."riderId" and contract.team_id = v_team_id and contract.status = 'active'
    and (contract.squad_status, contract.squad_protected_leader_id)
      is distinct from (updates."squadStatus", updates."protectedLeaderId");
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

revoke all on function private.apply_current_team_rider_squad_statuses(jsonb, boolean)
  from public, anon, authenticated, service_role;

create or replace function public.set_current_team_rider_squad_statuses(p_updates jsonb)
returns integer
language sql volatile security definer set search_path = ''
as $$
  select private.apply_current_team_rider_squad_statuses(p_updates, true);
$$;

create function public.set_current_team_rider_squad_status(
  p_rider_id uuid, p_squad_status text, p_protected_leader_id uuid
)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare v_status text := nullif(btrim(p_squad_status), '');
begin
  perform private.apply_current_team_rider_squad_statuses(jsonb_build_array(jsonb_build_object(
    'riderId', p_rider_id, 'squadStatus', v_status, 'expectedStatus', null,
    'protectedLeaderId', p_protected_leader_id, 'expectedProtectedLeaderId', null
  )), false);
  return v_status;
end;
$$;

revoke all on function public.set_current_team_rider_squad_status(uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.set_current_team_rider_squad_status(uuid, text, uuid) to authenticated;

create or replace function public.set_current_team_rider_squad_status(p_rider_id uuid, p_squad_status text)
returns text
language sql volatile security definer set search_path = ''
as $$
  select public.set_current_team_rider_squad_status(p_rider_id, p_squad_status, null);
$$;

create or replace function private.inherit_team_squad_status_on_renewal()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_start_year integer;
  v_previous_status text;
  v_previous_leader_id uuid;
begin
  if new.acquisition_type <> 'renewal' or new.status <> 'active'
    or new.squad_status is not null then return new; end if;
  if tg_op = 'UPDATE' and old.status <> 'planned' then return new; end if;

  select game_year into v_start_year from public.seasons where id = new.start_season_id;
  select previous.squad_status, previous.squad_protected_leader_id
  into v_previous_status, v_previous_leader_id
  from public.rider_contracts previous
  join public.seasons ending on ending.id = previous.end_season_id
  where previous.rider_id = new.rider_id and previous.team_id = new.team_id
    and previous.id <> new.id and previous.status in ('active', 'completed')
    and ending.game_year = v_start_year - 1
  order by previous.signed_at desc nulls last, previous.created_at desc, previous.id desc
  limit 1;
  -- The latest same-team contract carries any deliberate clearing of a role.
  if found then
    new.squad_status := v_previous_status;
    new.squad_protected_leader_id := v_previous_leader_id;
  end if;
  return new;
end;
$$;

create function private.clear_invalid_close_guards()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_team_id uuid;
  v_leader_id uuid;
begin
  if tg_argv[0] = 'leader' then
    v_team_id := old.team_id;
    v_leader_id := old.rider_id;
  else
    v_team_id := new.team_id;
    v_leader_id := new.squad_protected_leader_id;
  end if;

  if not exists (
    select 1 from public.rider_contracts leader
    where leader.rider_id = v_leader_id and leader.team_id = v_team_id and leader.status = 'active'
      and leader.squad_status in ('absolute_leader', 'co_leader')
  ) then
    update public.rider_contracts
    set squad_status = null, squad_protected_leader_id = null
    where team_id = v_team_id and squad_protected_leader_id = v_leader_id and status = 'active';
  end if;
  return null;
end;
$$;

revoke all on function private.clear_invalid_close_guards()
  from public, anon, authenticated, service_role;

-- Evaluate eligibility at the end of the transaction so closing the old
-- contract and activating the new same-team contract preserves valid guards.
create constraint trigger clear_close_guards_after_leader_update
after update of status, team_id, rider_id, squad_status on public.rider_contracts
deferrable initially deferred for each row
when (old.status = 'active' and old.squad_status in ('absolute_leader', 'co_leader') and (
  new.status is distinct from 'active' or new.team_id is distinct from old.team_id
  or new.rider_id is distinct from old.rider_id or new.squad_status is null
  or new.squad_status not in ('absolute_leader', 'co_leader')
)) execute function private.clear_invalid_close_guards('leader');

create constraint trigger clear_close_guards_after_leader_delete
after delete on public.rider_contracts deferrable initially deferred for each row
when (old.status = 'active' and old.squad_status in ('absolute_leader', 'co_leader'))
execute function private.clear_invalid_close_guards('leader');

create constraint trigger clear_invalid_close_guard_after_insert
after insert on public.rider_contracts deferrable initially deferred for each row
when (new.status = 'active' and new.squad_status = 'close_guard')
execute function private.clear_invalid_close_guards('guard');

create constraint trigger clear_invalid_close_guard_after_update
after update of status, team_id, rider_id, squad_protected_leader_id on public.rider_contracts
deferrable initially deferred for each row
when (new.status = 'active' and new.squad_status = 'close_guard' and (
  old.status is distinct from new.status or old.team_id is distinct from new.team_id
  or old.rider_id is distinct from new.rider_id
  or old.squad_protected_leader_id is distinct from new.squad_protected_leader_id
)) execute function private.clear_invalid_close_guards('guard');

-- The read RPCs retain their names and existing columns. PostgreSQL requires
-- recreating them to append the protected leader to the table return type.
drop function public.get_current_team_roster_with_potential();
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
  potential_steps integer, squad_status text, squad_protected_leader_id uuid
)
language sql stable security definer set search_path = ''
as $$
  select roster.*, contract.squad_status, contract.squad_protected_leader_id
  from public.get_current_team_roster_with_potential_before_squad_status() as roster
  join public.rider_contracts as contract on contract.rider_id = roster.rider_id and contract.status = 'active';
$$;

revoke all on function public.get_current_team_roster_with_potential() from public, anon;
grant execute on function public.get_current_team_roster_with_potential() to authenticated;

drop function public.get_current_team_race_roster_options(uuid);
create function public.get_current_team_race_roster_options(p_race_edition_id uuid)
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
  squad_status text, squad_protected_leader_id uuid
)
language sql stable security definer set search_path = ''
as $$
  select option.*, contract.squad_status, contract.squad_protected_leader_id
  from public.get_current_team_race_roster_options_before_squad_status(p_race_edition_id) as option
  join public.rider_contracts as contract on contract.rider_id = option.rider_id and contract.status = 'active';
$$;

revoke all on function public.get_current_team_race_roster_options(uuid) from public, anon;
grant execute on function public.get_current_team_race_roster_options(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
