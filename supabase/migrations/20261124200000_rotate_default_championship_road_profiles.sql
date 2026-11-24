begin;
set local lock_timeout = '500ms';
set local statement_timeout = '8s';

-- Independent cycles, with staggered phases between countries and continents.
create function private.default_championship_road_preset(
  p_game_year integer, p_competition_type text, p_race_key text
)
returns text language sql immutable strict set search_path = '' as $$
  select case when p_game_year < 6 then 'hilly'
    else cycle.profiles[1 + mod(
      p_game_year - 6 + case when p_competition_type = 'continental_championship' then
        coalesce(array_position(array['championnats-continentaux-afrique','championnats-continentaux-amerique',
          'championnats-continentaux-asie','championnats-continentaux-europe','championnats-continentaux-oceanie'],
          p_race_key), 1) - 1
      else get_byte(decode(md5(p_competition_type || ':' || p_race_key), 'hex'), 0) end,
      cardinality(cycle.profiles)
    )] end
  from (values
    ('national_road', array['hilly','flat','mountain','flat_hilly','cobbles']),
    ('world_championship', array['hilly','sprint','mountain','flat_hilly']),
    ('continental_championship', array['hilly','sprint','mountain','flat_hilly','hilly_cobbles','flat'])
  ) as cycle(competition_type, profiles)
  where cycle.competition_type = p_competition_type;
$$;

-- Keep the established stage distance. Add only flat sectors before the last
-- significant approach sector; all climbs, descents and finishes are preserved.
create function private.default_championship_road_segments(p_preset text, p_distance numeric)
returns table (
  segment_number integer, distance_km numeric, terrain_type text,
  surface_type text, average_gradient_pct numeric
)
language sql immutable strict set search_path = '' as $$
  with base as (
    select sector.ordinality as sector_number, (sector.value->>0)::numeric as distance_km,
      sector.value->>1 as terrain_type, sector.value->>2 as surface_type,
      (sector.value->>3)::numeric as average_gradient_pct
    from private.national_championship_road_presets() preset
    cross join lateral jsonb_array_elements(preset.segments) with ordinality sector(value, ordinality)
    where preset.preset_key = case when p_preset = 'sprint' then 'flat' else p_preset end
  ), approach as (
    select sector_number from base
    where terrain_type = 'flat' and surface_type = 'asphalt' and sector_number < (select max(sector_number) from base)
    order by distance_km desc, sector_number desc limit 1
  ), sectors as (
    select sector_number, 0 as extra_number, distance_km, terrain_type, surface_type, average_gradient_pct
    from base
    union all
    select approach.sector_number, extra.number, least(10, p_distance - 178 - (extra.number - 1)*10),
      'flat', 'asphalt', 0
    from approach
    cross join lateral generate_series(1, ceil((p_distance - 178)/10)::integer) as extra(number)
  )
  select row_number() over(order by sector_number, extra_number)::integer,
    distance_km, terrain_type, surface_type, average_gradient_pct from sectors;
$$;

create function private.write_default_championship_road_route(
  p_stage_id uuid, p_preset text, p_distance numeric
)
returns void language plpgsql set search_path = '' as $$
declare
  v_profile text;
  v_variant text;
  v_count integer;
  v_distance numeric;
begin
  select preset.profile_type, preset.profile_variant into v_profile, v_variant
  from private.national_championship_road_presets() preset
  where preset.preset_key = case when p_preset = 'sprint' then 'flat' else p_preset end;
  if p_preset = 'sprint' then v_profile := 'sprint'; end if;
  select count(*), sum(segment.distance_km) into v_count, v_distance
  from private.default_championship_road_segments(p_preset, p_distance) segment;
  if v_profile is null or v_count < 1 or v_distance is distinct from p_distance then
    raise exception 'Invalid championship segments for preset % at distance %', p_preset, p_distance;
  end if;

  update public.stages stage set profile_type = v_profile, profile_variant = v_variant
  where stage.id = p_stage_id
    and (stage.profile_type, stage.profile_variant) is distinct from (v_profile, v_variant);

  insert into public.stage_segments as current_segment
    (stage_id, segment_number, distance_km, terrain_type, surface_type, average_gradient_pct)
  select p_stage_id, segment_number, distance_km, terrain_type, surface_type, average_gradient_pct
  from private.default_championship_road_segments(p_preset, p_distance)
  on conflict (stage_id, segment_number) do update set
    distance_km = excluded.distance_km, terrain_type = excluded.terrain_type,
    surface_type = excluded.surface_type, average_gradient_pct = excluded.average_gradient_pct
  where (current_segment.distance_km, current_segment.terrain_type, current_segment.surface_type,
      current_segment.average_gradient_pct)
    is distinct from (excluded.distance_km, excluded.terrain_type, excluded.surface_type,
      excluded.average_gradient_pct);

  delete from public.stage_segments where stage_id = p_stage_id and segment_number > v_count;
