begin;

-- A rider can only have one active physiotherapist assignment. Keep the most
-- recent assignment when repairing legacy data, then enforce the rule at the
-- database boundary for every future write path.
lock table public.staff_rider_assignments in share row exclusive mode;

with ranked_active_assignments as (
  select
    assignment.id,
    row_number() over (
      partition by assignment.rider_id
      order by assignment.assigned_at desc, assignment.id desc
    ) as assignment_rank
  from public.staff_rider_assignments as assignment
  where assignment.status = 'active'
)
update public.staff_rider_assignments as assignment
set
  status = 'ended',
  ended_at = now()
from ranked_active_assignments as ranked
where ranked.id = assignment.id
  and ranked.assignment_rank > 1;

create unique index if not exists staff_rider_assignments_one_active_physio_idx
  on public.staff_rider_assignments (rider_id)
  where status = 'active';

create or replace function public.get_active_rider_physiotherapist_level(
  p_team_id uuid,
  p_rider_id uuid
)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(max(member.level), 0)::integer
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

create or replace function public.get_rider_physio_form_protection(
  p_team_id uuid,
  p_rider_id uuid,
  p_source text
)
returns integer
language sql
stable
set search_path = public
as $$
  select coalesce(round(max(
    (
      member.level
      + case
          when p_source = 'race' and exists (
            select 1 from public.staff_member_talents as talent
            where talent.staff_member_id = member.id
              and talent.talent_code = 'physio_race_recovery'
          ) then 1
          when p_source = 'training' and exists (
            select 1 from public.staff_member_talents as talent
            where talent.staff_member_id = member.id
              and talent.talent_code = 'physio_training_recovery'
          ) then 1
          else 0
        end
    )
    * case
        when member.country_id = team_season.registration_country_id
          then 1.10
        else 1.00
      end
  )), 0)::integer
  from public.staff_rider_assignments as staff_assignment
  join public.staff_contracts as contract
    on contract.id = staff_assignment.staff_contract_id
   and contract.status = 'active'
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'physiotherapist'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = contract.team_id
   and team_season.season_id = season.id
  where contract.team_id = p_team_id
    and staff_assignment.rider_id = p_rider_id
    and staff_assignment.status = 'active';
$$;

comment on function public.get_active_rider_physiotherapist_level(uuid, uuid) is
  'Retourne le niveau du seul kiné actif affecté au coureur, sans cumul.';

comment on function public.get_rider_physio_form_protection(uuid, uuid, text) is
  'Retourne la protection du seul kiné actif affecté au coureur, sans cumul de bonus.';

commit;