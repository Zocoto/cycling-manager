begin;
set local lock_timeout = '500ms';
set local statement_timeout = '5s';

-- Every preset is an actual 178 km route. The same segments power the preview
-- and the edition, and the traditional hilly route is the fallback.
create function private.national_championship_road_presets()
returns table (preset_key text, profile_type text, profile_variant text, segments jsonb)
language sql immutable set search_path = '' as $$
  select 'flat', 'flat', null::text,
    (select jsonb_agg(jsonb_build_array(
      case when sector = 18 then 8 else 10 end, 'flat', 'asphalt', 0
    ) order by sector) from generate_series(1, 18) as sector)
  union all
  select * from (values
    ('flat_hilly', 'flat', 'flat_hilly',
      '[[24,"flat","asphalt",0],[5,"climb","asphalt",2.8],[5,"descent","asphalt",-2.8],
        [26,"flat","asphalt",0],[5,"climb","asphalt",3.4],[5,"descent","asphalt",-3.4],
        [32,"flat","asphalt",0],[4,"climb","asphalt",3.2],[4,"descent","asphalt",-3.2],
        [38,"flat","asphalt",0],[4,"climb","asphalt",3.5],[4,"descent","asphalt",-3.5],
        [22,"flat","asphalt",0]]'::jsonb),
    ('hilly', 'hilly', null,
      '[[25,"flat","asphalt",0],[12,"climb","asphalt",4.5],[10,"descent","asphalt",-4],
        [30,"flat","asphalt",0],[8,"climb","asphalt",6.5],[8,"descent","asphalt",-6],
        [35,"flat","asphalt",0],[12,"climb","asphalt",5],[38,"flat","asphalt",0]]'::jsonb),
    ('cobbles', 'cobbles', 'selective_cobbles',
      '[[25,"flat","asphalt",0],[8,"flat","cobbles",0],[24,"flat","asphalt",0],
        [8,"flat","cobbles",0],[20,"flat","asphalt",0],[9,"flat","cobbles",0],
        [26,"flat","asphalt",0],[7,"flat","cobbles",0],[24,"flat","asphalt",0],
        [8,"flat","cobbles",0],[19,"flat","asphalt",0]]'::jsonb),
    ('hilly_cobbles', 'hilly', 'hilly_cobbles',
      '[[25,"flat","asphalt",0],[6,"flat","cobbles",0],[6,"climb","cobbles",4],
        [6,"descent","asphalt",-4],[24,"flat","asphalt",0],[8,"flat","cobbles",0],
        [6,"climb","asphalt",5],[6,"descent","asphalt",-5],[24,"flat","asphalt",0],
        [7,"flat","cobbles",0],[7,"climb","cobbles",5.5],[7,"descent","asphalt",-5.5],
        [25,"flat","asphalt",0],[5,"flat","cobbles",0],[16,"flat","asphalt",0]]'::jsonb),
    ('mountain', 'mountain', null,
      '[[20,"flat","asphalt",0],[16,"climb","asphalt",6],[14,"descent","asphalt",-6],
        [16,"flat","asphalt",0],[20,"climb","asphalt",6.5],[16,"descent","asphalt",-6.5],
        [20,"flat","asphalt",0],[12,"climb","asphalt",5.5],[10,"descent","asphalt",-5.5],
        [15,"flat","asphalt",0],[19,"climb","asphalt",7.5]]'::jsonb)
  ) as preset(preset_key, profile_type, profile_variant, segments);
$$;

create table private.national_championship_road_choices (
  country_id uuid not null references public.countries(id),
  target_game_year integer not null check (target_game_year > 1),
  preset_key text not null check (
    preset_key in ('flat', 'flat_hilly', 'hilly', 'cobbles', 'hilly_cobbles', 'mountain')
  ),
  primary key (country_id, target_game_year)
);

-- Widen the already validated variant domain without scanning historic stages.
alter table public.stages
  drop constraint stages_profile_variant_check,
  add constraint stages_profile_variant_check check (
    profile_variant in ('sprint_cobbles', 'selective_cobbles', 'hilly_cobbles', 'flat_hilly')
  ) not valid;

