-- Settle every Fan Club shop at the daily game rollover instead of on page load.

begin;

create or replace function public.settle_due_fan_club_shop_sales()
returns table (
  processed_teams integer,
  processed_days integer,
  units_sold integer,
  failed_teams integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target record;
  v_day_number integer;
  v_first_due_day integer;
  v_units integer;
  v_processed_teams integer := 0;
  v_processed_days integer := 0;
  v_units_sold integer := 0;
  v_failed_teams integer := 0;
begin
  -- Keep the game day aligned with the Paris calendar before computing the CR.
  perform public.sync_active_season_day();

  for v_target in
    select
      team_season.id as team_season_id,
      team_season.team_id,
      season.id as season_id,
      season.game_year,
      season.current_day_number,
      profile.last_settled_game_day
    from public.seasons as season
    join public.team_seasons as team_season
      on team_season.season_id = season.id
     and team_season.status = 'active'
    join public.team_infrastructures as infrastructure
      on infrastructure.team_id = team_season.team_id
     and infrastructure.infrastructure_code = 'club_shop'
     and infrastructure.level > 0
    join public.fan_club_profiles as profile
      on profile.team_id = team_season.team_id
    where season.status = 'active'
    order by team_season.id
  loop
    begin
      v_processed_teams := v_processed_teams + 1;

      perform public.expire_fan_club_collector_stock(
        v_target.team_id,
        v_target.season_id
      );

      -- A newly opened shop starts with the previous day as its baseline, so
      -- its first scheduled CR can sell today's stock normally.
      if v_target.last_settled_game_day is null then
        update public.fan_club_profiles
        set last_settled_game_day =
              v_target.game_year * 28 + v_target.current_day_number - 2,
            updated_at = now()
        where team_id = v_target.team_id
          and last_settled_game_day is null;

        v_first_due_day := v_target.current_day_number;
      else
        v_first_due_day := greatest(
          1,
          v_target.last_settled_game_day - v_target.game_year * 28 + 2
        );
      end if;

      if v_first_due_day <= v_target.current_day_number then
        for v_day_number in
          v_first_due_day..v_target.current_day_number
        loop
          v_units := public.settle_team_fan_club_sales_for_day(
            v_target.team_season_id,
            v_day_number
          );
          v_processed_days := v_processed_days + 1;
          v_units_sold := v_units_sold + coalesce(v_units, 0);

          update public.team_finance_transactions
          set description = 'Fan Club — ventes quotidiennes de la boutique'
          where team_season_id = v_target.team_season_id
            and source_reference =
              'fan-club:sales:' || v_target.season_id::text || ':'
              || v_day_number::text;
        end loop;
      end if;
    exception
      when others then
        v_failed_teams := v_failed_teams + 1;
        raise warning
          'Daily Fan Club sales failed for team %: %',
          v_target.team_id,
          sqlerrm;
    end;
  end loop;

  return query
  select
    v_processed_teams,
    v_processed_days,
    v_units_sold,
    v_failed_teams;
end;
$$;

create or replace function public.get_current_fan_club_assistant_summary()
returns table (
  shop_level integer,
  total_stock integer,
  sales_processed_today boolean,
  today_units_sold integer,
  today_revenue numeric
)
language sql
stable
security definer
set search_path = ''
set statement_timeout = '2000ms'
as $$
  with current_context as (
    select
      assignment.team_id,
      season.id as season_id,
      season.game_year,
      season.current_day_number
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.seasons as season
      on season.status = 'active'
    where director.auth_user_id = auth.uid()
      and director.status = 'active'
    limit 1
  ),
  shop as (
    select coalesce(max(infrastructure.level), 0)::integer as shop_level
    from current_context as context
    left join public.team_infrastructures as infrastructure
      on infrastructure.team_id = context.team_id
     and infrastructure.infrastructure_code = 'club_shop'
  ),
  inventory as (
    select coalesce(sum(item.quantity), 0)::integer as total_stock
    from current_context as context
    left join public.fan_club_shop_inventory as item
      on item.team_id = context.team_id
  ),
  profile as (
    select max(fan_profile.last_settled_game_day) as last_settled_game_day
    from current_context as context
    left join public.fan_club_profiles as fan_profile
      on fan_profile.team_id = context.team_id
  ),
  today_sales as (
    select
      coalesce(sum(sale.units_sold), 0)::integer as units_sold,
      coalesce(sum(sale.revenue), 0)::numeric as revenue
    from current_context as context
    left join public.fan_club_shop_sales as sale
      on sale.team_id = context.team_id
     and sale.season_id = context.season_id
     and sale.day_number = context.current_day_number
  )
  select
    shop.shop_level,
    inventory.total_stock,
    coalesce(
      profile.last_settled_game_day >=
        context.game_year * 28 + context.current_day_number - 1,
      false
    ) as sales_processed_today,
    today_sales.units_sold,
    today_sales.revenue
  from current_context as context
  cross join shop
  cross join inventory
  cross join profile
  cross join today_sales
$$;

revoke all on function public.settle_due_fan_club_shop_sales()
  from public, anon, authenticated;
grant execute on function public.settle_due_fan_club_shop_sales()
  to service_role;

-- Visiting the shop must never be able to trigger the daily settlement again.
revoke execute on function public.settle_current_team_fan_club_sales()
  from authenticated;

revoke all on function public.get_current_fan_club_assistant_summary()
  from public, anon;
grant execute on function public.get_current_fan_club_assistant_summary()
  to authenticated;

comment on function public.settle_due_fan_club_shop_sales() is
  'Règle une fois par journée de jeu les ventes de toutes les boutiques actives, avec rattrapage idempotent des journées manquées.';

comment on function public.get_current_fan_club_assistant_summary() is
  'Expose au DS le stock et le CR du jour de sa boutique pour son assistant.';

commit;
