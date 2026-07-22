begin;

create or replace function public.get_active_team_staff_level(
  p_team_id uuid,
  p_role text,
  p_trainer_specialty text default null
)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(sum(member.level), 0)::integer
  from public.staff_contracts as contract
  join public.staff_members as member on member.id = contract.staff_member_id
  where contract.team_id = p_team_id
    and contract.status = 'active'
    and member.role = p_role
    and member.role not in ('trainer', 'physiotherapist')
    and (
      p_trainer_specialty is null
      or member.trainer_specialty = p_trainer_specialty
    );
$$;

comment on function public.get_active_team_staff_level(uuid, text, text) is
  'Returns the cumulative level of active staff with a global team effect. Trainers and physiotherapists require a rider assignment.';

create or replace function public.get_active_rider_physiotherapist_level(
  p_team_id uuid,
  p_rider_id uuid
)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(sum(member.level), 0)::integer
  from public.staff_rider_assignments as staff_assignment
  join public.staff_contracts as contract
    on contract.id = staff_assignment.staff_contract_id
   and contract.status = 'active'
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'physiotherapist'
  where contract.team_id = p_team_id
    and staff_assignment.rider_id = p_rider_id
    and staff_assignment.status = 'active';
$$;

comment on function public.get_active_rider_physiotherapist_level(uuid, uuid) is
  'Returns the cumulative level of the active physiotherapists assigned to a rider.';

commit;
