-- A single persisted wholesale course, shared by every Fan Club shop.

begin;

create table public.fan_club_wholesale_prices (
  season_id uuid not null references public.seasons(id) on delete cascade,
  day_number smallint not null check (day_number between 1 and 28),
  product_code text not null,
  unit_cost numeric(10, 2) not null check (unit_cost > 0),
  created_at timestamptz not null default now(),
  primary key (season_id, day_number, product_code),
  constraint fan_club_wholesale_product_allowed check (
    product_code in ('team-jersey', 'bottle', 'pennant', 'cap', 'supporter-balloon')
  )
);

alter table public.fan_club_wholesale_prices enable row level security;

create or replace function public.ensure_fan_club_wholesale_prices(
  p_season_id uuid,
  p_through_day integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day integer;
  v_product record;
  v_previous_price numeric(10, 2);
  v_candidate numeric(10, 2);
  v_minimum numeric(10, 2);
  v_maximum numeric(10, 2);
  v_seed bigint;
  v_direction integer;
  v_magnitude numeric;
begin
  if p_season_id is null or not exists (
    select 1 from public.seasons where id = p_season_id
  ) then
    raise exception 'La saison du cours des matières premières est invalide.';
  end if;

  if p_through_day is null or p_through_day < 1 or p_through_day > 28 then
    raise exception 'La journée du cours des matières premières est invalide.';
  end if;

  -- Serialise the very first generation for a season. Once written, a quote
  -- never changes and is therefore identical for every team.
  perform pg_advisory_xact_lock(
    hashtextextended('fan-club-wholesale:' || p_season_id::text, 0)
  );

  for v_day in 1..p_through_day loop
    for v_product in
      select *
      from (values
        ('team-jersey', 38::numeric),
        ('bottle', 5.20::numeric),
        ('pennant', 8::numeric),
        ('cap', 9.50::numeric),
        ('supporter-balloon', 1.82::numeric)
      ) as products(product_code, base_unit_cost)
    loop
      if exists (
        select 1
        from public.fan_club_wholesale_prices price
        where price.season_id = p_season_id
          and price.day_number = v_day
          and price.product_code = v_product.product_code
      ) then
        continue;
      end if;

      if v_day = 1 then
        v_previous_price := v_product.base_unit_cost;
      else
        select price.unit_cost
        into v_previous_price
        from public.fan_club_wholesale_prices price
        where price.season_id = p_season_id
          and price.day_number = v_day - 1
          and price.product_code = v_product.product_code;
      end if;

      v_seed := hashtextextended(
        p_season_id::text || ':' || v_product.product_code || ':' || v_day::text,
        0
      );
      v_direction := case when abs((v_seed / 7) % 2) = 0 then -1 else 1 end;
      v_magnitude := 0.008 + abs(v_seed % 6)::numeric * 0.004;
      v_minimum := round(v_product.base_unit_cost * 0.82, 2);
      v_maximum := round(v_product.base_unit_cost * 1.18, 2);
      v_candidate := round(
        v_previous_price * (1 + v_direction * v_magnitude),
        2
      );

      if v_candidate < v_minimum or v_candidate > v_maximum then
        v_direction := -v_direction;
        v_candidate := round(
          v_previous_price * (1 + v_direction * v_magnitude),
          2
        );
      end if;

      v_candidate := least(v_maximum, greatest(v_minimum, v_candidate));
      if v_candidate = v_previous_price then
        v_candidate := v_previous_price + v_direction * 0.01;
        if v_candidate < v_minimum or v_candidate > v_maximum then
          v_candidate := v_previous_price - v_direction * 0.01;
        end if;
      end if;

      insert into public.fan_club_wholesale_prices (
        season_id,
        day_number,
        product_code,
        unit_cost
      ) values (
        p_season_id,
        v_day,
        v_product.product_code,
        v_candidate
      );
    end loop;
  end loop;
end;
$$;

create or replace function public.get_current_fan_club_wholesale_market()
returns table (
  product_code text,
  day_number smallint,
  unit_cost numeric(10, 2)
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season_id uuid;
  v_current_day integer;
begin
  select season.id, season.current_day_number
  into v_season_id, v_current_day
  from public.seasons season
  where season.status = 'active'
  order by season.game_year desc
  limit 1;

  if v_season_id is null or v_current_day is null then
    raise exception 'Aucune saison active ne permet de charger le cours des matières premières.';
  end if;

  perform public.ensure_fan_club_wholesale_prices(v_season_id, v_current_day);

  return query
  select
    price.product_code,
    price.day_number,
    price.unit_cost
  from public.fan_club_wholesale_prices price
  where price.season_id = v_season_id
    and price.day_number between greatest(1, v_current_day - 6) and v_current_day
  order by price.product_code, price.day_number;
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
  from public.sporting_directors director
  join public.team_manager_assignments assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons season on season.status = 'active'
  join public.team_seasons team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  join public.season_days season_day
    on season_day.season_id = season.id
   and season_day.day_number = season.current_day_number
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  select level
  into v_shop_level
  from public.team_infrastructures
  where team_id = v_context.team_id
    and infrastructure_code = 'club_shop';

  if coalesce(v_shop_level, 0) < 1 then
    raise exception 'Construisez d’abord le magasin du club.';
  end if;

  select required_level, suggested_price
  into v_required_level, v_suggested_price
  from (values
    ('team-jersey', 1, 69::numeric),
    ('bottle', 2, 12::numeric),
    ('pennant', 3, 18::numeric),
    ('cap', 4, 24::numeric),
    ('supporter-balloon', 5, 5::numeric)
  ) product(product_code, required_level, suggested_price)
  where product_code = p_product_code;

  if v_required_level is null then
    raise exception 'Cet article n’existe pas.';
  end if;
  if v_shop_level < v_required_level then
    raise exception 'Cet article n’est pas encore disponible dans votre magasin.';
  end if;

  perform public.ensure_fan_club_wholesale_prices(
    v_context.season_id,
    v_context.current_day_number
  );

  select price.unit_cost
  into v_unit_cost
  from public.fan_club_wholesale_prices price
  where price.season_id = v_context.season_id
    and price.day_number = v_context.current_day_number
    and price.product_code = p_product_code;

  if v_unit_cost is null then
    raise exception 'Le cours de cet article est momentanément indisponible.';
  end if;

  v_capacity := (array[300, 800, 1600, 3000, 5000]::integer[])[v_shop_level];
  select coalesce(sum(quantity), 0)
  into v_total_stock
  from public.fan_club_shop_inventory
  where team_id = v_context.team_id;

  if v_total_stock + p_quantity > v_capacity then
    raise exception 'La capacité de stockage du magasin est insuffisante.';
  end if;

  v_cost := p_quantity * v_unit_cost;
  if v_context.cash_balance < v_cost then
    raise exception 'Trésorerie insuffisante pour acheter ce stock.';
  end if;

  select quantity, average_unit_cost
  into v_previous_quantity, v_previous_average
  from public.fan_club_shop_inventory
  where team_id = v_context.team_id
    and product_code = p_product_code
  for update;

  v_previous_quantity := coalesce(v_previous_quantity, 0);
  v_previous_average := coalesce(v_previous_average, 0);

  insert into public.fan_club_shop_inventory (
    team_id,
    product_code,
    quantity,
    average_unit_cost,
    sale_price
  ) values (
    v_context.team_id,
    p_product_code,
    p_quantity,
    v_unit_cost,
    v_suggested_price
  )
  on conflict (team_id, product_code) do update
  set quantity = public.fan_club_shop_inventory.quantity + excluded.quantity,
      average_unit_cost = round(
        (v_previous_quantity * v_previous_average + p_quantity * v_unit_cost)
        / (v_previous_quantity + p_quantity),
        2
      ),
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

do $$
declare
  v_active_season record;
begin
  for v_active_season in
    select id, current_day_number
    from public.seasons
    where status = 'active'
      and current_day_number between 1 and 28
  loop
    perform public.ensure_fan_club_wholesale_prices(
      v_active_season.id,
      v_active_season.current_day_number
    );
  end loop;
end;
$$;

revoke all on table public.fan_club_wholesale_prices from public, anon, authenticated;
revoke all on function public.ensure_fan_club_wholesale_prices(uuid, integer) from public, anon, authenticated;
revoke all on function public.get_current_fan_club_wholesale_market() from public, anon;
revoke all on function public.purchase_current_team_fan_club_stock(text, integer) from public, anon;

grant execute on function public.get_current_fan_club_wholesale_market() to authenticated;
grant execute on function public.purchase_current_team_fan_club_stock(text, integer) to authenticated;

commit;