create function public.get_national_championship_road_choice(p_country_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'countryCode', lower(country.iso_alpha2),
    'targetGameYear', season.game_year + 1,
    'currentPreset', coalesce(current_choice.preset_key, 'hilly'),
    'nextPreset', next_choice.preset_key,
    'opensOn', season.ends_on - 6,
    'closesOn', season.ends_on,
    'window', case
      when (now() at time zone 'Europe/Paris')::date < season.ends_on - 6 then 'upcoming'
      when (now() at time zone 'Europe/Paris')::date <= season.ends_on then 'open'
      else 'closed'
    end,
    'viewerIsPresident', exists (
      select 1
      from public.get_current_federation_identity(p_country_code) identity
      join public.national_federation_terms term
        on term.country_id = identity.country_id
        and term.president_director_id = identity.sporting_director_id
      where term.country_id = country.id
        and term.governance_mode = 'elected'
        and season.game_year between term.start_game_year and term.end_game_year
    ),
    'presets', (
      select jsonb_object_agg(preset.preset_key, preset.segments)
      from private.national_championship_road_presets() preset
    )
  )
  from public.countries country
  cross join public.seasons season
  left join private.national_championship_road_choices current_choice
    on current_choice.country_id = country.id and current_choice.target_game_year = season.game_year
  left join private.national_championship_road_choices next_choice
    on next_choice.country_id = country.id and next_choice.target_game_year = season.game_year + 1
  where country.iso_alpha2 = upper(p_country_code)
    and country.is_active
    and season.status = 'active'
    and (select auth.uid()) is not null;
$$;

create function public.save_national_championship_road_choice(
  p_country_code text, p_target_game_year integer, p_preset_key text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_season public.seasons%rowtype;
  v_country_id uuid;
  v_director_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentification requise.';
  end if;

  -- Serialize with rollover. A stale form must never target another season.
  select * into v_season from public.seasons where status = 'active' for share;
  if not found or p_target_game_year is distinct from v_season.game_year + 1 then
    raise exception 'La saison a changé. Rechargez la page.';
  end if;

  select identity.country_id, identity.sporting_director_id into v_country_id, v_director_id
  from public.get_current_federation_identity(p_country_code) identity
  join public.countries country on country.id = identity.country_id and country.is_active;

  perform 1 from public.national_federation_terms term
  where term.country_id = v_country_id
    and term.president_director_id = v_director_id
    and term.governance_mode = 'elected'
    and v_season.game_year between term.start_game_year and term.end_game_year
  for share;
  if not found then
    raise exception 'Seul le président élu peut choisir le profil du championnat national.';
  end if;

  if not exists (
    select 1 from private.national_championship_road_presets() preset
    where preset.preset_key = p_preset_key
  ) then
    raise exception 'Ce profil de course est indisponible.';
  end if;

  if (clock_timestamp() at time zone 'Europe/Paris')::date
    not between v_season.ends_on - 6 and v_season.ends_on
  then
    raise exception 'Le choix du profil est ouvert durant les sept derniers jours de la saison.';
  end if;

  insert into private.national_championship_road_choices (country_id, target_game_year, preset_key)
  values (v_country_id, p_target_game_year, p_preset_key)
  on conflict (country_id, target_game_year) do update set preset_key = excluded.preset_key;
end;
$$;

create function private.get_national_championship_route_reminder(
  p_team_season_id uuid, p_director_id uuid
)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'countryCode', lower(country.iso_alpha2),
    'targetGameYear', season.game_year + 1,
    'closesAt', (season.ends_on + 1)::timestamp at time zone 'Europe/Paris'
  )
  from public.team_seasons team_season
  join public.seasons season on season.id = team_season.season_id and season.status = 'active'
  join public.national_federation_terms term
    on term.country_id = team_season.registration_country_id
    and term.president_director_id = p_director_id
    and term.governance_mode = 'elected'
    and season.game_year between term.start_game_year and term.end_game_year
  join public.countries country on country.id = term.country_id and country.is_active
  where team_season.id = p_team_season_id
    and (now() at time zone 'Europe/Paris')::date between season.ends_on - 6 and season.ends_on
    and not exists (
      select 1 from private.national_championship_road_choices choice
      where choice.country_id = country.id and choice.target_game_year = season.game_year + 1
    )
  order by country.iso_alpha2
  limit 1;
$$;

-- Keep the existing provisioner, including its CLM and registration logic.
-- Only the road stage can acquire a chosen profile, during normal provisioning.
do $migration$
declare
  v_definition text;
  v_declaration text := E'  v_profile_type text;\n';
  v_default text := E'      v_profile_type := ''hilly'';\n';
  v_race_insert text := E'    insert into public.races (\n';
  v_stage_fields text := E'      profile_type,\n      day_slot\n';
  v_stage_values text := E'      v_profile_type,\n      v_day_slot\n';
  v_stage_update text := E'      profile_type = excluded.profile_type,\n';
  v_segments text := E'    if v_kind = ''national_time_trial'' then\n      insert into public.stage_segments (';
