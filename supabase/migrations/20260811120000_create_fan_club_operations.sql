-- Fan Club production operations: fleet, trips, shop inventory and daily sales.

begin;
create table public.fan_club_profiles (
  team_id uuid primary key references public.teams(id) on delete cascade,
  supporter_count integer not null default 0 check (supporter_count >= 0),
  fervor smallint not null default 0 check (fervor between 0 and 100),
  popularity_index smallint not null default 0 check (popularity_index between 0 and 100),
  recent_results_multiplier numeric(6, 3) not null default 1 check (recent_results_multiplier >= 0),
  last_settled_game_day integer,
  updated_at timestamptz not null default now()
);
create table public.fan_club_fleet (
  team_id uuid not null references public.teams(id) on delete cascade,
  model_code text not null,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (team_id, model_code),
  constraint fan_club_fleet_model_allowed check (
    model_code in ('regional', 'grand-tourisme', 'double-etage')
  )
);
create table public.fan_club_trip_allocations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  race_edition_id uuid not null references public.race_editions(id) on delete cascade,
  model_code text not null,
  car_count integer not null check (car_count > 0),
  trip_cost numeric(14, 2) not null check (trip_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fan_club_trip_model_allowed check (
    model_code in ('regional', 'grand-tourisme', 'double-etage')
  ),
  constraint fan_club_trip_unique unique (team_id, race_edition_id, model_code)
);
create index fan_club_trip_team_created_idx
  on public.fan_club_trip_allocations (team_id, created_at desc);
create table public.fan_club_shop_inventory (
  team_id uuid not null references public.teams(id) on delete cascade,
  product_code text not null,
  quantity integer not null default 0 check (quantity >= 0),
  average_unit_cost numeric(10, 2) not null default 0 check (average_unit_cost >= 0),
  sale_price numeric(10, 2) not null check (sale_price >= 0.5),
  updated_at timestamptz not null default now(),
  primary key (team_id, product_code),
  constraint fan_club_inventory_product_allowed check (
    product_code in ('team-jersey', 'bottle', 'pennant', 'cap', 'supporter-balloon')
  )
);
create table public.fan_club_shop_sales (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  day_number smallint not null check (day_number between 1 and 28),
  product_code text not null,
  units_sold integer not null check (units_sold > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0.5),
  revenue numeric(14, 2) not null check (revenue > 0),
  demand_factor numeric(6, 3) not null check (demand_factor > 0),
  created_at timestamptz not null default now(),
  constraint fan_club_sales_product_allowed check (
    product_code in ('team-jersey', 'bottle', 'pennant', 'cap', 'supporter-balloon')
  ),
  constraint fan_club_sale_once_per_day unique (
    team_id,
    season_id,
    day_number,
    product_code
  )
);
create index fan_club_sales_team_created_idx
  on public.fan_club_shop_sales (team_id, created_at desc);