end;
$$;

-- Record the first decision on each planned road edition, even when its
-- existing course must be kept. A generic calendar clone retry must not
-- overwrite a published rotation, a host's route or a president's choice.
create table private.championship_road_rotation_locks (
  race_edition_id uuid primary key references public.race_editions(id) on delete cascade
);

do $provision$
declare
  v_definition text;
  v_cn_choice constant text := $anchor$
      from private.national_championship_road_choices choice
      join private.national_championship_road_presets() preset on preset.preset_key = choice.preset_key
      where choice.country_id = v_country.id and choice.target_game_year = v_season.game_year;$anchor$;
  v_current_choice constant text := $anchor$    'currentPreset', coalesce(current_choice.preset_key, 'hilly'),$anchor$;
  v_cn_safety constant text := '          or exists (select 1 from public.stage_results result where result.stage_id = stage.id)';
  v_edition_insert constant text := '    returning id into v_edition_id;';
  v_international_race constant text := '    returning id into v_race_id;';
  v_international_stage constant text := '    returning id into v_stage_id;';
begin
  select replace(pg_get_functiondef('public.ensure_national_championship_editions(uuid,uuid)'::regprocedure),chr(13),'')
    into v_definition;
  if length(v_definition) - length(replace(v_definition,v_cn_choice,'')) <> length(v_cn_choice)
    or length(v_definition) - length(replace(v_definition,v_cn_safety,'')) <> length(v_cn_safety)
    or length(v_definition) - length(replace(v_definition,v_edition_insert,'')) <> length(v_edition_insert) then
    raise exception 'Unexpected CN choice path; default profiles not installed';
  end if;
  v_definition := replace(v_definition, v_cn_choice, $replacement$
      from private.national_championship_road_presets() preset
      where preset.preset_key = coalesce((
        select choice.preset_key from private.national_championship_road_choices choice
        where choice.country_id = v_country.id and choice.target_game_year = v_season.game_year
      ), case when v_season.game_year >= 6 then
        private.default_championship_road_preset(v_season.game_year, 'national_road', lower(v_country.iso_alpha2))
      end);$replacement$);
  v_definition := replace(v_definition, v_cn_safety, v_cn_safety || $preserve$
          or (v_season.game_year >= 6 and (
            exists (select 1 from public.race_stage_strategies strategy where strategy.stage_id = stage.id)
            or exists (select 1 from public.race_stage_equipment_assignments item where item.stage_id = stage.id)
            or exists (select 1 from public.race_roster_stage_roles role where role.stage_id = stage.id)
            or exists (select 1 from public.stage_reconnaissances recon where recon.target_stage_id = stage.id)
          ))$preserve$);
  execute replace(v_definition, v_edition_insert, v_edition_insert || $preserve$

    -- Keep the planned default road route while still provisioning deadlines.
    -- A valid president's own choice can replace it before entries are made.
    if v_kind = 'national_road' and v_season.game_year >= 6 and exists (
      select 1 from private.championship_road_rotation_locks locked where locked.race_edition_id = v_edition_id
    ) and not exists (
      select 1 from private.national_championship_road_choices choice
      where choice.country_id = v_country.id and choice.target_game_year = v_season.game_year
    ) then
      continue;
    end if;$preserve$);

  select replace(pg_get_functiondef('public.get_national_championship_road_choice(text)'::regprocedure),chr(13),'')
    into v_definition;
  if length(v_definition) - length(replace(v_definition,v_current_choice,'')) <> length(v_current_choice) then
    raise exception 'Unexpected CN preview path; default profiles not installed';
  end if;
  execute replace(v_definition, v_current_choice, $replacement$
    'currentPreset', coalesce((
      select preset.preset_key
      from public.races race
      join public.race_editions edition on edition.race_id = race.id and edition.season_id = season.id
      join public.stages stage on stage.race_edition_id = edition.id and stage.stage_number = 1
      join private.national_championship_road_presets() preset on preset.profile_type = stage.profile_type
        and preset.profile_variant is not distinct from stage.profile_variant
      where race.slug = 'cn-' || lower(country.iso_alpha2) || '-route'
      limit 1
    ), current_choice.preset_key, 'hilly'),
    'defaultNextPreset', private.default_championship_road_preset(
      season.game_year + 1, 'national_road', lower(country.iso_alpha2)
    ),$replacement$);

  -- This is the shared road generator under the independent adult CLM wrappers.
  -- Do not recreate the road stage or its sectors on activation/maintenance retries.
  select replace(pg_get_functiondef('public.ensure_international_championship_editions_base(uuid)'::regprocedure),chr(13),'')
    into v_definition;
  if length(v_definition) - length(replace(v_definition,v_international_race,'')) <> length(v_international_race)
    or length(v_definition) - length(replace(v_definition,v_edition_insert,'')) <> length(v_edition_insert)
    or length(v_definition) - length(replace(v_definition,v_international_stage,'')) <> length(v_international_stage) then
    raise exception 'Unexpected CM/CC road generator; default profiles not installed';
  end if;
  v_definition := replace(v_definition, v_international_race, v_international_race || $preserve$

    if v_season.game_year >= 6 and (
      v_season.status not in ('planned','active') or exists (
        select 1 from public.race_editions edition
        where edition.race_id = v_race_id and edition.season_id = v_season.id
          and edition.status in ('completed','cancelled')
      )
    ) then
      continue;
    end if;$preserve$);
  v_definition := replace(v_definition, v_edition_insert, v_edition_insert || $preserve$

    -- Activation owns the existing deadlines, but the road route was already
    -- frozen during planned provisioning. Only a new stage needs sectors.
    if v_season.game_year >= 6 and exists (
      select 1 from public.stages stage where stage.race_edition_id = v_edition_id and stage.stage_number = 1
    ) then
      continue;
    end if;$preserve$);
  v_definition := replace(v_definition, v_international_stage, v_international_stage || $rotate$

    if v_season.game_year >= 6 then
      perform private.write_default_championship_road_route(
        v_stage_id,
        private.default_championship_road_preset(v_season.game_year, v_championship.competition_type,
          v_championship.slug),
        v_distance
      );
      continue;
    end if;$rotate$);
  execute v_definition;
