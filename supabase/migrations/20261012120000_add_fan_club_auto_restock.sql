begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

create table public.fan_club_shop_restock_settings (
  team_id uuid primary key references public.teams(id) on delete cascade,
  enabled boolean not null default false,
  allow_negative_projection boolean not null default false,
  minimum_stocks jsonb not null default '{}'::jsonb check (jsonb_typeof(minimum_stocks) = 'object'),
  last_restock_game_day integer,
  updated_at timestamptz not null default now()
);
alter table public.fan_club_shop_restock_settings enable row level security;
create policy fan_club_restock_select_own on public.fan_club_shop_restock_settings
  for select to authenticated using (team_id = public.current_fan_club_team_id());
revoke all on public.fan_club_shop_restock_settings from anon, authenticated;
grant select on public.fan_club_shop_restock_settings to authenticated;
grant all on public.fan_club_shop_restock_settings to service_role;

create or replace function public.set_current_team_fan_club_auto_restock(
  p_enabled boolean, p_allow_negative_projection boolean, p_minimum_stocks jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid := public.current_fan_club_team_id();
  v_level integer;
  v_season_id uuid;
  v_capacity integer;
  v_total integer := 0;
  v_entry record;
  v_product record;
begin
  if auth.uid() is null or v_team_id is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;
  -- Same lock order as stock purchases and daily sales.
  select ts.season_id into v_season_id from public.team_seasons ts
    join public.seasons s on s.id = ts.season_id and s.status = 'active'
    where ts.team_id = v_team_id and ts.status = 'active' for update of ts;
  if v_season_id is null then raise exception 'Aucune saison active.'; end if;
  select level into v_level from public.team_infrastructures
    where team_id = v_team_id and infrastructure_code = 'club_shop';
  v_capacity := (array[300,800,1600,3000,5000]::integer[])[v_level];
  if v_capacity is null then raise exception 'Construisez d’abord le magasin du club.'; end if;
  if p_enabled is null or p_allow_negative_projection is null or p_minimum_stocks is null
    or jsonb_typeof(p_minimum_stocks) <> 'object' then
    raise exception 'Réglages de réapprovisionnement invalides.';
  end if;
  for v_entry in select key, value from jsonb_each(p_minimum_stocks) loop
    if jsonb_typeof(v_entry.value) <> 'number' or v_entry.value::text !~ '^[0-9]{1,4}$'
      or (v_entry.value::text)::integer > v_capacity then
      raise exception 'Stock minimum invalide.';
    end if;
    select * into v_product from public.get_fan_club_shop_product_config(v_entry.key);
    if v_product is null or v_product.required_level > v_level then
      raise exception 'Cet article n’est pas disponible dans votre magasin.';
    end if;
    if v_product.is_collector and not public.team_won_fan_club_collector_gt(v_team_id,v_season_id,v_entry.key) then
      raise exception 'Ce maillot collector n’est pas disponible cette saison.';
    end if;
    v_total := v_total + (v_entry.value::text)::integer;
  end loop;
  if v_total > v_capacity then raise exception 'Les minimums cumulés dépassent la capacité du magasin.'; end if;
  insert into public.fan_club_shop_restock_settings(team_id, enabled, allow_negative_projection, minimum_stocks)
    values(v_team_id, p_enabled, p_allow_negative_projection, p_minimum_stocks)
    on conflict(team_id) do update set enabled=excluded.enabled,
      allow_negative_projection=excluded.allow_negative_projection,
      minimum_stocks=excluded.minimum_stocks, updated_at=now();
end;
$$;
revoke all on function public.set_current_team_fan_club_auto_restock(boolean,boolean,jsonb) from public, anon;
grant execute on function public.set_current_team_fan_club_auto_restock(boolean,boolean,jsonb) to authenticated;

create or replace function private.restock_fan_club_shop(p_team_season_id uuid, p_day_number integer)
returns integer language plpgsql security definer set search_path = public, private as $$
declare
  v_context record;
  v_settings public.fan_club_shop_restock_settings%rowtype;
  v_entry record;
  v_product record;
  v_inventory record;
  v_level integer;
  v_capacity integer;
  v_total integer;
  v_quantity integer;
  v_unit_cost numeric(10,2);
  v_cost numeric(14,2);
  v_cash numeric;
  v_projection numeric;
  v_budget numeric;
  v_bought integer := 0;
  v_game_day integer;
begin
  select ts.id,ts.team_id,ts.season_id,ts.cash_balance,ts.opening_cash_balance,
    s.game_year,d.id as season_day_id into v_context
    from public.team_seasons ts
    join public.seasons s on s.id=ts.season_id and s.status='active'
    join public.season_days d on d.season_id=s.id and d.day_number=p_day_number
    where ts.id=p_team_season_id and ts.status='active' and p_day_number=s.current_day_number
    for update of ts;
  if v_context is null then return 0; end if;
  select * into v_settings from public.fan_club_shop_restock_settings
    where team_id=v_context.team_id for update;
  if v_settings is null or not v_settings.enabled then return 0; end if;
  v_game_day := v_context.game_year*28+p_day_number-1;
  if v_settings.last_restock_game_day >= v_game_day then return 0; end if;
  update public.fan_club_shop_restock_settings set last_restock_game_day=v_game_day
    where team_id=v_context.team_id;
  if v_context.cash_balance < 0 then return 0; end if;
  -- Include due charges even if the owner has not opened Finances today.
  -- Never spend expected future shop revenue or put current cash into debt.
  select v_context.cash_balance + coalesce(sum(t.amount) filter(where t.status='pending' and t.day_number<=p_day_number),0),
    v_context.opening_cash_balance + coalesce(sum(t.amount) filter(where t.status<>'cancelled'),0)
    into v_cash,v_projection from public.team_finance_transactions t where t.team_season_id=p_team_season_id;
  if v_cash<=0 or (not v_settings.allow_negative_projection and v_projection<=0) then return 0; end if;
  select level into v_level from public.team_infrastructures where team_id=v_context.team_id and infrastructure_code='club_shop';
  v_capacity := (array[300,800,1600,3000,5000]::integer[])[v_level];
  if v_capacity is null then return 0; end if;
  perform public.expire_fan_club_collector_stock(v_context.team_id,v_context.season_id);
  select coalesce(sum(quantity),0) into v_total from public.fan_club_shop_inventory where team_id=v_context.team_id;
  perform public.ensure_fan_club_wholesale_prices(v_context.season_id,p_day_number);
  for v_entry in select key,value from jsonb_each_text(v_settings.minimum_stocks) order by key loop
    if v_total>=v_capacity then exit; end if;
    select * into v_product from public.get_fan_club_shop_product_config(v_entry.key);
    if v_product is null or v_product.required_level>v_level then continue; end if;
    if v_product.is_collector and not public.team_won_fan_club_collector_gt(v_context.team_id,v_context.season_id,v_entry.key) then continue; end if;
    select quantity,average_unit_cost into v_inventory from public.fan_club_shop_inventory
      where team_id=v_context.team_id and product_code=v_entry.key for update;
    v_quantity := least(v_entry.value::integer-coalesce(v_inventory.quantity,0),v_capacity-v_total);
    if v_quantity<=0 then continue; end if;
    select round(unit_cost * public.get_team_club_shop_wholesale_cost_multiplier(v_context.team_id),2)
      into v_unit_cost from public.fan_club_wholesale_prices where season_id=v_context.season_id
      and day_number=p_day_number and product_code=v_product.wholesale_product_code;
    if v_unit_cost is null or v_unit_cost<=0 then continue; end if;
    v_budget := least(v_cash,v_context.cash_balance);
    if not v_settings.allow_negative_projection then v_budget := least(v_budget,v_projection); end if;
    v_quantity := least(v_quantity,greatest(0,floor(v_budget/v_unit_cost))::integer);
    if v_quantity<=0 then continue; end if;
    v_cost := v_quantity*v_unit_cost;
    insert into public.fan_club_shop_inventory(team_id,product_code,quantity,average_unit_cost,sale_price,collector_season_id)
      values(v_context.team_id,v_entry.key,v_quantity,v_unit_cost,v_product.suggested_price,
        case when v_product.is_collector then v_context.season_id else null end)
      on conflict(team_id,product_code) do update set quantity=fan_club_shop_inventory.quantity+excluded.quantity,
        average_unit_cost=round((fan_club_shop_inventory.quantity*fan_club_shop_inventory.average_unit_cost+v_cost)
          /(fan_club_shop_inventory.quantity+v_quantity),2),
        collector_season_id=excluded.collector_season_id,updated_at=now();
    update public.team_seasons set cash_balance=cash_balance-v_cost where id=p_team_season_id;
    insert into public.team_finance_transactions(team_season_id,season_day_id,day_number,amount,category,description,status,source_reference,posted_at)
      values(p_team_season_id,v_context.season_day_id,p_day_number,-v_cost,'other',
        'Fan Club — réapprovisionnement automatique','posted',
        'fan-club:auto-stock:'||v_context.season_id::text||':'||p_day_number::text||':'||v_entry.key,now());
    v_context.cash_balance := v_context.cash_balance-v_cost;
    v_cash := v_cash-v_cost; v_projection := v_projection-v_cost;
    v_total := v_total+v_quantity; v_bought := v_bought+v_quantity;
  end loop;
  return v_bought;
end;
$$;
revoke all on function private.restock_fan_club_shop(uuid,integer) from public, anon, authenticated;
grant execute on function private.restock_fan_club_shop(uuid,integer) to service_role;

-- Preserve the deployed sales routine and its catch-up logic. Refill only today,
-- after all due sales, never retrospectively for days preceding activation.
do $$
declare v_definition text; v_anchor text := E'      end if;\n    exception';
begin
  v_definition := replace(pg_get_functiondef('public.settle_due_fan_club_shop_sales()'::regprocedure),E'\r\n',E'\n');
  if (length(v_definition)-length(replace(v_definition,v_anchor,'')))/length(v_anchor)<>1 then
    raise exception 'Unexpected daily shop settlement body; review before patching.';
  end if;
  execute replace(v_definition,v_anchor,E'      end if;\n      perform private.restock_fan_club_shop(v_target.team_season_id, v_target.current_day_number);\n    exception');
  v_definition := replace(pg_get_functiondef('public.purchase_current_team_fan_club_stock(text,integer)'::regprocedure),E'\r\n',E'\n');
  v_anchor := E'  limit 1;';
  if (length(v_definition)-length(replace(v_definition,v_anchor,'')))/length(v_anchor)<>1 then
    raise exception 'Unexpected shop purchase context; review before patching.';
  end if;
  execute replace(v_definition,v_anchor,E'  limit 1\n  for update of team_season;');
end;
$$;
notify pgrst, 'reload schema';
commit;
