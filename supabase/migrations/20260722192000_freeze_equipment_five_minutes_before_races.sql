begin;

-- L'équipement est figé par coureur cinq minutes avant son prochain
-- départ. Un changement demandé pendant cette fenêtre devient actif après
-- la course en cours, et peut donc servir pour le second créneau de la journée.

create or replace function public.equip_current_team_rider(
  p_rider_id uuid,
  p_slot_type text,
  p_equipment_item_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_item record;
  v_owned integer;
  v_used integer;
  v_current_item_id uuid;
  v_effective_at timestamptz;
  v_frozen_stage record;
begin
  if p_slot_type not in (
    'helmet', 'gloves', 'bib_shorts', 'glasses', 'shoes',
    'front_wheel', 'rear_wheel', 'frame'
  ) then
    raise exception 'Emplacement de matériel invalide.';
  end if;

  select team_season.id as team_season_id, team_season.team_id
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
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  perform public.settle_due_equipment_assignments(v_context.team_season_id);

  if not exists (
    select 1
    from public.rider_contracts
    where rider_id = p_rider_id
      and team_id = v_context.team_id
      and status = 'active'
  ) then
    raise exception 'Vous ne pouvez équiper que les coureurs de votre équipe.';
  end if;

  select id, slot_type
  into v_item
  from public.equipment_catalog_items
  where id = p_equipment_item_id
    and status = 'active';

  if v_item is null or v_item.slot_type <> p_slot_type then
    raise exception 'Ce matériel ne correspond pas à cet emplacement.';
  end if;

  select equipment_item_id
  into v_current_item_id
  from public.rider_equipment_assignments
  where rider_id = p_rider_id
    and slot_type = p_slot_type;

  if v_current_item_id = p_equipment_item_id then
    delete from public.rider_equipment_pending_assignments
    where rider_id = p_rider_id and slot_type = p_slot_type;
    return now();
  end if;

  select coalesce(quantity, 0)
  into v_owned
  from public.team_equipment_inventory
  where team_season_id = v_context.team_season_id
    and equipment_item_id = p_equipment_item_id;

  select
    (
      select count(*)
      from public.rider_equipment_assignments as equipped
      join public.rider_contracts as contract
        on contract.rider_id = equipped.rider_id
        and contract.team_id = v_context.team_id
        and contract.status = 'active'
      where equipped.equipment_item_id = p_equipment_item_id
    ) + (
      select count(*)
      from public.rider_equipment_pending_assignments as pending
      where pending.team_season_id = v_context.team_season_id
        and pending.equipment_item_id = p_equipment_item_id
        and not (
          pending.rider_id = p_rider_id
          and pending.slot_type = p_slot_type
        )
    )
  into v_used;

  if coalesce(v_owned, 0) <= coalesce(v_used, 0) then
    raise exception 'Tous les exemplaires de cette référence sont déjà attribués.';
  end if;

  select
    stage.departure_at,
    greatest(8, least(48, round(stage.distance_km / 6.0)))::integer
      as duration_minutes
  into v_frozen_stage
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
  where roster.rider_id = p_rider_id
    and roster.status in ('selected', 'confirmed')
    and now() >= stage.departure_at - interval '5 minutes'
    and now() < stage.departure_at
      + make_interval(
          mins => greatest(8, least(48, round(stage.distance_km / 6.0)))::integer
        )
  order by stage.departure_at
  limit 1;

  if v_frozen_stage is null then
    v_effective_at := now();

    insert into public.rider_equipment_assignments (
      rider_id, slot_type, equipment_item_id, equipped_at
    )
    values (p_rider_id, p_slot_type, p_equipment_item_id, v_effective_at)
    on conflict (rider_id, slot_type) do update set
      equipment_item_id = excluded.equipment_item_id,
      equipped_at = excluded.equipped_at;

    delete from public.rider_equipment_pending_assignments
    where rider_id = p_rider_id and slot_type = p_slot_type;
  else
    v_effective_at := v_frozen_stage.departure_at
      + make_interval(mins => v_frozen_stage.duration_minutes);

    insert into public.rider_equipment_pending_assignments (
      team_season_id, rider_id, slot_type, equipment_item_id, effective_at
    )
    values (
      v_context.team_season_id,
      p_rider_id,
      p_slot_type,
      p_equipment_item_id,
      v_effective_at
    )
    on conflict (rider_id, slot_type) do update set
      team_season_id = excluded.team_season_id,
      equipment_item_id = excluded.equipment_item_id,
      requested_at = now(),
      effective_at = excluded.effective_at;
  end if;

  return v_effective_at;
end;
$$;

comment on function public.equip_current_team_rider(uuid, text, uuid) is
  'Equipe immédiatement un coureur, sauf de H-5 minutes à la fin de sa course, où le changement est programmé après l arrivée.';

-- Les changements encore en attente selon l'ancienne règle de midi sont
-- recalés : immédiats hors course, ou reportés après la course figée.
update public.rider_equipment_pending_assignments as pending
set effective_at = coalesce(
  (
    select stage.departure_at
      + make_interval(
          mins => greatest(8, least(48, round(stage.distance_km / 6.0)))::integer
        )
    from public.race_rosters as roster
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
      and registration.team_season_id = pending.team_season_id
      and registration.status in ('pending', 'accepted')
    join public.race_editions as edition
      on edition.id = registration.race_edition_id
      and edition.status not in ('completed', 'cancelled')
    join public.stages as stage
      on stage.race_edition_id = edition.id
      and stage.status not in ('completed', 'cancelled')
      and stage.departure_at is not null
    where roster.rider_id = pending.rider_id
      and roster.status in ('selected', 'confirmed')
      and now() >= stage.departure_at - interval '5 minutes'
      and now() < stage.departure_at
        + make_interval(
            mins => greatest(8, least(48, round(stage.distance_km / 6.0)))::integer
          )
    order by stage.departure_at
    limit 1
  ),
  now()
);

do $$
declare
  v_team_season_id uuid;
begin
  for v_team_season_id in
    select distinct pending.team_season_id
    from public.rider_equipment_pending_assignments as pending
    where pending.effective_at <= now()
  loop
    perform public.settle_due_equipment_assignments(v_team_season_id);
  end loop;
end;
$$;

commit;