end;
$provision$;

create function private.apply_planned_championship_road_rotation(
  p_season_id uuid, p_only_legacy boolean
)
returns void language plpgsql set search_path = '' as $planned$
declare
  v_candidate record;
  v_matches boolean;
begin
  perform 1 from public.seasons where id = p_season_id and game_year >= 6 and status = 'planned' for share;
  if not found then return; end if;

  for v_candidate in
    select stage.id, edition.id as edition_id, stage.distance_km, stage.profile_type,
      stage.profile_variant, race.competition_type, season.game_year,
      case race.competition_type when 'national_road' then lower(country.iso_alpha2) else race.slug end as race_key,
      choice.preset_key as cn_choice,
      (stage.status = 'planned' and stage.departure_at > clock_timestamp()
      and edition.status in ('planned','registration_open','registration_closed')
      and edition.host_country_id is null and (not p_only_legacy or not edition.is_neutral_host)
      and stage.distance_km = case race.competition_type
        when 'national_road' then 178 when 'world_championship' then 210 else 190 end
      and (not p_only_legacy or choice.preset_key is null)
      and not exists (select 1 from public.national_federation_hosting_decisions decision
        where decision.target_game_year = season.game_year and decision.event_key = case race.competition_type
          when 'world_championship' then 'world_championship_pro'
          when 'continental_championship' then 'continental_championship_pro:' || race.championship_continent_code end
          and (p_only_legacy or decision.decision = 'hosted'))
      and not exists (select 1 from public.national_federation_hosting_candidacies candidacy
        where candidacy.target_game_year = season.game_year and candidacy.status in ('pending','selected')
          and candidacy.event_key = case race.competition_type
            when 'world_championship' then 'world_championship_pro'
            when 'continental_championship' then 'continental_championship_pro:' || race.championship_continent_code end)
      and not exists (select 1 from public.national_federation_selection_lists list
        join public.countries nation on nation.id = list.country_id
        where list.season_id = season.id and (
          race.competition_type = 'world_championship' and list.slot_key = 'world-pro-road'
          or race.competition_type = 'continental_championship' and list.slot_key = 'cc-pro-road'
            and nation.continent_code = race.championship_continent_code
        ))
      and not exists (select 1 from public.race_registrations entry where entry.race_edition_id = edition.id)
      and not exists (select 1 from public.race_results result where result.race_edition_id = edition.id)
      and not exists (select 1 from public.stage_results result where result.stage_id = stage.id)
      and not exists (select 1 from public.official_stage_simulations simulation where simulation.stage_id = stage.id)
      and not exists (select 1 from public.race_stage_strategies strategy where strategy.stage_id = stage.id)
      and not exists (select 1 from public.race_stage_equipment_assignments item where item.stage_id = stage.id)
      and not exists (select 1 from public.race_roster_stage_roles role where role.stage_id = stage.id)
      and not exists (select 1 from public.stage_reconnaissances recon where recon.target_stage_id = stage.id)
      and not exists (select 1 from public.stage_segments sector
        join public.stage_segment_primes prime on prime.stage_segment_id = sector.id where sector.stage_id = stage.id)
      ) as can_rotate
    from public.stages stage
    join public.race_editions edition on edition.id = stage.race_edition_id
    join public.seasons season on season.id = edition.season_id and season.id = p_season_id
    join public.races race on race.id = edition.race_id
    join public.countries country on country.id = race.country_id
    left join private.national_championship_road_choices choice on race.competition_type = 'national_road'
      and choice.country_id = race.country_id and choice.target_game_year = season.game_year
    where season.game_year >= 6 and season.status = 'planned'
      and stage.stage_number = 1 and stage.stage_type = 'road' and race.race_format = 'one_day'
      and (race.competition_type = 'national_road' and race.slug = 'cn-' || lower(country.iso_alpha2) || '-route'
        or race.competition_type = 'world_championship' and race.slug = 'championnats-du-monde'
        or race.competition_type = 'continental_championship'
             and race.slug in ('championnats-continentaux-afrique','championnats-continentaux-amerique',
               'championnats-continentaux-asie','championnats-continentaux-europe','championnats-continentaux-oceanie'))
      and not exists (select 1 from private.championship_road_rotation_locks locked
        where locked.race_edition_id = edition.id)
    order by stage.id
    for update of stage, edition
  loop
    insert into private.championship_road_rotation_locks(race_edition_id) values (v_candidate.edition_id)
    on conflict (race_edition_id) do nothing;
    if not found or not coalesce(v_candidate.can_rotate, false) then continue; end if;

    v_matches := not p_only_legacy;
    if p_only_legacy and v_candidate.profile_type = 'hilly' and v_candidate.profile_variant is null then
      with previous_default as (
        select * from private.default_championship_road_segments('hilly', 178)
        where v_candidate.competition_type = 'national_road'
        union all
        select number, least(10, v_candidate.distance_km - (number - 1)*10),
          case number % 7 when 2 then 'climb' when 3 then 'climb' when 4 then 'descent'
            when 6 then 'climb' when 0 then 'descent' else 'flat' end, 'asphalt',
          case number % 7 when 2 then 4.2 when 3 then 6.1 when 4 then -5.4 when 6 then 5.2 when 0 then -4.6 else 0 end
        from generate_series(1,ceil(v_candidate.distance_km/10)::integer) as number
        where v_candidate.competition_type <> 'national_road'
      ), actual as (
        select segment_number,distance_km,terrain_type,surface_type,average_gradient_pct
        from public.stage_segments where stage_id = v_candidate.id
      )
      select not exists (
        (select * from actual except select * from previous_default)
        union all
        (select * from previous_default except select * from actual)
      ) into v_matches;
    end if;
    if v_matches then
      perform private.write_default_championship_road_route(
        v_candidate.id,
        coalesce(v_candidate.cn_choice,
          private.default_championship_road_preset(v_candidate.game_year, v_candidate.competition_type, v_candidate.race_key)),
        v_candidate.distance_km
      );
    end if;
  end loop;
