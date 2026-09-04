begin;

-- À partir de la S3, aucune journée internationale (CC, Nations Cup ou CM)
-- ne doit partager sa date avec une course Elite. Les identifiants d'étapes,
-- les inscriptions, les compositions et les préparations sont conservés :
-- seules les dates et leurs échéances dépendantes sont déplacées.

create temporary table s3_international_calendar_moves
on commit drop
as
select
  stage.id as stage_id,
  edition.id as race_edition_id,
  race.slug as race_slug,
  race.competition_type,
  stage.stage_type,
  case
    when race.competition_type = 'continental_championship' then 15
    else 28
  end::smallint as target_day_number,
  case
    when race.competition_type = 'continental_championship'
      then stage.day_slot
    else 'early'
  end::text as target_day_slot
from public.stages as stage
join public.race_editions as edition
  on edition.id = stage.race_edition_id
join public.races as race
  on race.id = edition.race_id
join public.seasons as season
  on season.id = edition.season_id
where season.game_year = 3
  and (
    race.competition_type = 'continental_championship'
    or race.slug = 'mur-de-catalogne'
  )
  and stage.status = 'planned'
  and edition.status not in ('in_progress', 'completed', 'cancelled')
  and not exists (
    select 1
    from public.stage_results as result
    where result.stage_id = stage.id
  )
  and not exists (
    select 1
    from public.official_stage_simulations as simulation
    where simulation.stage_id = stage.id
  );

do $$
begin
  if (select count(*) from s3_international_calendar_moves) <> 11 then
    raise exception
      'Le déplacement S3 exige dix étapes continentales et le Mur de Catalogne intacts.';
  end if;

  if (
    select count(*)
    from s3_international_calendar_moves
    where competition_type = 'continental_championship'
      and stage_type = 'individual_time_trial'
      and target_day_slot = 'early'
  ) <> 5 then
    raise exception 'Les cinq CLM continentaux S3 doivent rester à 14 h.';
  end if;

  if (
    select count(*)
    from s3_international_calendar_moves
    where competition_type = 'continental_championship'
      and stage_type = 'road'
      and target_day_slot = 'late'
  ) <> 5 then
    raise exception 'Les cinq courses en ligne continentales S3 doivent rester à 18 h.';
  end if;

  if (
    select count(*)
    from s3_international_calendar_moves
    where race_slug = 'mur-de-catalogne'
      and target_day_number = 28
      and target_day_slot = 'early'
  ) <> 1 then
    raise exception 'Le Mur de Catalogne S3 doit être déplaçable en J28 à 14 h.';
  end if;

  if exists (
    select 1
    from s3_international_calendar_moves as move
    left join public.season_days as target_day
      on target_day.season_id = (
        select edition.season_id
        from public.race_editions as edition
        where edition.id = move.race_edition_id
      )
     and target_day.day_number = move.target_day_number
    where target_day.id is null
  ) then
    raise exception 'Une journée cible du calendrier S3 est introuvable.';
  end if;
end;
$$;

update public.stages as stage
set
  season_day_id = target_day.id,
  day_slot = move.target_day_slot,
  departure_at = (
    target_day.calendar_date::timestamp
    + case move.target_day_slot
        when 'early' then time '14:00'
        else time '18:00'
      end
  ) at time zone 'Europe/Paris'
from s3_international_calendar_moves as move
join public.race_editions as edition
  on edition.id = move.race_edition_id
join public.season_days as target_day
  on target_day.season_id = edition.season_id
 and target_day.day_number = move.target_day_number
where stage.id = move.stage_id;

-- Les quatre fiches CC, pros comme juniors, partagent désormais J15.
update public.national_federation_selection_slots
set day_number = 15
where competition_code in (
  'continental_championship',
  'continental_championship_junior'
);

do $$
begin
  if (
    select count(*)
    from public.national_federation_selection_slots
    where competition_code in (
      'continental_championship',
      'continental_championship_junior'
    )
      and day_number = 15
  ) <> 4 then
    raise exception 'Les quatre créneaux fédéraux CC doivent être positionnés en J15.';
  end if;
end;
$$;

-- Le repère global du calendrier suit les courses et les convocations.
update public.season_events as event
set season_day_id = target_day.id
from public.season_days as current_day
join public.seasons as season
  on season.id = current_day.season_id
 and season.game_year = 3
join public.season_days as target_day
  on target_day.season_id = season.id
 and target_day.day_number = 15
