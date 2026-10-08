begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- A sale, an individual equipment change and a stage plan must share the same
-- team lock. Patch only the context SELECT, retaining later gameplay extensions.
do $migration$
declare
  v_signature text;
  v_definition text;
  v_prefix text;
  v_updated text;
  v_end integer;
begin
  foreach v_signature in array array[
    'public.equip_current_team_rider(uuid,text,uuid)',
    'public.unequip_current_team_rider(uuid,text)',
    'public.save_current_team_race_equipment_plan(uuid,uuid,jsonb,boolean)'
  ] loop
    v_definition := replace(pg_get_functiondef(v_signature::regprocedure), E'\r\n', E'\n');
    v_end := position('if v_context is null' in lower(v_definition));
    if v_end = 0 then raise exception 'Contexte de matériel introuvable : %', v_signature; end if;
    v_prefix := left(v_definition, v_end - 1);
    if position('for update of team_season' in lower(v_prefix)) > 0 then continue; end if;
    v_updated := regexp_replace(v_prefix, 'limit 1;', 'limit 1 for update of team_season;', 'i');
    if v_updated = v_prefix then raise exception 'Verrou de matériel non appliqué : %', v_signature; end if;
    execute v_updated || substring(v_definition from v_end);
  end loop;
end;
$migration$;

