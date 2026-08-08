begin;

create or replace function public.save_current_team_equipment_assignments(
  p_assignments jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment jsonb;
  v_rider_id text;
  v_slot text;
  v_equipment_item_id text;
  v_is_frozen boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;

  if p_assignments is null
    or jsonb_typeof(p_assignments) <> 'array'
    or jsonb_array_length(p_assignments) < 1
    or jsonb_array_length(p_assignments) > 280
  then
    raise exception 'Sélectionnez entre 1 et 280 affectations à modifier.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_assignments) as entry(value)
    group by entry.value ->> 'riderId', entry.value ->> 'slot'
    having count(*) > 1
  ) then
    raise exception 'Un emplacement ne peut être modifié qu’une seule fois.';
  end if;

  -- Valide tout le lot avant la moindre mutation.
  for v_assignment in
    select entry.value
    from jsonb_array_elements(p_assignments) with ordinality as entry(value, position)
    order by entry.position
  loop
    if jsonb_typeof(v_assignment) <> 'object' then
      raise exception 'Une affectation de matériel est invalide.';
    end if;

    v_rider_id := coalesce(v_assignment ->> 'riderId', '');
    v_slot := coalesce(v_assignment ->> 'slot', '');
    v_equipment_item_id := v_assignment ->> 'equipmentItemId';

    if v_rider_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or v_slot not in (
        'helmet', 'gloves', 'bib_shorts', 'glasses', 'shoes',
        'front_wheel', 'rear_wheel', 'frame'
      )
      or (
        v_equipment_item_id is not null
        and v_equipment_item_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )
    then
      raise exception 'Une affectation de matériel est invalide.';
    end if;
  end loop;

  -- Libère d’abord les emplacements modifiés hors course. Cette première passe
  -- permet les échanges de pièces entre deux coureurs dans le même lot.
  for v_assignment in
    select entry.value
    from jsonb_array_elements(p_assignments) with ordinality as entry(value, position)
    order by entry.position
  loop
    v_rider_id := v_assignment ->> 'riderId';
    v_slot := v_assignment ->> 'slot';
    v_equipment_item_id := v_assignment ->> 'equipmentItemId';

    select exists (
      select 1
      from public.race_rosters as roster
      join public.race_registrations as registration
        on registration.id = roster.race_registration_id
       and registration.status in ('pending', 'accepted')
      join public.race_editions as edition
        on edition.id = registration.race_edition_id
       and edition.status not in ('completed', 'cancelled')
      join public.stages as stage
        on stage.race_edition_id = edition.id
       and stage.status not in ('completed', 'cancelled')
       and stage.departure_at is not null
      where roster.rider_id = v_rider_id::uuid
        and roster.status in ('selected', 'confirmed')
        and now() >= stage.departure_at - interval '5 minutes'
        and now() < stage.departure_at
          + make_interval(
              mins => greatest(
                8,
                least(48, round(stage.distance_km / 6.0))
              )::integer
            )
    ) into v_is_frozen;

    if not v_is_frozen or v_equipment_item_id is null then
      perform public.unequip_current_team_rider(
        v_rider_id::uuid,
        v_slot
      );
    end if;
  end loop;

  -- Attribue ensuite les pièces demandées. Les contrôles d’équipe, de stock,
  -- de compatibilité et de gel restent centralisés dans la fonction existante.
  for v_assignment in
    select entry.value
    from jsonb_array_elements(p_assignments) with ordinality as entry(value, position)
    order by entry.position
  loop
    v_equipment_item_id := v_assignment ->> 'equipmentItemId';
    if v_equipment_item_id is null then continue; end if;

    perform public.equip_current_team_rider(
      (v_assignment ->> 'riderId')::uuid,
      v_assignment ->> 'slot',
      v_equipment_item_id::uuid
    );
  end loop;

  return jsonb_array_length(p_assignments);
end;
$$;

revoke all on function public.save_current_team_equipment_assignments(jsonb)
from public, anon;

grant execute on function public.save_current_team_equipment_assignments(jsonb)
to authenticated;

comment on function public.save_current_team_equipment_assignments(jsonb) is
  'Valide puis applique atomiquement les affectations de matériel de plusieurs coureurs.';

notify pgrst, 'reload schema';

commit;
