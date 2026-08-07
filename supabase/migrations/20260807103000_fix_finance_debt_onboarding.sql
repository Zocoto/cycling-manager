begin;

-- Une carrière créée en cours de saison ne doit supporter que les échéances
-- strictement postérieures à son arrivée. Les saisons suivantes repartent de J1.
alter table public.team_seasons
  add column if not exists finance_start_day_number smallint not null default 1;

alter table public.team_seasons
  drop constraint if exists team_seasons_finance_start_day_allowed;

alter table public.team_seasons
  add constraint team_seasons_finance_start_day_allowed
    check (finance_start_day_number between 1 and 28);

update public.team_seasons as team_season
set finance_start_day_number = greatest(
  1,
  least(28, (generation.created_at::date - season.starts_on) + 1)
)::smallint
from public.initial_career_generations as generation
join public.seasons as season on season.id = generation.season_id
where team_season.team_id = generation.team_id
  and team_season.season_id = generation.season_id;

create or replace function private.set_initial_career_finance_start()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.team_seasons as team_season
  set finance_start_day_number = greatest(
    1,
    least(28, coalesce(season.current_day_number, 1))
  )::smallint
  from public.seasons as season
  where team_season.team_id = new.team_id
    and team_season.season_id = new.season_id
    and season.id = new.season_id;

  return new;
end;
$$;

drop trigger if exists initial_career_finance_start
  on public.initial_career_generations;

create trigger initial_career_finance_start
after insert
on public.initial_career_generations
for each row
execute function private.set_initial_career_finance_start();

-- Protège aussi les contrats signés en cours de saison : une échéance passée
-- n'est jamais recréée comme "pending" par une resynchronisation de contrat.
create or replace function private.guard_retroactive_salary_installment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_finance_start_day smallint;
  v_contract_start_day smallint;
  v_season_starts_on date;
  v_signed_at timestamptz;
begin
  if new.source_reference !~ '^(rider-salary|staff-contract):[0-9a-f-]{36}:' then
    return new;
  end if;

  select
    team_season.finance_start_day_number,
    season.starts_on
  into v_finance_start_day, v_season_starts_on
  from public.team_seasons as team_season
  join public.seasons as season on season.id = team_season.season_id
  where team_season.id = new.team_season_id;

  if new.source_reference like 'rider-salary:%' then
    select coalesce(contract.signed_at, contract.created_at)
    into v_signed_at
    from public.rider_contracts as contract
    where contract.id = split_part(new.source_reference, ':', 2)::uuid;
  else
    select contract.signed_at
    into v_signed_at
    from public.staff_contracts as contract
    where contract.id = split_part(new.source_reference, ':', 2)::uuid;
  end if;

  v_contract_start_day := greatest(
    1,
    least(
      28,
      coalesce((v_signed_at::date - v_season_starts_on) + 1, 1)
    )
  )::smallint;

  if new.day_number <= greatest(v_finance_start_day, v_contract_start_day) then
    new.status := 'cancelled';
    new.posted_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_retroactive_salary_installment
  on public.team_finance_transactions;

create trigger guard_retroactive_salary_installment
before insert or update of
  team_season_id,
  day_number,
  category,
  status,
  source_reference
on public.team_finance_transactions
for each row
execute function private.guard_retroactive_salary_installment();

-- Rejoue la garde sur les échéances existantes, y compris celles déjà postées.
update public.team_finance_transactions as transaction
set status = transaction.status
where transaction.source_reference like 'rider-salary:%'
   or transaction.source_reference like 'staff-contract:%';

update public.team_seasons as team_season
set cash_balance = team_season.opening_cash_balance + coalesce((
  select sum(transaction.amount)
  from public.team_finance_transactions as transaction
  where transaction.team_season_id = team_season.id
    and transaction.status = 'posted'
), 0);

-- Les alertes deviennent des états actifs/résolus plutôt qu'un historique
-- éternellement affiché par l'interface.
alter table public.team_finance_alerts
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_checkpoint_day_number smallint;

alter table public.team_finance_alerts
  drop constraint if exists team_finance_alerts_resolved_checkpoint_allowed;

alter table public.team_finance_alerts
  add constraint team_finance_alerts_resolved_checkpoint_allowed
    check (
      resolved_checkpoint_day_number is null
      or resolved_checkpoint_day_number in (7, 14, 21, 28)
    );