create or replace function public.sell_current_team_equipment_batch(p_sales jsonb, p_sale_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout = '20s'
set lock_timeout = '5s'
as $$
declare
  v_context record;
  v_line jsonb;
  v_item record;
  v_inventory record;
  v_stage record;
  v_item_ids uuid[];
  v_item_id uuid;
  v_quantity integer;
  v_quantity_total integer := 0;
  v_price bigint;
  v_total bigint := 0;
  v_previous numeric;
  v_equipped jsonb;
  v_pending jsonb;
  v_unequip jsonb;
  v_cancel jsonb;
  v_needed integer;
  v_remaining integer;
  v_used integer;
  v_plan_ids uuid[];
  v_unequipped_count integer := 0;
  v_pending_count integer := 0;
  v_plans_updated integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentification requise.'; end if;
  if p_sale_id is null or p_sales is null or jsonb_typeof(p_sales) <> 'array' then
    raise exception 'La sélection de matériel à revendre est invalide.';
  end if;
  if jsonb_array_length(p_sales) not between 1 and 100 then
    raise exception 'Sélectionnez entre 1 et 100 références à revendre.';
  end if;
  for v_line in select value from jsonb_array_elements(p_sales) loop
    if jsonb_typeof(v_line) <> 'object'
      or coalesce(v_line->>'equipmentItemId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or jsonb_typeof(v_line->'quantity') is distinct from 'number'
      or coalesce(v_line->>'quantity', '') !~ '^[0-9]{1,3}$' then
      raise exception 'Une ligne de revente est invalide.';
    end if;
    v_quantity := (v_line->>'quantity')::integer;
    if v_quantity not between 1 and 500 then raise exception 'La quantité à revendre est invalide.'; end if;
    v_quantity_total := v_quantity_total + v_quantity;
    if v_quantity_total > 500 then raise exception 'Une revente ne peut pas dépasser 500 exemplaires.'; end if;
  end loop;
  select array_agg((value->>'equipmentItemId')::uuid) into v_item_ids from jsonb_array_elements(p_sales);
  if cardinality(v_item_ids) <> (select count(distinct id) from unnest(v_item_ids) as ids(id)) then
    raise exception 'Une référence ne peut apparaître qu’une fois dans la vente.';
  end if;

  perform public.settle_current_team_finances();
  select team_season.id as team_season_id, team_season.team_id,
    team_season.currency, season.current_day_number, season_day.id as season_day_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as manager on manager.sporting_director_id=director.id
    and manager.role='general_manager' and manager.status='active'
  join public.seasons as season on season.status='active'
  join public.team_seasons as team_season on team_season.team_id=manager.team_id and team_season.season_id=season.id
  join public.season_days as season_day on season_day.season_id=season.id and season_day.day_number=coalesce(season.current_day_number,1)
  where director.auth_user_id=auth.uid() and director.status='active'
  limit 1 for update of team_season;
  if v_context is null then raise exception 'Aucune équipe active ne correspond au Directeur Sportif.'; end if;

  select amount into v_previous from public.team_finance_transactions
  where team_season_id=v_context.team_season_id and source_reference='equipment-resale-batch:'||p_sale_id::text;
  if found then
    return jsonb_build_object('alreadySold',true,'resalePrice',v_previous,'currency',v_context.currency);
  end if;
  -- The background pending-assignment worker cannot restore a sold item.
  perform 1 from public.rider_equipment_pending_assignments
  where team_season_id=v_context.team_season_id and equipment_item_id=any(v_item_ids)
  order by rider_id,slot_type for update;
  perform public.settle_due_equipment_assignments(v_context.team_season_id);
  perform 1 from public.team_equipment_inventory
  where team_season_id=v_context.team_season_id and equipment_item_id=any(v_item_ids)
  order by equipment_item_id for update;
  perform 1 from public.rider_equipment_assignments as equipped
  where equipped.equipment_item_id=any(v_item_ids) and exists(
    select 1 from public.rider_contracts where rider_id=equipped.rider_id and team_id=v_context.team_id and status='active'
  ) order by equipped.rider_id,equipped.slot_type for update;

  for v_line in select value from jsonb_array_elements(p_sales) order by value->>'equipmentItemId' loop
    v_item_id := (v_line->>'equipmentItemId')::uuid;
    v_quantity := (v_line->>'quantity')::integer;
    select id,name,acquisition_channel,owner_team_id,resale_price,effect_payload into v_item
    from public.equipment_catalog_items where id=v_item_id and status='active' for share;
    if v_item is null or not (v_item.acquisition_channel='commercial' or
      (v_item.acquisition_channel='research_prototype' and v_item.owner_team_id=v_context.team_id)) then
      raise exception 'Seul le matériel réellement possédé peut être revendu.';
    end if;
    v_price := case when v_item.acquisition_channel='research_prototype'
      then public.calculate_research_prototype_resale_price(v_item.effect_payload) else v_item.resale_price end;
    if v_price is null or v_price <= 0 then raise exception 'Ce matériel ne dispose pas d’une valeur de reprise.'; end if;
    select id,quantity into v_inventory from public.team_equipment_inventory
    where team_season_id=v_context.team_season_id and equipment_item_id=v_item_id;
    if v_inventory is null or v_inventory.quantity < v_quantity then
      raise exception 'Stock insuffisant pour % : actualisez votre inventaire.',v_item.name;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('riderId',rider_id,'slot',slot_type) order by rider_id,slot_type), '[]')
    into v_equipped from public.rider_equipment_assignments as equipped
    where equipment_item_id=v_item_id and exists(select 1 from public.rider_contracts
      where rider_id=equipped.rider_id and team_id=v_context.team_id and status='active');
    select coalesce(jsonb_agg(jsonb_build_object('riderId',rider_id,'slot',slot_type) order by rider_id,slot_type), '[]')
    into v_pending from public.rider_equipment_pending_assignments
    where team_season_id=v_context.team_season_id and equipment_item_id=v_item_id;
    if jsonb_array_length(v_equipped)+jsonb_array_length(v_pending)>v_inventory.quantity then
      raise exception 'Le stock affecté de % est incohérent. Actualisez l’inventaire.',v_item.name;
    end if;
    v_needed := greatest(0,v_quantity-greatest(0,v_inventory.quantity-jsonb_array_length(v_equipped)-jsonb_array_length(v_pending)));
    select coalesce(jsonb_agg(value order by ordinality),'[]') into v_cancel
    from jsonb_array_elements(v_pending) with ordinality where ordinality<=v_needed;
    v_needed := v_needed-jsonb_array_length(v_cancel);
    select coalesce(jsonb_agg(value order by ordinality),'[]') into v_unequip
    from jsonb_array_elements(v_equipped) with ordinality where ordinality<=v_needed;
    -- Do not silently unequip a different rider when the displayed stock changed.
    if (v_line ? 'unequip' and v_line->'unequip' is distinct from v_unequip)
      or (v_line ? 'cancelPending' and v_line->'cancelPending' is distinct from v_cancel) then
      raise exception 'Les affectations ont changé. Actualisez l’inventaire avant de confirmer la revente.';
    end if;
    if exists(
      select 1 from jsonb_to_recordset(v_unequip) as removed("riderId" uuid,slot text)
      join public.race_rosters as roster on roster.rider_id=removed."riderId" and roster.status in ('selected','confirmed')
      join public.race_registrations as registration on registration.id=roster.race_registration_id
        and registration.team_season_id=v_context.team_season_id and registration.status in ('pending','accepted')
      join public.race_editions as edition on edition.id=registration.race_edition_id and edition.status not in ('completed','cancelled')
      join public.stages as stage on stage.race_edition_id=edition.id and stage.status not in ('completed','cancelled')
      where stage.departure_at is not null and now()>=stage.departure_at-interval '5 minutes'
        and now()<stage.departure_at+make_interval(mins=>greatest(8,least(48,round(stage.distance_km/6.0)))::integer)
    ) then raise exception 'Le matériel d’un coureur à déséquiper est figé jusqu’à la fin de sa course.'; end if;
    delete from public.rider_equipment_pending_assignments as pending
    using jsonb_to_recordset(v_cancel) as removed("riderId" uuid,slot text)
    where pending.team_season_id=v_context.team_season_id and pending.equipment_item_id=v_item_id
      and pending.rider_id=removed."riderId" and pending.slot_type=removed.slot;
    delete from public.rider_equipment_assignments as equipped
    using jsonb_to_recordset(v_unequip) as removed("riderId" uuid,slot text)
    where equipped.equipment_item_id=v_item_id and equipped.rider_id=removed."riderId" and equipped.slot_type=removed.slot;
    v_pending_count := v_pending_count+jsonb_array_length(v_cancel);
    v_unequipped_count := v_unequipped_count+jsonb_array_length(v_unequip);
    v_remaining := v_inventory.quantity-v_quantity;
    if v_remaining=0 then delete from public.team_equipment_inventory where id=v_inventory.id;
    else update public.team_equipment_inventory set quantity=v_remaining,updated_at=now() where id=v_inventory.id; end if;

    -- Stage-specific plans can reuse the remaining pieces. Keep compatible
    -- plans, clear only excess overrides, and never rewrite a historical stage.
    for v_stage in
      select distinct stage.id,stage.race_edition_id,stage.departure_at,stage.distance_km
      from public.race_stage_equipment_assignments as planned
      join public.stages as stage on stage.id=planned.stage_id and stage.status not in ('completed','cancelled')
      join public.race_editions as edition on edition.id=stage.race_edition_id and edition.status not in ('completed','cancelled')
      where planned.team_season_id=v_context.team_season_id and planned.equipment_item_id=v_item_id
      order by stage.id
    loop
      with roster as (
        select distinct roster.rider_id from public.race_rosters as roster
        join public.race_registrations as registration on registration.id=roster.race_registration_id
        where registration.team_season_id=v_context.team_season_id and registration.race_edition_id=v_stage.race_edition_id
          and registration.status='accepted' and roster.status in ('selected','confirmed')
      ), slots(slot_type) as (values ('helmet'),('gloves'),('bib_shorts'),('glasses'),('shoes'),('front_wheel'),('rear_wheel'),('frame')),
      effective as (
        select case when planned.id is not null then planned.equipment_item_id else permanent.equipment_item_id end as item_id
        from roster cross join slots
        left join public.race_stage_equipment_assignments as planned on planned.stage_id=v_stage.id
          and planned.team_season_id=v_context.team_season_id and planned.rider_id=roster.rider_id and planned.slot_type=slots.slot_type
        left join public.rider_equipment_assignments as permanent on permanent.rider_id=roster.rider_id and permanent.slot_type=slots.slot_type
      ) select (select count(*) from effective where item_id=v_item_id)
        +(select count(*) from public.rider_equipment_assignments as equipped where equipped.equipment_item_id=v_item_id
          and exists(select 1 from public.rider_contracts where rider_id=equipped.rider_id and team_id=v_context.team_id and status='active')
          and not exists(select 1 from roster where rider_id=equipped.rider_id))
        +(select count(*) from public.rider_equipment_pending_assignments where team_season_id=v_context.team_season_id and equipment_item_id=v_item_id)
      into v_used;
      v_needed := greatest(0,v_used-v_remaining);
      if v_needed=0 then continue; end if;
      if v_stage.departure_at is not null and now()>=v_stage.departure_at-interval '5 minutes'
        and now()<v_stage.departure_at+make_interval(mins=>greatest(8,least(48,round(v_stage.distance_km/6.0)))::integer) then
        raise exception 'Ce matériel est réservé par un montage de course figé. Attendez la fin de la course.';
      end if;
      select array_agg(id) into v_plan_ids from (
        select planned.id from public.race_stage_equipment_assignments as planned
        where planned.team_season_id=v_context.team_season_id and planned.stage_id=v_stage.id and planned.equipment_item_id=v_item_id
          and exists(select 1 from public.race_rosters as roster join public.race_registrations as registration on registration.id=roster.race_registration_id
            where registration.team_season_id=v_context.team_season_id and registration.race_edition_id=v_stage.race_edition_id
              and registration.status='accepted' and roster.rider_id=planned.rider_id and roster.status in ('selected','confirmed'))
        order by planned.rider_id,planned.slot_type,planned.id limit v_needed for update
      ) as excess;
      if coalesce(cardinality(v_plan_ids),0)<v_needed then raise exception 'Le stock réservé en course est incohérent. Actualisez l’inventaire.'; end if;
      update public.race_stage_equipment_assignments set equipment_item_id=null,updated_at=now() where id=any(v_plan_ids);
      v_plans_updated := v_plans_updated+cardinality(v_plan_ids);
    end loop;
    v_total := v_total+v_quantity::bigint*v_price;
  end loop;
  update public.team_seasons set cash_balance=cash_balance+v_total where id=v_context.team_season_id;
  insert into public.team_finance_transactions(team_season_id,season_day_id,day_number,amount,category,status,description,source_reference,posted_at)
  values(v_context.team_season_id,v_context.season_day_id,coalesce(v_context.current_day_number,1),v_total,'equipment','posted',
    'Revente matériel : '||v_quantity_total||' exemplaire(s), '||jsonb_array_length(p_sales)||' référence(s)',
    'equipment-resale-batch:'||p_sale_id::text,now());
  return jsonb_build_object('itemName',v_item.name,'resalePrice',v_total,'currency',v_context.currency,'quantitySold',v_quantity_total,
    'unequippedCount',v_unequipped_count,'pendingCancelledCount',v_pending_count,'racePlansUpdated',v_plans_updated);
end;
$$;

-- Preserve the old RPC for already-open clients, using the same atomic rules.
create or replace function public.sell_current_team_equipment(p_equipment_item_id uuid)
returns jsonb language sql security definer set search_path = public, pg_temp
as $$ select public.sell_current_team_equipment_batch(
  jsonb_build_array(jsonb_build_object('equipmentItemId',p_equipment_item_id,'quantity',1)),gen_random_uuid()) $$;

revoke all on function public.sell_current_team_equipment_batch(jsonb,uuid) from public,anon;
grant execute on function public.sell_current_team_equipment_batch(jsonb,uuid) to authenticated,service_role;
revoke all on function public.sell_current_team_equipment(uuid) from public,anon;
grant execute on function public.sell_current_team_equipment(uuid) to authenticated,service_role;
comment on function public.sell_current_team_equipment_batch(jsonb,uuid) is
  'Revente atomique et idempotente du matériel possédé, stock libre prioritaire, déséquipement et ajustement minimal des montages hors gel de course.';
notify pgrst, 'reload schema';
commit;
