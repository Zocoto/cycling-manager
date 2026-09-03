begin;

-- Correctif ciblé demandé le 3 septembre : Nayeem Kapoor doit rester engagé
-- sur la Ruta de las Sierras, déjà commencée, et être retiré de Desert to Sky
-- Classic qui occupe le même créneau le 4 septembre à 18 h.
do $correction$
declare
  v_desert_roster_id constant uuid :=
    'b0054b92-865f-4090-b339-9d9885a6b4e1';
  v_desert_registration_id constant uuid :=
    '131c445d-1c42-4236-87df-b5894fc2e699';
  v_ruta_roster_id constant uuid :=
    'e24a79b2-d024-4045-bb29-e4e26d0e78e4';
  v_kapoor_id constant uuid :=
    'e781b417-f0f0-4e68-a8e6-306ed8f4bfab';
  v_active_count integer;
begin
  if not exists (
    select 1
    from public.race_rosters as roster
    join public.riders as rider on rider.id = roster.rider_id
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    join public.race_editions as edition
      on edition.id = registration.race_edition_id
    where roster.id = v_desert_roster_id
      and roster.race_registration_id = v_desert_registration_id
      and roster.rider_id = v_kapoor_id
      and roster.status = 'confirmed'
      and rider.first_name = 'Nayeem'
      and rider.last_name = 'Kapoor'
      and edition.display_name = 'Desert to Sky Classic'
  ) then
    raise exception
      'Correction Kapoor annulée : la ligne Desert to Sky attendue a changé.';
  end if;

  if not exists (
    select 1
    from public.race_rosters as roster
    join public.race_registrations as registration
      on registration.id = roster.race_registration_id
    join public.race_editions as edition
      on edition.id = registration.race_edition_id
    where roster.id = v_ruta_roster_id
      and roster.rider_id = v_kapoor_id
      and roster.status = 'confirmed'
      and registration.status = 'accepted'
      and edition.display_name = 'Ruta de las Sierras'
  ) then
    raise exception
      'Correction Kapoor annulée : son engagement actif sur la Ruta est introuvable.';
  end if;

  update public.race_rosters
  set
    status = 'withdrawn',
    withdrawn_by_injury_id = null
  where id = v_desert_roster_id
    and race_registration_id = v_desert_registration_id
    and rider_id = v_kapoor_id
    and status = 'confirmed';

  if not found then
    raise exception
      'Correction Kapoor annulée : aucun engagement Desert to Sky retiré.';
  end if;

  select count(*)::integer
  into v_active_count
  from public.race_rosters as roster
  where roster.race_registration_id = v_desert_registration_id
    and roster.status in ('selected', 'confirmed');

  if v_active_count <> 6 then
    raise exception
      'Correction Kapoor annulée : 6 engagés Desert attendus, % trouvés.',
      v_active_count;
  end if;

  update public.race_roster_notifications
  set
    active_roster_count = v_active_count,
    requires_action = true,
    read_at = null,
    updated_at = now()
  where race_registration_id = v_desert_registration_id;

  if not found then
    raise exception
      'Correction Kapoor annulée : alerte Desert to Sky introuvable.';
  end if;

  if not exists (
    select 1
    from public.race_rosters
    where id = v_ruta_roster_id
      and rider_id = v_kapoor_id
      and status = 'confirmed'
  ) then
    raise exception
      'Correction Kapoor annulée : son engagement Ruta a été altéré.';
  end if;
end;
$correction$;

commit;
