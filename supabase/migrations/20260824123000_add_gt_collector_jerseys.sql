begin;

alter table public.fan_club_shop_inventory
  drop constraint fan_club_inventory_product_allowed;

alter table public.fan_club_shop_inventory
  add column collector_season_id uuid
    references public.seasons(id)
    on delete cascade,
  add constraint fan_club_inventory_product_allowed check (
    product_code in (
      'team-jersey',
      'bottle',
      'pennant',
      'cap',
      'supporter-balloon',
      'collector-jersey-france',
      'collector-jersey-italy',
      'collector-jersey-spain'
    )
  ),
  add constraint fan_club_inventory_collector_season_required check (
    (
      product_code in (
        'collector-jersey-france',
        'collector-jersey-italy',
        'collector-jersey-spain'
      )
      and collector_season_id is not null
    )
    or (
      product_code not in (
        'collector-jersey-france',
        'collector-jersey-italy',
        'collector-jersey-spain'
      )
      and collector_season_id is null
    )
  );

create index fan_club_inventory_collector_season_idx
  on public.fan_club_shop_inventory (collector_season_id)
  where collector_season_id is not null;

alter table public.fan_club_shop_sales
  drop constraint fan_club_sales_product_allowed;

alter table public.fan_club_shop_sales
  add constraint fan_club_sales_product_allowed check (
    product_code in (
      'team-jersey',
      'bottle',
      'pennant',
      'cap',
      'supporter-balloon',
      'collector-jersey-france',
      'collector-jersey-italy',
      'collector-jersey-spain'
    )
  );

create or replace function public.get_fan_club_shop_product_config(
  p_product_code text
)
returns table (
  required_level integer,
  wholesale_product_code text,
  suggested_price numeric,
  base_rate numeric,
  elasticity numeric,
  default_cost numeric,
  margin_tolerance numeric,
  margin_penalty numeric,
  popularity_bonus numeric,
  resistance_start numeric,
  maximum_price numeric,
  is_collector boolean
)
language sql
immutable
set search_path = ''
as $$
  select
    product.required_level,
    product.wholesale_product_code,
    product.suggested_price,
    product.base_rate,
    product.elasticity,
    product.default_cost,
    product.margin_tolerance,
    product.margin_penalty,
    product.popularity_bonus,
    product.resistance_start,
    product.maximum_price,
    product.is_collector
  from (values
    ('team-jersey', 1, 'team-jersey', 69::numeric, 0.0015::numeric,
      1.60::numeric, 38::numeric, 2.00::numeric, 1.80::numeric,
      0.50::numeric, 100::numeric, 200::numeric, false),
    ('bottle', 2, 'bottle', 12::numeric, 0.0030::numeric,
      1.35::numeric, 5.2::numeric, 2.15::numeric, 2.20::numeric,
      0.25::numeric, 18::numeric, 35::numeric, false),
    ('pennant', 3, 'pennant', 18::numeric, 0.0022::numeric,
      1.45::numeric, 8::numeric, 2.15::numeric, 2.00::numeric,
      0.30::numeric, 28::numeric, 50::numeric, false),
    ('cap', 4, 'cap', 24::numeric, 0.0020::numeric,
      1.50::numeric, 9.5::numeric, 2.20::numeric, 1.90::numeric,
      0.35::numeric, 38::numeric, 70::numeric, false),
    ('supporter-balloon', 5, 'supporter-balloon', 5::numeric, 0.0040::numeric,
      1.20::numeric, 1.82::numeric, 2.30::numeric, 2.30::numeric,
      0.20::numeric, 8::numeric, 16::numeric, false),
    ('collector-jersey-france', 1, 'team-jersey', 109::numeric, 0.0022::numeric,
      1.25::numeric, 38::numeric, 3.40::numeric, 1.20::numeric,
      0.70::numeric, 155::numeric, 260::numeric, true),
    ('collector-jersey-italy', 1, 'team-jersey', 109::numeric, 0.0022::numeric,
      1.25::numeric, 38::numeric, 3.40::numeric, 1.20::numeric,
      0.70::numeric, 155::numeric, 260::numeric, true),
    ('collector-jersey-spain', 1, 'team-jersey', 109::numeric, 0.0022::numeric,
      1.25::numeric, 38::numeric, 3.40::numeric, 1.20::numeric,
      0.70::numeric, 155::numeric, 260::numeric, true)
  ) as product(
    product_code,
    required_level,
    wholesale_product_code,
    suggested_price,
    base_rate,
    elasticity,
    default_cost,
    margin_tolerance,
    margin_penalty,
    popularity_bonus,
    resistance_start,
    maximum_price,
    is_collector
  )
  where product.product_code = p_product_code;
