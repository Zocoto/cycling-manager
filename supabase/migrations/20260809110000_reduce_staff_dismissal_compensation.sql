-- Limite l’indemnité de licenciement aux échéances restant à payer
-- pendant la saison active. Aucune saison supplémentaire n’est facturée.

begin;

create or replace function public.dismiss_current_team_staff(
  p_contract_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_contract record;
  v_due_installments integer;
  v_regular_installment numeric(14, 2);
  v_due_current_salary numeric(14, 2);
  v_current_remaining numeric(14, 2);
  v_compensation numeric(14, 2);
  v_terminated_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Vous devez être authentifié pour licencier un membre du staff.';
  end if;

  if p_contract_id is null then
    raise exception 'Le contrat de staff est obligatoire.';
  end if;

  perform public.settle_current_team_finances();

  select
    director.id as director_id,
    assignment.team_id,
    season.id as season_id,
    season.current_day_number,
    team_season.id as team_season_id,
    team_season.currency,
    season_day.id as season_day_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = season.current_day_number
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  perform 1
  from public.team_seasons as team_season
  where team_season.id = v_context.team_season_id
  for update;

  select
    contract.id,
    contract.staff_member_id,
    contract.team_id,
    contract.salary_per_season,
    contract.currency_code,
    contract.status,
    contract.termination_compensation,
    member.first_name,
    member.last_name
  into v_contract
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
  where contract.id = p_contract_id
    and contract.team_id = v_context.team_id
  for update of contract;

  if v_contract is null then
    raise exception 'Ce contrat de staff est introuvable ou ne vous appartient pas.';
  end if;

  if v_contract.status = 'terminated'
    and v_contract.termination_compensation is not null then
    return v_contract.termination_compensation;
  end if;

  if v_contract.status <> 'active' then
    raise exception 'Seul un contrat de staff actif peut être rompu.';
  end if;

  v_regular_installment := round(v_contract.salary_per_season / 4, 2);
  v_due_installments := least(
    4,
    greatest(
      0,
      floor(v_context.current_day_number / 7.0)::integer
    )
  );
  v_due_current_salary := case
    when v_due_installments < 4
      then v_regular_installment * v_due_installments
    else v_contract.salary_per_season
  end;
  v_current_remaining := greatest(
    0,
    v_contract.salary_per_season - v_due_current_salary
  );
  v_compensation := round(v_current_remaining, 2);

  update public.staff_rider_assignments
  set
    status = 'ended',
    ended_at = v_terminated_at
  where staff_contract_id = v_contract.id
    and status = 'active';

  update public.youth_scouting_missions
  set
    status = 'cancelled',
    updated_at = v_terminated_at
  where scout_contract_id = v_contract.id
    and status = 'active';

  update public.staff_academy_trainings
  set
    status = 'cancelled',
    updated_at = v_terminated_at
  where staff_contract_id = v_contract.id
    and status = 'active';

  update public.staff_contracts
  set
    status = 'terminated',
    terminated_at = v_terminated_at,
    termination_compensation = v_compensation,
    termination_season_id = v_context.season_id,
    termination_day_number = v_context.current_day_number
  where id = v_contract.id;

  if v_compensation > 0 then
    insert into public.team_finance_transactions (
      team_season_id,
      season_day_id,
      day_number,
      amount,
      category,
      status,
      description,
      source_reference,
      posted_at
    )
    values (
      v_context.team_season_id,
      v_context.season_day_id,
      v_context.current_day_number,
      -v_compensation,
      'staff_salary',
      'posted',
      'Indemnité de licenciement de '
        || v_contract.first_name || ' ' || v_contract.last_name,
      'staff-dismissal:' || v_contract.id::text,
      v_terminated_at
    );
  end if;

  perform public.settle_current_team_finances();

  return v_compensation;
end;
$$;

revoke all
on function public.dismiss_current_team_staff(uuid)
from public, anon;

grant execute
on function public.dismiss_current_team_staff(uuid)
to authenticated;

comment on column public.staff_contracts.termination_compensation is
  'Indemnité payée lors du licenciement : échéances restant à régler pendant la saison active.';

comment on column public.staff_contracts.termination_season_id is
  'Saison pendant laquelle le contrat de staff a été rompu.';

comment on column public.staff_contracts.termination_day_number is
  'Jour de la saison auquel le licenciement a été prononcé.';

comment on function public.dismiss_current_team_staff(uuid) is
  'Licencie un membre du staff géré par le DS connecté et débite uniquement le solde de la saison active.';

commit;
