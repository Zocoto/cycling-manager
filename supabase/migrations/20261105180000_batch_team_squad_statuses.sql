-- One authenticated, atomic save for the Effectif squad-role selections.
-- The profile page's existing single-rider RPC and all sporting logic remain
-- unchanged. No INSERT entitlement or caller-supplied team identifier.
begin;
set local lock_timeout='3s';
set local statement_timeout='10s';

create function public.set_current_team_rider_squad_statuses(p_updates jsonb)
returns integer
language plpgsql volatile security definer
set search_path=''
set statement_timeout='3s'
set lock_timeout='500ms'
as $$
declare
  v_team_id uuid;
  v_requested integer;
  v_locked integer:=0;
  v_changed integer;
  v_row record;
  v_allowed constant text[]:=array['absolute_leader','co_leader','road_captain','lieutenant',
    'free_role','stage_hunter','prospect','domestique','bottle_carrier'];
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.' using errcode='42501';
  end if;
  if p_updates is null or jsonb_typeof(p_updates) is distinct from 'array' then
    raise exception 'La sélection de statuts d’effectif est invalide.' using errcode='22023';
  end if;
  v_requested:=jsonb_array_length(p_updates);
  if v_requested not between 1 and 200 then
    raise exception 'Sélectionnez entre 1 et 200 coureurs.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_updates) entry where jsonb_typeof(entry) is distinct from 'object') then
    raise exception 'La sélection de statuts d’effectif est invalide.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_updates) entry where
      not(entry ?& array['riderId','squadStatus','expectedStatus'])
      or entry-array['riderId','squadStatus','expectedStatus']<>'{}'::jsonb
      or jsonb_typeof(entry->'riderId') is distinct from 'string'
      or coalesce(entry->>'riderId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or (entry->'squadStatus'<>'null'::jsonb and
        (jsonb_typeof(entry->'squadStatus') is distinct from 'string' or not((entry->>'squadStatus')=any(v_allowed))))
      or (entry->'expectedStatus'<>'null'::jsonb and
        (jsonb_typeof(entry->'expectedStatus') is distinct from 'string' or not((entry->>'expectedStatus')=any(v_allowed))))) then
    raise exception 'Un coureur ou un statut d’effectif est invalide.' using errcode='22023';
  end if;
  if (select count(distinct (entry->>'riderId')::uuid) from jsonb_array_elements(p_updates) entry)<>v_requested then
    raise exception 'Un coureur ne peut apparaître qu’une fois dans la sélection.' using errcode='22023';
  end if;

  -- These three specific rows protect ownership while all contract rows are
  -- locked. A concurrent DS swap/inactivation cannot cross this save.
  select assignment.team_id into v_team_id
    from public.sporting_directors director
    join public.team_manager_assignments assignment on assignment.sporting_director_id=director.id
      and assignment.role='general_manager' and assignment.status='active'
    join public.teams team on team.id=assignment.team_id and team.status='active'
    where director.auth_user_id=(select auth.uid()) and director.status='active'
    limit 1 for share of director,assignment,team;
  if v_team_id is null then
    raise exception 'Aucune équipe active ne vous est attribuée.' using errcode='42501';
  end if;

  -- Lock only the requested active contracts in deterministic rider-ID order.
  -- Check every owner and baseline before issuing the single UPDATE below.
  for v_row in
    select contract.id,contract.rider_id,contract.squad_status,
      updates."squadStatus" requested_status,updates."expectedStatus" expected_status
    from public.rider_contracts contract
    join jsonb_to_recordset(p_updates) updates("riderId" uuid,"squadStatus" text,"expectedStatus" text)
      on updates."riderId"=contract.rider_id
    where contract.team_id=v_team_id and contract.status='active'
    order by contract.rider_id
    for update of contract
  loop
    v_locked:=v_locked+1;
    if v_row.squad_status is distinct from v_row.requested_status
      and v_row.squad_status is distinct from v_row.expected_status then
      raise exception 'Les statuts d’effectif ont changé. Rechargez l’effectif avant de valider.' using errcode='40001';
    end if;
  end loop;
  if v_locked<>v_requested then
    raise exception 'Seul le DS de l’équipe actuelle peut modifier ces statuts. Un contrat actif a changé.' using errcode='42501';
  end if;

  update public.rider_contracts contract set squad_status=updates."squadStatus"
    from jsonb_to_recordset(p_updates) updates("riderId" uuid,"squadStatus" text,"expectedStatus" text)
    where contract.rider_id=updates."riderId" and contract.team_id=v_team_id and contract.status='active'
      and contract.squad_status is distinct from updates."squadStatus";
  get diagnostics v_changed=row_count;
  return v_changed;
end;
$$;

revoke all on function public.set_current_team_rider_squad_statuses(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.set_current_team_rider_squad_statuses(jsonb) to authenticated;
comment on function public.set_current_team_rider_squad_statuses(jsonb) is
  'Atomic 1–200 squad-role changes for the authenticated active GM. Strict expectedStatus baselines, idempotent retries, and no sporting side effects.';
notify pgrst,'reload schema';
commit;
