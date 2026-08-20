begin;

create or replace function public.assign_current_team_physiotherapist_matrix(
  p_assignments jsonb default '[]'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignments jsonb := coalesce(p_assignments, '[]'::jsonb);
  v_assignment_count integer;
  v_team_id uuid;
begin
  if jsonb_typeof(v_assignments) <> 'array' then
    raise exception 'Les affectations des kinés doivent être transmises sous forme de liste.';
  end if;

  if jsonb_array_length(v_assignments) > 50 then
    raise exception 'La liste des affectations des kinés est trop longue.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_assignments) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or coalesce(item.value ->> 'rider_id', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(item.value ->> 'staff_contract_id', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception 'Une affectation de kiné est invalide.';
  end if;

  select team_assignment.team_id
  into v_team_id
  from public.team_manager_assignments as team_assignment
  join public.sporting_directors as director
    on director.id = team_assignment.sporting_director_id
   and director.auth_user_id = auth.uid()
   and director.status = 'active'
  where team_assignment.role = 'general_manager'
    and team_assignment.status = 'active'
  limit 1;

  if v_team_id is null then
    raise exception 'Aucune équipe active ne peut être gérée par ce compte.';
  end if;

  -- Une sauvegarde de la matrice doit rester atomique, même si deux requêtes
  -- concurrentes tentent de modifier les affectations de la même équipe.
  perform 1
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'physiotherapist'
  where contract.team_id = v_team_id
    and contract.status = 'active'
  order by contract.id
  for update of contract;

  select count(*)::integer
  into v_assignment_count
  from jsonb_to_recordset(v_assignments) as requested(
    rider_id uuid,
    staff_contract_id uuid
  );

  if (
    select count(distinct requested.rider_id)::integer
    from jsonb_to_recordset(v_assignments) as requested(
      rider_id uuid,
      staff_contract_id uuid
    )
  ) <> v_assignment_count then
    raise exception 'Un coureur ne peut être suivi que par un seul kiné.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_assignments) as requested(
      rider_id uuid,
      staff_contract_id uuid
    )
    where not exists (
      select 1
      from public.rider_contracts as rider_contract
      where rider_contract.rider_id = requested.rider_id
        and rider_contract.team_id = v_team_id
        and rider_contract.status = 'active'
    )
  ) then
    raise exception 'Un des coureurs sélectionnés ne fait pas partie de votre effectif actif.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_assignments) as requested(
      rider_id uuid,
      staff_contract_id uuid
    )
    where not exists (
      select 1
      from public.staff_contracts as contract
      join public.staff_members as member
        on member.id = contract.staff_member_id
       and member.role = 'physiotherapist'
      where contract.id = requested.staff_contract_id
        and contract.team_id = v_team_id
        and contract.status = 'active'
    )
  ) then
    raise exception 'Un des kinés sélectionnés ne fait pas partie de votre staff actif.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_assignments) as requested(
      rider_id uuid,
      staff_contract_id uuid
    )
    join public.staff_contracts as contract
      on contract.id = requested.staff_contract_id
     and contract.team_id = v_team_id
     and contract.status = 'active'
    join public.staff_members as member
      on member.id = contract.staff_member_id
     and member.role = 'physiotherapist'
    group by requested.staff_contract_id, member.level
    having count(*) > public.get_physiotherapist_rider_capacity(member.level)
  ) then
    raise exception 'Le quota d’affectations d’un des kinés est dépassé.';
  end if;

  -- Retire les associations décochées, y compris celles d’un ancien contrat
  -- de kiné qui serait encore marqué actif par une donnée historique.
  update public.staff_rider_assignments as current_assignment
  set status = 'ended', ended_at = now()
  where current_assignment.status = 'active'
    and exists (
      select 1
      from public.staff_contracts as contract
      join public.staff_members as member
        on member.id = contract.staff_member_id
       and member.role = 'physiotherapist'
      where contract.id = current_assignment.staff_contract_id
        and contract.team_id = v_team_id
    )
    and not exists (
      select 1
      from jsonb_to_recordset(v_assignments) as requested(
        rider_id uuid,
        staff_contract_id uuid
      )
      where requested.rider_id = current_assignment.rider_id
        and requested.staff_contract_id = current_assignment.staff_contract_id
    );

  -- Une nouvelle case cochée déplace le coureur depuis son ancien kiné.
  update public.staff_rider_assignments as current_assignment
  set status = 'ended', ended_at = now()
  where current_assignment.status = 'active'
    and exists (
      select 1
      from jsonb_to_recordset(v_assignments) as requested(
        rider_id uuid,
        staff_contract_id uuid
      )
      where requested.rider_id = current_assignment.rider_id
        and requested.staff_contract_id <> current_assignment.staff_contract_id
    );

  insert into public.staff_rider_assignments (
    staff_contract_id,
    rider_id,
    status,
    assigned_at
  )
  select
    requested.staff_contract_id,
    requested.rider_id,
    'active',
    now()
  from jsonb_to_recordset(v_assignments) as requested(
    rider_id uuid,
    staff_contract_id uuid
  )
  where not exists (
    select 1
    from public.staff_rider_assignments as existing
    where existing.staff_contract_id = requested.staff_contract_id
      and existing.rider_id = requested.rider_id
      and existing.status = 'active'
  );

  return v_assignment_count;
end;
$$;

revoke all on function public.assign_current_team_physiotherapist_matrix(jsonb) from public;
grant execute on function public.assign_current_team_physiotherapist_matrix(jsonb) to authenticated;

comment on function public.assign_current_team_physiotherapist_matrix(jsonb) is
  'Enregistre atomiquement toute la matrice coureurs-kinés de l’équipe active en contrôlant l’effectif et les quotas.';

commit;
