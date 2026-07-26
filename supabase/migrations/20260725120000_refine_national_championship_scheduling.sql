begin;

-- Les championnats nationaux peuvent désormais utiliser l'un des deux
-- créneaux du jour selon une répartition par nation.

create or replace function public.ensure_national_championship_editions(
  p_country_id uuid,
  p_season_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_country public.countries%rowtype;
  v_season public.seasons%rowtype;
  v_category_id uuid;
  v_kind text;
  v_race_id uuid;
  v_edition_id uuid;
  v_stage_id uuid;
  v_day_number integer;
  v_day_id uuid;
  v_day_slot text;
  v_day_date date;
  v_departure_at timestamptz;
  v_registration_closes_at timestamptz;
  v_slug text;
  v_name text;
  v_short_name text;
  v_profile_type text;
  v_stage_type text;
  v_distance numeric(6, 2);
begin
  select country.*
  into v_country
  from public.countries as country
  where country.id = p_country_id
    and country.is_active = true;

  if not found then
    return;
  end if;

  select season.*
  into v_season
  from public.seasons as season
  where season.id = p_season_id;

  if not found then
    return;
  end if;

  select category.id
  into v_category_id
  from public.race_categories as category
  where category.code = 'national'
    and category.is_active = true;

  if v_category_id is null then
    raise exception 'La catégorie Nationale est introuvable.';
  end if;

  foreach v_kind in array array['national_time_trial', 'national_road']
  loop
    if v_kind = 'national_time_trial' then
      v_day_number := 8;
      v_slug := 'cn-' || lower(v_country.iso_alpha2) || '-clm';
      v_name := 'Championnat de ' || v_country.name || ' - Contre-la-montre';
      v_short_name := 'CN ' || v_country.iso_alpha2 || ' CLM';
      v_profile_type := 'time_trial';
      v_stage_type := 'individual_time_trial';
      v_distance := 38;
    else
      v_day_number := 9;
      v_slug := 'cn-' || lower(v_country.iso_alpha2) || '-route';
      v_name := 'Championnat de ' || v_country.name || ' - Route';
      v_short_name := 'CN ' || v_country.iso_alpha2;
      v_profile_type := 'hilly';
      v_stage_type := 'road';
      v_distance := 178;
    end if;

    v_day_slot := case
      when get_byte(
        decode(md5(v_country.iso_alpha2 || '-' || v_kind), 'hex'),
        0
      ) % 2 = 0
        then 'early'
      else 'late'
    end;

    select
      day.id,
      day.calendar_date
    into v_day_id, v_day_date
    from public.season_days as day
    where day.season_id = v_season.id
      and day.day_number = v_day_number;

    if v_day_id is null then
      raise exception 'La journée J% est absente de la saison %.', v_day_number, v_season.name;
    end if;

    v_departure_at := (
      v_day_date::timestamp
      + case v_day_slot when 'early' then time '14:00' else time '18:00' end
    ) at time zone 'Europe/Paris';

    v_registration_closes_at := (
      v_day_date::timestamp
      + case v_day_slot when 'early' then time '08:00' else time '12:00' end
    ) at time zone 'Europe/Paris';

    insert into public.races (
      country_id,
      name,
      short_name,
      race_format,
      status,
      slug,
      competition_type
    )
    values (
      v_country.id,
      v_name,
      v_short_name,
      'one_day',
      'active',
      v_slug,
      v_kind
    )
    on conflict (slug)
    do update set
      country_id = excluded.country_id,
      name = excluded.name,
      short_name = excluded.short_name,
      race_format = excluded.race_format,
      status = excluded.status,
      competition_type = excluded.competition_type
    returning id into v_race_id;

    insert into public.race_editions (
      race_id,
      season_id,
      race_category_id,
      edition_number,
      display_name,
      status,
      registration_closes_at,
      withdrawal_closes_at,
      minimum_reputation,
      registration_policy,
      field_limit
    )
    values (
      v_race_id,
      v_season.id,
      v_category_id,
      greatest(1, v_season.game_year),
      v_name,
      'registration_open',
      v_registration_closes_at,
      v_registration_closes_at,
      0,
      'open',
      200
    )
    on conflict (race_id, season_id)
    do update set
      race_category_id = excluded.race_category_id,
      edition_number = excluded.edition_number,
      display_name = excluded.display_name,
      registration_closes_at = excluded.registration_closes_at,
      withdrawal_closes_at = excluded.withdrawal_closes_at,
      minimum_reputation = excluded.minimum_reputation,
      registration_policy = excluded.registration_policy,
      field_limit = excluded.field_limit
    returning id into v_edition_id;

    insert into public.stages (
      race_edition_id,
      season_day_id,
      stage_number,
      name,
      stage_type,
      distance_km,
      status,
      departure_at,
      profile_type,
      day_slot
    )
    values (
      v_edition_id,
      v_day_id,
      1,
      v_name,
      v_stage_type,
      v_distance,
      'planned',
      v_departure_at,
      v_profile_type,
      v_day_slot
    )
    on conflict (race_edition_id, stage_number)
    do update set
      season_day_id = excluded.season_day_id,
      name = excluded.name,
      stage_type = excluded.stage_type,
      distance_km = excluded.distance_km,
      departure_at = excluded.departure_at,
      profile_type = excluded.profile_type,
      day_slot = excluded.day_slot
    returning id into v_stage_id;

    if v_kind = 'national_time_trial' then
      insert into public.stage_segments (
        stage_id,
        segment_number,
        distance_km,
        terrain_type,
        surface_type,
        average_gradient_pct
      )
      values
        (v_stage_id, 1, 10, 'flat', 'asphalt', 0),
        (v_stage_id, 2, 10, 'flat', 'asphalt', 0),
        (v_stage_id, 3, 10, 'flat', 'asphalt', 0),
        (v_stage_id, 4, 8, 'flat', 'asphalt', 0)
      on conflict (stage_id, segment_number)
      do update set
        distance_km = excluded.distance_km,
        terrain_type = excluded.terrain_type,
        surface_type = excluded.surface_type,
        average_gradient_pct = excluded.average_gradient_pct;

      delete from public.stage_segments
      where stage_id = v_stage_id
        and segment_number > 4;
    else
      insert into public.stage_segments (
        stage_id,
        segment_number,
        distance_km,
        terrain_type,
        surface_type,
        average_gradient_pct
      )
      values
        (v_stage_id, 1, 25, 'flat', 'asphalt', 0),
        (v_stage_id, 2, 12, 'climb', 'asphalt', 4.5),
        (v_stage_id, 3, 10, 'descent', 'asphalt', -4),
        (v_stage_id, 4, 30, 'flat', 'asphalt', 0),
        (v_stage_id, 5, 8, 'climb', 'asphalt', 6.5),
        (v_stage_id, 6, 8, 'descent', 'asphalt', -6),
        (v_stage_id, 7, 35, 'flat', 'asphalt', 0),
        (v_stage_id, 8, 12, 'climb', 'asphalt', 5),
        (v_stage_id, 9, 38, 'flat', 'asphalt', 0)
      on conflict (stage_id, segment_number)
      do update set
        distance_km = excluded.distance_km,
        terrain_type = excluded.terrain_type,
        surface_type = excluded.surface_type,
        average_gradient_pct = excluded.average_gradient_pct;

      delete from public.stage_segments
      where stage_id = v_stage_id
        and segment_number > 9;
    end if;
  end loop;
end;
$$;

revoke all
on function public.ensure_national_championship_editions(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.ensure_national_championship_editions(uuid, uuid)
to service_role;

-- Recalage des championnats déjà provisionnés sur les créneaux 14 h / 18 h.
with national_edition_slots as (
  select
    edition.id as edition_id,
    day.calendar_date as day_date,
    case
      when get_byte(
        decode(
          md5(country.iso_alpha2 || '-' || race.competition_type),
          'hex'
        ),
        0
      ) % 2 = 0
        then 'early'
      else 'late'
    end as day_slot
  from public.race_editions as edition
  join public.races as race
    on race.id = edition.race_id
  join public.countries as country
    on country.id = race.country_id
  join public.seasons as season
    on season.id = edition.season_id
  join public.stages as stage
    on stage.race_edition_id = edition.id
   and stage.stage_number = 1
  join public.season_days as day
    on day.id = stage.season_day_id
  where season.status in ('active', 'planned')
    and edition.status not in ('completed', 'cancelled')
    and race.competition_type in ('national_road', 'national_time_trial')
), adjusted_deadlines as (
  select
    edition_id,
    (day_date::timestamp
      + case day_slot when 'early' then time '14:00' else time '18:00' end
    ) at time zone 'Europe/Paris' as departure_at,
    (day_date::timestamp
      + case day_slot when 'early' then time '08:00' else time '12:00' end
    ) at time zone 'Europe/Paris' as closes_at,
    day_slot
  from national_edition_slots
)
update public.stages as stage
set
  departure_at = adjusted.departure_at,
  day_slot = adjusted.day_slot
from adjusted_deadlines as adjusted
where stage.race_edition_id = adjusted.edition_id
  and stage.stage_number = 1;

with national_edition_slots as (
  select
    edition.id as edition_id,
    day.calendar_date as day_date,
    case
      when get_byte(
        decode(
          md5(country.iso_alpha2 || '-' || race.competition_type),
          'hex'
        ),
        0
      ) % 2 = 0
        then 'early'
      else 'late'
    end as day_slot
  from public.race_editions as edition
  join public.races as race
    on race.id = edition.race_id
  join public.countries as country
    on country.id = race.country_id
  join public.seasons as season
    on season.id = edition.season_id
  join public.stages as stage
    on stage.race_edition_id = edition.id
   and stage.stage_number = 1
  join public.season_days as day
    on day.id = stage.season_day_id
  where season.status in ('active', 'planned')
    and edition.status not in ('completed', 'cancelled')
    and race.competition_type in ('national_road', 'national_time_trial')
), adjusted_deadlines as (
  select
    edition_id,
    (day_date::timestamp
      + case day_slot when 'early' then time '08:00' else time '12:00' end
    ) at time zone 'Europe/Paris' as closes_at
  from national_edition_slots
)
update public.race_editions as edition
set
  registration_closes_at = adjusted.closes_at,
  withdrawal_closes_at = adjusted.closes_at
from adjusted_deadlines as adjusted
where edition.id = adjusted.edition_id;

-- Rattrapage des championnats nationaux pour toutes les saisons actives :
-- on reconstruit / régénère les éditions CN existantes et on crée celles
-- qui auraient pu manquer (cas d'un correctif appliqué en retard).
do $$
declare
  v_season_id uuid;
  v_country_id uuid;
begin
  for v_season_id in
    select season.id
    from public.seasons as season
    where season.status in ('active', 'planned')
  loop
    for v_country_id in
      select distinct rider.country_id
      from public.riders as rider
      where rider.country_id is not null
    loop
      perform public.ensure_national_championship_editions(
        v_country_id,
        v_season_id
      );
    end loop;
  end loop;
end $$;

comment on function public.ensure_national_championship_editions(uuid, uuid)
  is 'Provisionne/actualise les championnats nationaux par pays avec un créneau AM/PM selon la répartition nationale.';

commit;
