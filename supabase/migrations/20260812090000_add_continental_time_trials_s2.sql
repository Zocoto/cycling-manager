begin;

-- Les CLM continentaux n'existent qu'a partir de la S2. La S1 et ses
-- resultats restent donc strictement inchanges.
alter function public.ensure_international_championship_editions(uuid)
rename to ensure_international_championship_editions_pre_cc_tt_s2;

revoke all
on function public.ensure_international_championship_editions_pre_cc_tt_s2(uuid)
from public, anon, authenticated;

create or replace function public.ensure_continental_time_trial_championships_s2(
  p_season_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season public.seasons%rowtype;
  v_championship record;
  v_host_country_id uuid;
  v_category_id uuid;
  v_day_id uuid;
  v_departure_at timestamptz;
  v_race_id uuid;
  v_edition_id uuid;
  v_stage_id uuid;
  v_distance numeric(6, 2) := 42;
begin
  select season.*
  into v_season
  from public.seasons as season
  where season.id = p_season_id;

  if not found or v_season.game_year < 2 then
    return;
  end if;

  select category.id
  into v_category_id
  from public.race_categories as category
  where category.code = 'continental'
    and category.is_active = true;

  select
    day.id,
    (day.calendar_date::timestamp + interval '14 hours')
      at time zone 'Europe/Paris'
  into v_day_id, v_departure_at
  from public.season_days as day
  where day.season_id = v_season.id
    and day.day_number = 22;

  if v_category_id is null or v_day_id is null then
    raise exception
      'Impossible de preparer les championnats continentaux CLM S2.';
  end if;

  for v_championship in
    select *
    from (
      values
        (
          'africa',
          'ZA',
          'championnats-continentaux-afrique-contre-la-montre',
          'Championnats d''Afrique CLM',
          'CC Afrique CLM'
        ),
        (
          'america',
          'CA',
          'championnats-continentaux-amerique-contre-la-montre',
          'Championnats d''Amerique CLM',
          'CC Amerique CLM'
        ),
        (
          'asia',
          'JP',
          'championnats-continentaux-asie-contre-la-montre',
          'Championnats d''Asie CLM',
          'CC Asie CLM'
        ),
        (
          'europe',
          'CH',
          'championnats-continentaux-europe-contre-la-montre',
          'Championnats d''Europe CLM',
          'CC Europe CLM'
        ),
        (
          'oceania',
          'AU',
          'championnats-continentaux-oceanie-contre-la-montre',
          'Championnats d''Oceanie CLM',
          'CC Oceanie CLM'
        )
    ) as championship(
      continent_code,
      host_country_code,
      slug,
      display_name,
      short_name
    )
  loop
    select country.id
    into v_host_country_id
    from public.countries as country
    where country.iso_alpha2 = v_championship.host_country_code;

    if v_host_country_id is null then
      raise exception
        'Pays hote introuvable pour %.',
        v_championship.display_name;
    end if;

    insert into public.races (
      country_id,
      name,
      short_name,
      race_format,
      status,
      slug,
      competition_type,
      championship_continent_code
    )
    values (
      v_host_country_id,
      v_championship.display_name,
      v_championship.short_name,
      'one_day',
      'active',
      v_championship.slug,
      'continental_championship',
      v_championship.continent_code
    )
    on conflict (slug)
    do update set
      country_id = excluded.country_id,
      name = excluded.name,
      short_name = excluded.short_name,
      race_format = excluded.race_format,
      status = excluded.status,
      competition_type = excluded.competition_type,
      championship_continent_code = excluded.championship_continent_code
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
      v_championship.display_name,
      'registration_open',
      v_departure_at - interval '24 hours',
      v_departure_at - interval '24 hours',
      0,
      'closed',
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
      v_championship.display_name,
      'individual_time_trial',
      v_distance,
      'planned',
      v_departure_at,
      'time_trial',
      'early'
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

    delete from public.stage_segments
    where stage_id = v_stage_id;

    insert into public.stage_segments (
      stage_id,
      segment_number,
      distance_km,
      terrain_type,
      surface_type,
      average_gradient_pct
    )
    select
      v_stage_id,
      generated.segment_number,
      least(6, v_distance - ((generated.segment_number - 1) * 6)),
      case generated.segment_number
        when 3 then 'climb'
        when 4 then 'descent'
        when 6 then 'climb'
        else 'flat'
      end,
      'asphalt',
      case generated.segment_number
        when 3 then 2.4
        when 4 then -2.1
        when 6 then 1.8
        else 0
      end
    from generate_series(1, ceil(v_distance / 6.0)::integer)
      as generated(segment_number);
  end loop;
end;
$$;

revoke all
on function public.ensure_continental_time_trial_championships_s2(uuid)
from public, anon, authenticated;

grant execute
on function public.ensure_continental_time_trial_championships_s2(uuid)
to service_role;

create or replace function public.ensure_international_championship_editions(
  p_season_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.ensure_international_championship_editions_pre_cc_tt_s2(
    p_season_id
  );
  perform public.ensure_continental_time_trial_championships_s2(p_season_id);
end;
$$;

revoke all
on function public.ensure_international_championship_editions(uuid)
from public, anon, authenticated;

grant execute
on function public.ensure_international_championship_editions(uuid)
to service_role;

-- Le CLM de 14 h et la course en ligne de 18 h sont deux creneaux du meme
-- championnat. Un coureur peut disputer les deux sans faux conflit.
create or replace function public.enforce_pending_race_roster_conflicts()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_target_edition_id uuid;
  v_target_competition_type text;
  v_target_continent_code text;
  v_conflicting_race_name text;
begin
  if new.status not in ('selected', 'confirmed') then
    return new;
  end if;

  select
    registration.race_edition_id,
    race.competition_type,
    race.championship_continent_code
  into
    v_target_edition_id,
    v_target_competition_type,
    v_target_continent_code
  from public.race_registrations as registration
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
  join public.races as race
    on race.id = edition.race_id
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
  join public.races as other_race
    on other_race.id = other_edition.race_id
  where other_roster.rider_id = new.rider_id
    and other_roster.status in ('selected', 'confirmed')
    and not (
      (
        v_target_competition_type = 'world_championship'
        and other_race.competition_type = 'world_championship'
      )
      or (
        v_target_competition_type = 'continental_championship'
        and other_race.competition_type = 'continental_championship'
        and other_race.championship_continent_code = v_target_continent_code
      )
    )
    and exists (
      select 1
      from public.stages as target_stage
      join public.stages as other_stage
        on other_stage.season_day_id = target_stage.season_day_id
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

create or replace function public.prioritize_international_championship_rider(
  p_nation_selection_id uuid,
  p_rider_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_competition_type text;
  v_continent_code text;
begin
  select
    race.competition_type,
    race.championship_continent_code
  into v_competition_type, v_continent_code
  from public.international_championship_nation_selections as selection
  join public.race_editions as edition
    on edition.id = selection.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  where selection.id = p_nation_selection_id;

  perform public.prioritize_international_championship_rider_base(
    p_nation_selection_id,
    p_rider_id
  );

  if v_competition_type in (
    'world_championship',
    'continental_championship'
  ) then
    update public.race_rosters as roster
    set status = 'confirmed'
    from public.race_registrations as registration,
         public.race_editions as edition,
         public.races as race,
         public.international_championship_nation_selections as selection,
         public.international_championship_rider_selections as candidate
    where registration.id = roster.race_registration_id
      and edition.id = registration.race_edition_id
      and race.id = edition.race_id
      and race.competition_type = v_competition_type
      and (
        v_competition_type = 'world_championship'
        or race.championship_continent_code = v_continent_code
      )
      and selection.race_edition_id = edition.id
      and candidate.nation_selection_id = selection.id
      and candidate.rider_id = p_rider_id
      and candidate.rider_id = roster.rider_id
      and candidate.is_selected = true
      and candidate.response_status not in (
        'declined',
        'ineligible_injury',
        'unavailable'
      );

    update public.race_registrations as registration
    set
      status = 'accepted',
      decided_at = now()
    where registration.entry_method = 'automatic'
      and exists (
        select 1
        from public.race_editions as edition
        join public.races as race
          on race.id = edition.race_id
        where edition.id = registration.race_edition_id
          and race.competition_type = v_competition_type
          and (
            v_competition_type = 'world_championship'
            or race.championship_continent_code = v_continent_code
          )
      )
      and exists (
        select 1
        from public.race_rosters as roster
        where roster.race_registration_id = registration.id
          and roster.rider_id = p_rider_id
          and roster.status = 'confirmed'
      );
  end if;
end;
$$;

revoke all
on function public.prioritize_international_championship_rider(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.prioritize_international_championship_rider(uuid, uuid)
to service_role;

do $$
declare
  v_season_id uuid;
begin
  for v_season_id in
    select season.id
    from public.seasons as season
    where season.status = 'active'
      and season.game_year >= 2
  loop
    perform public.ensure_continental_time_trial_championships_s2(v_season_id);
  end loop;
end;
$$;

update public.season_events as event
set
  title = 'Championnats continentaux - CLM & course en ligne',
  description = 'A partir de la S2, le CLM continental se dispute a 14 h, puis la course en ligne a 18 h. Les 20 meilleures nations du continent selectionnent huit coureurs specialises selon le profil.'
from public.seasons as season
where season.id = event.season_id
  and season.game_year >= 2
  and event.event_type = 'continental_championships';

commit;
