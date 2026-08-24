begin;

create index if not exists rider_equipment_assignments_item_rider_idx
  on public.rider_equipment_assignments (equipment_item_id, rider_id);

create or replace function public.save_current_team_equipment_assignments(
  p_assignments jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
set statement_timeout = '0'
as $$
declare
  v_context record;
  v_assignment_count integer;
  v_requested_rider_count integer;
  v_stock_item_id uuid;
  v_stock_item_name text;
  v_stock_used integer;
  v_stock_owned integer;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;

  if p_assignments is null or jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'Sélectionnez entre 1 et 280 affectations à modifier.';
  end if;

  v_assignment_count := jsonb_array_length(p_assignments);
  if v_assignment_count not between 1 and 280 then
    raise exception 'Sélectionnez entre 1 et 280 affectations à modifier.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignments) as entry(value)
    where jsonb_typeof(entry.value) <> 'object'
      or coalesce(entry.value ->> 'riderId', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(entry.value ->> 'slot', '') not in (
        'helmet', 'gloves', 'bib_shorts', 'glasses', 'shoes',
        'front_wheel', 'rear_wheel', 'frame'
      )
      or (
        entry.value -> 'equipmentItemId' is not null
        and jsonb_typeof(entry.value -> 'equipmentItemId') <> 'null'
        and coalesce(entry.value ->> 'equipmentItemId', '') !~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )
  ) then
    raise exception 'Une affectation de matériel est invalide.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_assignments) as requested(
      "riderId" uuid,
      slot text,
      "equipmentItemId" uuid
    )
    group by requested."riderId", requested.slot
    having requested."riderId" is null
      or requested.slot is null
      or count(*) > 1
  ) then
    raise exception 'Un emplacement ne peut être modifié qu’une seule fois.';
  end if;

  select
    team_season.id as team_season_id,
    team_season.team_id,
    season.game_year
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
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1
  for update of team_season;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  -- Les montages différés arrivés à échéance sont appliqués une seule fois
  -- avant de calculer le stock final du lot.
  perform public.settle_due_equipment_assignments(v_context.team_season_id);

  select count(distinct requested."riderId")::integer
  into v_requested_rider_count
  from jsonb_to_recordset(p_assignments) as requested(
    "riderId" uuid,
    slot text,
    "equipmentItemId" uuid
  );

  if (
    select count(distinct contract.rider_id)::integer
    from public.rider_contracts as contract
    where contract.team_id = v_context.team_id
      and contract.status = 'active'
      and contract.rider_id in (
        select requested."riderId"
        from jsonb_to_recordset(p_assignments) as requested(
          "riderId" uuid,
          slot text,
          "equipmentItemId" uuid
        )
      )
  ) <> v_requested_rider_count then
    raise exception 'Vous ne pouvez modifier que les coureurs de votre équipe.';
  end if;

  -- Les lignes déjà présentes sont verrouillées dans un ordre stable. Le
  -- verrou d’équipe sérialise aussi les achats et les autres lots du club.
  perform 1
  from public.rider_equipment_assignments as equipped
  where exists (
    select 1
    from jsonb_to_recordset(p_assignments) as requested(
      "riderId" uuid,
      slot text,
      "equipmentItemId" uuid
    )
    where requested."riderId" = equipped.rider_id
      and requested.slot = equipped.slot_type
  )
  order by equipped.rider_id, equipped.slot_type
  for update;

  if exists (
    select 1
    from jsonb_to_recordset(p_assignments) as requested(
      "riderId" uuid,
      slot text,
      "equipmentItemId" uuid
    )
    left join public.rider_equipment_assignments as current_assignment
      on current_assignment.rider_id = requested."riderId"
     and current_assignment.slot_type = requested.slot
    where current_assignment.equipment_item_id
      is distinct from requested."equipmentItemId"
      and exists (
        select 1
        from public.race_rosters as roster
        join public.race_registrations as registration
          on registration.id = roster.race_registration_id
         and registration.team_season_id = v_context.team_season_id
         and registration.status in ('pending', 'accepted')
        join public.race_editions as edition
          on edition.id = registration.race_edition_id
         and edition.status not in ('completed', 'cancelled')
        join public.stages as stage
          on stage.race_edition_id = edition.id
         and stage.status not in ('completed', 'cancelled')
         and stage.departure_at is not null
        where roster.rider_id = requested."riderId"
          and roster.status in ('selected', 'confirmed')
          and now() >= stage.departure_at - interval '5 minutes'
          and now() < stage.departure_at
            + make_interval(
                mins => greatest(
                  8,
                  least(48, round(stage.distance_km / 6.0))
                )::integer
              )
      )
  ) then
    raise exception 'Le matériel d’un coureur sélectionné est figé jusqu’à la fin de sa course.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_assignments) as requested(
      "riderId" uuid,
      slot text,
      "equipmentItemId" uuid
    )
    left join public.equipment_catalog_items as item
      on item.id = requested."equipmentItemId"
     and item.status = 'active'
     and item.slot_type = requested.slot
    where requested."equipmentItemId" is not null
      and item.id is null
  ) then
    raise exception 'Une référence ne correspond pas à son emplacement ou n’est plus disponible.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_assignments) as requested(
      "riderId" uuid,
      slot text,
      "equipmentItemId" uuid
    )
    join public.equipment_catalog_items as item
      on item.id = requested."equipmentItemId"
     and item.acquisition_channel = 'equipment_partner'
    left join public.rider_equipment_assignments as current_assignment
      on current_assignment.rider_id = requested."riderId"
     and current_assignment.slot_type = requested.slot
    where current_assignment.equipment_item_id
      is distinct from requested."equipmentItemId"
      and not exists (
        select 1
        from public.equipment_partner_contracts as partner_contract
        join public.seasons as start_season
          on start_season.id = partner_contract.start_season_id
        join public.seasons as end_season
          on end_season.id = partner_contract.end_season_id
        join public.equipment_partner_products as product
          on product.supplier_key = partner_contract.supplier_key
         and product.equipment_item_id = requested."equipmentItemId"
         and product.offer_type = 'core'
        where partner_contract.team_id = v_context.team_id
          and partner_contract.status = 'active'
          and partner_contract.supplier_key = item.supplier_key
          and v_context.game_year between
            start_season.game_year and end_season.game_year
      )
  ) then
    raise exception 'Une dotation partenaire sélectionnée n’est pas disponible pour votre équipe.';
  end if;

  -- Les inventaires concernés sont verrouillés avant le calcul de projection.
  perform 1
  from public.team_equipment_inventory as inventory
  where inventory.team_season_id = v_context.team_season_id
    and inventory.equipment_item_id in (
      select requested."equipmentItemId"
      from jsonb_to_recordset(p_assignments) as requested(
        "riderId" uuid,
        slot text,
        "equipmentItemId" uuid
      )
      where requested."equipmentItemId" is not null
    )
  order by inventory.equipment_item_id
  for update;

  with requested as (
    select *
    from jsonb_to_recordset(p_assignments) as requested(
      "riderId" uuid,
      slot text,
      "equipmentItemId" uuid
    )
  ),
  active_riders as (
    select distinct contract.rider_id
    from public.rider_contracts as contract
    where contract.team_id = v_context.team_id
      and contract.status = 'active'
  ),
  final_assignments as (
    select
      equipped.rider_id,
      equipped.slot_type,
      equipped.equipment_item_id
    from public.rider_equipment_assignments as equipped
    join active_riders as rider on rider.rider_id = equipped.rider_id
    where not exists (
      select 1
      from requested
      where requested."riderId" = equipped.rider_id
        and requested.slot = equipped.slot_type
    )

    union all

    select
      requested."riderId",
      requested.slot,
      requested."equipmentItemId"
    from requested
    where requested."equipmentItemId" is not null
  ),
  stock_usage as (
    select
      final_assignment.equipment_item_id,
      count(*)::integer as used_quantity
    from final_assignments as final_assignment
    join public.equipment_catalog_items as item
      on item.id = final_assignment.equipment_item_id
     and item.acquisition_channel <> 'equipment_partner'
    where final_assignment.equipment_item_id in (
      select requested."equipmentItemId"
      from requested
      where requested."equipmentItemId" is not null
    )
    group by final_assignment.equipment_item_id
  )
  select
    item.id,
    item.name,
    usage.used_quantity,
    coalesce(inventory.quantity, 0)
  into v_stock_item_id, v_stock_item_name, v_stock_used, v_stock_owned
  from stock_usage as usage
  join public.equipment_catalog_items as item
    on item.id = usage.equipment_item_id
  left join public.team_equipment_inventory as inventory
    on inventory.team_season_id = v_context.team_season_id
   and inventory.equipment_item_id = usage.equipment_item_id
  where usage.used_quantity > coalesce(inventory.quantity, 0)
  order by item.name, item.id
  limit 1;

  if v_stock_item_id is not null then
    raise exception
      'Stock insuffisant pour % : % exemplaires utilisés pour % disponibles.',
      v_stock_item_name,
      v_stock_used,
      v_stock_owned;
  end if;

  delete from public.rider_equipment_pending_assignments as pending
  where exists (
    select 1
    from jsonb_to_recordset(p_assignments) as requested(
      "riderId" uuid,
      slot text,
      "equipmentItemId" uuid
    )
    where requested."riderId" = pending.rider_id
      and requested.slot = pending.slot_type
  );

  delete from public.rider_equipment_assignments as equipped
  where exists (
    select 1
    from jsonb_to_recordset(p_assignments) as requested(
      "riderId" uuid,
      slot text,
      "equipmentItemId" uuid
    )
    where requested."riderId" = equipped.rider_id
      and requested.slot = equipped.slot_type
      and requested."equipmentItemId" is null
  );

  insert into public.rider_equipment_assignments (
    rider_id,
    slot_type,
    equipment_item_id,
    equipped_at
  )
  select
    requested."riderId",
    requested.slot,
    requested."equipmentItemId",
    now()
  from jsonb_to_recordset(p_assignments) as requested(
    "riderId" uuid,
    slot text,
    "equipmentItemId" uuid
  )
  where requested."equipmentItemId" is not null
  on conflict (rider_id, slot_type) do update set
    equipment_item_id = excluded.equipment_item_id,
    equipped_at = excluded.equipped_at
  where public.rider_equipment_assignments.equipment_item_id
    is distinct from excluded.equipment_item_id;

  return v_assignment_count;
end;
$$;

revoke all on function public.save_current_team_equipment_assignments(jsonb)
  from public, anon;
grant execute on function public.save_current_team_equipment_assignments(jsonb)
  to authenticated, service_role;

comment on function public.save_current_team_equipment_assignments(jsonb) is
  'Régularise une fois les montages dus, valide le stock final puis applique les affectations par écritures ensemblistes.';

notify pgrst, 'reload schema';

commit;