where event.season_day_id = current_day.id
  and event.event_type = 'continental_championships';

-- Une modification de date doit déplacer les trois gels associés sans toucher
-- aux inscriptions ou aux coureurs déjà rattachés à l'édition.
with affected_editions as (
  select distinct move.race_edition_id
  from s3_international_calendar_moves as move
), first_stages as (
  select distinct on (stage.race_edition_id)
    stage.race_edition_id,
    race.competition_type,
    category.code as category_code,
    stage.departure_at,
    (
      day.calendar_date::timestamp
      + case stage.day_slot
          when 'early' then time '08:00'
          else time '12:00'
        end
    ) at time zone 'Europe/Paris' as roster_closes_at
  from public.stages as stage
  join affected_editions as affected
    on affected.race_edition_id = stage.race_edition_id
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  join public.race_categories as category
    on category.id = edition.race_category_id
  join public.season_days as day
    on day.id = stage.season_day_id
  order by stage.race_edition_id, stage.stage_number
)
update public.race_editions as edition
set
  registration_closes_at = case
    when first_stage.competition_type in (
      'continental_championship', 'world_championship'
    ) then first_stage.departure_at - interval '24 hours'
    else first_stage.roster_closes_at
  end,
  withdrawal_closes_at = case
    when first_stage.competition_type in (
      'continental_championship', 'world_championship'
    ) then first_stage.departure_at - interval '24 hours'
    else first_stage.roster_closes_at
  end,
  wildcard_closes_at = case
    when first_stage.category_code = 'elite'
      then first_stage.departure_at - interval '24 hours'
    else edition.wildcard_closes_at
  end
from first_stages as first_stage
where edition.id = first_stage.race_edition_id;

-- Les anciens générateurs contiennent encore des journées codées en dur.
-- Ce trigger fait de la table des créneaux fédéraux la source de vérité et
-- protège aussi les saisons créées après cette migration.
create or replace function public.enforce_international_elite_stage_calendar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_year integer;
  v_race_slug text;
  v_competition_type text;
  v_category_code text;
  v_target_day_number smallint;
  v_target_day_id uuid;
  v_target_calendar_date date;
  v_day_number smallint;
begin
  select
    season.game_year,
    race.slug,
    race.competition_type,
    category.code
  into
    v_game_year,
    v_race_slug,
    v_competition_type,
    v_category_code
  from public.race_editions as edition
  join public.seasons as season on season.id = edition.season_id
  join public.races as race on race.id = edition.race_id
  join public.race_categories as category
    on category.id = edition.race_category_id
  where edition.id = new.race_edition_id;

  if coalesce(v_game_year, 0) < 3 then
    return new;
  end if;

  if v_race_slug = 'mur-de-catalogne' then
    v_target_day_number := 28;
    new.day_slot := 'early';
  elsif v_competition_type in (
    'continental_championship',
    'world_championship',
    'nations_cup'
  ) then
    select min(slot.day_number)::smallint
    into v_target_day_number
    from public.national_federation_selection_slots as slot
    where slot.competition_code = v_competition_type
      and slot.rider_category = 'professional'
      and slot.active_from_game_year <= v_game_year
      and (
        v_competition_type = 'nations_cup'
        or (
          new.stage_type = 'individual_time_trial'
          and lower(slot.profile_label) = 'chrono'
        )
        or (
          new.stage_type <> 'individual_time_trial'
          and lower(slot.profile_label) <> 'chrono'
        )
      );

    if v_target_day_number is not null
      and v_competition_type in (
        'continental_championship', 'world_championship'
      )
    then
      new.day_slot := case
        when new.stage_type = 'individual_time_trial' then 'early'
        else 'late'
      end;
    end if;
  end if;

  if v_target_day_number is not null then
    select day.id, day.calendar_date
    into v_target_day_id, v_target_calendar_date
    from public.season_days as day
    join public.race_editions as edition
      on edition.season_id = day.season_id
    where edition.id = new.race_edition_id
      and day.day_number = v_target_day_number;

    if v_target_day_id is null then
      raise exception
        'La journée internationale J% est absente de la saison %.',
        v_target_day_number,
        v_game_year;
    end if;

    new.season_day_id := v_target_day_id;
    new.departure_at := (
      v_target_calendar_date::timestamp
      + case new.day_slot
          when 'early' then time '14:00'
          else time '18:00'
        end
    ) at time zone 'Europe/Paris';
  end if;

  if v_category_code = 'elite' then
    select day.day_number
    into v_day_number
    from public.season_days as day
    where day.id = new.season_day_id;

    if exists (
      select 1
      from public.national_federation_selection_slots as slot
      where slot.active_from_game_year <= v_game_year
        and slot.day_number = v_day_number
    ) then
      raise exception
        'Une course Elite ne peut pas être programmée en J%, réservé aux CC, à la Nations Cup ou aux CM.',
        v_day_number;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_international_elite_stage_calendar_trigger
  on public.stages;
