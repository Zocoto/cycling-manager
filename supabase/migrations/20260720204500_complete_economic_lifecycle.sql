-- ============================================================
-- Récompenses d'objectifs et clôture financière de saison
-- ============================================================

begin;

create or replace function public.reward_completed_sponsor_objective()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_reward_id uuid;
begin
  if new.status <> 'completed'
    or (tg_op = 'UPDATE' and old.status = 'completed') then
    return new;
  end if;

  select
    contract.team_id,
    team_season.id as team_season_id,
    sporting_director.id as sporting_director_id
  into v_context
  from public.team_sponsor_contracts as contract
  join public.team_seasons as team_season
    on team_season.team_id = contract.team_id
    and team_season.season_id = new.season_id
  left join public.team_manager_assignments as assignment
    on assignment.team_id = contract.team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  left join public.sporting_directors as sporting_director
    on sporting_director.id = assignment.sporting_director_id
  where contract.sponsor_offer_id = new.sponsor_offer_id
    and contract.status in ('planned', 'active', 'completed')
  limit 1;

  if v_context is null then
    return new;
  end if;

  insert into public.reward_events (
    source_reference,
    source_type,
    sporting_director_id,
    team_season_id,
    reputation_points,
    description
  )
  values (
    'sponsor-objective:' || new.id::text || ':' || v_context.team_id::text,
    'sponsor_objective',
    v_context.sporting_director_id,
    v_context.team_season_id,
    2,
    'Objectif sponsor rempli : ' || new.name
  )
  on conflict (source_reference) do nothing
  returning id into v_reward_id;

  if v_reward_id is not null then
    update public.sporting_directors
    set reputation_points = reputation_points + 2
    where id = v_context.sporting_director_id;

    update public.team_seasons
    set next_sponsor_budget_bonus_percent = least(
      14,
      next_sponsor_budget_bonus_percent + new.renewal_bonus_percent
    )
    where id = v_context.team_season_id;
  end if;

  return new;
end;
$$;

create trigger sponsor_objective_reward_on_completion
after insert or update of status
on public.sponsor_objectives
for each row execute function public.reward_completed_sponsor_objective();

create or replace function public.close_team_financial_season(
  p_team_season_id uuid
)
returns table (
  negative_season_streak smallint,
  released_rider_count integer,
  recovered_projected_payroll numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_season record;
  v_director_id uuid;
  v_contract record;
  v_new_streak smallint;
  v_previous_streak smallint := 0;
  v_released_count integer := 0;
  v_recovered_payroll numeric(14, 2) := 0;
  v_required_recovery numeric(14, 2);
  v_division_bonus integer := 0;
  v_reward_id uuid;
begin
  select team_season.*
  into v_team_season
  from public.team_seasons as team_season
  where team_season.id = p_team_season_id
  for update;

  if v_team_season is null then
    raise exception 'Saison d’équipe introuvable.';
  end if;

  perform public.refresh_uci_rankings(v_team_season.season_id);

  select sporting_director.id
  into v_director_id
  from public.team_manager_assignments as assignment
  join public.sporting_directors as sporting_director
    on sporting_director.id = assignment.sporting_director_id
  where assignment.team_id = v_team_season.team_id
    and assignment.role = 'general_manager'
    and assignment.status = 'active'
  limit 1;

  select case
    when final_rank between 1 and 20 then 15
    when final_rank between 21 and 50 then 8
    when final_rank between 51 and 100 then 4
    when final_rank between 101 and 200 then 1
    else 0
  end
  into v_division_bonus
  from public.team_seasons
  where id = p_team_season_id;

  if v_division_bonus > 0 then
    insert into public.reward_events (
      source_reference,
      source_type,
      sporting_director_id,
      team_season_id,
      reputation_points,
      description
    )
    values (
      'division-bonus:' || p_team_season_id::text,
      'division_bonus',
      v_director_id,
      p_team_season_id,
      v_division_bonus,
      'Bonus de division de fin de saison'
    )
    on conflict (source_reference) do nothing
    returning id into v_reward_id;

    if v_reward_id is not null then
      update public.sporting_directors
      set reputation_points = reputation_points + v_division_bonus
      where id = v_director_id;
    end if;
  end if;

  if v_team_season.cash_balance >= 0 then
    update public.team_seasons
    set negative_season_streak = 0
    where id = p_team_season_id;

    return query select 0::smallint, 0, 0::numeric;
    return;
  end if;

  select coalesce(previous_team_season.negative_season_streak, 0)
  into v_previous_streak
  from public.team_seasons as previous_team_season
  join public.seasons as previous_season
    on previous_season.id = previous_team_season.season_id
  join public.seasons as current_season
    on current_season.id = v_team_season.season_id
  where previous_team_season.team_id = v_team_season.team_id
    and previous_season.game_year < current_season.game_year
  order by previous_season.game_year desc
  limit 1;

  v_new_streak := greatest(
    v_team_season.negative_season_streak,
    coalesce(v_previous_streak, 0)
  ) + 1;
  update public.team_seasons
  set negative_season_streak = v_new_streak
  where id = p_team_season_id;

  if v_new_streak < 2 then
    return query select v_new_streak, 0, 0::numeric;
    return;
  end if;

  v_required_recovery := abs(v_team_season.cash_balance);

  for v_contract in
    select contract.id, contract.rider_id, contract.salary_per_season
    from public.rider_contracts as contract
    join public.seasons as end_season on end_season.id = contract.end_season_id
    join public.seasons as current_season on current_season.id = v_team_season.season_id
    where contract.team_id = v_team_season.team_id
      and contract.status = 'active'
      and end_season.game_year >= current_season.game_year
    order by contract.salary_per_season desc, contract.id
  loop
    update public.rider_contracts
    set status = 'terminated'
    where id = v_contract.id;

    if not exists (
      select 1 from public.rider_contracts
      where rider_id = v_contract.rider_id
        and status = 'active'
    ) then
      update public.riders
      set status = 'free_agent'
      where id = v_contract.rider_id;
    end if;

    v_released_count := v_released_count + 1;
    v_recovered_payroll := v_recovered_payroll + v_contract.salary_per_season;

    exit when v_recovered_payroll >= v_required_recovery;
  end loop;

  insert into public.team_finance_alerts (
    team_season_id,
    checkpoint_day_number,
    balance,
    severity,
    reputation_penalty,
    message
  )
  values (
    p_team_season_id,
    28,
    v_team_season.cash_balance,
    'forced_recovery',
    0,
    v_released_count || ' contrat(s), en commençant par les plus gros salaires, '
      || 'ont été libérés pour rétablir la projection financière.'
  )
  on conflict (team_season_id, checkpoint_day_number)
  do update set
    severity = 'forced_recovery',
    message = excluded.message;

  return query select v_new_streak, v_released_count, v_recovered_payroll;
end;
$$;

create or replace function public.close_team_finances_when_season_completes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    perform public.close_team_financial_season(new.id);
  end if;
  return new;
end;
$$;

create trigger team_season_financial_closure
after update of status
on public.team_seasons
for each row execute function public.close_team_finances_when_season_completes();

revoke all on function public.close_team_financial_season(uuid) from public;
grant execute on function public.close_team_financial_season(uuid) to service_role;

comment on function public.close_team_financial_season(uuid) is
  'Attribue le bonus de division, suit les saisons déficitaires et libère les plus gros salaires après deux saisons négatives.';

notify pgrst, 'reload schema';

commit;
