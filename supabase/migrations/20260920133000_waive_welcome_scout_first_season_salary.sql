begin;

-- Le salaire contractuel reste mémorisé pour les saisons suivantes, tandis
-- que cette référence neutralise uniquement la saison offerte. Une valeur
-- dédiée évite qu'une progression du scout ne réactive sa paie par mégarde.
alter table public.staff_contracts
  add column if not exists salary_waived_season_id uuid
    references public.seasons(id) on delete set null;

create index if not exists staff_contracts_salary_waiver_idx
  on public.staff_contracts (salary_waived_season_id)
  where salary_waived_season_id is not null;

comment on column public.staff_contracts.salary_waived_season_id is
  'Saison exceptionnellement exonérée de salaire ; le salaire contractuel normal reprend aux saisons suivantes.';

create or replace function public.sync_staff_salary_installments(
  p_contract_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract record;
  v_team_season record;
  v_regular_installment numeric(14, 2);
  v_amount numeric(14, 2);
begin
  select contract.*, member.first_name, member.last_name
  into v_contract
  from public.staff_contracts as contract
  join public.staff_members as member on member.id = contract.staff_member_id
  where contract.id = p_contract_id;

  if v_contract is null or v_contract.status <> 'active' then
    update public.team_finance_transactions
    set status = 'cancelled'
    where source_reference like 'staff-contract:' || p_contract_id::text || ':%'
      and status = 'pending';
    return;
  end if;

  v_regular_installment := round(v_contract.salary_per_season / 4, 2);

  for v_team_season in
    select team_season.*
    from public.team_seasons as team_season
    join public.seasons as season on season.id = team_season.season_id
    join public.seasons as start_season on start_season.id = v_contract.start_season_id
    left join public.seasons as end_season on end_season.id = v_contract.end_season_id
    where team_season.team_id = v_contract.team_id
      and team_season.status in ('planned', 'active')
      and season.game_year >= start_season.game_year
      and (end_season.id is null or season.game_year <= end_season.game_year)
  loop
    if v_contract.salary_waived_season_id = v_team_season.season_id then
      update public.team_finance_transactions
      set status = 'cancelled'
      where team_season_id = v_team_season.id
        and source_reference like 'staff-contract:' || p_contract_id::text
          || ':' || v_team_season.season_id::text || ':%'
        and status = 'pending';
      continue;
    end if;

    for v_installment in 1..4 loop
      v_amount := case
        when v_installment < 4 then v_regular_installment
        else v_contract.salary_per_season - v_regular_installment * 3
      end;

      insert into public.team_finance_transactions (
        team_season_id,
        season_day_id,
        day_number,
        amount,
        category,
        status,
        description,
        source_reference
      )
      select
        v_team_season.id,
        day.id,
        v_installment * 7,
        -v_amount,
        'staff_salary',
        'pending',
        'Salaire de ' || v_contract.first_name || ' ' || v_contract.last_name
          || ' · échéance ' || v_installment || '/4',
        'staff-contract:' || p_contract_id::text || ':'
          || v_team_season.season_id::text || ':' || v_installment
      from public.season_days as day
      where day.season_id = v_team_season.season_id
        and day.day_number = v_installment * 7
      on conflict (team_season_id, source_reference)
      do update set
        amount = excluded.amount,
        description = excluded.description,
        season_day_id = excluded.season_day_id,
        status = case
          when team_finance_transactions.status = 'posted'
            then team_finance_transactions.status
          else 'pending'
        end;
    end loop;
  end loop;
end;
$$;

drop trigger if exists staff_contract_finance_sync
on public.staff_contracts;

create trigger staff_contract_finance_sync
after insert or update of status, salary_per_season, salary_waived_season_id
on public.staff_contracts
for each row execute function public.handle_staff_contract_finance_change();

-- Le registre privé est l'autorité qui prouve que le scout a été offert par
-- la campagne. Aucun autre contrat de scout ne bénéficie de l'exonération.
create or replace function private.apply_new_director_welcome_scout_salary_waiver()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.scout_contract_id is null then
    return new;
  end if;

  update public.staff_contracts as contract
  set salary_waived_season_id = new.season_id
  where contract.id = new.scout_contract_id
    and contract.team_id = new.team_id
    and contract.start_season_id = new.season_id
    and contract.salary_waived_season_id is distinct from new.season_id;

  return new;
end;
$$;

drop trigger if exists new_director_welcome_scout_salary_waiver
on private.new_director_welcome_grants;

create trigger new_director_welcome_scout_salary_waiver
after insert or update on private.new_director_welcome_grants
for each row execute function private.apply_new_director_welcome_scout_salary_waiver();

-- Curatif : les cadeaux déjà attribués pendant la semaine en cours reçoivent
-- exactement la même exonération. La mise à jour déclenche la suppression des
-- quatre échéances encore en attente.
update public.staff_contracts as contract
set salary_waived_season_id = award.season_id
from private.new_director_welcome_grants as award
where contract.id = award.scout_contract_id
  and contract.team_id = award.team_id
  and contract.start_season_id = award.season_id
  and contract.salary_waived_season_id is distinct from award.season_id;

-- Une éventuelle échéance déjà débitée reste dans l'historique comptable et
-- reçoit un remboursement compensatoire traçable, sans réécrire le passé.
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
select
  transaction.team_season_id,
  transaction.season_day_id,
  transaction.day_number,
  -transaction.amount,
  'other',
  'posted',
  'Remboursement du salaire du scout de bienvenue · première saison offerte',
  'welcome-scout-salary-refund:' || transaction.id::text,
  now()
from private.new_director_welcome_grants as award
join public.staff_contracts as contract
  on contract.id = award.scout_contract_id
join public.team_seasons as team_season
  on team_season.team_id = award.team_id
 and team_season.season_id = award.season_id
join public.team_finance_transactions as transaction
  on transaction.team_season_id = team_season.id
 and transaction.category = 'staff_salary'
 and transaction.status = 'posted'
 and transaction.source_reference like
   'staff-contract:' || contract.id::text || ':' || award.season_id::text || ':%'
on conflict (team_season_id, source_reference) do nothing;

-- Le solde matérialisé est immédiatement cohérent, même avant la prochaine
-- ouverture de la page Finances par le Directeur Sportif.
update public.team_seasons as team_season
set cash_balance = team_season.opening_cash_balance + coalesce((
  select sum(transaction.amount)
  from public.team_finance_transactions as transaction
  where transaction.team_season_id = team_season.id
    and transaction.status = 'posted'
), 0)
where exists (
  select 1
  from private.new_director_welcome_grants as award
  where award.team_id = team_season.team_id
    and award.season_id = team_season.season_id
    and award.scout_contract_id is not null
);

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
  v_cash_balance numeric(14, 2);
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

  select team_season.cash_balance
  into v_cash_balance
  from public.team_seasons as team_season
  where team_season.id = v_context.team_season_id
  for update;

  select
    contract.id,
    contract.staff_member_id,
    contract.team_id,
    contract.salary_per_season,
    contract.salary_waived_season_id,
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

  if v_contract.salary_waived_season_id = v_context.season_id then
    v_due_current_salary := 0;
    v_current_remaining := 0;
  else
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
  end if;

  v_compensation := case
    when v_cash_balance < 0 then 0
    else round(v_current_remaining, 2)
  end;

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

revoke all on function private.apply_new_director_welcome_scout_salary_waiver()
  from public, anon, authenticated;

comment on function private.apply_new_director_welcome_scout_salary_waiver() is
  'Exonère uniquement la première saison du scout offert par la campagne de bienvenue.';

comment on function public.dismiss_current_team_staff(uuid) is
  'Licencie un membre du staff ; aucune indemnité saisonnière ne s’applique pendant une saison de salaire offerte.';

commit;