create index if not exists team_finance_alerts_active_idx
  on public.team_finance_alerts (team_season_id, checkpoint_day_number desc)
  where resolved_at is null;

-- Recalcule les contrôles passés après suppression des charges rétroactives.
-- Cette table temporaire sert aussi à détecter le premier contrôle positif qui
-- clôt une dette sans pénalité supplémentaire.
create temporary table finance_checkpoint_repair
on commit drop
as
with team_context as (
  select
    team_season.id as team_season_id,
    team_season.opening_cash_balance,
    team_season.finance_start_day_number,
    season.current_day_number,
    generation.sporting_director_id
  from public.team_seasons as team_season
  join public.seasons as season on season.id = team_season.season_id
  join public.initial_career_generations as generation
    on generation.team_id = team_season.team_id
    and generation.season_id = team_season.season_id
), checkpoint_balances as (
  select
    context.team_season_id,
    context.sporting_director_id,
    checkpoint.day_number as checkpoint_day_number,
    context.opening_cash_balance + coalesce((
      select sum(transaction.amount)
      from public.team_finance_transactions as transaction
      where transaction.team_season_id = context.team_season_id
        and transaction.status = 'posted'
        and transaction.day_number <= checkpoint.day_number
    ), 0) as balance
  from team_context as context
  cross join unnest(array[7, 14, 21, 28]) as checkpoint(day_number)
  where checkpoint.day_number > context.finance_start_day_number
    and checkpoint.day_number <= context.current_day_number
)
select
  checkpoint.team_season_id,
  checkpoint.sporting_director_id,
  checkpoint.checkpoint_day_number,
  checkpoint.balance,
  lag(checkpoint.balance) over (
    partition by checkpoint.team_season_id
    order by checkpoint.checkpoint_day_number
  ) as previous_balance
from checkpoint_balances as checkpoint;

create temporary table finance_alert_repair
on commit drop
as
select
  alert.id as alert_id,
  coalesce(
    checkpoint.sporting_director_id,
    generation.sporting_director_id
  ) as sporting_director_id,
  checkpoint.balance as corrected_balance,
  checkpoint.previous_balance,
  alert.reputation_penalty as previous_penalty,
  case
    when checkpoint.balance < 0 and checkpoint.previous_balance < 0 then least(
      35,
      10 + ceil(abs(checkpoint.balance) / 25000)::integer * 2
    )
    else 0
  end as corrected_penalty,
  (
    select min(next_checkpoint.checkpoint_day_number)
    from finance_checkpoint_repair as next_checkpoint
    where next_checkpoint.team_season_id = alert.team_season_id
      and next_checkpoint.checkpoint_day_number >= alert.checkpoint_day_number
      and next_checkpoint.balance >= 0
  ) as resolved_checkpoint_day_number,
  checkpoint.team_season_id is null as is_invalid
from public.team_finance_alerts as alert
join public.team_seasons as team_season
  on team_season.id = alert.team_season_id
left join public.initial_career_generations as generation
  on generation.team_id = team_season.team_id
  and generation.season_id = team_season.season_id
left join finance_checkpoint_repair as checkpoint
  on checkpoint.team_season_id = alert.team_season_id
  and checkpoint.checkpoint_day_number = alert.checkpoint_day_number
where alert.severity in ('warning', 'critical');

with refunds as (
  select
    repair.sporting_director_id,
    sum(repair.previous_penalty - repair.corrected_penalty)::integer as points
  from finance_alert_repair as repair
  where repair.sporting_director_id is not null
    and repair.previous_penalty > repair.corrected_penalty
  group by repair.sporting_director_id
)
update public.sporting_directors as director
set reputation_points = director.reputation_points + refunds.points
from refunds
where director.id = refunds.sporting_director_id;

update public.team_finance_alerts as alert
set
  balance = coalesce(repair.corrected_balance, alert.balance),
  severity = case
    when repair.corrected_balance < 0 and repair.previous_balance < 0
      then 'critical'
    else 'warning'
  end,
  reputation_penalty = repair.corrected_penalty,
  message = case
    when repair.is_invalid then
      'Alerte annulée : ce contrôle est antérieur au début de la carrière.'
    when repair.corrected_balance < 0 and repair.previous_balance < 0 then
      'La dette n’a pas été résorbée depuis le précédent contrôle : '
        || repair.corrected_penalty || ' points de réputation sont retirés.'
    else
      'Trésorerie négative : le solde doit redevenir positif avant le prochain contrôle hebdomadaire.'
  end,
  resolved_at = case
    when repair.is_invalid or repair.resolved_checkpoint_day_number is not null
      then coalesce(alert.resolved_at, now())
    else null
  end,
  resolved_checkpoint_day_number = repair.resolved_checkpoint_day_number