end;
$planned$;

do $clone$
declare
  v_definition text;
  v_season_id uuid;
  v_clone_anchor constant text := 'and target_edition.season_id = p_target_season_id';
  v_end_anchor constant text := '  perform public.repair_missing_standard_race_deadlines(p_target_season_id);';
begin
  select replace(pg_get_functiondef('public.provision_season_race_calendar(uuid,uuid)'::regprocedure),chr(13),'')
    into v_definition;
  if length(v_definition) - length(replace(v_definition,v_clone_anchor,'')) <> 3 * length(v_clone_anchor)
    or length(v_definition) - length(replace(v_definition,v_end_anchor,'')) <> length(v_end_anchor) then
    raise exception 'Unexpected calendar clone path; default championship profiles not installed';
  end if;
  v_definition := replace(v_definition, v_clone_anchor, v_clone_anchor ||
    E'\n   and not exists (select 1 from private.championship_road_rotation_locks locked where locked.race_edition_id = target_edition.id)');
  execute replace(v_definition, v_end_anchor, v_end_anchor ||
    E'\n  perform private.apply_planned_championship_road_rotation(p_target_season_id, false);');

  for v_season_id in select id from public.seasons where status = 'planned' and game_year >= 6 order by game_year loop
    perform private.apply_planned_championship_road_rotation(v_season_id, true);
  end loop;
end;
$clone$;

revoke all on table private.championship_road_rotation_locks from public, anon, authenticated;
revoke all on function private.default_championship_road_preset(integer,text,text),
  private.default_championship_road_segments(text,numeric),
  private.write_default_championship_road_route(uuid,text,numeric),
  private.apply_planned_championship_road_rotation(uuid,boolean)
from public, anon, authenticated;
notify pgrst,'reload schema';
commit;
