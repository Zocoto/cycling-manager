begin;

-- Deux courses ne se chevauchent que si au moins une de leurs étapes occupe
-- le même créneau du même jour. Les fonctions sont retouchées de manière
-- ciblée afin de conserver leurs autres garde-fous et leurs correctifs plus
-- récents (capacité, santé, reconnaissance, wild-cards et réparations).
do $migration$
declare
  v_signature regprocedure;
  v_definition text;
  v_patched_definition text;
  v_old_fragment constant text :=
    'on other_stage.season_day_id = target_stage.season_day_id';
  v_new_fragment constant text :=
    'on other_stage.season_day_id = target_stage.season_day_id
     and other_stage.day_slot = target_stage.day_slot';
begin
  foreach v_signature in array array[
    'public.save_current_team_race_roster(uuid,uuid[])'::regprocedure,
    'public.complete_current_team_underfilled_race_roster(uuid,jsonb)'::regprocedure,
    'public.prioritize_national_championship_rider(uuid,uuid)'::regprocedure
  ]
  loop
    select pg_catalog.pg_get_functiondef(v_signature)
    into v_definition;

    v_patched_definition := replace(
      v_definition,
      v_old_fragment,
      v_new_fragment
    );

    if v_patched_definition = v_definition then
      raise exception
        'Le contrôle journalier attendu est introuvable dans %.',
        v_signature;
    end if;

    if v_patched_definition like
      '%other_stage.day_slot = target_stage.day_slot%other_stage.day_slot = target_stage.day_slot%'
    then
      raise exception
        'Plusieurs contrôles ont été modifiés dans %, migration interrompue.',
        v_signature;
    end if;

    execute v_patched_definition;
  end loop;
end;
$migration$;

-- Le socle des disponibilités contient les engagements acceptés. Les couches
-- supérieures continuent d'ajouter sans changement la santé, les stages de
-- forme et la reconnaissance.
do $migration$
declare
  v_signature constant regprocedure :=
    'public.get_current_team_race_roster_options_before_reconnaissance(uuid)'::regprocedure;
  v_definition text;
  v_patched_definition text;
  v_old_fragment constant text :=
    'and other_day.day_number between context.target_start_day and context.target_end_day';
  v_new_fragment constant text :=
    'and exists (
        select 1
        from public.stages as target_stage
        where target_stage.race_edition_id = p_race_edition_id
          and target_stage.season_day_id = other_stage.season_day_id
          and target_stage.day_slot = other_stage.day_slot
      )';
begin
  select pg_catalog.pg_get_functiondef(v_signature)
  into v_definition;

  v_patched_definition := replace(
    v_definition,
    v_old_fragment,
    v_new_fragment
  );

  if v_patched_definition = v_definition then
    raise exception
      'Le contrôle des engagements acceptés est introuvable dans %.',
      v_signature;
  end if;

  execute v_patched_definition;
end;
$migration$;

-- La dernière couche de disponibilité ajoute les demandes de wild-card en
-- attente. Elle doit appliquer exactement la même définition du chevauchement.
do $migration$
declare
  v_signature constant regprocedure :=
    'public.get_current_team_race_roster_options(uuid)'::regprocedure;
  v_definition text;
  v_patched_definition text;
  v_old_fragment constant text :=
    'and target_stage.season_day_id = other_stage.season_day_id';
  v_new_fragment constant text :=
    'and target_stage.season_day_id = other_stage.season_day_id
          and target_stage.day_slot = other_stage.day_slot';
begin
  select pg_catalog.pg_get_functiondef(v_signature)
  into v_definition;

  v_patched_definition := replace(
    v_definition,
    v_old_fragment,
    v_new_fragment
  );

  if v_patched_definition = v_definition then
    raise exception
      'Le contrôle des wild-cards en attente est introuvable dans %.',
      v_signature;
  end if;

  execute v_patched_definition;
end;
$migration$;

-- Les sélections internationales sont prioritaires sur les autres courses,
-- mais uniquement sur leur créneau réel. Les bornes journalières restent
-- utilisées séparément pour l'annulation des stages de forme concurrents.
do $migration$
declare
  v_signature constant regprocedure :=
    'public.prioritize_international_championship_rider_base(uuid,uuid)'::regprocedure;
  v_definition text;
  v_patched_definition text;
  v_old_fragment constant text :=
    'and other_day.day_number between v_target_start_day and v_target_end_day';
  v_new_fragment constant text :=
    'and exists (
          select 1
          from public.stages as target_stage
          where target_stage.race_edition_id = v_selection.race_edition_id
            and target_stage.season_day_id = other_stage.season_day_id
            and target_stage.day_slot = other_stage.day_slot
        )';
begin
  select pg_catalog.pg_get_functiondef(v_signature)
  into v_definition;

  v_patched_definition := replace(
    v_definition,
    v_old_fragment,
    v_new_fragment
  );

  if v_patched_definition = v_definition then
    raise exception
      'Le contrôle de priorité internationale est introuvable dans %.',
      v_signature;
  end if;

  execute v_patched_definition;
end;
$migration$;

-- Ce trigger reste le verrou final face aux requêtes concurrentes. La règle
-- par créneau rend inutiles les exceptions historiques propres aux différents
-- championnats : deux courses early se bloquent, deux courses late aussi.
create or replace function public.enforce_pending_race_roster_conflicts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_target_edition_id uuid;
  v_conflicting_race_name text;
begin
  if new.status not in ('selected', 'confirmed') then
    return new;
  end if;

  select registration.race_edition_id
  into v_target_edition_id
  from public.race_registrations as registration
  where registration.id = new.race_registration_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.rider_id::text, 0)
  );

  select other_edition.display_name
  into v_conflicting_race_name
  from public.race_rosters as other_roster
  join public.race_registrations as other_registration
    on other_registration.id = other_roster.race_registration_id
   and other_registration.status in ('accepted', 'pending')
  join public.race_editions as other_edition
    on other_edition.id = other_registration.race_edition_id
   and other_edition.id <> v_target_edition_id
  where other_roster.rider_id = new.rider_id
    and other_roster.status in ('selected', 'confirmed')
    and exists (
      select 1
      from public.stages as target_stage
      join public.stages as other_stage
        on other_stage.season_day_id = target_stage.season_day_id
       and other_stage.day_slot = target_stage.day_slot
       and other_stage.race_edition_id = other_edition.id
      where target_stage.race_edition_id = v_target_edition_id
    )
  limit 1;

  if v_conflicting_race_name is not null then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Ce coureur est deja reserve pour %s sur le meme creneau.',
        v_conflicting_race_name
      );
  end if;

  return new;
end;
$$;

comment on function public.enforce_pending_race_roster_conflicts() is
  'Bloque les doubles engagements acceptés ou en attente sur le même jour et le même créneau de course.';

comment on function public.save_current_team_race_roster(uuid, uuid[]) is
  'Valide atomiquement la composition verrouillée de l équipe, sa capacité et les conflits de créneaux.';

notify pgrst, 'reload schema';

commit;