from finance_alert_repair as repair
where alert.id = repair.alert_id;

create or replace function public.settle_current_team_finances()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_checkpoint integer;
  v_checkpoint_balance numeric(14, 2);
  v_previous_negative boolean;
  v_penalty integer;
begin
  select
    team_season.id as team_season_id,
    team_season.opening_cash_balance,
    team_season.finance_start_day_number,
    season.current_day_number,
    sporting_director.id as sporting_director_id
  into v_context
  from public.sporting_directors as sporting_director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = sporting_director.id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
    and team_season.season_id = season.id
  where sporting_director.auth_user_id = auth.uid()
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  update public.team_finance_transactions
  set status = 'posted', posted_at = coalesce(posted_at, now())
  where team_season_id = v_context.team_season_id
    and status = 'pending'
    and day_number <= v_context.current_day_number;

  update public.team_seasons
  set cash_balance = opening_cash_balance + coalesce((
    select sum(transaction.amount)
    from public.team_finance_transactions as transaction
    where transaction.team_season_id = v_context.team_season_id
      and transaction.status = 'posted'
  ), 0)
  where id = v_context.team_season_id;

  foreach v_checkpoint in array array[7, 14, 21, 28]
  loop
    if v_checkpoint > v_context.current_day_number
      or v_checkpoint <= v_context.finance_start_day_number then
      continue;
    end if;

    if exists (
      select 1
      from public.team_finance_alerts
      where team_season_id = v_context.team_season_id
        and checkpoint_day_number = v_checkpoint
    ) then
      continue;
    end if;

    select v_context.opening_cash_balance + coalesce(sum(transaction.amount), 0)
    into v_checkpoint_balance
    from public.team_finance_transactions as transaction
    where transaction.team_season_id = v_context.team_season_id
      and transaction.status = 'posted'
      and transaction.day_number <= v_checkpoint;

    if v_checkpoint_balance >= 0 then
      update public.team_finance_alerts
      set
        resolved_at = coalesce(resolved_at, now()),
        resolved_checkpoint_day_number = v_checkpoint
      where team_season_id = v_context.team_season_id
        and severity in ('warning', 'critical')
        and resolved_at is null;

      continue;
    end if;

    select exists (
      select 1
      from public.team_finance_alerts
      where team_season_id = v_context.team_season_id
        and severity in ('warning', 'critical')
        and balance < 0
        and resolved_at is null
    ) into v_previous_negative;

    v_penalty := case
      when v_previous_negative then least(
        35,
        10 + ceil(abs(v_checkpoint_balance) / 25000)::integer * 2
      )
      else 0
    end;

    insert into public.team_finance_alerts (
      team_season_id,
      checkpoint_day_number,
      balance,
      severity,
      reputation_penalty,
      message
    )
    values (
      v_context.team_season_id,
      v_checkpoint,
      v_checkpoint_balance,
      case when v_previous_negative then 'critical' else 'warning' end,
      v_penalty,
      case
        when v_previous_negative then
          'La dette n’a pas été résorbée depuis le précédent contrôle : '
            || v_penalty || ' points de réputation sont retirés.'
        else
          'Trésorerie négative : le solde doit redevenir positif avant le prochain contrôle hebdomadaire.'
      end
    );

    if v_penalty > 0 then
      update public.sporting_directors
      set reputation_points = greatest(0, reputation_points - v_penalty)
      where id = v_context.sporting_director_id;
    end if;
  end loop;
end;
$$;

revoke all on function private.set_initial_career_finance_start() from public, anon, authenticated;
revoke all on function private.guard_retroactive_salary_installment() from public, anon, authenticated;

comment on column public.team_seasons.finance_start_day_number is
  'Premier jour de responsabilité financière de l’équipe pour cette saison.';
comment on column public.team_finance_alerts.resolved_at is
  'Date à laquelle un contrôle financier positif a clôturé cette alerte.';

notify pgrst, 'reload schema';

commit;
