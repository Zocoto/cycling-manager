-- ============================================================
-- Saison 4 : enrichissement des pays peu couverts, prologues et réduction
-- des arrivées de tours en CLM par équipes. Aucun changement en saison 3.
-- ============================================================

begin;

create or replace function private.rebuild_standard_stage_segments(
  p_stage_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stage record;
begin
  select distance_km, profile_type into v_stage
  from public.stages
  where id = p_stage_id;

  if not found then
    return;
  end if;

  delete from public.stage_segments where stage_id = p_stage_id;

  insert into public.stage_segments (
    stage_id, segment_number, distance_km, terrain_type,
    surface_type, average_gradient_pct
  )
  select
    p_stage_id,
    generated.segment_number,
    least(
      10.0,
      v_stage.distance_km - ((generated.segment_number - 1) * 10.0)
    ),
    case
      when v_stage.profile_type = 'mountain'
        and generated.segment_number >= ceil(v_stage.distance_km / 10.0) - 3
        then 'climb'
      when v_stage.profile_type in ('mountain', 'hilly')
        and generated.segment_number % 7 in (2, 3)
        then 'climb'
      when v_stage.profile_type in ('mountain', 'hilly')
        and generated.segment_number % 7 = 4
        then 'descent'
      else 'flat'
    end,
    case
      when v_stage.profile_type = 'cobbles'
        and generated.segment_number % 3 <> 0 then 'cobbles'
      else 'asphalt'
    end,
    case
      when v_stage.profile_type = 'mountain'
        and generated.segment_number >= ceil(v_stage.distance_km / 10.0) - 3
        then 6.1 + (generated.segment_number % 3) * 0.7
      when v_stage.profile_type in ('mountain', 'hilly')
        and generated.segment_number % 7 in (2, 3)
        then 3.5 + (generated.segment_number % 4) * 0.5
      when v_stage.profile_type in ('mountain', 'hilly')
        and generated.segment_number % 7 = 4
        then -(3.1 + (generated.segment_number % 3) * 0.6)
      else 0
    end
  from generate_series(1, ceil(v_stage.distance_km / 10.0)::integer)
    as generated(segment_number);
end;
$$;

create temporary table s4_calendar_seed (
  slug text primary key,
  name text not null,
  short_name text not null,
  country_code text not null,
  category_code text not null,
  race_format text not null,
  preferred_day integer not null,
  stages jsonb not null
) on commit drop;

insert into s4_calendar_seed (
  slug, name, short_name, country_code, category_code,
  race_format, preferred_day, stages
)
values
  ('tour-e-hindukush', 'تور هندوکش', 'TEH', 'AF', 'continental', 'stage_race', 3,
    '[{"type":"prologue","profile":"time_trial","distance":7},{"type":"road","profile":"hilly","distance":132},{"type":"road","profile":"mountain","distance":146}]'),
  ('tour-of-the-pennines', 'Tour of the Pennines', 'TOP', 'GB', 'world', 'stage_race', 4,
    '[{"type":"prologue","profile":"time_trial","distance":8},{"type":"road","profile":"hilly","distance":148},{"type":"road","profile":"mountain","distance":162},{"type":"road","profile":"sprint","distance":154},{"type":"road","profile":"hilly","distance":171}]'),
  ('tour-du-togo', 'Tour du Togo', 'TDTG', 'TG', 'national', 'stage_race', 6,
    '[{"type":"road","profile":"sprint","distance":126},{"type":"road","profile":"hilly","distance":141},{"type":"road","profile":"flat","distance":137}]'),
  ('vuelta-de-los-tepuyes', 'Vuelta de los Tepuyes', 'VLT', 'VE', 'continental', 'stage_race', 9,
    '[{"type":"road","profile":"sprint","distance":143},{"type":"road","profile":"hilly","distance":154},{"type":"road","profile":"mountain","distance":161},{"type":"road","profile":"mountain","distance":149}]'),
  ('tour-des-zagros', 'تور زاگرس', 'TDZ', 'IR', 'world', 'stage_race', 13,
    '[{"type":"road","profile":"hilly","distance":146},{"type":"road","profile":"mountain","distance":158},{"type":"individual_time_trial","profile":"time_trial","distance":22},{"type":"road","profile":"mountain","distance":166}]'),
  ('jarvien-kierros', 'Järvien Kierros', 'JAK', 'FI', 'continental', 'stage_race', 17,
    '[{"type":"prologue","profile":"time_trial","distance":7},{"type":"road","profile":"flat","distance":151},{"type":"road","profile":"hilly","distance":143},{"type":"road","profile":"sprint","distance":159}]'),

  ('bahamas-island-classic', 'Bahamas Island Classic', 'BIC', 'BS', 'national', 'one_day', 3,
    '[{"type":"road","profile":"sprint","distance":156}]'),
  ('lobamba-highlands-classic', 'Lobamba Highlands Classic', 'LHC', 'SZ', 'national', 'one_day', 5,
    '[{"type":"road","profile":"hilly","distance":164}]'),
  ('ala-too-klassikasy', 'Ала-Тоо классикасы', 'ATK', 'KG', 'continental', 'one_day', 8,
    '[{"type":"road","profile":"mountain","distance":178}]'),
  ('baekdusan-sunhwang-gyeongju', '백두산 순환경주', 'BSG', 'KP', 'national', 'one_day', 10,
    '[{"type":"road","profile":"mountain","distance":171}]'),
  ('cupa-codrilor', 'Cupa Codrilor', 'CCD', 'MD', 'national', 'one_day', 12,
    '[{"type":"road","profile":"hilly","distance":166}]'),
  ('maloti-classic', 'Maloti Classic', 'MCL', 'LS', 'national', 'one_day', 15,
    '[{"type":"road","profile":"mountain","distance":174}]'),
  ('klassik-el-aures', 'كلاسيك الأوراس', 'KAU', 'DZ', 'continental', 'one_day', 18,
    '[{"type":"road","profile":"mountain","distance":181}]'),
  ('classique-lagune-ebrie', 'Classique de la Lagune Ébrié', 'CLE', 'CI', 'national', 'one_day', 20,
    '[{"type":"road","profile":"sprint","distance":169}]'),
  ('grand-prix-mont-cameroun', 'Grand Prix du Mont Cameroun', 'GMC', 'CM', 'continental', 'one_day', 22,
    '[{"type":"road","profile":"mountain","distance":183}]'),
  ('abuja-plateau-classic', 'Abuja Plateau Classic', 'APC', 'NG', 'continental', 'one_day', 24,
    '[{"type":"road","profile":"hilly","distance":176}]'),
  ('clasica-del-istmo', 'Clásica del Istmo', 'CDI', 'PA', 'world', 'one_day', 26,
    '[{"type":"road","profile":"hilly","distance":192}]'),
  ('baltijos-kalvu-klasika', 'Baltijos Kalvų Klasika', 'BKK', 'LT', 'national', 'one_day', 28,
    '[{"type":"road","profile":"hilly","distance":172}]');

do $$
declare
  v_seed s4_calendar_seed%rowtype;
  v_season record;
  v_country_id uuid;
  v_category_id uuid;
  v_race_id uuid;
  v_edition_id uuid;
  v_stage_id uuid;
  v_start_day integer;
  v_duration integer;
  v_stage record;
  v_day record;
  v_day_slot text;
  v_stage_type text;
  v_profile text;
  v_distance numeric;
begin
  if (select count(*) from s4_calendar_seed) <> 18 then
    raise exception 'Le renfort international S4 doit contenir 18 courses.';
  end if;
  if (select count(*) from s4_calendar_seed where race_format = 'stage_race') <> 6
    or (select count(*) from s4_calendar_seed where race_format = 'one_day') <> 12 then
    raise exception 'Le renfort international S4 doit contenir 6 tours et 12 classiques.';
  end if;

  if exists (
    select 1
    from s4_calendar_seed as seed
    left join public.countries as country on country.iso_alpha2 = seed.country_code
    left join public.race_categories as category on category.code = seed.category_code
    where country.id is null or category.id is null
  ) then
    raise exception 'Un pays ou une catégorie du renfort S4 est introuvable.';
  end if;

  for v_season in
    select id, game_year
    from public.seasons
    where game_year >= 4 and status in ('planned', 'active')
      and (
        select count(*) from public.season_days
        where season_id = seasons.id
      ) = 28
    order by game_year
  loop
    for v_seed in select * from s4_calendar_seed order by preferred_day, slug
    loop
      select id into v_country_id from public.countries
      where iso_alpha2 = v_seed.country_code;
      select id into v_category_id from public.race_categories
      where code = v_seed.category_code;

      insert into public.races (
        country_id, name, short_name, race_format, status, slug,
        competition_type, is_grand_tour
      )
      values (
        v_country_id, v_seed.name, v_seed.short_name, v_seed.race_format,
        'active', v_seed.slug, 'standard', false
      )
      on conflict (slug)
      do update set
        country_id = excluded.country_id,
        name = excluded.name,
        short_name = excluded.short_name,
        race_format = excluded.race_format,
        status = excluded.status,
        competition_type = excluded.competition_type,
        is_grand_tour = excluded.is_grand_tour
      returning id into v_race_id;

      select id into v_edition_id
      from public.race_editions
      where race_id = v_race_id and season_id = v_season.id;

      v_duration := jsonb_array_length(v_seed.stages);
      v_start_day := private.find_free_standard_race_start_day(
        v_season.id,
        v_country_id,
        v_seed.preferred_day,
        v_duration,
        v_edition_id
      );
      if v_start_day is null then
        raise exception 'Aucun créneau S4 disponible pour %.', v_seed.name;
      end if;

      insert into public.race_editions as current_edition (
        race_id, season_id, race_category_id, edition_number, display_name,
        status, minimum_reputation, registration_policy, field_limit
      )
      values (
        v_race_id, v_season.id, v_category_id, greatest(1, v_season.game_year),
        v_seed.name, 'registration_open',
        case v_seed.category_code when 'world' then 200
          when 'continental' then 100 else 0 end,
        'open', 22
      )
      on conflict (race_id, season_id)
      do update set
        race_category_id = excluded.race_category_id,
        display_name = excluded.display_name,
        status = case
          when current_edition.status in ('planned', 'registration_open')
            then excluded.status
          else current_edition.status
        end,
        minimum_reputation = excluded.minimum_reputation,
        registration_policy = excluded.registration_policy,
        field_limit = excluded.field_limit
      returning id into v_edition_id;

      delete from public.stages
      where race_edition_id = v_edition_id and status = 'planned';

      for v_stage in
        select value as definition, ordinality::integer as stage_number
        from jsonb_array_elements(v_seed.stages) with ordinality
      loop
        select id, calendar_date into v_day
        from public.season_days
        where season_id = v_season.id
          and day_number = v_start_day + v_stage.stage_number - 1;
        v_stage_type := v_stage.definition ->> 'type';
        v_profile := v_stage.definition ->> 'profile';
        v_distance := (v_stage.definition ->> 'distance')::numeric;
        v_day_slot := case when v_stage.stage_number % 2 = 1
          then 'early' else 'late' end;

        insert into public.stages (
          race_edition_id, season_day_id, day_slot, stage_number, name,
          stage_type, distance_km, status, departure_at, profile_type
        )
        values (
          v_edition_id, v_day.id, v_day_slot, v_stage.stage_number,
          case
            when v_seed.race_format = 'one_day' then v_seed.name
            when v_stage_type = 'prologue' then v_seed.name || ' — Prologue'
            else v_seed.name || ' — ' || v_stage.stage_number::text
          end,
          v_stage_type, v_distance, 'planned',
          (v_day.calendar_date::timestamp + case v_day_slot
            when 'early' then time '14:00' else time '18:00' end)
            at time zone 'Europe/Paris',
          v_profile
        )
        returning id into v_stage_id;

        perform private.rebuild_standard_stage_segments(v_stage_id);
      end loop;

      update public.race_editions
      set registration_closes_at = (
            select (day.calendar_date::timestamp + case stage.day_slot
              when 'early' then time '08:00' else time '12:00' end)
              at time zone 'Europe/Paris'
            from public.stages as stage
            join public.season_days as day on day.id = stage.season_day_id
            where stage.race_edition_id = v_edition_id
              and stage.stage_number = 1
          ),
          withdrawal_closes_at = (
            select (day.calendar_date::timestamp + case stage.day_slot
              when 'early' then time '08:00' else time '12:00' end)
              at time zone 'Europe/Paris'
            from public.stages as stage
            join public.season_days as day on day.id = stage.season_day_id
            where stage.race_edition_id = v_edition_id
              and stage.stage_number = 1
          )
      where id = v_edition_id;
    end loop;
  end loop;
end;
$$;

-- Huit prologues sur les quarante tours internationaux/standards de S4
-- (trois nouveaux ci-dessus et cinq tours historiques).
update public.stages as stage
set stage_type = 'prologue',
    profile_type = 'time_trial',
    distance_km = case race.slug
      when 'tour-du-sakura' then 6
      when 'tour-du-saint-laurent' then 8
      when 'tour-du-rift' then 7
      when 'dragon-kingdom-tour' then 6
      when 'route-de-l-atlas' then 8
      else stage.distance_km
    end,
    name = edition.display_name || ' — Prologue'
from public.race_editions as edition,
     public.seasons as season,
     public.races as race
where stage.race_edition_id = edition.id
  and edition.season_id = season.id
  and edition.race_id = race.id
  and season.game_year >= 4
  and season.status in ('planned', 'active')
  and edition.status in ('planned', 'registration_open')
  and stage.status = 'planned'
  and stage.stage_number = 1
  and race.slug in (
    'tour-du-sakura', 'tour-du-saint-laurent', 'tour-du-rift',
    'dragon-kingdom-tour', 'route-de-l-atlas'
  );

-- Trois des cinq anciennes finales en CLM par équipes deviennent une étape
-- individuelle ou en ligne ; seules deux finales TTT sont conservées.
update public.stages as stage
set stage_type = case race.slug
      when 'tour-de-mazovie' then 'individual_time_trial'
      else 'road'
    end,
    profile_type = case race.slug
      when 'tour-de-mazovie' then 'time_trial'
      when 'tour-des-highlands-de-donegal' then 'hilly'
      else 'sprint'
    end,
    distance_km = case race.slug
      when 'tour-de-mazovie' then 24
      when 'tour-des-highlands-de-donegal' then 146
      when 'mekong-delta-tour' then 151
      else stage.distance_km
    end,
    name = case race.slug
      when 'tour-de-mazovie' then edition.display_name || ' — Chrono final'
      when 'tour-des-highlands-de-donegal' then edition.display_name || ' — Finale des Highlands'
      when 'mekong-delta-tour' then edition.display_name || ' — Finale du delta'
      else stage.name
    end
from public.race_editions as edition,
     public.seasons as season,
     public.races as race
where stage.race_edition_id = edition.id
  and edition.season_id = season.id
  and edition.race_id = race.id
  and season.game_year >= 4
  and season.status in ('planned', 'active')
  and edition.status in ('planned', 'registration_open')
  and stage.status = 'planned'
  and (
    (race.slug = 'tour-de-mazovie' and stage.stage_number = 3)
    or (race.slug = 'tour-des-highlands-de-donegal' and stage.stage_number = 5)
    or (race.slug = 'mekong-delta-tour' and stage.stage_number = 4)
  );

do $$
declare
  v_stage record;
begin
  for v_stage in
    select stage.id
    from public.stages as stage
    join public.race_editions as edition on edition.id = stage.race_edition_id
    join public.seasons as season on season.id = edition.season_id
    join public.races as race on race.id = edition.race_id
    where season.game_year >= 4
      and season.status in ('planned', 'active')
      and stage.status = 'planned'
      and (
        (stage.stage_number = 1 and race.slug in (
          'tour-du-sakura', 'tour-du-saint-laurent', 'tour-du-rift',
          'dragon-kingdom-tour', 'route-de-l-atlas'
        ))
        or (race.slug = 'tour-de-mazovie' and stage.stage_number = 3)
        or (race.slug = 'tour-des-highlands-de-donegal' and stage.stage_number = 5)
        or (race.slug = 'mekong-delta-tour' and stage.stage_number = 4)
      )
  loop
    perform private.rebuild_standard_stage_segments(v_stage.id);
  end loop;
end;
$$;

do $$
declare
  v_season record;
begin
  for v_season in
    select id from public.seasons
    where game_year >= 4 and status = 'planned'
      and (
        select count(*) from public.season_days
        where season_id = seasons.id
      ) = 28
  loop
    perform private.normalize_standard_race_country_spacing(v_season.id);
  end loop;
end;
$$;

create or replace function public.get_due_race_job_edition_ids(
  p_clock timestamptz,
  p_mode text
)
returns table (race_edition_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with active_season as (
    select id
    from public.seasons
    where status = 'active'
    limit 1
  ), stage_state as (
    select
      edition.id as race_edition_id,
      edition.status as edition_status,
      race.slug,
      race.competition_type,
      stage.status as stage_status,
      stage.departure_at,
      stage.departure_at + make_interval(mins => greatest(
        8,
        least(48, round(stage.distance_km / 6.0)::integer)
      )) as estimated_finish_at
    from active_season
    join public.race_editions as edition
      on edition.season_id = active_season.id
     and edition.status <> 'cancelled'
    join public.races as race on race.id = edition.race_id
    join public.stages as stage
      on stage.race_edition_id = edition.id
     and stage.status <> 'cancelled'
  ), repairable as (
    select incomplete.race_edition_id
    from active_season
    cross join lateral public.get_incomplete_completed_race_edition_ids(
      active_season.id
    ) as incomplete
  )
  select distinct state.race_edition_id
  from stage_state as state
  where (
    p_mode = 'simulation'
    and state.departure_at <= p_clock
    and state.estimated_finish_at > p_clock
    and state.stage_status <> 'completed'
    and (
      state.slug = 'criterium-de-namur'
      or exists (
        select 1
        from public.race_registrations as registration
        join public.race_rosters as roster
          on roster.race_registration_id = registration.id
         and roster.status in ('selected', 'confirmed')
        where registration.race_edition_id = state.race_edition_id
          and registration.status = 'accepted'
      )
    )
  ) or (
    p_mode = 'settlement'
    and (
      exists (
        select 1
        from stage_state as unfinished
        where unfinished.race_edition_id = state.race_edition_id
          and unfinished.estimated_finish_at <= p_clock
          and unfinished.stage_status <> 'completed'
      )
      or (
        state.edition_status <> 'completed'
        and not exists (
          select 1
          from stage_state as pending
          where pending.race_edition_id = state.race_edition_id
            and pending.estimated_finish_at > p_clock
        )
      )
      or exists (
        select 1 from repairable
        where repairable.race_edition_id = state.race_edition_id
      )
    )
  );
$$;

revoke all on function public.get_due_race_job_edition_ids(timestamptz, text)
from public, anon, authenticated;
grant execute on function public.get_due_race_job_edition_ids(timestamptz, text)
to service_role;

comment on function public.get_due_race_job_edition_ids(timestamptz, text) is
  'Préfiltre en base les éditions réellement dues pour les crons de simulation et de règlement.';

comment on function private.rebuild_standard_stage_segments(uuid) is
  'Reconstruit un profil de segments léger et déterministe après modification d’une étape planifiée.';

commit;
