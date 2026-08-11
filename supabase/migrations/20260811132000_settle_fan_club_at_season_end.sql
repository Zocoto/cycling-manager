begin;

-- This routine calls sync_active_season_day() and depends on now(); STABLE was
-- both inaccurate and rejected by plpgsql_check.
alter function public.get_training_effective_day_number(uuid) volatile;

create or replace function public.settle_team_fan_club_sales_for_day(
  p_team_season_id uuid,
  p_day_number integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_profile record;
  v_inventory record;
  v_game_day integer;
  v_elapsed integer;
  v_base_rate numeric;
  v_suggested_price numeric;
  v_elasticity numeric;
  v_expected numeric;
  v_random_factor numeric;
  v_units integer;
  v_revenue numeric(14, 2);
  v_total_revenue numeric(14, 2) := 0;
  v_total_units integer := 0;
begin
  select team_season.team_id, team_season.season_id,
    season.game_year, day.id as season_day_id
  into v_context
  from public.team_seasons as team_season
  join public.seasons as season on season.id = team_season.season_id
  join public.season_days as day
    on day.season_id = season.id and day.day_number = p_day_number
  where team_season.id = p_team_season_id
    and p_day_number between 1 and 28
  for update of team_season;

  if v_context is null then
    return 0;
  end if;

  select profile.* into v_profile
  from public.fan_club_profiles as profile
  where profile.team_id = v_context.team_id
  for update;

  if v_profile is null then
    return 0;
  end if;

  v_game_day := v_context.game_year * 28 + p_day_number - 1;
  if v_profile.last_settled_game_day is null then
    update public.fan_club_profiles
    set last_settled_game_day = v_game_day, updated_at = now()
    where team_id = v_context.team_id;
    return 0;
  end if;
  if v_profile.last_settled_game_day >= v_game_day then
    return 0;
  end if;

  v_elapsed := least(7, v_game_day - v_profile.last_settled_game_day);

  for v_inventory in
    select inventory.*
    from public.fan_club_shop_inventory as inventory
    where inventory.team_id = v_context.team_id and inventory.quantity > 0
    for update
  loop
    select product.base_rate, product.suggested_price, product.elasticity
    into v_base_rate, v_suggested_price, v_elasticity
    from (values
      ('team-jersey', 0.0015::numeric, 69::numeric, 1.60::numeric),
      ('bottle', 0.0030::numeric, 12::numeric, 1.35::numeric),
      ('pennant', 0.0022::numeric, 18::numeric, 1.45::numeric),
      ('cap', 0.0020::numeric, 24::numeric, 1.50::numeric),
      ('supporter-balloon', 0.0040::numeric, 5::numeric, 1.20::numeric)
    ) as product(product_code, base_rate, suggested_price, elasticity)
    where product.product_code = v_inventory.product_code;

    v_random_factor := 0.55 + random() * 0.90;
    v_expected := v_profile.supporter_count * v_base_rate
      * (0.65 + v_profile.fervor / 200.0)
      * (0.75 + v_profile.popularity_index / 200.0)
      * v_profile.recent_results_multiplier
      * greatest(0.2, least(2.0,
        power(v_suggested_price / v_inventory.sale_price, v_elasticity)))
      * v_elapsed;
    v_units := least(v_inventory.quantity,
      greatest(0, floor(v_expected * v_random_factor)::integer));

    if v_units > 0 then
      v_revenue := round(v_units * v_inventory.sale_price, 2);
      update public.fan_club_shop_inventory
      set quantity = quantity - v_units, updated_at = now()
      where team_id = v_context.team_id
        and product_code = v_inventory.product_code;

      insert into public.fan_club_shop_sales (
        team_id, season_id, day_number, product_code, units_sold,
        unit_price, revenue, demand_factor
      ) values (
        v_context.team_id, v_context.season_id, p_day_number,
        v_inventory.product_code, v_units, v_inventory.sale_price,
        v_revenue, round(v_random_factor, 3)
      ) on conflict (team_id, season_id, day_number, product_code) do nothing;

      v_total_revenue := v_total_revenue + v_revenue;
      v_total_units := v_total_units + v_units;
    end if;
  end loop;

  if v_total_revenue > 0 then
    update public.team_seasons
    set cash_balance = cash_balance + v_total_revenue
    where id = p_team_season_id;

    insert into public.team_finance_transactions (
      team_season_id, season_day_id, day_number, amount, category,
      status, description, source_reference, posted_at
    ) values (
      p_team_season_id, v_context.season_day_id, p_day_number,
      v_total_revenue, 'other', 'posted',
      'Fan Club - ventes de cloture de saison',
      'fan-club:sales:' || v_context.season_id::text || ':' || p_day_number,
      now()
    ) on conflict (team_season_id, source_reference) do nothing;
  end if;

  update public.fan_club_profiles
  set last_settled_game_day = v_game_day, updated_at = now()
  where team_id = v_context.team_id;

  return v_total_units;
end;
$$;

create or replace function public.settle_fan_club_when_team_season_completes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    perform public.settle_team_fan_club_sales_for_day(new.id, 28);
  end if;
  return new;
end;
$$;

drop trigger if exists aab_team_season_fan_club_sales_closure
  on public.team_seasons;
create trigger aab_team_season_fan_club_sales_closure
after update of status on public.team_seasons
for each row execute function public.settle_fan_club_when_team_season_completes();

revoke all on function public.settle_team_fan_club_sales_for_day(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.settle_fan_club_when_team_season_completes()
  from public, anon, authenticated;
grant execute on function public.settle_team_fan_club_sales_for_day(uuid, integer)
  to service_role;

comment on function public.settle_team_fan_club_sales_for_day(uuid, integer) is
  'Regle les ventes fan-club differees d une equipe avant sa cloture financiere.';

notify pgrst, 'reload schema';

commit;
