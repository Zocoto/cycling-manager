-- ============================================================
-- CYCLING MANAGER
-- Montages de matériel propres aux étapes et classiques
-- ============================================================

begin;

create table public.race_stage_equipment_assignments (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null
    references public.team_seasons(id) on delete cascade,
  race_edition_id uuid not null
    references public.race_editions(id) on delete cascade,
  stage_id uuid not null
    references public.stages(id) on delete cascade,
  rider_id uuid not null
    references public.riders(id) on delete cascade,
  slot_type text not null,
  equipment_item_id uuid
    references public.equipment_catalog_items(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint race_stage_equipment_slot_allowed check (slot_type in (
    'helmet', 'gloves', 'bib_shorts', 'glasses', 'shoes',
    'front_wheel', 'rear_wheel', 'frame'
  )),
  constraint race_stage_equipment_assignment_unique
    unique (stage_id, team_season_id, rider_id, slot_type)
);

create index race_stage_equipment_edition_team_idx
  on public.race_stage_equipment_assignments (
    race_edition_id,
    team_season_id,
    stage_id
  );
create index race_stage_equipment_item_idx
  on public.race_stage_equipment_assignments (equipment_item_id)
  where equipment_item_id is not null;

create or replace function public.enforce_race_stage_equipment_assignment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_item_slot text;
  v_stage_edition_id uuid;
begin
  select stage.race_edition_id
  into v_stage_edition_id
  from public.stages as stage
  where stage.id = new.stage_id;

  if v_stage_edition_id is null
     or v_stage_edition_id <> new.race_edition_id then
    raise exception 'Cette étape ne correspond pas à la course préparée.';
  end if;

  if new.equipment_item_id is null then
    return new;
  end if;

  select item.slot_type
  into v_item_slot
  from public.equipment_catalog_items as item
  where item.id = new.equipment_item_id
    and item.status = 'active';

  if v_item_slot is null or v_item_slot <> new.slot_type then
    raise exception 'Ce matériel ne correspond pas à cet emplacement.';
  end if;

  return new;
end;
$$;

create trigger enforce_race_stage_equipment_assignment
before insert or update of
  stage_id,
  race_edition_id,
  slot_type,
  equipment_item_id
on public.race_stage_equipment_assignments
for each row
execute function public.enforce_race_stage_equipment_assignment();

alter table public.race_stage_equipment_assignments enable row level security;

create or replace function public.save_current_team_race_equipment_plan(
  p_race_edition_id uuid,
  p_stage_id uuid,
  p_loadouts jsonb,
  p_apply_to_tour boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_registration record;
  v_target_stage_ids uuid[];
  v_expected_entries integer;
  v_conflict record;
begin
  if jsonb_typeof(p_loadouts) <> 'array' then
    raise exception 'Le montage de course est invalide.';
  end if;

  select
    team_season.id as team_season_id,
    team_season.team_id,
    season.id as season_id,
    season.game_year
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
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  select registration.id, count(roster.id)::integer as roster_count
  into v_registration
  from public.race_registrations as registration
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  where registration.race_edition_id = p_race_edition_id
    and registration.team_season_id = v_context.team_season_id
    and registration.status = 'accepted'
  group by registration.id;

  if v_registration is null then
    raise exception 'Une inscription acceptée est requise pour préparer le matériel.';
  end if;

  select array_agg(stage.id order by stage.stage_number)
  into v_target_stage_ids
  from public.stages as stage
  where stage.race_edition_id = p_race_edition_id
    and stage.status not in ('completed', 'cancelled')
    and stage.departure_at is not null
    and stage.departure_at > now() + interval '5 minutes'
    and (p_apply_to_tour or stage.id = p_stage_id);

  if v_target_stage_ids is null
     or not (p_stage_id = any(v_target_stage_ids)) then
    raise exception 'Le matériel de cette étape est déjà figé ou l’étape est invalide.';
  end if;

  v_expected_entries := v_registration.roster_count * 8;

  if jsonb_array_length(p_loadouts) <> v_expected_entries then
    raise exception 'Le montage doit décrire les huit emplacements de chaque coureur engagé.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_loadouts) as entry(
      "riderId" uuid,
      slot text,
      mode text,
      "equipmentItemId" uuid
    )
    left join public.race_rosters as roster
      on roster.race_registration_id = v_registration.id
     and roster.rider_id = entry."riderId"
     and roster.status in ('selected', 'confirmed')
    where roster.id is null
       or entry.slot not in (
         'helmet', 'gloves', 'bib_shorts', 'glasses', 'shoes',
         'front_wheel', 'rear_wheel', 'frame'
       )
       or entry.mode not in ('inherit', 'empty', 'item')
       or (entry.mode = 'item' and entry."equipmentItemId" is null)
       or (entry.mode <> 'item' and entry."equipmentItemId" is not null)
  ) then
    raise exception 'Le montage contient un coureur, un emplacement ou un choix invalide.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_loadouts) as entry(
      "riderId" uuid,
      slot text,
      mode text,
      "equipmentItemId" uuid
    )
    group by entry."riderId", entry.slot
    having count(*) <> 1
  ) then
    raise exception 'Chaque emplacement ne peut être renseigné qu’une fois.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_loadouts) as entry(
      "riderId" uuid,
      slot text,
      mode text,
      "equipmentItemId" uuid
    )
    left join public.equipment_catalog_items as item
      on item.id = entry."equipmentItemId"
     and item.status = 'active'
     and item.slot_type = entry.slot
    where entry.mode = 'item'
      and (
        item.id is null
        or not (
          (
            item.acquisition_channel = 'commercial'
            and exists (
              select 1
              from public.team_equipment_inventory as inventory
              where inventory.team_season_id = v_context.team_season_id
                and inventory.equipment_item_id = item.id
                and inventory.quantity > 0
            )
          )
          or (
            item.acquisition_channel = 'equipment_partner'
            and exists (
              select 1
              from public.equipment_partner_contracts as contract
              join public.seasons as start_season
                on start_season.id = contract.start_season_id
              join public.seasons as end_season
                on end_season.id = contract.end_season_id
              join public.equipment_partner_products as product
                on product.supplier_key = contract.supplier_key
               and product.equipment_item_id = item.id
              where contract.team_id = v_context.team_id
                and contract.status = 'active'
                and v_context.game_year between
                  start_season.game_year and end_season.game_year
                and (
                  product.offer_type = 'core'
                  or exists (
                    select 1
                    from public.equipment_partner_offers as offer
                    where offer.contract_id = contract.id
                      and offer.equipment_item_id = item.id
                      and offer.status = 'claimed'
                  )
                )
            )
          )
        )
      )
  ) then
    raise exception 'Une référence choisie n’est pas disponible pour votre équipe.';
  end if;

  delete from public.race_stage_equipment_assignments
  where team_season_id = v_context.team_season_id
    and race_edition_id = p_race_edition_id
    and stage_id = any(v_target_stage_ids);

  insert into public.race_stage_equipment_assignments (
    team_season_id,
    race_edition_id,
    stage_id,
    rider_id,
    slot_type,
    equipment_item_id
  )
  select
    v_context.team_season_id,
    p_race_edition_id,
    target_stage.id,
    entry."riderId",
    entry.slot,
    case when entry.mode = 'item' then entry."equipmentItemId" else null end
  from unnest(v_target_stage_ids) as target_stage(id)
  cross join jsonb_to_recordset(p_loadouts) as entry(
    "riderId" uuid,
    slot text,
    mode text,
    "equipmentItemId" uuid
  )
  where entry.mode <> 'inherit';

  for v_conflict in
    with roster as (
      select rider_id
      from public.race_rosters
      where race_registration_id = v_registration.id
        and status in ('selected', 'confirmed')
    ),
    slots(slot_type) as (
      values
        ('helmet'), ('gloves'), ('bib_shorts'), ('glasses'), ('shoes'),
        ('front_wheel'), ('rear_wheel'), ('frame')
    ),
    effective as (
      select
        target_stage.id as stage_id,
        roster.rider_id,
        slots.slot_type,
        case
          when planned.id is not null then planned.equipment_item_id
          else permanent.equipment_item_id
        end as equipment_item_id
      from unnest(v_target_stage_ids) as target_stage(id)
      cross join roster
      cross join slots
      left join public.race_stage_equipment_assignments as planned
        on planned.stage_id = target_stage.id
       and planned.team_season_id = v_context.team_season_id
       and planned.rider_id = roster.rider_id
       and planned.slot_type = slots.slot_type
      left join public.rider_equipment_assignments as permanent
        on permanent.rider_id = roster.rider_id
       and permanent.slot_type = slots.slot_type
    )
    select
      item.name,
      effective.stage_id,
      count(*)::integer as used_quantity,
      coalesce(max(inventory.quantity), 0)::integer as owned_quantity
    from effective
    join public.equipment_catalog_items as item
      on item.id = effective.equipment_item_id
     and item.acquisition_channel = 'commercial'
    left join public.team_equipment_inventory as inventory
      on inventory.team_season_id = v_context.team_season_id
     and inventory.equipment_item_id = item.id
    group by item.id, item.name, effective.stage_id
    having count(*) > coalesce(max(inventory.quantity), 0)
  loop
    raise exception 'Stock insuffisant pour % : % exemplaires utilisés pour % disponibles.',
      v_conflict.name,
      v_conflict.used_quantity,
      v_conflict.owned_quantity;
  end loop;

  return cardinality(v_target_stage_ids);
