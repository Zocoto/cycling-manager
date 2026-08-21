begin;

alter table public.staff_talent_catalog
  add column if not exists minimum_level integer not null default 1;

alter table public.staff_talent_catalog
  drop constraint if exists staff_talent_catalog_minimum_level_range;
alter table public.staff_talent_catalog
  add constraint staff_talent_catalog_minimum_level_range
  check (minimum_level between 1 and 5);

update public.staff_talent_catalog
set minimum_level = 3
where code = 'architect_parallel_construction';

insert into public.staff_talent_catalog (
  code,
  role,
  display_name,
  minimum_level
)
values (
  'mechanic_wheel_interchangeability',
  'mechanic',
  'Roues interchangeables',
  4
)
on conflict (code) do update
set
  role = excluded.role,
  display_name = excluded.display_name,
  minimum_level = excluded.minimum_level,
  is_active = true;

create or replace function public.validate_staff_member_talent_role()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_member_role text;
  v_member_level integer;
  v_talent_role text;
  v_talent_minimum_level integer;
begin
  select role, level
  into v_member_role, v_member_level
  from public.staff_members
  where id = new.staff_member_id;

  select role, minimum_level
  into v_talent_role, v_talent_minimum_level
  from public.staff_talent_catalog
  where code = new.talent_code
    and is_active;

  if v_member_role is null
    or v_talent_role is null
    or v_member_role <> v_talent_role then
    raise exception 'Ce talent ne correspond pas au métier du membre du staff.';
  end if;

  if v_member_level < v_talent_minimum_level then
    raise exception
      'Le talent % est réservé aux membres du staff de niveau % minimum.',
      new.talent_code,
      v_talent_minimum_level;
  end if;

  return new;
end;
$$;

-- Toutes les nouvelles lignes tirées par l’Académie respectent désormais le
-- niveau minimal porté par le catalogue, y compris Double chantier (3★).
do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_patched_definition text;
  v_pattern constant text :=
    '(where talent\.role = v_member\.role[[:space:]]+and talent\.is_active)';
  v_replacement constant text := E'\\1\n        and talent.minimum_level <= v_member.level';
begin
  foreach v_signature in array array[
    'public.settle_due_staff_academy_trainings()'::regprocedure,
    'public.start_current_team_staff_academy_training(uuid,text)'::regprocedure
  ]
  loop
    select pg_get_functiondef(v_signature) into v_definition;

    if position('talent.minimum_level <= v_member.level' in v_definition) > 0 then
      continue;
    end if;

    v_patched_definition := regexp_replace(
      v_definition,
      v_pattern,
      v_replacement,
      'g'
    );

    if v_patched_definition = v_definition then
      raise exception 'La fonction d’Académie % a une définition inattendue.',
        v_signature::text;
    end if;

    execute v_patched_definition;
  end loop;
end;
$migration$;

create or replace function public.team_has_mechanic_wheel_interchangeability(
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
     and member.role = 'mechanic'
     and member.level >= 4
    join public.staff_member_talents as talent
      on talent.staff_member_id = member.id
     and talent.talent_code = 'mechanic_wheel_interchangeability'
    where contract.team_id = p_team_id
      and contract.status = 'active'
  );
$$;

create or replace function public.equipment_slots_are_compatible(
  p_team_id uuid,
  p_target_slot text,
  p_item_slot text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p_target_slot = p_item_slot
    or (
      (
        (p_target_slot = 'front_wheel' and p_item_slot = 'rear_wheel')
        or
        (p_target_slot = 'rear_wheel' and p_item_slot = 'front_wheel')
      )
      and public.team_has_mechanic_wheel_interchangeability(p_team_id)
    );
$$;

create or replace function public.enforce_equipment_assignment_slot()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_catalog_slot text;
  v_team_id uuid;
begin
  select item.slot_type
  into v_catalog_slot
  from public.equipment_catalog_items as item
  where item.id = new.equipment_item_id;

  if v_catalog_slot is null then
    raise exception 'L objet d équipement demandé est introuvable.';
  end if;

  select contract.team_id
  into v_team_id
  from public.rider_contracts as contract
  where contract.rider_id = new.rider_id
    and contract.status = 'active'
  limit 1;

  if not public.equipment_slots_are_compatible(
    v_team_id,
    new.slot_type,
    v_catalog_slot
  ) then
    raise exception 'L objet d équipement ne correspond pas à l emplacement demandé.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_race_stage_equipment_assignment()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_item_slot text;
  v_stage_edition_id uuid;
  v_team_id uuid;
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

  select team_season.team_id
  into v_team_id
  from public.team_seasons as team_season
  where team_season.id = new.team_season_id;

  if v_item_slot is null
    or not public.equipment_slots_are_compatible(
      v_team_id,
      new.slot_type,
      v_item_slot
    ) then
    raise exception 'Ce matériel ne correspond pas à cet emplacement.';
  end if;

  return new;
end;
$$;

-- Les RPC existants gardent tous leurs contrôles d’authentification, de gel et
-- de stock ; seule leur règle de compatibilité d’emplacement est élargie.
do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_patched_definition text;
begin
  v_signature := 'public.equip_current_team_rider(uuid,text,uuid)'::regprocedure;
  select pg_get_functiondef(v_signature) into v_definition;

  if position('equipment_slots_are_compatible' in v_definition) = 0 then
    v_patched_definition := replace(
      v_definition,
      'if v_item is null or v_item.slot_type <> p_slot_type then',
      'if v_item is null or not public.equipment_slots_are_compatible(v_context.team_id, p_slot_type, v_item.slot_type) then'
    );
    if v_patched_definition = v_definition then
      raise exception 'La fonction equip_current_team_rider a une définition inattendue.';
    end if;
    execute v_patched_definition;
  end if;

  v_signature :=
    'public.save_current_team_race_equipment_plan(uuid,uuid,jsonb,boolean)'::regprocedure;
  select pg_get_functiondef(v_signature) into v_definition;

  if position('equipment_slots_are_compatible' in v_definition) = 0 then
    v_patched_definition := replace(
      v_definition,
      'and item.slot_type = entry.slot',
      'and public.equipment_slots_are_compatible(v_context.team_id, entry.slot, item.slot_type)'
    );
    if v_patched_definition = v_definition then
      raise exception 'La fonction save_current_team_race_equipment_plan a une définition inattendue.';
    end if;
    execute v_patched_definition;
  end if;
end;
$migration$;

revoke all on function public.team_has_mechanic_wheel_interchangeability(uuid)
  from public, anon;
grant execute on function public.team_has_mechanic_wheel_interchangeability(uuid)
  to authenticated, service_role;

revoke all on function public.equipment_slots_are_compatible(uuid, text, text)
  from public, anon;
grant execute on function public.equipment_slots_are_compatible(uuid, text, text)
  to authenticated, service_role;

comment on function public.team_has_mechanic_wheel_interchangeability(uuid) is
  'Indique si l’équipe emploie un mécanicien actif 4★ ou plus doté du talent Roues interchangeables.';

comment on function public.equipment_slots_are_compatible(uuid, text, text) is
  'Valide un emplacement de matériel et autorise le montage croisé des roues uniquement avec le talent mécanicien requis.';

notify pgrst, 'reload schema';

commit;
