begin;

-- Le nom historique "snapshot" permettait difficilement de distinguer cette
-- identité stable des compteurs temps réel. Le nouvel appel est explicite et
-- l'ancien point d'entrée est fermé afin que les clients obsolètes ne puissent
-- plus entretenir le trafic résiduel observé après la migration du bandeau.
create or replace function public.get_current_game_header_identity()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'display_name', director.display_name,
    'team_id', team.id,
    'team_name', team_season.display_name,
    'team_short_name', team_season.short_name,
    'sponsor_catalog_key', sponsor.catalog_key,
    'selected_jersey_id', sponsor_contract.selected_jersey_id,
    'budget_per_season', sponsor_contract.budget_per_season,
    'currency_code', sponsor_contract.currency_code,
    'contract_duration_seasons', sponsor_contract.contract_duration_seasons
  )
  from public.sporting_directors as director
  left join lateral (
    select assignment.team_id
    from public.team_manager_assignments as assignment
    where assignment.sporting_director_id = director.id
      and assignment.role = 'general_manager'
      and assignment.status = 'active'
    order by assignment.created_at desc
    limit 1
  ) as current_assignment on true
  left join public.teams as team
    on team.id = current_assignment.team_id
  left join public.seasons as active_season
    on active_season.status = 'active'
  left join public.team_seasons as team_season
    on team_season.team_id = team.id
   and team_season.season_id = active_season.id
  left join lateral (
    select
      contract.sponsor_id,
      contract.selected_jersey_id,
      contract.budget_per_season,
      contract.currency_code,
      contract.contract_duration_seasons
    from public.team_sponsor_contracts as contract
    where contract.team_id = team.id
      and contract.role = 'principal'
      and contract.status = 'active'
    order by contract.created_at desc
    limit 1
  ) as sponsor_contract on true
  left join public.sponsors as sponsor
    on sponsor.id = sponsor_contract.sponsor_id
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;
$$;

revoke all on function public.get_current_game_header_identity()
  from public, anon;
grant execute on function public.get_current_game_header_identity()
  to authenticated, service_role;

revoke all on function public.get_current_game_header_snapshot()
  from public, anon, authenticated, service_role;

comment on function public.get_current_game_header_identity() is
  'Identité privée minimale du bandeau de jeu, distincte de ses indicateurs temps réel.';

-- Aucun règlement global ne doit rester appelable depuis une session de page,
-- y compris au travers d'un ancien bundle ou d'un appel PostgREST manuel.
revoke execute on function public.settle_due_training_sessions()
  from public, anon, authenticated;
revoke execute on function public.settle_current_health_and_form()
  from public, anon, authenticated;
revoke execute on function public.settle_current_rider_state_throttled()
  from public, anon, authenticated;
revoke execute on function public.settle_current_rider_state_for_maintenance()
  from public, anon, authenticated;

grant execute on function public.settle_due_training_sessions()
  to service_role;
grant execute on function public.settle_current_health_and_form()
  to service_role;
grant execute on function public.settle_current_rider_state_throttled()
  to service_role;
grant execute on function public.settle_current_rider_state_for_maintenance()
  to service_role;

