begin;
set local lock_timeout = '1s';
set local statement_timeout = '8s';

create or replace function public.redeem_injury_care_rewards(
  p_inventory_id uuid,
  p_rider_id uuid,
  p_injury_id uuid,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_item record;
  v_stock record;
  v_gift_ids uuid[];
  v_gift_name text;
  v_injury record;
  v_hours integer;
  v_quantity integer;
  v_stock_used integer;
  v_gift_id uuid;
  v_previous_recovery timestamptz;
  v_adjusted_recovery timestamptz;
  v_reduction integer;
  v_total_reduction integer;
  v_message text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;
  if p_inventory_id is null or p_rider_id is null or p_injury_id is null then
    raise exception 'Sélectionnez un objet de soin et un coureur blessé.';
  end if;
  if p_quantity is null or p_quantity not between 1 and 30 then
    raise exception 'Choisissez une quantité entière entre 1 et 30.';
  end if;

  perform public.sync_active_season_day();

  select director.id as director_id, assignment.team_id,
    team_season.id as team_season_id, season.game_year
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id and team_season.season_id = season.id
    and team_season.status in ('planned', 'active')
  where director.auth_user_id = auth.uid() and director.status = 'active'
  limit 1;

  if not found then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  select catalog.reward_key as item_key, catalog.name, catalog.effect_payload
  into v_item
  from public.daily_reward_inventory as inventory
  join public.daily_reward_catalog as catalog using (reward_key)
  where inventory.id = p_inventory_id
    and inventory.sporting_director_id = v_context.director_id
    and inventory.status = 'available'
    and inventory.expires_after_game_year >= v_context.game_year
    and catalog.is_active and catalog.effect_kind = 'injury_care';

  if not found then
    select catalog.item_key, catalog.name, catalog.effect_payload
    into v_item
    from public.inventory_catalog_items as catalog
    where catalog.id = p_inventory_id and catalog.status = 'active'
      and catalog.is_consumable and catalog.category = 'injury_care'
      and catalog.effect_payload ->> 'effectKind' = 'injury_care';
    if not found then
      raise exception 'Cet objet de soin n’est plus disponible.';
    end if;
  end if;

  v_hours := (v_item.effect_payload ->> 'recoveryHours')::integer;
  if v_hours is null or v_hours not between 1 and 48 then
    raise exception 'La durée portée par cet objet de soin est invalide.';
  end if;

  -- Keep the inventory-before-injury lock order used by single-dose care.
  select inventory.id, inventory.quantity, catalog.id as catalog_id, catalog.name
  into v_stock
  from public.team_item_inventory as inventory
  join public.inventory_catalog_items as catalog on catalog.id = inventory.inventory_item_id
  where inventory.team_season_id = v_context.team_season_id and inventory.quantity > 0
    and catalog.item_key = v_item.item_key and catalog.status = 'active'
    and catalog.is_consumable and catalog.category = 'injury_care'
    and catalog.effect_payload ->> 'effectKind' = 'injury_care'
    and catalog.effect_payload ->> 'recoveryHours' = v_item.effect_payload ->> 'recoveryHours'
  for update of inventory;

  if coalesce(v_stock.quantity, 0) < p_quantity then
    select array_agg(gift.id order by gift.acquired_at, gift.id), min(gift.name)
    into v_gift_ids, v_gift_name
    from (
      select inventory.id, inventory.acquired_at, catalog.name
      from public.daily_reward_inventory as inventory
      join public.daily_reward_catalog as catalog using (reward_key)
      where inventory.sporting_director_id = v_context.director_id
        and inventory.reward_key = v_item.item_key
        and inventory.status = 'available'
        and inventory.expires_after_game_year >= v_context.game_year
        and catalog.is_active and catalog.effect_kind = 'injury_care'
        and catalog.effect_payload ->> 'recoveryHours' = v_item.effect_payload ->> 'recoveryHours'
      order by inventory.acquired_at, inventory.id
      limit p_quantity - coalesce(v_stock.quantity, 0)
      for update of inventory
    ) as gift;
  end if;

  select injury.id, injury.diagnosis_code, injury.expected_recovery_at,
    rider.first_name, rider.last_name
  into v_injury
  from public.rider_injuries as injury
  join public.riders as rider on rider.id = injury.rider_id and rider.status = 'active'
  where injury.id = p_injury_id and injury.rider_id = p_rider_id
    and injury.status = 'active' and injury.expected_recovery_at > now()
    and exists (
      select 1
      from public.rider_contracts as contract
      join public.seasons as start_season on start_season.id = contract.start_season_id
      join public.seasons as end_season on end_season.id = contract.end_season_id
      where contract.rider_id = rider.id and contract.team_id = v_context.team_id
        and contract.status = 'active'
        and v_context.game_year between start_season.game_year and end_season.game_year
    )
  for update of injury;

  if not found then
    raise exception 'Ce coureur ne présente aucune blessure active.';
  end if;
  if v_injury.diagnosis_code = 'fatigue_exhaustion' then
    raise exception 'Une blessure de fatigue impose trois jours de repos fixes et ne peut pas être raccourcie.';
  end if;

  v_quantity := least(p_quantity, ceil(
    extract(epoch from v_injury.expected_recovery_at - now()) / (3600 * v_hours)
  )::integer);
  v_stock_used := least(v_quantity, coalesce(v_stock.quantity, 0));
  if v_stock_used + coalesce(cardinality(v_gift_ids), 0) < v_quantity then
    raise exception 'Le stock de cet objet de soin a changé. Vérifiez la quantité disponible.';
  end if;

  v_adjusted_recovery := v_injury.expected_recovery_at;
  for v_dose in 1..v_quantity loop
    v_previous_recovery := v_adjusted_recovery;
    v_adjusted_recovery := greatest(now(), v_previous_recovery - make_interval(hours => v_hours));
    v_reduction := greatest(1, round(extract(epoch from v_previous_recovery - v_adjusted_recovery))::integer);
    v_gift_id := case when v_dose > v_stock_used then v_gift_ids[v_dose - v_stock_used] end;

    insert into public.rider_injury_care_item_applications (
      rider_id, rider_injury_id, team_season_id, source_type, inventory_item_id,
      daily_reward_inventory_id, item_name, requested_recovery_hours,
      recovery_seconds_reduced, previous_expected_recovery_at,
      adjusted_expected_recovery_at, completed_injury
    ) values (
      p_rider_id, v_injury.id, v_context.team_season_id,
      case when v_gift_id is null then 'team_item' else 'daily_reward' end,
      case when v_gift_id is null then v_stock.catalog_id end,
      v_gift_id, case when v_gift_id is null then v_stock.name else v_gift_name end,
      v_hours, v_reduction, v_previous_recovery, v_adjusted_recovery, v_adjusted_recovery <= now()
    );

    if v_gift_id is not null then
      update public.daily_reward_inventory
      set status = 'used', used_at = now(), usage_payload = jsonb_build_object(
        'riderId', p_rider_id, 'injuryId', v_injury.id, 'recoverySecondsReduced', v_reduction
      )
      where id = v_gift_id;
    end if;
  end loop;

  if v_stock_used > 0 then
    if v_stock_used = v_stock.quantity then
      delete from public.team_item_inventory where id = v_stock.id;
    else
      update public.team_item_inventory
      set quantity = quantity - v_stock_used, updated_at = now()
      where id = v_stock.id;
    end if;
  end if;

  update public.rider_injuries
  set expected_recovery_at = v_adjusted_recovery,
    status = case when v_adjusted_recovery <= now() then 'recovered' else 'active' end,
    recovered_at = case when v_adjusted_recovery <= now() then coalesce(recovered_at, now()) else recovered_at end,
    updated_at = now()
  where id = v_injury.id;

  v_total_reduction := greatest(1, round(extract(epoch from v_injury.expected_recovery_at - v_adjusted_recovery))::integer);
  v_message := format('%s × %s · %s %s. %s', v_quantity, v_item.name,
    v_injury.first_name, v_injury.last_name,
    case when v_adjusted_recovery <= now() then 'La convalescence est terminée.'
      else format('Convalescence restante : %s h.', ceil(extract(epoch from v_adjusted_recovery - now()) / 3600)::integer)
    end);
  return jsonb_build_object('inventoryId', p_inventory_id, 'riderId', p_rider_id,
    'injuryId', v_injury.id, 'quantityApplied', v_quantity,
    'recoverySecondsReduced', v_total_reduction, 'completedInjury', v_adjusted_recovery <= now(),
    'message', v_message);
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Les données de cet objet de soin sont invalides.';
end;
$$;

revoke all on function public.redeem_injury_care_rewards(uuid, uuid, uuid, integer) from public, anon;
grant execute on function public.redeem_injury_care_rewards(uuid, uuid, uuid, integer) to authenticated;

notify pgrst, 'reload schema';

commit;