begin
  select replace(pg_get_functiondef('public.ensure_national_championship_editions(uuid,uuid)'::regprocedure), chr(13), '')
  into v_definition;
  if position(v_declaration in v_definition) = 0 or position(v_default in v_definition) = 0
    or position(v_race_insert in v_definition) = 0 or position(v_stage_fields in v_definition) = 0
    or position(v_stage_values in v_definition) = 0 or position(v_stage_update in v_definition) = 0
    or position(v_segments in v_definition) = 0
  then
    raise exception 'Unexpected national championship generator; review the route integration.';
  end if;

  v_definition := replace(v_definition, v_declaration, v_declaration ||
    E'  v_road_variant text;\n  v_road_segments jsonb;\n');
  v_definition := replace(v_definition, v_default, v_default || $preset$
      select preset.profile_type, preset.profile_variant, preset.segments
        into v_profile_type, v_road_variant, v_road_segments
      from private.national_championship_road_choices choice
      join private.national_championship_road_presets() preset on preset.preset_key = choice.preset_key
      where choice.country_id = v_country.id and choice.target_game_year = v_season.game_year;
      v_profile_type := coalesce(v_profile_type, 'hilly');
$preset$);
  v_definition := replace(v_definition, v_race_insert, $guard$
    -- Once an active road edition has an entry, results, an official simulation
    -- or a passed departure, preserve its stage and sectors on every retry.
    if v_kind = 'national_road' and (v_season.status not in ('planned', 'active') or exists (
      select 1 from public.races race
      join public.race_editions edition on edition.race_id = race.id and edition.season_id = v_season.id
      join public.stages stage on stage.race_edition_id = edition.id and stage.stage_number = 1
      where race.slug = v_slug
        and (
          edition.status not in ('planned', 'registration_open', 'registration_closed')
          or stage.status <> 'planned'
          or (v_season.status = 'active' and stage.departure_at <= clock_timestamp())
          or exists (select 1 from public.race_registrations entry where entry.race_edition_id = edition.id)
          or exists (select 1 from public.official_stage_simulations simulation where simulation.stage_id = stage.id)
          or exists (select 1 from public.stage_results result where result.stage_id = stage.id)
        )
    )) then
      continue;
    end if;

$guard$ || v_race_insert);
  v_definition := replace(v_definition, v_stage_fields, E'      profile_type,\n      profile_variant,\n      day_slot\n');
  v_definition := replace(v_definition, v_stage_values, E'      v_profile_type,\n      v_road_variant,\n      v_day_slot\n');
  v_definition := replace(v_definition, v_stage_update,
    v_stage_update || E'      profile_variant = case when v_kind = ''national_road'' then excluded.profile_variant else stages.profile_variant end,\n');
  v_definition := replace(v_definition, v_segments, $route$
    if v_road_segments is not null then
      insert into public.stage_segments as current_segment (
        stage_id, segment_number, distance_km, terrain_type, surface_type, average_gradient_pct
      )
      select v_stage_id, sector.number::integer, (sector.data->>0)::numeric,
        sector.data->>1, sector.data->>2, (sector.data->>3)::numeric
      from jsonb_array_elements(v_road_segments) with ordinality as sector(data, number)
      on conflict (stage_id, segment_number) do update set
        distance_km = excluded.distance_km,
        terrain_type = excluded.terrain_type,
        surface_type = excluded.surface_type,
        average_gradient_pct = excluded.average_gradient_pct
      where (current_segment.distance_km, current_segment.terrain_type,
        current_segment.surface_type, current_segment.average_gradient_pct)
        is distinct from (excluded.distance_km, excluded.terrain_type,
          excluded.surface_type, excluded.average_gradient_pct);

      delete from public.stage_segments
      where stage_id = v_stage_id and segment_number > jsonb_array_length(v_road_segments);
    elsif v_kind = 'national_time_trial' then
      insert into public.stage_segments ($route$);
  execute v_definition;
end;
$migration$;

do $migration$
declare
  v_definition text;
  v_anchor text := E'      ''federationSelectionReminder'', (';
begin
  select replace(pg_get_functiondef('public.get_current_dashboard_assistant_summary()'::regprocedure), chr(13), '')
  into v_definition;
  if position(v_anchor in v_definition) = 0 then
    raise exception 'Unexpected dashboard assistant payload; review the CN reminder integration.';
  end if;
  execute replace(v_definition, v_anchor, $reminder$
      'nationalChampionshipRouteReminder', (
        select private.get_national_championship_route_reminder(
          context.team_season_id, context.sporting_director_id
        ) from current_context context
      ),
$reminder$ || v_anchor);
end;
$migration$;

revoke all on table private.national_championship_road_choices from public, anon, authenticated;
revoke all on function private.national_championship_road_presets(),
  private.get_national_championship_route_reminder(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_national_championship_road_choice(text),
  public.save_national_championship_road_choice(text, integer, text) from public, anon;
grant execute on function public.get_national_championship_road_choice(text),
  public.save_national_championship_road_choice(text, integer, text) to authenticated;
notify pgrst, 'reload schema';
commit;
