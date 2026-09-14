begin;

-- The professional Nations Cup is a twenty-rider format with one specialist
-- per nation. Its five races must therefore be short, immediately selective
-- and much more strongly typed than a regular one-day race.
create or replace function public.ensure_professional_nations_cup(
  p_season_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
set statement_timeout = '60s'
as $$
declare
  v_season public.seasons%rowtype;
  v_default_country_id uuid;
  v_host_country_id uuid;
  v_category_id uuid;
  v_day_id uuid;
  v_departure_at timestamptz;
  v_definition record;
  v_race_id uuid;
  v_edition_id uuid;
  v_stage_id uuid;
  v_created integer := 0;
begin
  select * into v_season
  from public.seasons as season
  where season.id = p_season_id;
  if v_season.id is null or v_season.game_year < 3 then return 0; end if;

  select country.id into v_default_country_id
  from public.countries as country
  where country.iso_alpha2 = 'CH' and country.is_active = true;
  select award.country_id into v_host_country_id
  from public.national_federation_hosting_awards as award
  where award.target_game_year = v_season.game_year
    and award.event_type = 'nations_cup_pro'
    and award.status in ('scheduled', 'settled')
  order by award.selected_at desc
  limit 1;
  v_host_country_id := coalesce(v_host_country_id, v_default_country_id);

  select category.id into v_category_id
  from public.race_categories as category
  where category.code = 'world' and category.is_active = true;
  select day.id,
    (day.calendar_date::timestamp + time '18:00') at time zone 'Europe/Paris'
  into v_day_id, v_departure_at
  from public.season_days as day
  where day.season_id = v_season.id and day.day_number = 24;
  if v_default_country_id is null or v_host_country_id is null
     or v_category_id is null or v_day_id is null then
    raise exception 'Impossible de préparer la Nations Cup professionnelle S%.',
      v_season.game_year;
  end if;

  for v_definition in
    select * from (values
      ('nc-mountain', 'nations-cup-montagne', 'Nations Cup · Montagne', 'NC Montagne', 'mountain', 'road', 50::numeric),
      ('nc-hills', 'nations-cup-vallons', 'Nations Cup · Vallons', 'NC Vallons', 'hilly', 'road', 55::numeric),
      ('nc-sprint', 'nations-cup-sprint', 'Nations Cup · Sprint', 'NC Sprint', 'sprint', 'road', 55::numeric),
      ('nc-cobbles', 'nations-cup-paves', 'Nations Cup · Pavés', 'NC Pavés', 'cobbles', 'road', 55::numeric),
      ('nc-time-trial', 'nations-cup-contre-la-montre', 'Nations Cup · Contre-la-montre', 'NC CLM', 'time_trial', 'individual_time_trial', 20::numeric)
    ) as definition(
      slot_key, slug, name, short_name, profile_type, stage_type, distance_km
    )
  loop
    insert into public.races (
      country_id, name, short_name, race_format, status, slug,
      competition_type, championship_continent_code
    ) values (
      v_default_country_id, v_definition.name, v_definition.short_name,
      'one_day', 'active', v_definition.slug, 'nations_cup', null
    )
    on conflict (slug) do update set
      name = excluded.name,
      short_name = excluded.short_name,
      race_format = excluded.race_format,
      status = excluded.status,
      competition_type = excluded.competition_type,
      championship_continent_code = null
    returning id into v_race_id;

    insert into public.race_editions (
      race_id, season_id, race_category_id, edition_number, display_name,
      status, registration_closes_at, withdrawal_closes_at,
      minimum_reputation, registration_policy, field_limit, host_country_id
    ) values (
      v_race_id, v_season.id, v_category_id, greatest(1, v_season.game_year),
      v_definition.name, 'registration_open',
      v_departure_at - interval '24 hours',
      v_departure_at - interval '24 hours',
      0, 'closed', 200, v_host_country_id
    )
    on conflict (race_id, season_id) do update set
      race_category_id = excluded.race_category_id,
      edition_number = excluded.edition_number,
      display_name = excluded.display_name,
      registration_closes_at = excluded.registration_closes_at,
      withdrawal_closes_at = excluded.withdrawal_closes_at,
      minimum_reputation = excluded.minimum_reputation,
      registration_policy = excluded.registration_policy,
      field_limit = excluded.field_limit,
      host_country_id = excluded.host_country_id
    returning id into v_edition_id;

    v_stage_id := null;
    insert into public.stages as target (
      race_edition_id, season_day_id, stage_number, name, stage_type,
      distance_km, status, departure_at, profile_type, day_slot
    ) values (
      v_edition_id, v_day_id, 1, v_definition.name,
      v_definition.stage_type, v_definition.distance_km,
      'planned', v_departure_at, v_definition.profile_type, 'late'
    )
    on conflict (race_edition_id, stage_number) do update set
      season_day_id = excluded.season_day_id,
      name = excluded.name,
      stage_type = excluded.stage_type,
      distance_km = excluded.distance_km,
      departure_at = excluded.departure_at,
      profile_type = excluded.profile_type,
      day_slot = excluded.day_slot
    where target.status = 'planned'
    returning id into v_stage_id;

    -- Never rewrite a result or an already-started simulation. The authored
    -- profiles below are applied to every still-planned edition, including S3.
    if v_stage_id is not null then
      delete from public.stage_segments where stage_id = v_stage_id;
      insert into public.stage_segments (
        stage_id, segment_number, distance_km, terrain_type,
        surface_type, average_gradient_pct
      )
      select
        v_stage_id,
        authored.segment_number,
        authored.distance_km,
        authored.terrain_type,
        authored.surface_type,
        authored.average_gradient_pct
      from (values
        -- Montagne: a short approach followed by one continuous, brutal
        -- fourteen-kilometre summit climb, including 10 km at 10%.
        ('nc-mountain', 1::smallint, 36::numeric, 'flat', 'asphalt', 0::numeric),
        ('nc-mountain', 2::smallint, 4::numeric, 'climb', 'asphalt', 5::numeric),
        ('nc-mountain', 3::smallint, 10::numeric, 'climb', 'asphalt', 10::numeric),

        -- Vallons: four steep efforts with little recovery and a seven-
        -- kilometre uphill finish after the three short ramps.
        ('nc-hills', 1::smallint, 10::numeric, 'flat', 'asphalt', 0::numeric),
        ('nc-hills', 2::smallint, 3::numeric, 'climb', 'asphalt', 7.5::numeric),
        ('nc-hills', 3::smallint, 3::numeric, 'descent', 'asphalt', -6::numeric),
        ('nc-hills', 4::smallint, 8::numeric, 'flat', 'asphalt', 0::numeric),
        ('nc-hills', 5::smallint, 2::numeric, 'climb', 'asphalt', 10::numeric),
        ('nc-hills', 6::smallint, 2::numeric, 'descent', 'asphalt', -7::numeric),
        ('nc-hills', 7::smallint, 8::numeric, 'flat', 'asphalt', 0::numeric),
        ('nc-hills', 8::smallint, 2::numeric, 'climb', 'asphalt', 11::numeric),
        ('nc-hills', 9::smallint, 2::numeric, 'descent', 'asphalt', -7::numeric),
        ('nc-hills', 10::smallint, 8::numeric, 'flat', 'asphalt', 0::numeric),
        ('nc-hills', 11::smallint, 7::numeric, 'climb', 'asphalt', 7.5::numeric),

        -- Sprint: fifty-five uninterrupted kilometres on the flat. The short
        -- distance makes positioning and pure speed decisive.
        ('nc-sprint', 1::smallint, 15::numeric, 'flat', 'asphalt', 0::numeric),
        ('nc-sprint', 2::smallint, 15::numeric, 'flat', 'asphalt', 0::numeric),
        ('nc-sprint', 3::smallint, 15::numeric, 'flat', 'asphalt', 0::numeric),
        ('nc-sprint', 4::smallint, 10::numeric, 'flat', 'asphalt', 0::numeric),

        -- Pavés: thirty-six of fifty-five kilometres on cobbles, with two
        -- rising sectors to prevent the race from becoming a flat sprint.
        ('nc-cobbles', 1::smallint, 7::numeric, 'flat', 'asphalt', 0::numeric),
        ('nc-cobbles', 2::smallint, 7::numeric, 'flat', 'cobbles', 0::numeric),
        ('nc-cobbles', 3::smallint, 4::numeric, 'flat', 'asphalt', 0::numeric),
        ('nc-cobbles', 4::smallint, 6::numeric, 'climb', 'cobbles', 3::numeric),
        ('nc-cobbles', 5::smallint, 4::numeric, 'descent', 'asphalt', -3::numeric),
        ('nc-cobbles', 6::smallint, 8::numeric, 'flat', 'cobbles', 0::numeric),
        ('nc-cobbles', 7::smallint, 4::numeric, 'flat', 'asphalt', 0::numeric),
        ('nc-cobbles', 8::smallint, 7::numeric, 'climb', 'cobbles', 2.5::numeric),
        ('nc-cobbles', 9::smallint, 8::numeric, 'flat', 'cobbles', 0::numeric),

        -- CLM: a twenty-kilometre effort with one sustained rise and a fast
        -- return, short enough to reward explosive time-trial specialists.
        ('nc-time-trial', 1::smallint, 6::numeric, 'flat', 'asphalt', 0::numeric),
        ('nc-time-trial', 2::smallint, 4::numeric, 'climb', 'asphalt', 4.5::numeric),
        ('nc-time-trial', 3::smallint, 3::numeric, 'descent', 'asphalt', -4::numeric),
        ('nc-time-trial', 4::smallint, 7::numeric, 'flat', 'asphalt', 0::numeric)
      ) as authored(
        slot_key, segment_number, distance_km, terrain_type,
        surface_type, average_gradient_pct
      )
      where authored.slot_key = v_definition.slot_key
      order by authored.segment_number;
    end if;
    v_created := v_created + 1;
  end loop;
  return v_created;
end;
$$;

revoke all on function public.ensure_professional_nations_cup(uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_professional_nations_cup(uuid)
  to service_role;

-- Re-author every active or future planned edition now. Completed or running
-- stages are protected by the status guard in the canonical generator.
select public.ensure_due_professional_nations_cup();

comment on function public.ensure_professional_nations_cup(uuid) is
  'Creates the five J24 professional Nations Cup events with short, specialist, twenty-rider race profiles while preserving any edition that has already started.';

commit;