create trigger enforce_international_elite_stage_calendar_trigger
before insert or update of
  race_edition_id, season_day_id, departure_at, day_slot, stage_type
on public.stages
for each row
execute function public.enforce_international_elite_stage_calendar();

-- Les échéances sont recalculées après tout futur déplacement d'étape Elite
-- ou internationale, y compris lorsqu'un ancien ensure_* tente J22.
create or replace function public.refresh_schedule_dependent_edition_deadlines()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_edition_ids uuid[];
  v_edition_id uuid;
  v_competition_type text;
  v_category_code text;
  v_departure_at timestamptz;
  v_roster_closes_at timestamptz;
begin
  if tg_op = 'DELETE' then
    v_edition_ids := array[old.race_edition_id];
  elsif tg_op = 'UPDATE'
    and old.race_edition_id is distinct from new.race_edition_id
  then
    v_edition_ids := array[old.race_edition_id, new.race_edition_id];
  else
    v_edition_ids := array[new.race_edition_id];
  end if;

  foreach v_edition_id in array v_edition_ids loop
    select race.competition_type, category.code
    into v_competition_type, v_category_code
    from public.race_editions as edition
    join public.races as race on race.id = edition.race_id
    join public.race_categories as category
      on category.id = edition.race_category_id
    where edition.id = v_edition_id;

    if v_category_code is distinct from 'elite'
      and coalesce(v_competition_type, '') not in (
        'continental_championship', 'world_championship', 'nations_cup'
      )
    then
      continue;
    end if;

    select
      stage.departure_at,
      (
        day.calendar_date::timestamp
        + case stage.day_slot
            when 'early' then time '08:00'
            else time '12:00'
          end
      ) at time zone 'Europe/Paris'
    into v_departure_at, v_roster_closes_at
    from public.stages as stage
    join public.season_days as day on day.id = stage.season_day_id
    where stage.race_edition_id = v_edition_id
    order by stage.stage_number
    limit 1;

    if v_departure_at is null then
      continue;
    end if;

    update public.race_editions as edition
    set
      registration_closes_at = case
        when v_competition_type in (
          'continental_championship', 'world_championship', 'nations_cup'
        ) then v_departure_at - interval '24 hours'
        else v_roster_closes_at
      end,
      withdrawal_closes_at = case
        when v_competition_type in (
          'continental_championship', 'world_championship', 'nations_cup'
        ) then v_departure_at - interval '24 hours'
        else v_roster_closes_at
      end,
      wildcard_closes_at = case
        when v_category_code = 'elite'
          then v_departure_at - interval '24 hours'
        else edition.wildcard_closes_at
      end
    where edition.id = v_edition_id;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists refresh_schedule_dependent_edition_deadlines_trigger
  on public.stages;
create trigger refresh_schedule_dependent_edition_deadlines_trigger
after insert or update of
  race_edition_id, season_day_id, departure_at, day_slot, stage_type
or delete
on public.stages
for each row
execute function public.refresh_schedule_dependent_edition_deadlines();

-- Empêche aussi de transformer après coup une édition déjà placée sur une
-- journée internationale en course Elite.
create or replace function public.guard_elite_edition_international_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_year integer;
  v_category_code text;
  v_conflicting_day smallint;
begin
  select season.game_year, category.code
  into v_game_year, v_category_code
  from public.seasons as season
  join public.race_categories as category on category.id = new.race_category_id
  where season.id = new.season_id;

  if coalesce(v_game_year, 0) < 3 or v_category_code <> 'elite' then
    return new;
  end if;

  select day.day_number
  into v_conflicting_day
  from public.stages as stage
  join public.season_days as day on day.id = stage.season_day_id
  where stage.race_edition_id = new.id
    and exists (
      select 1
      from public.national_federation_selection_slots as slot
      where slot.active_from_game_year <= v_game_year
        and slot.day_number = day.day_number
    )
  limit 1;

  if v_conflicting_day is not null then
    raise exception
      'L’édition Elite ne peut pas rester en J%, réservé au programme international.',
      v_conflicting_day;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_elite_edition_international_day_trigger
  on public.race_editions;