end;
$$;

comment on function public.save_current_team_race_equipment_plan(
  uuid,
  uuid,
  jsonb,
  boolean
) is
  'Enregistre des surcharges de matériel limitées à une étape, ou les copie sur les étapes encore modifiables du tour. Ne modifie jamais rider_equipment_assignments.';

create or replace function public.get_active_calendar_stage_equipment_effects(
  p_race_edition_ids uuid[] default null
)
returns table (
  race_edition_id uuid,
  stage_id uuid,
  rider_id uuid,
  team_id uuid,
  equipment_effects jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    edition.id,
    stage.id,
    roster.rider_id,
    team_season.team_id,
    coalesce(equipment.effects, '[]'::jsonb)
  from public.race_editions as edition
  join public.seasons as season
    on season.id = edition.season_id
   and season.status = 'active'
  join public.stages as stage
    on stage.race_edition_id = edition.id
   and stage.status <> 'cancelled'
  join public.race_registrations as registration
    on registration.race_edition_id = edition.id
   and registration.status = 'accepted'
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  left join lateral (
    select jsonb_agg(
      resolved.effect_payload order by resolved.slot_type
    ) as effects
    from (
      select
        slot.slot_type,
        (
          case
            when item.acquisition_channel = 'commercial'
              then item.effect_payload
            else partner_effect.effect_payload
          end
        ) || jsonb_build_object('_slotType', slot.slot_type) as effect_payload
      from (
        values
          ('helmet'), ('gloves'), ('bib_shorts'), ('glasses'), ('shoes'),
          ('front_wheel'), ('rear_wheel'), ('frame')
      ) as slot(slot_type)
      left join public.race_stage_equipment_assignments as planned
        on planned.stage_id = stage.id
       and planned.team_season_id = registration.team_season_id
       and planned.rider_id = roster.rider_id
       and planned.slot_type = slot.slot_type
      left join public.rider_equipment_assignments as permanent
        on permanent.rider_id = roster.rider_id
       and permanent.slot_type = slot.slot_type
      join public.equipment_catalog_items as item
        on item.id = case
          when planned.id is not null then planned.equipment_item_id
          else permanent.equipment_item_id
        end
       and item.status = 'active'
      left join lateral (
        select effect.effect_payload
        from public.equipment_partner_item_effects as effect
        join public.equipment_partner_contracts as contract
          on contract.id = effect.contract_id
         and contract.team_id = team_season.team_id
         and contract.supplier_key = item.supplier_key
         and contract.status = 'active'
        join public.seasons as contract_start
          on contract_start.id = contract.start_season_id
        join public.seasons as contract_end
          on contract_end.id = contract.end_season_id
        where effect.equipment_item_id = item.id
          and season.game_year between
            contract_start.game_year and contract_end.game_year
        limit 1
      ) as partner_effect on true
      where item.acquisition_channel = 'commercial'
         or partner_effect.effect_payload is not null
    ) as resolved
  ) as equipment on true
  where edition.status <> 'cancelled'
    and (
      p_race_edition_ids is null
      or edition.id = any(p_race_edition_ids)
    )
  order by edition.id, stage.stage_number, team_season.id, roster.rider_id;
$$;

comment on function public.get_active_calendar_stage_equipment_effects(uuid[]) is
  'Effets de matériel effectifs par étape : une surcharge de course prévaut, sinon le montage permanent est hérité.';

create or replace function public.prevent_reserved_race_equipment_inventory_reduction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quantity integer;
  v_required integer;
  v_item_name text;
begin
  v_quantity := case when tg_op = 'DELETE' then 0 else new.quantity end;

  select item.name
  into v_item_name
  from public.equipment_catalog_items as item
  where item.id = old.equipment_item_id
    and item.acquisition_channel = 'commercial';

  if v_item_name is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  with slots(slot_type) as (
    values
      ('helmet'), ('gloves'), ('bib_shorts'), ('glasses'), ('shoes'),
      ('front_wheel'), ('rear_wheel'), ('frame')
  ),
  effective as (
    select
      stage.id as stage_id,
      roster.rider_id,
      case
        when planned.id is not null then planned.equipment_item_id
        else permanent.equipment_item_id
      end as equipment_item_id
    from public.race_registrations as registration
    join public.race_rosters as roster
      on roster.race_registration_id = registration.id
     and roster.status in ('selected', 'confirmed')
    join public.stages as stage
      on stage.race_edition_id = registration.race_edition_id
     and stage.status not in ('completed', 'cancelled')
     and stage.departure_at > now()
    cross join slots
    left join public.race_stage_equipment_assignments as planned
      on planned.stage_id = stage.id
     and planned.team_season_id = registration.team_season_id
     and planned.rider_id = roster.rider_id
     and planned.slot_type = slots.slot_type
    left join public.rider_equipment_assignments as permanent
      on permanent.rider_id = roster.rider_id
     and permanent.slot_type = slots.slot_type
    where registration.team_season_id = old.team_season_id
      and registration.status = 'accepted'
  ),
  stage_usage as (
    select stage_id, count(*)::integer as quantity
    from effective
    where equipment_item_id = old.equipment_item_id
    group by stage_id
  )
  select coalesce(max(quantity), 0)
  into v_required
  from stage_usage;

  if v_quantity < v_required then
    raise exception 'Impossible de réduire le stock de % : % exemplaires sont réservés pour une prochaine course.',
      v_item_name,
      v_required;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger prevent_reserved_race_equipment_inventory_reduction
before update of quantity or delete
on public.team_equipment_inventory
for each row
execute function public.prevent_reserved_race_equipment_inventory_reduction();

grant select on table public.race_stage_equipment_assignments to service_role;

revoke all
on function public.save_current_team_race_equipment_plan(
  uuid,
  uuid,
  jsonb,
  boolean
)
from public, anon;

revoke all
on function public.get_active_calendar_stage_equipment_effects(uuid[])
from public, anon;

grant execute
on function public.save_current_team_race_equipment_plan(
  uuid,
  uuid,
  jsonb,
  boolean
)
to authenticated, service_role;

grant execute
on function public.get_active_calendar_stage_equipment_effects(uuid[])
to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