-- Le bureau n'a besoin que de deux compteurs d'objectifs. Leur calcul complet
-- était pourtant répété à chaque navigation. Cette cache privée et courte
-- absorbe les rafales de navigation ; la page Objectifs continue à calculer la
-- progression exacte. Une réclamation invalide immédiatement la ligne.
create table if not exists public.game_objective_summary_cache (
  sporting_director_id uuid primary key
    references public.sporting_directors(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  season_day_number integer not null,
  experience_points numeric not null,
  total_count integer not null,
  ready_count integer not null,
  computed_at timestamptz not null default clock_timestamp(),

  constraint game_objective_summary_cache_counts_valid check (
    total_count >= 0
    and ready_count >= 0
    and ready_count <= total_count
  )
);

alter table public.game_objective_summary_cache enable row level security;
revoke all on table public.game_objective_summary_cache
  from public, anon, authenticated;
grant all on table public.game_objective_summary_cache to service_role;

create or replace function public.get_current_game_objective_summary_cached()
returns table (
  total_count integer,
  ready_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_context record;
  v_total_count integer;
  v_ready_count integer;
begin
  select
    director.id as sporting_director_id,
    coalesce(director.experience_points, 0) as experience_points,
    assignment.team_id,
    season.id as season_id,
    season.current_day_number::integer as season_day_number
  into v_context
  from public.sporting_directors as director
  join lateral (
    select managed.team_id
    from public.team_manager_assignments as managed
    where managed.sporting_director_id = director.id
      and managed.role = 'general_manager'
      and managed.status = 'active'
    order by managed.created_at desc
    limit 1
  ) as assignment on true
  join public.seasons as season
    on season.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    return;
  end if;

  select cache.total_count, cache.ready_count
  into v_total_count, v_ready_count
  from public.game_objective_summary_cache as cache
  where cache.sporting_director_id = v_context.sporting_director_id
    and cache.team_id = v_context.team_id
    and cache.season_id = v_context.season_id
    and cache.season_day_number = v_context.season_day_number
    and cache.experience_points = v_context.experience_points
    and cache.computed_at >= statement_timestamp() - interval '60 seconds';

  if found then
    return query select v_total_count, v_ready_count;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'game-objective-summary:' || v_context.sporting_director_id::text,
      0
    )
  );

  -- Une requête concurrente a pu remplir la cache pendant l'attente du verrou.
  select cache.total_count, cache.ready_count
  into v_total_count, v_ready_count
  from public.game_objective_summary_cache as cache
  where cache.sporting_director_id = v_context.sporting_director_id
    and cache.team_id = v_context.team_id
    and cache.season_id = v_context.season_id
    and cache.season_day_number = v_context.season_day_number
    and cache.experience_points = v_context.experience_points
    and cache.computed_at >= statement_timestamp() - interval '60 seconds';

  if not found then
    select
      count(*)::integer,
      count(*) filter (
        where objective.is_completed
          and objective.claimed_at is null
      )::integer
    into v_total_count, v_ready_count
    from public.get_current_game_objectives() as objective;

    insert into public.game_objective_summary_cache (
      sporting_director_id,
      team_id,
      season_id,
      season_day_number,
      experience_points,
      total_count,
      ready_count,
      computed_at
    )
    values (
      v_context.sporting_director_id,
      v_context.team_id,
      v_context.season_id,
      v_context.season_day_number,
      v_context.experience_points,
      coalesce(v_total_count, 0),
      coalesce(v_ready_count, 0),
      clock_timestamp()
    )
    on conflict (sporting_director_id) do update
    set team_id = excluded.team_id,
      season_id = excluded.season_id,
      season_day_number = excluded.season_day_number,
      experience_points = excluded.experience_points,
      total_count = excluded.total_count,
      ready_count = excluded.ready_count,
      computed_at = excluded.computed_at;
  end if;

  return query select
    coalesce(v_total_count, 0),
    coalesce(v_ready_count, 0);
end;
$$;

revoke all on function public.get_current_game_objective_summary_cached()
  from public, anon, authenticated;
grant execute on function public.get_current_game_objective_summary_cached()
  to service_role;

create or replace function public.invalidate_game_objective_summary_cache()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.game_objective_summary_cache as cache
    where cache.sporting_director_id = old.sporting_director_id;
    return old;
  end if;

  delete from public.game_objective_summary_cache as cache
  where cache.sporting_director_id = new.sporting_director_id;
  return new;
end;
$$;

revoke all on function public.invalidate_game_objective_summary_cache()
  from public, anon, authenticated;

drop trigger if exists invalidate_game_objective_summary_cache_on_claim
  on public.game_objective_claims;
create trigger invalidate_game_objective_summary_cache_on_claim
after insert or update or delete on public.game_objective_claims
for each row execute function public.invalidate_game_objective_summary_cache();

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
    select summary.total_count, summary.ready_count
    from public.get_current_game_objective_summary_cached() as summary
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
  'Résumé compact du bureau ; les compteurs d’objectifs absorbent les rafales de navigation dans une cache privée de 60 secondes.';

revoke all on function public.get_current_dashboard_fast_summary()
  from public, anon;
grant execute on function public.get_current_dashboard_fast_summary()
  to authenticated, service_role;

comment on table public.game_objective_summary_cache is
  'Cache privée très courte des seuls compteurs d’objectifs nécessaires au bureau du DS.';
comment on function public.get_current_game_objective_summary_cached() is
  'Compte les objectifs du bureau au plus une fois par minute et par Directeur Sportif.';

notify pgrst, 'reload schema';

commit;
