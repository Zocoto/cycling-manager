-- Permet d'ajouter des coureurs à une liste de kiné déjà enregistrée.
--
-- Dans la version initiale, le `rider_id` non qualifié de la sous-requête
-- pouvait être résolu sur la ligne `existing`. Dès qu'une affectation active
-- existait pour le kiné, le `not exists` devenait faux pour tous les coureurs
-- demandés et aucun nouvel ajout n'était créé.

create or replace function public.assign_current_team_physiotherapist(
  p_staff_contract_id uuid,
  p_rider_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_rider_ids uuid[] := coalesce(p_rider_ids, array[]::uuid[]);
  v_unique_count integer;
  v_capacity integer;
begin
  select
    contract.id as contract_id,
    contract.team_id,
    member.level
  into v_context
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'physiotherapist'
  join public.team_manager_assignments as team_assignment
    on team_assignment.team_id = contract.team_id
   and team_assignment.role = 'general_manager'
   and team_assignment.status = 'active'
  join public.sporting_directors as director
    on director.id = team_assignment.sporting_director_id
   and director.auth_user_id = auth.uid()
   and director.status = 'active'
  where contract.id = p_staff_contract_id
    and contract.status = 'active'
  for update of contract;

  if v_context is null then
    raise exception 'Ce kiné ne fait pas partie du staff actif de votre équipe.';
  end if;

  select count(distinct requested.rider_id)::integer
  into v_unique_count
  from unnest(v_rider_ids) as requested(rider_id);

  if v_unique_count <> cardinality(v_rider_ids) then
    raise exception 'Un coureur ne peut apparaître qu’une fois dans cette affectation.';
  end if;

  v_capacity := public.get_physiotherapist_rider_capacity(v_context.level);
  if v_unique_count > v_capacity then
    raise exception 'Ce kiné de niveau % peut suivre au maximum % coureur(s).',
      v_context.level, v_capacity;
  end if;

  if exists (
    select 1
    from unnest(v_rider_ids) as requested(requested_rider_id)
    where not exists (
      select 1
      from public.rider_contracts as rider_contract
      where rider_contract.rider_id = requested.requested_rider_id
        and rider_contract.team_id = v_context.team_id
        and rider_contract.status = 'active'
    )
  ) then
    raise exception 'Un des coureurs sélectionnés ne fait pas partie de votre effectif actif.';
  end if;

  update public.staff_rider_assignments as staff_assignment
  set status = 'ended', ended_at = now()
  where staff_assignment.staff_contract_id = v_context.contract_id
    and staff_assignment.status = 'active'
    and not (staff_assignment.rider_id = any(v_rider_ids));

  update public.staff_rider_assignments as staff_assignment
  set status = 'ended', ended_at = now()
  where staff_assignment.rider_id = any(v_rider_ids)
    and staff_assignment.status = 'active'
    and staff_assignment.staff_contract_id <> v_context.contract_id;

  insert into public.staff_rider_assignments (
    staff_contract_id,
    rider_id,
    status,
    assigned_at
  )
  select
    v_context.contract_id,
    requested.rider_id,
    'active',
    now()
  from unnest(v_rider_ids) as requested(rider_id)
  where not exists (
    select 1
    from public.staff_rider_assignments as existing
    where existing.staff_contract_id = v_context.contract_id
      and existing.rider_id = requested.rider_id
      and existing.status = 'active'
  );

  return v_unique_count;
end;
$$;

revoke all on function public.assign_current_team_physiotherapist(uuid, uuid[]) from public;
grant execute on function public.assign_current_team_physiotherapist(uuid, uuid[]) to authenticated;

comment on function public.assign_current_team_physiotherapist(uuid, uuid[]) is
  'Remplace la sélection de coureurs d’un kiné tout en conservant les affectations déjà actives et en ajoutant uniquement les nouvelles.';