create trigger guard_elite_edition_international_day_trigger
before insert or update of race_category_id, season_id
on public.race_editions
for each row
execute function public.guard_elite_edition_international_day();

-- Les repères généraux des CC et CM suivent eux aussi la table officielle.
create or replace function public.align_international_season_event_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season_id uuid;
  v_game_year integer;
  v_competition_code text;
  v_target_day smallint;
  v_target_day_id uuid;
begin
  if new.event_type not in (
    'continental_championships', 'world_championships'
  ) then
    return new;
  end if;

  select day.season_id, season.game_year
  into v_season_id, v_game_year
  from public.season_days as day
  join public.seasons as season on season.id = day.season_id
  where day.id = new.season_day_id;

  if coalesce(v_game_year, 0) < 3 then
    return new;
  end if;

  v_competition_code := case new.event_type
    when 'continental_championships' then 'continental_championship'
    else 'world_championship'
  end;

  select min(slot.day_number)::smallint
  into v_target_day
  from public.national_federation_selection_slots as slot
  where slot.competition_code = v_competition_code
    and slot.rider_category = 'professional'
    and slot.active_from_game_year <= v_game_year;

  if v_target_day is not null then
    select day.id into v_target_day_id
    from public.season_days as day
    where day.season_id = v_season_id
      and day.day_number = v_target_day;
    new.season_day_id := coalesce(v_target_day_id, new.season_day_id);
  end if;

  return new;
end;
$$;

drop trigger if exists align_international_season_event_day_trigger
  on public.season_events;
create trigger align_international_season_event_day_trigger
before insert or update of season_day_id, event_type
on public.season_events
for each row
execute function public.align_international_season_event_day();

-- Les compétitions juniors utilisent un calendrier séparé. Le trigger est
-- installé avant leur arrivée afin qu'un futur générateur encore codé en J22
-- adopte automatiquement J15, sans modifier son moteur ni ses résultats.
create or replace function public.align_development_international_calendar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_year integer;
  v_competition_code text;
  v_profile_label text;
  v_target_day smallint;
begin
  select season.game_year into v_game_year
  from public.seasons as season
  where season.id = new.season_id;

  if coalesce(v_game_year, 0) < 3
    or new.competition_type not in (
      'continental_road', 'continental_time_trial',
      'world_road', 'world_time_trial'
    )
  then
    return new;
  end if;

  v_competition_code := case
    when new.competition_type like 'continental_%'
      then 'continental_championship_junior'
    else 'world_championship_junior'
  end;
  v_profile_label := case
    when new.competition_type like '%time_trial' then 'Chrono'
    else 'Route'
  end;

  select min(slot.day_number)::smallint
  into v_target_day
  from public.national_federation_selection_slots as slot
  where slot.competition_code = v_competition_code
    and slot.rider_category = 'junior'
    and slot.profile_label = v_profile_label
    and slot.active_from_game_year <= v_game_year;

  if v_target_day is not null then
    new.start_day_number := v_target_day;
    new.end_day_number := v_target_day;
  end if;

  return new;
end;
$$;

drop trigger if exists align_development_international_calendar_trigger
  on public.development_race_editions;
create trigger align_development_international_calendar_trigger
before insert or update of
  season_id, competition_type, start_day_number, end_day_number
on public.development_race_editions
for each row
execute function public.align_development_international_calendar();

-- Une modification de créneau est refusée si elle recrée un conflit Elite,
-- puis propagée aux courses pros, aux repères et au calendrier junior.
create or replace function public.guard_international_selection_slot_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conflicting_season text;
begin
  select season.name
  into v_conflicting_season
  from public.stages as stage
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.race_categories as category
    on category.id = edition.race_category_id
   and category.code = 'elite'
  join public.season_days as day
    on day.id = stage.season_day_id
   and day.day_number = new.day_number
  join public.seasons as season
    on season.id = edition.season_id
   and season.game_year >= new.active_from_game_year
   and season.status in ('active', 'planned')
  where stage.status = 'planned'
    and edition.status not in ('completed', 'cancelled')
  limit 1;

  if v_conflicting_season is not null then
    raise exception
      'J% contient déjà une course Elite dans %.',
      new.day_number,
      v_conflicting_season;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_international_selection_slot_day_trigger
  on public.national_federation_selection_slots;
