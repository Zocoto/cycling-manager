begin;

-- Les règlements ci-dessous parcourent l'ensemble des coureurs actifs. Ils
-- restent idempotents, mais les exécuter à chaque rendu serveur consomme du
-- CPU et des I/O même lorsqu'aucune journée n'est à régler. Cette table sert
-- uniquement de verrou léger entre les instances Next.js.
create table if not exists public.game_settlement_throttles (
  task_key text primary key,
  last_claimed_at timestamptz not null default '-infinity'::timestamptz,

  constraint game_settlement_throttles_task_allowed
    check (task_key in ('training', 'health'))
);

alter table public.game_settlement_throttles enable row level security;

revoke all on table public.game_settlement_throttles
  from public, anon, authenticated;
grant all on table public.game_settlement_throttles to service_role;

insert into public.game_settlement_throttles (task_key)
values ('training'), ('health')
on conflict (task_key) do nothing;

create or replace function public.settle_due_training_sessions_throttled()
returns table (
  processed_sessions integer,
  completed_sessions integer,
  current_day_number integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed boolean := false;
  v_current_day_number integer;
begin
  update public.game_settlement_throttles as throttle
  set last_claimed_at = clock_timestamp()
  where throttle.task_key = 'training'
    and throttle.last_claimed_at <= statement_timestamp() - interval '1 minute'
  returning true into v_claimed;

  if coalesce(v_claimed, false) then
    return query
    select
      settlement.processed_sessions,
      settlement.completed_sessions,
      settlement.current_day_number
    from public.settle_due_training_sessions() as settlement;
    return;
  end if;

  select season.current_day_number::integer
  into v_current_day_number
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  return query select 0, 0, v_current_day_number;
end;
$$;

create or replace function public.settle_current_health_and_form_throttled()
returns table (
  processed_daily_effects integer,
  processed_injury_effects integer,
  current_day_number integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed boolean := false;
  v_current_day_number integer;
begin
  update public.game_settlement_throttles as throttle
  set last_claimed_at = clock_timestamp()
  where throttle.task_key = 'health'
    and throttle.last_claimed_at <= statement_timestamp() - interval '1 minute'
  returning true into v_claimed;

  if coalesce(v_claimed, false) then
    return query
    select
      settlement.processed_daily_effects,
      settlement.processed_injury_effects,
      settlement.current_day_number
    from public.settle_current_health_and_form() as settlement;
    return;
  end if;

  select season.current_day_number::integer
  into v_current_day_number
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  return query select 0, 0, v_current_day_number;
end;
$$;

create or replace function public.settle_current_rider_state_throttled()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_training record;
  v_health record;
begin
  select *
  into v_training
  from public.settle_due_training_sessions_throttled();

  select *
  into v_health
  from public.settle_current_health_and_form_throttled();

  return jsonb_build_object(
    'trainingProcessed', coalesce(v_training.processed_sessions, 0),
    'trainingCompleted', coalesce(v_training.completed_sessions, 0),
    'healthDailyEffects', coalesce(v_health.processed_daily_effects, 0),
    'healthInjuryEffects', coalesce(v_health.processed_injury_effects, 0),
    'currentDayNumber', coalesce(
      v_health.current_day_number,
      v_training.current_day_number
    )
  );
end;
$$;

revoke all on function public.settle_due_training_sessions_throttled()
  from public, anon, authenticated;
revoke all on function public.settle_current_health_and_form_throttled()
  from public, anon, authenticated;
revoke all on function public.settle_current_rider_state_throttled()
  from public, anon, authenticated;

grant execute on function public.settle_due_training_sessions_throttled()
  to service_role;
grant execute on function public.settle_current_health_and_form_throttled()
  to service_role;
grant execute on function public.settle_current_rider_state_throttled()
  to service_role;

comment on table public.game_settlement_throttles is
  'Verrou persistant qui empêche les lectures du jeu de relancer les règlements globaux plus d’une fois par minute.';

-- Le bandeau du jeu peut désormais charger ses trois pastilles dans un seul
-- aller-retour PostgREST, tout en conservant les fonctions spécialisées pour
-- les écrans qui en ont besoin séparément.
create or replace function public.get_current_game_header_indicators()
returns table (
  mailbox_unread_count integer,
  has_unread_global_chat boolean,
  has_unread_cyclogazette boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.get_current_director_unread_message_count(),
    public.has_unread_global_chat_messages(),
    public.has_unread_cyclogazette_editions();
$$;

revoke all on function public.get_current_game_header_indicators()
  from public, anon;
grant execute on function public.get_current_game_header_indicators()
  to authenticated, service_role;

comment on function public.get_current_game_header_indicators() is
  'Regroupe les compteurs non lus du bandeau de jeu dans un seul aller-retour.';

-- Plusieurs objectifs partagent la même métrique (trois paliers de victoires,
-- d'effectif ou de matériel, par exemple). L'ancienne requête recalculait la
-- métrique complète pour chaque palier. Les CTE matérialisées garantissent ici
-- un seul calcul par métrique distincte, aussi bien sur la page Objectifs que
-- dans le résumé rapide du bureau qui consomme cette fonction.
create or replace function public.get_current_game_objectives()
returns table (
  objective_key text,
  objective_type text,
  objective_group text,
  title text,
  description text,
  current_value integer,
  target_value integer,
  reward_cash numeric,
  reward_experience integer,
  reward_reputation numeric,
  reward_item_name text,
  reward_item_kind text,
  display_order integer,
  claimed_at timestamptz,
  is_completed boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_context record;
begin
  select
    director.id as director_id,
    director.experience_points,
    assignment.team_id
  into v_context
  from public.sporting_directors as director
  left join lateral (
    select managed.team_id
    from public.team_manager_assignments as managed
    where managed.sporting_director_id = director.id
      and managed.role = 'general_manager'
      and managed.status = 'active'
    order by managed.created_at desc
    limit 1
  ) as assignment on true
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    return;
  end if;

  return query
  with active_definitions as materialized (
    select definition.*
    from public.game_objective_definitions as definition
    where definition.is_active = true
  ),
  metric_keys as materialized (
    select distinct definition.metric_key
    from active_definitions as definition
  ),
  metric_progress as materialized (
    select
      metric.metric_key,
      public.calculate_game_objective_progress(
        metric.metric_key,
        v_context.director_id,
        v_context.team_id,
        v_context.experience_points
      ) as value
    from metric_keys as metric
  )
  select
    definition.objective_key,
    definition.objective_type,
    definition.objective_group,
    definition.title,
    definition.description,
    progress.value,
    definition.target_value,
    definition.reward_cash,
    definition.reward_experience,
    definition.reward_reputation,
    case
      when definition.reward_random_special_ability
        then 'Médaillon de capacité spéciale aléatoire'
      else coalesce(inventory_item.name, equipment_item.name)
    end,
    case
      when definition.reward_random_special_ability then 'special_ability'
      when definition.reward_inventory_item_key is not null
        then inventory_item.category
      when definition.reward_equipment_catalog_key is not null
        then 'equipment'
      else null
    end,
    definition.display_order,
    claim.claimed_at,
    progress.value >= definition.target_value
  from active_definitions as definition
  join metric_progress as progress
    on progress.metric_key = definition.metric_key
  left join public.game_objective_claims as claim
    on claim.objective_key = definition.objective_key
    and claim.sporting_director_id = v_context.director_id
  left join public.inventory_catalog_items as inventory_item
    on inventory_item.item_key = definition.reward_inventory_item_key
  left join public.equipment_catalog_items as equipment_item
    on equipment_item.catalog_key = definition.reward_equipment_catalog_key
  order by definition.display_order;
end;
$$;

comment on function public.get_current_game_objectives() is
  'Liste des objectifs courants dont chaque métrique distincte est calculée une seule fois par appel.';

commit;
