begin;

create or replace function public.get_current_dashboard_fast_summary()
returns table (
  sporting_director_id uuid,
  team_id uuid,
  team_season_id uuid,
  team_name text,
  rider_count integer,
  season_id uuid,
  season_name text,
  season_day_number integer,
  cash_balance numeric,
  currency text,
  team_points integer,
  team_rank integer,
  division_code text,
  inventory_total_units integer,
  inventory_available_units integer,
  race_roster_alert_count integer,
  objective_total_count integer,
  objective_ready_count integer,
  trophy_reward_count integer,
  daily_reward_available boolean
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with current_context as (
    select
      sporting_director.id as sporting_director_id,
      team.id as team_id,
      team_season.id as team_season_id,
      regexp_replace(
        team_season.display_name::text,
        '\s+·\s+[A-F0-9]{4}$',
        ''
      )::text as team_name,
      team_season.opening_cash_balance,
      team_season.currency,
      team_season.points,
      team_season.division_id,
      season.id as season_id,
      season.name as season_name,
      season.game_year,
      season.current_day_number
    from public.sporting_directors as sporting_director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = sporting_director.id
      and assignment.role = 'general_manager'
      and assignment.status = 'active'
    join public.teams as team
      on team.id = assignment.team_id
      and team.status = 'active'
    join public.seasons as season
      on season.status = 'active'
    join public.team_seasons as team_season
      on team_season.team_id = team.id
      and team_season.season_id = season.id
      and team_season.status = 'active'
    where sporting_director.auth_user_id = auth.uid()
      and sporting_director.status = 'active'
    limit 1
  ),
  active_contracts as (
    select contract.rider_id
    from public.rider_contracts as contract
    join public.seasons as start_season
      on start_season.id = contract.start_season_id
    join public.seasons as end_season
      on end_season.id = contract.end_season_id
    join current_context as context
      on context.team_id = contract.team_id
    where contract.status = 'active'
      and start_season.game_year <= context.game_year
      and end_season.game_year >= context.game_year
  ),
  ranked_teams as (
    select
      team_season.id,
      row_number() over (
        order by team_season.points desc, team_season.display_name, team_season.id
      )::integer as rank
    from public.team_seasons as team_season
    join current_context as context
      on context.season_id = team_season.season_id
    where team_season.status <> 'withdrawn'
  ),
  effective_finances as (
    select
      context.opening_cash_balance
        + coalesce(sum(transaction.amount) filter (
            where transaction.status <> 'cancelled'
              and transaction.day_number <= context.current_day_number
          ), 0) as balance
    from current_context as context
    left join public.team_finance_transactions as transaction
      on transaction.team_season_id = context.team_season_id
    group by context.opening_cash_balance
  ),
  generic_inventory as (
    select coalesce(sum(inventory.quantity), 0)::integer as quantity
    from current_context as context
    left join public.team_item_inventory as inventory
      on inventory.team_season_id = context.team_season_id
  ),
  equipment_usage as (
    select
      assignment.equipment_item_id,
      count(*)::integer as quantity
    from public.rider_equipment_assignments as assignment
    join active_contracts as contract
      on contract.rider_id = assignment.rider_id
    group by assignment.equipment_item_id
  ),
  pending_equipment_usage as (
    select
      pending.equipment_item_id,
      count(*)::integer as quantity
    from current_context as context
    join public.rider_equipment_pending_assignments as pending
      on pending.team_season_id = context.team_season_id
    group by pending.equipment_item_id
  ),
  equipment_inventory as (
    select
      coalesce(sum(inventory.quantity), 0)::integer as total_quantity,
      coalesce(sum(greatest(
        0,
        inventory.quantity
          - coalesce(used.quantity, 0)
          - coalesce(pending.quantity, 0)
      )), 0)::integer as available_quantity
    from current_context as context
    left join public.team_equipment_inventory as inventory
      on inventory.team_season_id = context.team_season_id
    left join equipment_usage as used
      on used.equipment_item_id = inventory.equipment_item_id
    left join pending_equipment_usage as pending
      on pending.equipment_item_id = inventory.equipment_item_id
  ),
  medical_alerts as (
    select count(*)::integer as quantity
    from current_context as context
    join public.race_roster_notifications as notification
      on notification.team_season_id = context.team_season_id
    where notification.requires_action = true
      and notification.read_at is null
  ),
  objective_status as (
    select
      count(*)::integer as total_count,
      count(*) filter (
        where objective.is_completed
          and objective.claimed_at is null
      )::integer as ready_count
    from public.get_current_game_objectives() as objective
  ),
  reward_status as (
    select
      (
        select count(*)::integer
        from public.sporting_director_trophies as trophy
        where trophy.sporting_director_id = context.sporting_director_id
          and trophy.claimed_at is null
      ) as trophy_count,
      not exists (
        select 1
        from public.daily_reward_claims as reward
        join public.season_days as reward_day on reward_day.id = reward.season_day_id
        where reward.sporting_director_id = context.sporting_director_id
          and reward.season_id = context.season_id
          and reward_day.day_number = context.current_day_number
      ) as daily_available
    from current_context as context
  )
  select
    context.sporting_director_id,
    context.team_id,
    context.team_season_id,
    context.team_name,
    (select count(*)::integer from active_contracts),
    context.season_id,
    context.season_name,
    context.current_day_number::integer,
    finances.balance,
    context.currency,
    context.points::integer,
    ranked.rank,
    coalesce(division.code, 'amateur')::text,
    (generic.quantity + equipment.total_quantity)::integer,
    (generic.quantity + equipment.available_quantity)::integer,
    medical.quantity,
    objectives.total_count,
    objectives.ready_count,
    rewards.trophy_count,
    rewards.daily_available
  from current_context as context
  cross join effective_finances as finances
  cross join generic_inventory as generic
  cross join equipment_inventory as equipment
  cross join medical_alerts as medical
  cross join objective_status as objectives
  cross join reward_status as rewards
  left join ranked_teams as ranked
    on ranked.id = context.team_season_id
  left join public.divisions as division
    on division.id = context.division_id;
$$;

comment on function public.get_current_dashboard_fast_summary() is
  'Résumé compact du bureau du DS : identité équipe, finances effectives, classement, inventaire et alertes médicales en un seul aller-retour.';

revoke all on function public.get_current_dashboard_fast_summary() from public;
revoke all on function public.get_current_dashboard_fast_summary() from anon;
grant execute on function public.get_current_dashboard_fast_summary() to authenticated;

commit;