create trigger guard_international_selection_slot_day_trigger
before insert or update of day_number, active_from_game_year
on public.national_federation_selection_slots
for each row
execute function public.guard_international_selection_slot_day();

create or replace function public.apply_international_selection_slot_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.rider_category = 'professional'
    and new.competition_code in (
      'continental_championship', 'world_championship', 'nations_cup'
    )
  then
    update public.stages as stage
    set season_day_id = stage.season_day_id
    from public.race_editions as edition,
         public.races as race,
         public.seasons as season
    where edition.id = stage.race_edition_id
      and race.id = edition.race_id
      and race.competition_type = new.competition_code
      and season.id = edition.season_id
      and season.game_year >= new.active_from_game_year
      and season.status in ('active', 'planned')
      and (
        new.competition_code = 'nations_cup'
        or (
          new.profile_label = 'Chrono'
          and stage.stage_type = 'individual_time_trial'
        )
        or (
          new.profile_label <> 'Chrono'
          and stage.stage_type <> 'individual_time_trial'
        )
      );
  elsif new.rider_category = 'junior'
    and new.competition_code in (
      'continental_championship_junior', 'world_championship_junior'
    )
  then
    update public.development_race_editions as edition
    set
      start_day_number = new.day_number,
      end_day_number = new.day_number,
      updated_at = now()
    from public.seasons as season
    where season.id = edition.season_id
      and season.game_year >= new.active_from_game_year
      and season.status in ('active', 'planned')
      and edition.competition_type = case
        when new.competition_code = 'continental_championship_junior'
          and new.profile_label = 'Chrono' then 'continental_time_trial'
        when new.competition_code = 'continental_championship_junior'
          then 'continental_road'
        when new.profile_label = 'Chrono' then 'world_time_trial'
        else 'world_road'
      end;

    update public.development_race_stages as stage
    set day_number = edition.start_day_number
    from public.development_race_editions as edition
    join public.seasons as season on season.id = edition.season_id
    where stage.race_edition_id = edition.id
      and season.game_year >= new.active_from_game_year
      and season.status in ('active', 'planned')
      and edition.competition_type = case
        when new.competition_code = 'continental_championship_junior'
          and new.profile_label = 'Chrono' then 'continental_time_trial'
        when new.competition_code = 'continental_championship_junior'
          then 'continental_road'
        when new.profile_label = 'Chrono' then 'world_time_trial'
        else 'world_road'
      end;
  end if;

  return new;
end;
$$;

drop trigger if exists apply_international_selection_slot_day_trigger
  on public.national_federation_selection_slots;
create trigger apply_international_selection_slot_day_trigger
after insert or update of day_number, active_from_game_year
on public.national_federation_selection_slots
for each row
execute function public.apply_international_selection_slot_day();

