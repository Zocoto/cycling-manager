begin;

create or replace function public.purchase_current_team_equipment_cart(
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_line jsonb;
  v_item record;
  v_item_id uuid;
  v_quantity integer;
  v_total_quantity integer := 0;
  v_total_cost numeric := 0;
  v_purchase_id uuid := gen_random_uuid();
  v_seen_item_ids uuid[] := array[]::uuid[];
begin
  if
    p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 100
  then
    raise exception 'Le panier de matériel est invalide.';
  end if;

  perform public.settle_current_team_finances();

  select
    team_season.id as team_season_id,
    team_season.cash_balance,
    season.current_day_number,
    season_day.id as season_day_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = season.current_day_number
  where director.auth_user_id = auth.uid()
  limit 1
  for update of team_season;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    if
      jsonb_typeof(v_line) <> 'object'
      or coalesce(v_line ->> 'equipmentItemId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(v_line ->> 'quantity', '') !~ '^[0-9]+$'
    then
      raise exception 'Une ligne du panier de matériel est invalide.';
    end if;

    v_item_id := (v_line ->> 'equipmentItemId')::uuid;
    v_quantity := (v_line ->> 'quantity')::integer;

    if v_quantity < 1 or v_quantity > 99 then
      raise exception 'La quantité demandée est invalide.';
    end if;

    if v_item_id = any(v_seen_item_ids) then
      raise exception 'Une référence ne peut apparaître qu’une fois dans le panier.';
    end if;

    v_seen_item_ids := array_append(v_seen_item_ids, v_item_id);
    v_total_quantity := v_total_quantity + v_quantity;
    if v_total_quantity > 500 then
      raise exception 'Le panier ne peut pas dépasser 500 pièces.';
    end if;

    select id, name, price
    into v_item
    from public.equipment_catalog_items
    where id = v_item_id
      and status = 'active'
      and acquisition_channel = 'commercial'
    for share;

    if v_item is null then
      raise exception 'Une référence du panier n’est plus disponible à l’achat.';
    end if;

    v_total_cost := v_total_cost + (v_item.price * v_quantity);
  end loop;

  if v_context.cash_balance <= 0 or v_context.cash_balance < v_total_cost then
    raise exception 'Trésorerie insuffisante pour régler ce panier.';
  end if;

  for v_line in select value from jsonb_array_elements(p_items)
  loop
    v_item_id := (v_line ->> 'equipmentItemId')::uuid;
    v_quantity := (v_line ->> 'quantity')::integer;

    select id, name, price
    into v_item
    from public.equipment_catalog_items
    where id = v_item_id;

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
    )
    values (
      v_context.team_season_id,
      v_context.season_day_id,
      v_context.current_day_number,
      -(v_item.price * v_quantity),
      'equipment',
      'posted',
      'Achat groupé matériel : ' || v_item.name || ' × ' || v_quantity::text,
      'equipment-cart-purchase:' || v_purchase_id::text || ':' || v_item.id::text,
      now()
    );

    insert into public.team_equipment_inventory (
      team_season_id,
      equipment_item_id,
      quantity,
      last_purchase_price
    )
    values (
      v_context.team_season_id,
      v_item.id,
      v_quantity,
      v_item.price
    )
    on conflict (team_season_id, equipment_item_id) do update set
      quantity = public.team_equipment_inventory.quantity + excluded.quantity,
      last_purchase_price = excluded.last_purchase_price,
      updated_at = now();
  end loop;

  update public.team_seasons
  set cash_balance = cash_balance - v_total_cost
  where id = v_context.team_season_id;

  return jsonb_build_object(
    'purchaseId', v_purchase_id,
    'purchasedQuantity', v_total_quantity,
    'totalCost', v_total_cost
  );
end;
$$;

revoke all on function public.purchase_current_team_equipment_cart(jsonb) from public;
grant execute on function public.purchase_current_team_equipment_cart(jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
