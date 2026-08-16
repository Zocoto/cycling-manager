begin;

create or replace function public.calculate_fan_club_price_factor(
  p_product_code text,
  p_sale_price numeric,
  p_unit_cost numeric,
  p_popularity_index numeric
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_suggested_price numeric;
  v_elasticity numeric;
  v_default_cost numeric;
  v_margin_tolerance numeric;
  v_margin_penalty numeric;
  v_popularity_bonus numeric;
  v_resistance_start numeric;
  v_maximum_price numeric;
  v_safe_cost numeric;
  v_popularity_exception numeric;
  v_tolerated_cost_multiple numeric;
  v_customer_price_ceiling numeric;
  v_price_elasticity_factor numeric;
  v_cost_multiple numeric;
  v_excessive_margin_factor numeric;
  v_price_resistance_factor numeric;
begin
  select product.suggested_price, product.elasticity,
    product.default_cost, product.margin_tolerance,
    product.margin_penalty, product.popularity_bonus,
    product.resistance_start, product.maximum_price
  into v_suggested_price, v_elasticity,
    v_default_cost, v_margin_tolerance,
    v_margin_penalty, v_popularity_bonus,
    v_resistance_start, v_maximum_price
  from (values
    ('team-jersey', 69::numeric, 1.60::numeric, 38::numeric,
      2.00::numeric, 1.80::numeric, 0.50::numeric, 100::numeric, 200::numeric),
    ('bottle', 12::numeric, 1.35::numeric, 5.2::numeric,
      2.15::numeric, 2.20::numeric, 0.25::numeric, 18::numeric, 35::numeric),
    ('pennant', 18::numeric, 1.45::numeric, 8::numeric,
      2.15::numeric, 2.00::numeric, 0.30::numeric, 28::numeric, 50::numeric),
    ('cap', 24::numeric, 1.50::numeric, 9.5::numeric,
      2.20::numeric, 1.90::numeric, 0.35::numeric, 38::numeric, 70::numeric),
    ('supporter-balloon', 5::numeric, 1.20::numeric, 1.82::numeric,
      2.30::numeric, 2.30::numeric, 0.20::numeric, 8::numeric, 16::numeric)
  ) as product(
    product_code, suggested_price, elasticity, default_cost,
    margin_tolerance, margin_penalty, popularity_bonus,
    resistance_start, maximum_price
  )
  where product.product_code = p_product_code;

  if v_suggested_price is null or coalesce(p_sale_price, 0) <= 0 then
    return 0;
  end if;

  v_safe_cost := greatest(
    0.01,
    coalesce(nullif(p_unit_cost, 0), v_default_cost)
  );
  v_popularity_exception := greatest(
    0,
    least(1, (greatest(0, coalesce(p_popularity_index, 0)) - 80) / 20.0)
  );
  v_tolerated_cost_multiple := v_margin_tolerance
    + v_popularity_exception * v_popularity_bonus;
  v_customer_price_ceiling := v_maximum_price
    * (1 + v_popularity_exception * 0.15);

  if p_sale_price >= v_customer_price_ceiling then
    return 0;
  end if;

  v_price_elasticity_factor := least(
    2,
    power(v_suggested_price / p_sale_price, v_elasticity)
  );
  v_cost_multiple := p_sale_price / v_safe_cost;
  v_excessive_margin_factor := case
    when v_cost_multiple <= v_tolerated_cost_multiple then 1
    else exp(
      -(v_cost_multiple - v_tolerated_cost_multiple) * v_margin_penalty
    )
  end;
  v_price_resistance_factor := case
    when p_sale_price <= v_resistance_start then 1
    else power(
      greatest(
        0,
        (v_customer_price_ceiling - p_sale_price)
          / (v_customer_price_ceiling - v_resistance_start)
      ),
      2
    )
  end;

  return greatest(
    0,
    least(
      2,
      v_price_elasticity_factor
        * v_excessive_margin_factor
        * v_price_resistance_factor
    )
  );
end;
$$;

create or replace function public.settle_current_team_fan_club_sales()
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
  perform public.settle_current_team_finances();
  select assignment.team_id, season.id as season_id, season.game_year,
    season.current_day_number, team_season.id as team_season_id,
    season_day.id as season_day_id
  into v_context
  from public.sporting_directors director
  join public.team_manager_assignments assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons season on season.status = 'active'
  join public.team_seasons team_season
    on team_season.team_id = assignment.team_id and team_season.season_id = season.id
  join public.season_days season_day
    on season_day.season_id = season.id and season_day.day_number = season.current_day_number
  where director.auth_user_id = auth.uid() and director.status = 'active'
  limit 1;
  if v_context is null then return 0; end if;
  select * into v_profile from public.fan_club_profiles
  where team_id = v_context.team_id for update;
  if v_profile is null then return 0; end if;
  v_game_day := v_context.game_year * 28 + v_context.current_day_number - 1;
  if v_profile.last_settled_game_day is null then
    update public.fan_club_profiles set last_settled_game_day = v_game_day, updated_at = now()
    where team_id = v_context.team_id;
    return 0;
  end if;
  if v_profile.last_settled_game_day >= v_game_day then return 0; end if;
  v_elapsed := least(7, v_game_day - v_profile.last_settled_game_day);

  for v_inventory in
    select * from public.fan_club_shop_inventory
    where team_id = v_context.team_id and quantity > 0 for update
  loop
    select base_rate, suggested_price, elasticity
    into v_base_rate, v_suggested_price, v_elasticity
    from (values
      ('team-jersey', 0.0015::numeric, 69::numeric, 1.60::numeric),
      ('bottle', 0.0030::numeric, 12::numeric, 1.35::numeric),
      ('pennant', 0.0022::numeric, 18::numeric, 1.45::numeric),
      ('cap', 0.0020::numeric, 24::numeric, 1.50::numeric),
      ('supporter-balloon', 0.0040::numeric, 5::numeric, 1.20::numeric)
    ) product(product_code, base_rate, suggested_price, elasticity)
    where product_code = v_inventory.product_code;
    v_random_factor := 0.55 + random() * 0.90;
    v_expected := v_profile.supporter_count * v_base_rate
      * (0.65 + v_profile.fervor / 200.0)
      * (0.75 + v_profile.popularity_index / 200.0)
      * v_profile.recent_results_multiplier
      * public.calculate_fan_club_price_factor(
          v_inventory.product_code,
          v_inventory.sale_price,
          v_inventory.average_unit_cost,
          v_profile.popularity_index
        )
      * v_elapsed;
    v_units := least(v_inventory.quantity, greatest(0, floor(v_expected * v_random_factor)::integer));
    if v_units > 0 then
      v_revenue := round(v_units * v_inventory.sale_price, 2);
      update public.fan_club_shop_inventory
      set quantity = quantity - v_units, updated_at = now()
      where team_id = v_context.team_id and product_code = v_inventory.product_code;
      insert into public.fan_club_shop_sales (
        team_id, season_id, day_number, product_code, units_sold,
        unit_price, revenue, demand_factor
      ) values (
        v_context.team_id, v_context.season_id, v_context.current_day_number,
        v_inventory.product_code, v_units, v_inventory.sale_price,
        v_revenue, round(v_random_factor, 3)
      ) on conflict (team_id, season_id, day_number, product_code) do nothing;
      v_total_revenue := v_total_revenue + v_revenue;
      v_total_units := v_total_units + v_units;
    end if;
  end loop;
  if v_total_revenue > 0 then
    update public.team_seasons set cash_balance = cash_balance + v_total_revenue
    where id = v_context.team_season_id;
    insert into public.team_finance_transactions (
      team_season_id, season_day_id, day_number, amount, category, status,
      description, source_reference, posted_at
    ) values (
      v_context.team_season_id, v_context.season_day_id, v_context.current_day_number,
      v_total_revenue, 'other', 'posted', 'Fan Club — ventes de la boutique',
      'fan-club:sales:' || v_context.season_id::text || ':' || v_context.current_day_number::text,
      now()
    ) on conflict (team_season_id, source_reference) do nothing;
  end if;
  update public.fan_club_profiles set last_settled_game_day = v_game_day, updated_at = now()
  where team_id = v_context.team_id;
  return v_total_units;
end;
$$;

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
      * public.calculate_fan_club_price_factor(
          v_inventory.product_code,
          v_inventory.sale_price,
          v_inventory.average_unit_cost,
          v_profile.popularity_index
        )
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

revoke all on function public.calculate_fan_club_price_factor(
  text, numeric, numeric, numeric
) from public, anon, authenticated;

comment on function public.calculate_fan_club_price_factor(
  text, numeric, numeric, numeric
) is
  'Réduit fortement la demande au-delà de la marge tolérée et annule les prix dépassant le plafond psychologique propre à chaque article.';

commit;