$$;

create or replace function public.team_won_fan_club_collector_gt(
  p_team_id uuid,
  p_season_id uuid,
  p_product_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.race_results as result
    join public.race_editions as edition
      on edition.id = result.race_edition_id
     and edition.season_id = p_season_id
    join public.races as race
      on race.id = edition.race_id
    join public.race_rosters as roster
      on roster.id = result.race_roster_id
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    join public.team_seasons as team_season
      on team_season.id = registration.team_season_id
     and team_season.season_id = p_season_id
    where team_season.team_id = p_team_id
      and result.status = 'classified'
      and result.final_rank = 1
      and race.slug = case p_product_code
        when 'collector-jersey-france' then 'boucle-des-provinces'
        when 'collector-jersey-italy' then 'corsa-delle-regioni'
        when 'collector-jersey-spain' then 'ruta-de-las-sierras'
        else null
      end
  );
$$;

create or replace function public.expire_fan_club_collector_stock(
  p_team_id uuid,
  p_active_season_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_count integer;
begin
  delete from public.fan_club_shop_inventory as inventory
  where inventory.team_id = p_team_id
    and inventory.product_code in (
      'collector-jersey-france',
      'collector-jersey-italy',
      'collector-jersey-spain'
    )
    and inventory.collector_season_id is distinct from p_active_season_id;

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

create or replace function public.get_current_team_fan_club_collector_products()
returns table (product_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_season_id uuid;
begin
  v_team_id := public.current_fan_club_team_id();

  select season.id
  into v_season_id
  from public.seasons as season
  where season.status = 'active'
  order by season.game_year desc
  limit 1;

  if v_team_id is null or v_season_id is null then
    return;
  end if;

  perform public.expire_fan_club_collector_stock(v_team_id, v_season_id);

  return query
  select collector.product_code
  from (values
    ('collector-jersey-france'::text),
    ('collector-jersey-italy'::text),
    ('collector-jersey-spain'::text)
  ) as collector(product_code)
  where public.team_won_fan_club_collector_gt(
    v_team_id,
    v_season_id,
    collector.product_code
  )
  order by collector.product_code;
end;
$$;

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
  v_product record;
  v_safe_cost numeric;
  v_popularity_exception numeric;
  v_tolerated_cost_multiple numeric;
  v_customer_price_ceiling numeric;
  v_price_elasticity_factor numeric;
  v_cost_multiple numeric;
  v_excessive_margin_factor numeric;
  v_price_resistance_factor numeric;
begin
  select config.*
  into v_product
  from public.get_fan_club_shop_product_config(p_product_code) as config;

  if v_product is null or coalesce(p_sale_price, 0) <= 0 then
    return 0;
  end if;

  v_safe_cost := greatest(
    0.01,
    coalesce(nullif(p_unit_cost, 0), v_product.default_cost)
  );
  v_popularity_exception := greatest(
    0,
    least(1, (greatest(0, coalesce(p_popularity_index, 0)) - 80) / 20.0)
  );
  v_tolerated_cost_multiple := v_product.margin_tolerance
    + v_popularity_exception * v_product.popularity_bonus;
  v_customer_price_ceiling := v_product.maximum_price
    * (1 + v_popularity_exception * 0.15);

  if p_sale_price >= v_customer_price_ceiling then
    return 0;
  end if;

  v_price_elasticity_factor := least(
    2,
    power(v_product.suggested_price / p_sale_price, v_product.elasticity)
  );
  v_cost_multiple := p_sale_price / v_safe_cost;
  v_excessive_margin_factor := case
    when v_cost_multiple <= v_tolerated_cost_multiple then 1
    else exp(
      -(v_cost_multiple - v_tolerated_cost_multiple) * v_product.margin_penalty
    )
  end;
  v_price_resistance_factor := case
    when p_sale_price <= v_product.resistance_start then 1
    else power(
      greatest(
        0,
        (v_customer_price_ceiling - p_sale_price)
          / (v_customer_price_ceiling - v_product.resistance_start)
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

create or replace function public.purchase_current_team_fan_club_stock(
  p_product_code text,
  p_quantity integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_product record;
  v_shop_level integer;
  v_unit_cost numeric(10, 2);
  v_capacity integer;
  v_total_stock integer;
  v_previous_quantity integer;
  v_previous_average numeric(10, 2);
  v_cost numeric(14, 2);
  v_new_quantity integer;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 5000 then
    raise exception 'La quantité demandée est invalide.';
  end if;

  perform public.settle_current_team_finances();

  select
    assignment.team_id,
    season.id as season_id,
    season.current_day_number,
    team_season.id as team_season_id,
    team_season.cash_balance,
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

  perform public.expire_fan_club_collector_stock(
    v_context.team_id,
    v_context.season_id
  );

  select config.*
  into v_product
  from public.get_fan_club_shop_product_config(p_product_code) as config;

  if v_product is null then
    raise exception 'Cet article n’existe pas.';
  end if;

  select infrastructure.level
  into v_shop_level
  from public.team_infrastructures as infrastructure
  where infrastructure.team_id = v_context.team_id
    and infrastructure.infrastructure_code = 'club_shop';

  if coalesce(v_shop_level, 0) < 1 then
    raise exception 'Construisez d’abord le magasin du club.';
  end if;
  if v_shop_level < v_product.required_level then
    raise exception 'Cet article n’est pas encore disponible dans votre magasin.';
  end if;
  if v_product.is_collector and not public.team_won_fan_club_collector_gt(
    v_context.team_id,
    v_context.season_id,
    p_product_code
  ) then
    raise exception 'Ce maillot collector est réservé au vainqueur du Grand Tour de la saison.';
  end if;

  perform public.ensure_fan_club_wholesale_prices(
    v_context.season_id,
    v_context.current_day_number
  );

  select price.unit_cost
  into v_unit_cost
  from public.fan_club_wholesale_prices as price
  where price.season_id = v_context.season_id
    and price.day_number = v_context.current_day_number
    and price.product_code = v_product.wholesale_product_code;

  if v_unit_cost is null then
    raise exception 'Le cours de cet article est momentanément indisponible.';
  end if;

  v_capacity := (array[300, 800, 1600, 3000, 5000]::integer[])[v_shop_level];
  select coalesce(sum(inventory.quantity), 0)
  into v_total_stock
  from public.fan_club_shop_inventory as inventory
  where inventory.team_id = v_context.team_id;

  if v_total_stock + p_quantity > v_capacity then
    raise exception 'La capacité de stockage du magasin est insuffisante.';
  end if;

  v_cost := p_quantity * v_unit_cost;
  if v_context.cash_balance < v_cost then
    raise exception 'Trésorerie insuffisante pour acheter ce stock.';
  end if;

  select inventory.quantity, inventory.average_unit_cost
  into v_previous_quantity, v_previous_average
  from public.fan_club_shop_inventory as inventory
  where inventory.team_id = v_context.team_id
    and inventory.product_code = p_product_code
  for update;

  v_previous_quantity := coalesce(v_previous_quantity, 0);
  v_previous_average := coalesce(v_previous_average, 0);

  insert into public.fan_club_shop_inventory (
    team_id,
    product_code,
    quantity,
    average_unit_cost,
    sale_price,
    collector_season_id
  ) values (
    v_context.team_id,
    p_product_code,
    p_quantity,
    v_unit_cost,
    v_product.suggested_price,
    case when v_product.is_collector then v_context.season_id else null end
  )
  on conflict (team_id, product_code) do update
  set quantity = public.fan_club_shop_inventory.quantity + excluded.quantity,
      average_unit_cost = round(
        (v_previous_quantity * v_previous_average + p_quantity * v_unit_cost)
        / (v_previous_quantity + p_quantity),
        2
      ),
      collector_season_id = excluded.collector_season_id,
      updated_at = now()
  returning quantity into v_new_quantity;

  update public.team_seasons
  set cash_balance = cash_balance - v_cost
  where id = v_context.team_season_id;

  insert into public.team_finance_transactions (
    team_season_id,
    season_day_id,
    day_number,
    amount,
    category,
    description,
    status,
    source_reference,
    posted_at
  ) values (
    v_context.team_season_id,
    v_context.season_day_id,
    v_context.current_day_number,
    -v_cost,
    'other',
    'Fan Club — achat de stock',
    'posted',
    'fan-club:stock:' || p_product_code || ':' || gen_random_uuid()::text,
    now()
  );

  return v_new_quantity;
end;
$$;

create or replace function public.set_current_team_fan_club_sale_price(
  p_product_code text,
  p_sale_price numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_season_id uuid;
  v_shop_level integer;
  v_product record;
begin
  if p_sale_price is null or p_sale_price < 0.5 or p_sale_price > 999 then
    raise exception 'Le prix de vente est invalide.';
  end if;

  v_team_id := public.current_fan_club_team_id();
  select season.id
  into v_season_id
  from public.seasons as season
  where season.status = 'active'
  order by season.game_year desc
  limit 1;

  if v_team_id is null or v_season_id is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  perform public.expire_fan_club_collector_stock(v_team_id, v_season_id);

  select config.*
  into v_product
  from public.get_fan_club_shop_product_config(p_product_code) as config;

  if v_product is null then
    raise exception 'Cet article n’existe pas.';
  end if;

  select infrastructure.level
  into v_shop_level
  from public.team_infrastructures as infrastructure
  where infrastructure.team_id = v_team_id
    and infrastructure.infrastructure_code = 'club_shop';

  if coalesce(v_shop_level, 0) < v_product.required_level then
    raise exception 'Cet article n’est pas disponible dans votre magasin.';
  end if;
  if v_product.is_collector and not public.team_won_fan_club_collector_gt(
    v_team_id,
    v_season_id,
    p_product_code
  ) then
    raise exception 'Ce maillot collector est réservé au vainqueur du Grand Tour de la saison.';
  end if;

  insert into public.fan_club_shop_inventory (
    team_id,
    product_code,
    quantity,
    average_unit_cost,
    sale_price,
    collector_season_id
  ) values (
    v_team_id,
    p_product_code,
    0,
    0,
    round(p_sale_price, 2),
    case when v_product.is_collector then v_season_id else null end
  )
  on conflict (team_id, product_code) do update
  set sale_price = excluded.sale_price,
      collector_season_id = excluded.collector_season_id,
      updated_at = now();

  return round(p_sale_price, 2);
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
  v_product record;
  v_game_day integer;
  v_elapsed integer;
  v_expected numeric;
  v_random_factor numeric;
  v_units integer;
  v_revenue numeric(14, 2);
  v_total_revenue numeric(14, 2) := 0;
  v_total_units integer := 0;
begin
  perform public.settle_current_team_finances();

  select
    assignment.team_id,
    season.id as season_id,
    season.game_year,
    season.current_day_number,
    team_season.id as team_season_id,
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
    return 0;
  end if;

  perform public.expire_fan_club_collector_stock(
    v_context.team_id,
    v_context.season_id
  );

  select profile.*
  into v_profile
  from public.fan_club_profiles as profile
  where profile.team_id = v_context.team_id
  for update;

  if v_profile is null then
    return 0;
  end if;

  v_game_day := v_context.game_year * 28 + v_context.current_day_number - 1;
  if v_profile.last_settled_game_day is null then
    update public.fan_club_profiles
    set last_settled_game_day = v_game_day,
        updated_at = now()
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
    where inventory.team_id = v_context.team_id
      and inventory.quantity > 0
      and (
        inventory.collector_season_id is null
        or inventory.collector_season_id = v_context.season_id
      )
    for update
  loop
    select config.*
    into v_product
    from public.get_fan_club_shop_product_config(
      v_inventory.product_code
    ) as config;

    if v_product is null then
      continue;
    end if;

    v_random_factor := 0.55 + random() * 0.90;
    v_expected := v_profile.supporter_count * v_product.base_rate
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
    v_units := least(
      v_inventory.quantity,
      greatest(0, floor(v_expected * v_random_factor)::integer)
    );

    if v_units > 0 then
      v_revenue := round(v_units * v_inventory.sale_price, 2);
      update public.fan_club_shop_inventory
      set quantity = quantity - v_units,
          updated_at = now()
      where team_id = v_context.team_id
        and product_code = v_inventory.product_code;

      insert into public.fan_club_shop_sales (
        team_id,
        season_id,
        day_number,
        product_code,
        units_sold,
        unit_price,
        revenue,
        demand_factor
      ) values (
        v_context.team_id,
        v_context.season_id,
        v_context.current_day_number,
        v_inventory.product_code,
        v_units,
        v_inventory.sale_price,
        v_revenue,
        round(v_random_factor, 3)
      )
      on conflict (team_id, season_id, day_number, product_code) do nothing;

      v_total_revenue := v_total_revenue + v_revenue;
      v_total_units := v_total_units + v_units;
    end if;
  end loop;

  if v_total_revenue > 0 then
    update public.team_seasons
    set cash_balance = cash_balance + v_total_revenue
    where id = v_context.team_season_id;

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
    ) values (
      v_context.team_season_id,
      v_context.season_day_id,
      v_context.current_day_number,
      v_total_revenue,
      'other',
      'posted',
      'Fan Club — ventes de la boutique',
      'fan-club:sales:' || v_context.season_id::text || ':'
        || v_context.current_day_number::text,
      now()
    )
    on conflict (team_season_id, source_reference) do nothing;
  end if;

  update public.fan_club_profiles
  set last_settled_game_day = v_game_day,
      updated_at = now()
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
  v_product record;
  v_game_day integer;
  v_elapsed integer;
  v_expected numeric;
  v_random_factor numeric;
  v_units integer;
  v_revenue numeric(14, 2);
  v_total_revenue numeric(14, 2) := 0;
  v_total_units integer := 0;
begin
  select
    team_season.team_id,
    team_season.season_id,
    season.game_year,
    day.id as season_day_id
  into v_context
  from public.team_seasons as team_season
  join public.seasons as season
    on season.id = team_season.season_id
  join public.season_days as day
    on day.season_id = season.id
   and day.day_number = p_day_number
  where team_season.id = p_team_season_id
    and p_day_number between 1 and 28
  for update of team_season;

  if v_context is null then
    return 0;
  end if;

  select profile.*
  into v_profile
  from public.fan_club_profiles as profile
  where profile.team_id = v_context.team_id
  for update;

  if v_profile is null then
    return 0;
  end if;

  v_game_day := v_context.game_year * 28 + p_day_number - 1;
  if v_profile.last_settled_game_day is null then
    update public.fan_club_profiles
    set last_settled_game_day = v_game_day,
        updated_at = now()
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
    where inventory.team_id = v_context.team_id
      and inventory.quantity > 0
      and (
        inventory.collector_season_id is null
        or inventory.collector_season_id = v_context.season_id
      )
    for update
  loop
    select config.*
    into v_product
    from public.get_fan_club_shop_product_config(
      v_inventory.product_code
    ) as config;

    if v_product is null then
      continue;
    end if;

    v_random_factor := 0.55 + random() * 0.90;
    v_expected := v_profile.supporter_count * v_product.base_rate
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
    v_units := least(
      v_inventory.quantity,
      greatest(0, floor(v_expected * v_random_factor)::integer)
    );

    if v_units > 0 then
      v_revenue := round(v_units * v_inventory.sale_price, 2);
      update public.fan_club_shop_inventory
      set quantity = quantity - v_units,
          updated_at = now()
      where team_id = v_context.team_id
        and product_code = v_inventory.product_code;

      insert into public.fan_club_shop_sales (
        team_id,
        season_id,
        day_number,
        product_code,
        units_sold,
        unit_price,
        revenue,
        demand_factor
      ) values (
        v_context.team_id,
        v_context.season_id,
        p_day_number,
        v_inventory.product_code,
        v_units,
        v_inventory.sale_price,
        v_revenue,
        round(v_random_factor, 3)
      )
      on conflict (team_id, season_id, day_number, product_code) do nothing;

      v_total_revenue := v_total_revenue + v_revenue;
      v_total_units := v_total_units + v_units;
    end if;
  end loop;

  if v_total_revenue > 0 then
    update public.team_seasons
    set cash_balance = cash_balance + v_total_revenue
    where id = p_team_season_id;

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
    ) values (
      p_team_season_id,
      v_context.season_day_id,
      p_day_number,
      v_total_revenue,
      'other',
      'posted',
      'Fan Club - ventes de cloture de saison',
      'fan-club:sales:' || v_context.season_id::text || ':' || p_day_number,
      now()
    )
    on conflict (team_season_id, source_reference) do nothing;
  end if;

  update public.fan_club_profiles
  set last_settled_game_day = v_game_day,
      updated_at = now()
  where team_id = v_context.team_id;

  return v_total_units;
end;
$$;

revoke all on function public.get_fan_club_shop_product_config(text)
  from public, anon, authenticated;
revoke all on function public.team_won_fan_club_collector_gt(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.expire_fan_club_collector_stock(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.get_current_team_fan_club_collector_products()
  from public, anon;
revoke all on function public.calculate_fan_club_price_factor(
  text, numeric, numeric, numeric
) from public, anon, authenticated;
revoke all on function public.purchase_current_team_fan_club_stock(text, integer)
  from public, anon;
revoke all on function public.set_current_team_fan_club_sale_price(text, numeric)
  from public, anon;
revoke all on function public.settle_current_team_fan_club_sales()
  from public, anon;
revoke all on function public.settle_team_fan_club_sales_for_day(uuid, integer)
  from public, anon, authenticated;

grant execute on function public.get_current_team_fan_club_collector_products()
  to authenticated;
grant execute on function public.purchase_current_team_fan_club_stock(text, integer)
  to authenticated;
grant execute on function public.set_current_team_fan_club_sale_price(text, numeric)
  to authenticated;
grant execute on function public.settle_current_team_fan_club_sales()
  to authenticated;
grant execute on function public.settle_team_fan_club_sales_for_day(uuid, integer)
  to service_role;

comment on function public.get_current_team_fan_club_collector_products() is
  'Liste les maillots collectors de la saison remportés par l équipe du DS connecté.';
comment on column public.fan_club_shop_inventory.collector_season_id is
  'Saison de validité d un maillot collector. Le stock est supprimé au changement de saison.';

notify pgrst, 'reload schema';

commit;
