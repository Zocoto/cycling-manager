create or replace function public.validate_race_stage_equipment_available_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team_season_id uuid;
  v_race_edition_id uuid;
  v_stage_id uuid;
  v_conflict record;
begin
  if tg_op = 'DELETE' then
    v_team_season_id := old.team_season_id;
    v_race_edition_id := old.race_edition_id;
    v_stage_id := old.stage_id;
  else
    v_team_season_id := new.team_season_id;
    v_race_edition_id := new.race_edition_id;
    v_stage_id := new.stage_id;
  end if;

  for v_conflict in
    with registration_context as (
      select registration.id, team_season.team_id
      from public.race_registrations as registration
      join public.team_seasons as team_season
        on team_season.id = registration.team_season_id
      where registration.team_season_id = v_team_season_id
        and registration.race_edition_id = v_race_edition_id
        and registration.status = 'accepted'
      limit 1
    ),
    roster as (
      select race_roster.rider_id
      from public.race_rosters as race_roster
      join registration_context as registration
        on registration.id = race_roster.race_registration_id
      where race_roster.status in ('selected', 'confirmed')
    ),
    slots(slot_type) as (
      values
        ('helmet'), ('gloves'), ('bib_shorts'), ('glasses'), ('shoes'),
        ('front_wheel'), ('rear_wheel'), ('frame')
    ),
    effective as (
      select
        roster.rider_id,
        slots.slot_type,
        case
          when planned.id is not null then planned.equipment_item_id
          else permanent.equipment_item_id
        end as equipment_item_id
      from roster
      cross join slots
      left join public.race_stage_equipment_assignments as planned
        on planned.stage_id = v_stage_id
       and planned.team_season_id = v_team_season_id
       and planned.rider_id = roster.rider_id
       and planned.slot_type = slots.slot_type
      left join public.rider_equipment_assignments as permanent
        on permanent.rider_id = roster.rider_id
       and permanent.slot_type = slots.slot_type
    ),
    external_equipped as (
      select
        assignment.equipment_item_id,
        count(*)::integer as reserved_quantity
      from public.rider_equipment_assignments as assignment
      join public.rider_contracts as contract
        on contract.rider_id = assignment.rider_id
       and contract.team_id = (
         select registration.team_id
         from registration_context as registration
       )
       and contract.status = 'active'
      where not exists (
        select 1
        from roster
        where roster.rider_id = assignment.rider_id
      )
      group by assignment.equipment_item_id
    ),
    pending as (
      select
        assignment.equipment_item_id,
        count(*)::integer as reserved_quantity
      from public.rider_equipment_pending_assignments as assignment
      where assignment.team_season_id = v_team_season_id
      group by assignment.equipment_item_id
    ),
    stage_usage as (
      select
        effective.equipment_item_id,
        count(*)::integer as used_quantity
      from effective
      join public.equipment_catalog_items as item
        on item.id = effective.equipment_item_id
       and item.acquisition_channel <> 'equipment_partner'
      where effective.equipment_item_id is not null
      group by effective.equipment_item_id
    )
    select
      item.name,
      stage_usage.used_quantity,
      greatest(
        0,
        coalesce(inventory.quantity, 0)
          - coalesce(external_equipped.reserved_quantity, 0)
          - coalesce(pending.reserved_quantity, 0)
      )::integer as available_quantity
    from stage_usage
    join public.equipment_catalog_items as item
      on item.id = stage_usage.equipment_item_id
    left join public.team_equipment_inventory as inventory
      on inventory.team_season_id = v_team_season_id
     and inventory.equipment_item_id = stage_usage.equipment_item_id
    left join external_equipped
      on external_equipped.equipment_item_id = stage_usage.equipment_item_id
    left join pending
      on pending.equipment_item_id = stage_usage.equipment_item_id
    where stage_usage.used_quantity > greatest(
      0,
      coalesce(inventory.quantity, 0)
        - coalesce(external_equipped.reserved_quantity, 0)
        - coalesce(pending.reserved_quantity, 0)
    )
  loop
    raise exception
      'Stock insuffisant pour % : % exemplaires requis pour % disponibles après les équipements déjà affectés.',
      v_conflict.name,
      v_conflict.used_quantity,
      v_conflict.available_quantity;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_race_stage_equipment_available_stock
  on public.race_stage_equipment_assignments;

create constraint trigger validate_race_stage_equipment_available_stock
after insert or update or delete
on public.race_stage_equipment_assignments
deferrable initially deferred
for each row
execute function public.validate_race_stage_equipment_available_stock();

revoke execute on function public.validate_race_stage_equipment_available_stock()
  from public;
revoke execute on function public.validate_race_stage_equipment_available_stock()
  from anon;
revoke execute on function public.validate_race_stage_equipment_available_stock()
  from authenticated;

comment on function public.validate_race_stage_equipment_available_stock() is
  'Refuse les plans de course qui dépassent le stock disponible après réservation des équipements permanents hors course et des changements programmés.';

notify pgrst, 'reload schema';
