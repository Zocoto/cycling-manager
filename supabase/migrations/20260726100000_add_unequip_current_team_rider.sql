begin;

create or replace function public.unequip_current_team_rider(
  p_rider_id uuid,
  p_slot_type text
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
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
    raise exception 'Vous ne pouvez modifier que les coureurs de votre équipe.';
  end if;

  select stage.id
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

  if v_frozen_stage is not null then
    raise exception 'Le matériel de ce coureur est figé jusqu’à la fin de sa course.';
  end if;

  delete from public.rider_equipment_pending_assignments
  where rider_id = p_rider_id
    and slot_type = p_slot_type;

  delete from public.rider_equipment_assignments
  where rider_id = p_rider_id
    and slot_type = p_slot_type;

  return now();
end;
$$;

comment on function public.unequip_current_team_rider(uuid, text) is
  'Retire un matériel du coureur authentifié hors fenêtre de gel de course.';

revoke all on function public.unequip_current_team_rider(uuid, text) from public;
grant execute on function public.unequip_current_team_rider(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;