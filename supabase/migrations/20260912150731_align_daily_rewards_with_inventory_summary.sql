begin;

-- The inventory page already merges available daily-reward consumables with
-- generic items and physical equipment. Keep the dashboard shortcut on the
-- exact same perimeter instead of omitting those rewards from both counters.
create or replace function public.get_current_dashboard_fast_summary_v2()
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
  unread_trophy_count integer,
  daily_reward_available boolean
)
language sql
volatile
security definer
set search_path = ''
as $$
  select
    summary.sporting_director_id,
    summary.team_id,
    summary.team_season_id,
    summary.team_name,
    summary.rider_count,
    summary.season_id,
    summary.season_name,
    summary.season_day_number,
    summary.cash_balance,
    summary.currency,
    summary.team_points,
    summary.team_rank,
    summary.division_code,
    (summary.inventory_total_units + daily_rewards.quantity)::integer,
    (summary.inventory_available_units + daily_rewards.quantity)::integer,
    summary.race_roster_alert_count,
    summary.objective_total_count,
    summary.objective_ready_count,
    summary.trophy_reward_count,
    (
      select count(*)::integer
      from public.sporting_director_trophy_notifications as notification
      where notification.sporting_director_id = summary.sporting_director_id
        and notification.seen_at is null
    ),
    summary.daily_reward_available
  from public.get_current_dashboard_fast_summary() as summary
  join public.seasons as season
    on season.id = summary.season_id
  cross join lateral (
    select count(*)::integer as quantity
    from public.daily_reward_inventory as inventory
    join public.daily_reward_catalog as catalog
      on catalog.reward_key = inventory.reward_key
    where inventory.sporting_director_id = summary.sporting_director_id
      and inventory.status = 'available'
      and inventory.expires_after_game_year >= season.game_year
      and catalog.effect_kind <> 'equipment'
  ) as daily_rewards;
$$;

revoke all on function public.get_current_dashboard_fast_summary_v2()
  from public, anon;
grant execute on function public.get_current_dashboard_fast_summary_v2()
  to authenticated, service_role;

comment on function public.get_current_dashboard_fast_summary_v2() is
  'Résumé du bureau incluant tous les consommables quotidiens encore disponibles dans les compteurs de l’inventaire.';

-- Every daily claim is meant to create an inventory row in the same
-- transaction. Enforce that contract at commit time so a future claim-flow
-- refactor cannot silently award a reward without storing its object.
create or replace function public.assert_daily_reward_claim_has_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.daily_reward_inventory as inventory
    where inventory.source_claim_id = new.id
  ) then
    raise exception
      'La récompense quotidienne réclamée doit être ajoutée à l’inventaire.';
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_daily_reward_claim_has_inventory
  on public.daily_reward_claims;
create constraint trigger ensure_daily_reward_claim_has_inventory
after insert on public.daily_reward_claims
deferrable initially deferred
for each row execute function public.assert_daily_reward_claim_has_inventory();

revoke all on function public.assert_daily_reward_claim_has_inventory()
  from public, anon, authenticated;
grant execute on function public.assert_daily_reward_claim_has_inventory()
  to service_role;

comment on function public.assert_daily_reward_claim_has_inventory() is
  'Empêche de valider une récompense quotidienne sans créer son objet d’inventaire dans la même transaction.';

notify pgrst, 'reload schema';

commit;