-- Contrat final du calendrier validé. La migration est annulée en bloc si un
-- autre changement recrée une collision ou déplace indirectement la Ruta.
do $$
begin
  if exists (
    select 1
    from public.stages as stage
    join public.race_editions as edition
      on edition.id = stage.race_edition_id
    join public.race_categories as category
      on category.id = edition.race_category_id
     and category.code = 'elite'
    join public.season_days as day on day.id = stage.season_day_id
    join public.seasons as season
      on season.id = edition.season_id
     and season.game_year >= 3
     and season.status in ('active', 'planned')
    where stage.status = 'planned'
      and edition.status not in ('completed', 'cancelled')
      and exists (
        select 1
        from public.national_federation_selection_slots as slot
        where slot.active_from_game_year <= season.game_year
          and slot.day_number = day.day_number
      )
  ) then
    raise exception 'Une collision Elite / CC-NC-CM subsiste à partir de la S3.';
  end if;

  if (
    select count(*)
    from public.stages as stage
    join public.race_editions as edition
      on edition.id = stage.race_edition_id
    join public.races as race
      on race.id = edition.race_id
     and race.competition_type = 'continental_championship'
    join public.seasons as season
      on season.id = edition.season_id
     and season.game_year = 3
    join public.season_days as day
      on day.id = stage.season_day_id
     and day.day_number = 15
  ) <> 10 then
    raise exception 'Les dix épreuves continentales S3 ne sont pas toutes en J15.';
  end if;

  if (
    select count(*)
    from public.season_events as event
    join public.season_days as day
      on day.id = event.season_day_id
     and day.day_number = 15
    join public.seasons as season
      on season.id = day.season_id
     and season.game_year = 3
    where event.event_type = 'continental_championships'
  ) <> 1 then
    raise exception 'Le repère des championnats continentaux S3 doit être en J15.';
  end if;

  if (
    select count(*)
    from public.national_federation_selection_slots as slot
    where (
      slot.competition_code in (
        'continental_championship', 'continental_championship_junior'
      )
      and slot.day_number = 15
    )
      or (slot.competition_code = 'nations_cup' and slot.day_number = 24)
      or (
        slot.competition_code in (
          'world_championship', 'world_championship_junior'
        )
        and slot.day_number = 26
      )
  ) <> 13 then
    raise exception 'Les treize créneaux CC, Nations Cup et CM sont incohérents.';
  end if;

  if (
    select count(*)
    from public.stages as stage
    join public.race_editions as edition
      on edition.id = stage.race_edition_id
    join public.races as race
      on race.id = edition.race_id
     and race.competition_type = 'world_championship'
    join public.seasons as season
      on season.id = edition.season_id
     and season.game_year = 3
    join public.season_days as day
      on day.id = stage.season_day_id
     and day.day_number = 26
  ) <> 2 then
    raise exception 'Les deux épreuves mondiales pros S3 doivent rester en J26.';
  end if;

  if (
    select count(*)
    from public.stages as stage
    join public.race_editions as edition
      on edition.id = stage.race_edition_id
    join public.races as race
      on race.id = edition.race_id
     and race.slug = 'mur-de-catalogne'
    join public.seasons as season
      on season.id = edition.season_id
     and season.game_year = 3
    join public.season_days as day
      on day.id = stage.season_day_id
     and day.day_number = 28
    where stage.day_slot = 'early'
  ) <> 1 then
    raise exception 'Le Mur de Catalogne S3 doit être en J28 à 14 h.';
  end if;

  if (
    select count(*)
    from public.stages as stage
    join public.race_editions as edition
      on edition.id = stage.race_edition_id
    join public.races as race
      on race.id = edition.race_id
     and race.slug = 'grand-prix-du-littoral'
    join public.seasons as season
      on season.id = edition.season_id
     and season.game_year = 3
    join public.season_days as day
      on day.id = stage.season_day_id
     and day.day_number = 28
    where stage.day_slot = 'late'
  ) <> 1 then
    raise exception 'Le Grand Prix du Littoral S3 doit rester en J28 à 18 h.';
  end if;

  if (
    select count(*)
    from public.stages as stage
    join public.race_editions as edition
      on edition.id = stage.race_edition_id
    join public.races as race
      on race.id = edition.race_id
     and race.slug = 'ruta-de-las-sierras'
    join public.seasons as season
      on season.id = edition.season_id
     and season.game_year = 3
    join public.season_days as day on day.id = stage.season_day_id
    where day.day_number between 17 and 22
  ) <> 12 then
    raise exception 'Les douze étapes de la Ruta S3 doivent rester de J17 à J22.';
  end if;

  if (
    select count(*)
    from public.stages as stage
    join public.race_editions as edition
      on edition.id = stage.race_edition_id
    join public.races as race
      on race.id = edition.race_id
     and race.slug = 'desert-to-sky-classic'
    join public.seasons as season
      on season.id = edition.season_id
     and season.game_year = 3
    join public.season_days as day
      on day.id = stage.season_day_id
     and day.day_number = 22
    where stage.day_slot = 'late'
  ) <> 1 then
    raise exception 'Desert to Sky S3 doit rester en J22 à 18 h.';
  end if;
end;
$$;

revoke all on function public.enforce_international_elite_stage_calendar()
  from public, anon, authenticated;
revoke all on function public.refresh_schedule_dependent_edition_deadlines()
  from public, anon, authenticated;
revoke all on function public.guard_elite_edition_international_day()
  from public, anon, authenticated;
revoke all on function public.align_international_season_event_day()
  from public, anon, authenticated;
revoke all on function public.align_development_international_calendar()
  from public, anon, authenticated;
revoke all on function public.guard_international_selection_slot_day()
  from public, anon, authenticated;
revoke all on function public.apply_international_selection_slot_day()
  from public, anon, authenticated;

comment on function public.enforce_international_elite_stage_calendar() is
  'Aligne les CC/CM/NC et le Mur de Catalogne sur le calendrier S3 validé, puis bloque toute collision Elite.';
comment on function public.align_development_international_calendar() is
  'Aligne les championnats juniors S3+ sur les journées de sélection fédérales.';

notify pgrst, 'reload schema';

commit;