alter table public.fan_club_profiles enable row level security;
alter table public.fan_club_fleet enable row level security;
alter table public.fan_club_trip_allocations enable row level security;
alter table public.fan_club_shop_inventory enable row level security;
alter table public.fan_club_shop_sales enable row level security;
create or replace function public.current_fan_club_team_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select assignment.team_id
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1
$$;
revoke all on function public.current_fan_club_team_id() from public, anon;
grant execute on function public.current_fan_club_team_id() to authenticated;
create policy fan_club_profiles_select_own
on public.fan_club_profiles for select to authenticated
using (team_id = public.current_fan_club_team_id());
create policy fan_club_fleet_select_own
on public.fan_club_fleet for select to authenticated
using (team_id = public.current_fan_club_team_id());
create policy fan_club_trips_select_own
on public.fan_club_trip_allocations for select to authenticated
using (team_id = public.current_fan_club_team_id());
create policy fan_club_inventory_select_own
on public.fan_club_shop_inventory for select to authenticated
using (team_id = public.current_fan_club_team_id());
create policy fan_club_sales_select_own
on public.fan_club_shop_sales for select to authenticated
using (team_id = public.current_fan_club_team_id());
grant select on table public.fan_club_profiles to authenticated;
grant select on table public.fan_club_fleet to authenticated;
grant select on table public.fan_club_trip_allocations to authenticated;
grant select on table public.fan_club_shop_inventory to authenticated;
grant select on table public.fan_club_shop_sales to authenticated;
create or replace function public.purchase_current_team_fan_club_car(
  p_model_code text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_headquarters_level integer;
  v_required_level integer;
  v_purchase_price numeric(14, 2);
  v_fleet_limit integer;
  v_total_cars integer;
  v_quantity integer;
begin
  perform public.settle_current_team_finances();
  select assignment.team_id, season.id as season_id,
    season.current_day_number, team_season.id as team_season_id,
    team_season.cash_balance, season_day.id as season_day_id
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
  if v_context is null then raise exception 'Aucune équipe active ne correspond au Directeur Sportif.'; end if;

  select level into v_headquarters_level
  from public.team_infrastructures
  where team_id = v_context.team_id and infrastructure_code = 'fan_club_headquarters';
  if coalesce(v_headquarters_level, 0) < 1 then raise exception 'Construisez d’abord le siège du Fan Club.'; end if;

  select required_level, purchase_price into v_required_level, v_purchase_price
  from (values
    ('regional', 1, 85000::numeric),
    ('grand-tourisme', 2, 135000::numeric),
    ('double-etage', 3, 220000::numeric)
  ) model(model_code, required_level, purchase_price)
  where model_code = p_model_code;
  if v_required_level is null then raise exception 'Ce modèle de car n’existe pas.'; end if;
  if v_headquarters_level < v_required_level then raise exception 'Le niveau du siège est insuffisant pour ce modèle.'; end if;

  v_fleet_limit := (array[2, 5, 10, 18, 30]::integer[])[v_headquarters_level];
  select coalesce(sum(quantity), 0) into v_total_cars
  from public.fan_club_fleet where team_id = v_context.team_id;
  if v_total_cars >= v_fleet_limit then raise exception 'Le parc de cars a atteint sa capacité maximale.'; end if;
  if v_context.cash_balance < v_purchase_price then raise exception 'Trésorerie insuffisante pour acheter ce car.'; end if;

  perform 1 from public.team_seasons where id = v_context.team_season_id for update;
  update public.team_seasons set cash_balance = cash_balance - v_purchase_price
  where id = v_context.team_season_id;
  insert into public.team_finance_transactions (
    team_season_id, season_day_id, day_number, amount, category, status,
    description, source_reference, posted_at
  ) values (
    v_context.team_season_id, v_context.season_day_id, v_context.current_day_number,
    -v_purchase_price, 'other', 'posted', 'Fan Club — achat d’un car',
    'fan-club:car:purchase:' || gen_random_uuid()::text, now()
  );
  insert into public.fan_club_fleet (team_id, model_code, quantity)
  values (v_context.team_id, p_model_code, 1)
  on conflict (team_id, model_code) do update
  set quantity = public.fan_club_fleet.quantity + 1, updated_at = now()
  returning quantity into v_quantity;
  return v_quantity;
end;
$$;
create or replace function public.sell_current_team_fan_club_car(
  p_model_code text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_resale_price numeric(14, 2);
  v_quantity integer;
  v_reserved integer;
begin
  perform public.settle_current_team_finances();
  select assignment.team_id, season.id as season_id,
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
  if v_context is null then raise exception 'Aucune équipe active ne correspond au Directeur Sportif.'; end if;

  select resale_price into v_resale_price
  from (values
    ('regional', 55250::numeric),
    ('grand-tourisme', 87750::numeric),
    ('double-etage', 143000::numeric)
  ) model(model_code, resale_price)
  where model_code = p_model_code;
  if v_resale_price is null then raise exception 'Ce modèle de car n’existe pas.'; end if;

  select quantity into v_quantity from public.fan_club_fleet
  where team_id = v_context.team_id and model_code = p_model_code for update;
  if coalesce(v_quantity, 0) <= 0 then raise exception 'Vous ne possédez aucun car de ce modèle.'; end if;
  select coalesce(max(allocation.car_count), 0) into v_reserved
  from public.fan_club_trip_allocations allocation
  join public.race_editions edition on edition.id = allocation.race_edition_id
  where allocation.team_id = v_context.team_id
    and allocation.model_code = p_model_code
    and edition.status not in ('completed', 'cancelled');
  if v_quantity - 1 < v_reserved then raise exception 'Ce car est déjà affecté à une course à venir.'; end if;

  update public.fan_club_fleet set quantity = quantity - 1, updated_at = now()
  where team_id = v_context.team_id and model_code = p_model_code
  returning quantity into v_quantity;
  update public.team_seasons set cash_balance = cash_balance + v_resale_price
  where id = v_context.team_season_id;
  insert into public.team_finance_transactions (
    team_season_id, season_day_id, day_number, amount, category, status,
    description, source_reference, posted_at
  ) values (
    v_context.team_season_id, v_context.season_day_id, v_context.current_day_number,
    v_resale_price, 'other', 'posted', 'Fan Club — revente d’un car',
    'fan-club:car:sale:' || gen_random_uuid()::text, now()
  );
  return v_quantity;
end;
$$;
create or replace function public.charter_current_team_fan_club_cars(
  p_race_edition_id uuid,
  p_model_code text,
  p_car_count integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_capacity integer;
  v_operating_cost numeric;
  v_owned integer;
  v_already_allocated integer;
  v_distance numeric;
  v_cost numeric(14, 2);
  v_total integer;
begin
  if p_car_count is null or p_car_count < 1 then raise exception 'Choisissez au moins un car.'; end if;
  perform public.settle_current_team_finances();
  select assignment.team_id, season.id as season_id,
    season.current_day_number, team_season.id as team_season_id,
    team_season.cash_balance, season_day.id as season_day_id
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
  if v_context is null then raise exception 'Aucune équipe active ne correspond au Directeur Sportif.'; end if;

  select capacity, operating_cost into v_capacity, v_operating_cost
  from (values
    ('regional', 40, 1.35::numeric),
    ('grand-tourisme', 55, 1.75::numeric),
    ('double-etage', 80, 2.40::numeric)
  ) model(model_code, capacity, operating_cost)
  where model_code = p_model_code;
  if v_capacity is null then raise exception 'Ce modèle de car n’existe pas.'; end if;

  select fleet.quantity into v_owned from public.fan_club_fleet fleet
  where fleet.team_id = v_context.team_id and fleet.model_code = p_model_code for update;
  select coalesce(allocation.car_count, 0) into v_already_allocated
  from public.fan_club_trip_allocations allocation
  where allocation.team_id = v_context.team_id
    and allocation.race_edition_id = p_race_edition_id
    and allocation.model_code = p_model_code;
  v_already_allocated := coalesce(v_already_allocated, 0);
  if coalesce(v_owned, 0) < v_already_allocated + p_car_count then
    raise exception 'Chaque car ne peut être engagé qu’une fois sur cette course.';
  end if;

  select sum(stage.distance_km) into v_distance
  from public.race_registrations registration
  join public.race_editions edition on edition.id = registration.race_edition_id
  join public.stages stage on stage.race_edition_id = edition.id
  join public.season_days day on day.id = stage.season_day_id
  where registration.team_season_id = v_context.team_season_id
    and registration.status = 'accepted'
    and edition.id = p_race_edition_id
    and edition.season_id = v_context.season_id
    and edition.status not in ('completed', 'cancelled')
    and exists (
      select 1 from public.stages future_stage
      join public.season_days future_day on future_day.id = future_stage.season_day_id
      where future_stage.race_edition_id = edition.id
        and future_day.day_number >= v_context.current_day_number
    );
  if v_distance is null then raise exception 'Cette course n’est pas disponible pour un déplacement.'; end if;

  v_cost := round(p_car_count * (v_distance * 2 * v_operating_cost + 250), 2);
  if v_context.cash_balance < v_cost then raise exception 'Trésorerie insuffisante pour ce déplacement.'; end if;
  update public.team_seasons set cash_balance = cash_balance - v_cost
  where id = v_context.team_season_id;
  insert into public.team_finance_transactions (
    team_season_id, season_day_id, day_number, amount, category, status,
    description, source_reference, posted_at
  ) values (
    v_context.team_season_id, v_context.season_day_id, v_context.current_day_number,
    -v_cost, 'other', 'posted', 'Fan Club — affrètement de supporters',
    'fan-club:trip:' || p_race_edition_id::text || ':' || p_model_code || ':' || gen_random_uuid()::text,
    now()
  );
  insert into public.fan_club_trip_allocations (
    team_id, season_id, race_edition_id, model_code, car_count, trip_cost
  ) values (
    v_context.team_id, v_context.season_id, p_race_edition_id,
    p_model_code, p_car_count, v_cost
  ) on conflict (team_id, race_edition_id, model_code) do update
  set car_count = public.fan_club_trip_allocations.car_count + excluded.car_count,
      trip_cost = public.fan_club_trip_allocations.trip_cost + excluded.trip_cost,
      updated_at = now()
  returning car_count into v_total;
  return v_total;
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
  v_shop_level integer;
  v_required_level integer;
  v_unit_cost numeric(10, 2);
  v_suggested_price numeric(10, 2);
  v_capacity integer;
  v_total_stock integer;
  v_previous_quantity integer;
  v_previous_average numeric(10, 2);
  v_cost numeric(14, 2);
  v_new_quantity integer;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 5000 then raise exception 'La quantité demandée est invalide.'; end if;
  perform public.settle_current_team_finances();
  select assignment.team_id, season.id as season_id,
    season.current_day_number, team_season.id as team_season_id,
    team_season.cash_balance, season_day.id as season_day_id
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
  if v_context is null then raise exception 'Aucune équipe active ne correspond au Directeur Sportif.'; end if;

  select level into v_shop_level from public.team_infrastructures
  where team_id = v_context.team_id and infrastructure_code = 'club_shop';
  if coalesce(v_shop_level, 0) < 1 then raise exception 'Construisez d’abord le magasin du club.'; end if;
  select required_level, unit_cost, suggested_price
  into v_required_level, v_unit_cost, v_suggested_price
  from (values
    ('team-jersey', 1, 38::numeric, 69::numeric),
    ('bottle', 2, 5.20::numeric, 12::numeric),
    ('pennant', 3, 8::numeric, 18::numeric),
    ('cap', 4, 9.50::numeric, 24::numeric),
    ('supporter-balloon', 5, 1.82::numeric, 5::numeric)
  ) product(product_code, required_level, unit_cost, suggested_price)
  where product_code = p_product_code;
  if v_required_level is null then raise exception 'Cet article n’existe pas.'; end if;
  if v_shop_level < v_required_level then raise exception 'Cet article n’est pas encore disponible dans votre magasin.'; end if;

  v_capacity := (array[300, 800, 1600, 3000, 5000]::integer[])[v_shop_level];
  select coalesce(sum(quantity), 0) into v_total_stock
  from public.fan_club_shop_inventory where team_id = v_context.team_id;
  if v_total_stock + p_quantity > v_capacity then raise exception 'La capacité de stockage du magasin est insuffisante.'; end if;
  v_cost := p_quantity * v_unit_cost;
  if v_context.cash_balance < v_cost then raise exception 'Trésorerie insuffisante pour acheter ce stock.'; end if;

  select quantity, average_unit_cost into v_previous_quantity, v_previous_average
  from public.fan_club_shop_inventory
  where team_id = v_context.team_id and product_code = p_product_code for update;
  v_previous_quantity := coalesce(v_previous_quantity, 0);
  v_previous_average := coalesce(v_previous_average, 0);
  insert into public.fan_club_shop_inventory (
    team_id, product_code, quantity, average_unit_cost, sale_price
  ) values (
    v_context.team_id, p_product_code, p_quantity, v_unit_cost, v_suggested_price
  ) on conflict (team_id, product_code) do update
  set quantity = public.fan_club_shop_inventory.quantity + excluded.quantity,
      average_unit_cost = round(
        (v_previous_quantity * v_previous_average + p_quantity * v_unit_cost)
        / (v_previous_quantity + p_quantity), 2
      ),
      updated_at = now()
  returning quantity into v_new_quantity;
  update public.team_seasons set cash_balance = cash_balance - v_cost
  where id = v_context.team_season_id;
  insert into public.team_finance_transactions (
    team_season_id, season_day_id, day_number, amount, category, description,
    status, source_reference, posted_at
  ) values (
    v_context.team_season_id, v_context.season_day_id, v_context.current_day_number,
    -v_cost, 'other', 'Fan Club — achat de stock', 'posted',
    'fan-club:stock:' || p_product_code || ':' || gen_random_uuid()::text, now()
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
  v_shop_level integer;
  v_required_level integer;
  v_suggested_price numeric(10, 2);
begin
  if p_sale_price is null or p_sale_price < 0.5 or p_sale_price > 999 then raise exception 'Le prix de vente est invalide.'; end if;
  v_team_id := public.current_fan_club_team_id();
  if v_team_id is null then raise exception 'Aucune équipe active ne correspond au Directeur Sportif.'; end if;
  select level into v_shop_level from public.team_infrastructures
  where team_id = v_team_id and infrastructure_code = 'club_shop';
  select required_level, suggested_price into v_required_level, v_suggested_price
  from (values
    ('team-jersey', 1, 69::numeric), ('bottle', 2, 12::numeric),
    ('pennant', 3, 18::numeric), ('cap', 4, 24::numeric),
    ('supporter-balloon', 5, 5::numeric)
  ) product(product_code, required_level, suggested_price)
  where product_code = p_product_code;
  if v_required_level is null then raise exception 'Cet article n’existe pas.'; end if;
  if coalesce(v_shop_level, 0) < v_required_level then raise exception 'Cet article n’est pas disponible dans votre magasin.'; end if;
  insert into public.fan_club_shop_inventory (
    team_id, product_code, quantity, average_unit_cost, sale_price
  ) values (v_team_id, p_product_code, 0, 0, round(p_sale_price, 2))
  on conflict (team_id, product_code) do update
  set sale_price = excluded.sale_price, updated_at = now();
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
      * greatest(0.2, least(2.0, power(v_suggested_price / v_inventory.sale_price, v_elasticity)))
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
revoke all on function public.purchase_current_team_fan_club_car(text) from public, anon;
revoke all on function public.sell_current_team_fan_club_car(text) from public, anon;
revoke all on function public.charter_current_team_fan_club_cars(uuid, text, integer) from public, anon;
revoke all on function public.purchase_current_team_fan_club_stock(text, integer) from public, anon;
revoke all on function public.set_current_team_fan_club_sale_price(text, numeric) from public, anon;
revoke all on function public.settle_current_team_fan_club_sales() from public, anon;
grant execute on function public.purchase_current_team_fan_club_car(text) to authenticated;
grant execute on function public.sell_current_team_fan_club_car(text) to authenticated;
grant execute on function public.charter_current_team_fan_club_cars(uuid, text, integer) to authenticated;
grant execute on function public.purchase_current_team_fan_club_stock(text, integer) to authenticated;
grant execute on function public.set_current_team_fan_club_sale_price(text, numeric) to authenticated;
grant execute on function public.settle_current_team_fan_club_sales() to authenticated;
commit;
