begin;

-- Le leader de classement général choisi à l'inscription est un engagement
-- pour l'ensemble du tour. Les rôles d'étape restent libres pour les autres
-- coureurs, sauf la place de leader qui lui est réservée tant qu'il est en
-- course. Les chronos continuent d'utiliser directement le rôle général.
create function public.normalize_declared_tour_leader_stage_roles(
  p_race_registration_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_race_edition_id uuid;
  v_race_format text;
  v_leader_rider_id uuid;
begin
  select registration.race_edition_id, race.race_format
  into v_race_edition_id, v_race_format
  from public.race_registrations as registration
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  where registration.id = p_race_registration_id;

  if not found or v_race_format is distinct from 'stage_race' then
    return;
  end if;

  select roster.rider_id
  into v_leader_rider_id
  from public.race_rosters as roster
  where roster.race_registration_id = p_race_registration_id
    and roster.status in ('selected', 'confirmed')
    and roster.race_role = 'leader'
    and not exists (
      select 1
      from public.stage_rider_unavailabilities as unavailable
      where unavailable.race_edition_id = v_race_edition_id
        and unavailable.rider_id = roster.rider_id
    )
  order by roster.rider_id
  limit 1;

  if v_leader_rider_id is null then
    return;
  end if;

  -- L'absence de surcharge fait naturellement retomber le moteur sur le rôle
  -- général. On supprime donc uniquement les anciennes contradictions, sans
  -- toucher aux autres choix tactiques déjà enregistrés.
  delete from public.race_roster_stage_roles as stage_role
  using public.stages as stage
  where stage_role.race_registration_id = p_race_registration_id
    and stage_role.stage_id = stage.id
    and stage.race_edition_id = v_race_edition_id
    and stage.stage_type = 'road'
    and stage.status = 'planned'
    and not exists (
      select 1
      from public.official_stage_simulations as simulation
      where simulation.stage_id = stage.id
    )
    and (
      stage_role.rider_id = v_leader_rider_id
      or stage_role.race_role = 'leader'
    );
end;
$$;

revoke all on function public.normalize_declared_tour_leader_stage_roles(uuid)
from public, anon, authenticated;

create function public.sync_declared_tour_leader_after_roster_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration_id uuid;
  v_leader_changed boolean := false;
begin
  if tg_op = 'INSERT' then
    v_registration_id := new.race_registration_id;
    v_leader_changed :=
      new.race_role = 'leader'
      and new.status in ('selected', 'confirmed');
  elsif tg_op = 'DELETE' then
    v_registration_id := old.race_registration_id;
    v_leader_changed :=
      old.race_role = 'leader'
      and old.status in ('selected', 'confirmed');
  else
    v_registration_id := new.race_registration_id;
    v_leader_changed :=
      (
        old.race_role = 'leader'
        and old.status in ('selected', 'confirmed')
      )
      or (
        new.race_role = 'leader'
        and new.status in ('selected', 'confirmed')
      );
  end if;

  if v_leader_changed then
    perform public.normalize_declared_tour_leader_stage_roles(
      v_registration_id
    );
  end if;

  return null;
end;
$$;

revoke all on function public.sync_declared_tour_leader_after_roster_change()
from public, anon, authenticated;

create trigger race_rosters_sync_declared_tour_leader
after insert or update of race_role, status or delete
on public.race_rosters
for each row
execute function public.sync_declared_tour_leader_after_roster_change();

create function public.enforce_declared_tour_leader_stage_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_race_edition_id uuid;
  v_race_format text;
  v_stage_type text;
  v_leader_rider_id uuid;
begin
  select
    registration.race_edition_id,
    race.race_format,
    stage.stage_type
  into
    v_race_edition_id,
    v_race_format,
    v_stage_type
  from public.race_registrations as registration
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  join public.stages as stage
    on stage.id = new.stage_id
   and stage.race_edition_id = edition.id
  where registration.id = new.race_registration_id;

  if not found
    or v_race_format is distinct from 'stage_race'
    or v_stage_type is distinct from 'road'
  then
    return new;
  end if;

  select roster.rider_id
  into v_leader_rider_id
  from public.race_rosters as roster
  where roster.race_registration_id = new.race_registration_id
    and roster.status in ('selected', 'confirmed')
    and roster.race_role = 'leader'
    and not exists (
      select 1
      from public.stage_rider_unavailabilities as unavailable
      where unavailable.race_edition_id = v_race_edition_id
        and unavailable.rider_id = roster.rider_id
    )
  order by roster.rider_id
  limit 1;

  if v_leader_rider_id is null then
    return new;
  end if;

  if new.rider_id = v_leader_rider_id
    and new.race_role is distinct from 'leader'
  then
    raise exception using
      errcode = 'P0001',
      message = 'Le leader annoncé à l inscription reste leader pendant tout le tour.';
  end if;

  if new.rider_id <> v_leader_rider_id
    and new.race_role = 'leader'
  then
    raise exception using
      errcode = 'P0001',
      message = 'La place de leader est réservée au leader annoncé à l inscription.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_declared_tour_leader_stage_role()
from public, anon, authenticated;

-- Nettoyage ciblé des seules étapes futures : les autres rôles et toute la
-- stratégie collective restent intacts.
do $migration$
declare
  v_registration record;
begin
  for v_registration in
    select distinct registration.id
    from public.race_registrations as registration
    join public.race_editions as edition
      on edition.id = registration.race_edition_id
    join public.races as race
      on race.id = edition.race_id
     and race.race_format = 'stage_race'
    join public.race_rosters as roster
      on roster.race_registration_id = registration.id
     and roster.status in ('selected', 'confirmed')
     and roster.race_role = 'leader'
  loop
    perform public.normalize_declared_tour_leader_stage_roles(
      v_registration.id
    );
  end loop;
end;
$migration$;

create trigger race_roster_stage_roles_lock_declared_tour_leader
before insert or update of race_role, rider_id, stage_id, race_registration_id
on public.race_roster_stage_roles
for each row
execute function public.enforce_declared_tour_leader_stage_role();

comment on function public.normalize_declared_tour_leader_stage_roles(uuid) is
  'Supprime les surcharges futures qui contredisent le leader annoncé pour un tour, sans modifier les autres rôles ni stratégies.';

comment on function public.enforce_declared_tour_leader_stage_role() is
  'Réserve le rôle de leader de chaque étape route au leader déclaré lors de l inscription au tour.';

notify pgrst, 'reload schema';

commit;
