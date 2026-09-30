-- ============================================================
-- Saison 4 : circuit local national (4 classiques + 1 mini-tour),
-- filtrage serveur et garde-fous d'inscription.
-- La saison 3 et ses éditions ne sont jamais modifiées.
-- ============================================================

begin;

insert into public.race_categories (
  code,
  name,
  race_format_scope,
  prestige_rank,
  description,
  is_active,
  minimum_roster_size,
  maximum_roster_size
)
values (
  'local',
  'Local',
  'both',
  6,
  'Circuit national réservé aux équipes enregistrées dans le pays organisateur.',
  true,
  4,
  6
)
on conflict (code)
do update set
  name = excluded.name,
  race_format_scope = excluded.race_format_scope,
  prestige_rank = excluded.prestige_rank,
  description = excluded.description,
  is_active = excluded.is_active,
  minimum_roster_size = excluded.minimum_roster_size,
  maximum_roster_size = excluded.maximum_roster_size;

alter table public.stage_reconnaissances
drop constraint if exists stage_reconnaissances_category_allowed;

alter table public.stage_reconnaissances
add constraint stage_reconnaissances_category_allowed
check (category_code in (
  'elite', 'world', 'continental', 'national', 'regional', 'local'
));

create or replace function public.calculate_stage_reconnaissance_cost(
  p_category_code text,
  p_race_format text
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_race_format not in ('one_day', 'stage_race') then
    raise exception 'Format de course invalide.';
  end if;

  return case p_category_code
    when 'elite' then case p_race_format when 'one_day' then 20000 else 15000 end
    when 'world' then case p_race_format when 'one_day' then 12000 else 9000 end
    when 'continental' then case p_race_format when 'one_day' then 7000 else 5000 end
    when 'national' then case p_race_format when 'one_day' then 4000 else 3000 end
    when 'regional' then case p_race_format when 'one_day' then 2500 else 2000 end
    when 'local' then case p_race_format when 'one_day' then 2500 else 2000 end
    else null
  end;
end;
$$;

create schema if not exists private;

create table if not exists private.local_race_country_catalog (
  country_code text primary key,
  classic_names text[] not null,
  tour_name text not null,
  signature_profile text not null,
  constraint local_race_catalog_classic_count
    check (cardinality(classic_names) = 4),
  constraint local_race_catalog_profile_allowed
    check (signature_profile in ('hilly', 'mountain', 'cobbles'))
);

insert into private.local_race_country_catalog (
  country_code,
  classic_names,
  tour_name,
  signature_profile
)
values
  ('AF', array['د کابل دور','د بامیان چلنج','د هریرود کپ','د پنجشیر کلاسیک'], 'د افغانستان کوچنی تور', 'mountain'),
  ('AM', array['Երևանի շրջան','Սևանի գավաթ','Արարատի դասական','Դիլիջանի ուղի'], 'Հայաստանի փոքր տուր', 'mountain'),
  ('AR', array['Circuito de Córdoba','Copa de Mendoza','Clásica del Litoral','Gran Premio de Salta'], 'Vuelta Federal Argentina', 'mountain'),
  ('AT', array['Wiener Ring','Salzkammergut-Pokal','Tiroler Höhenklassiker','Donau-Sprint'], 'Österreichische Regionenfahrt', 'mountain'),
  ('BE', array['Ronde van Brabant','Waalse Pijlrit','Scheldecircuit','Heuvelland Klassieker'], 'Ronde van de Provincies', 'cobbles'),
  ('BR', array['Circuito de Recife','Copa do Cerrado','Clássica de Florianópolis','Desafio da Serra'], 'Volta das Regiões', 'hilly'),
  ('BS', array['Nassau Criterium','Grand Bahama Classic','Exuma Coastal Race','Andros Island Challenge'], 'Tour of the Family Islands', 'hilly'),
  ('BW', array['Gaborone Circuit','Kalahari Cup','Okavango Classic','Francistown Challenge'], 'Botswana Local Tour', 'hilly'),
  ('CA', array['Circuit de Québec','Coupe des Prairies','Classique de l’Ontario','Défi des Rocheuses'], 'Tour des Provinces Canadiennes', 'mountain'),
  ('CH', array['Zürcher Rundfahrt','Coupe du Léman','Ticino Classica','Alpenpokal'], 'Schweizer Regionenfahrt', 'mountain'),
  ('CO', array['Circuito de Medellín','Copa del Caribe','Clásica Cafetera','Desafío de Boyacá'], 'Vuelta de las Regiones', 'mountain'),
  ('DE', array['Berliner Runde','Hanse-Pokal','Schwarzwald-Klassiker','Rhein-Sprint'], 'Deutsche Regionen-Rundfahrt', 'cobbles'),
  ('DK', array['Københavnerløbet','Jyllands Cykelcup','Fyn Rundt Lokal','Sjællandsklassikeren'], 'Dansk Regiontour', 'cobbles'),
  ('EC', array['Circuito de Quito','Copa del Pacífico','Clásica del Azuay','Desafío de los Andes'], 'Vuelta de las Provincias', 'mountain'),
  ('ES', array['Circuito de Sevilla','Copa de Castilla','Clásica del Cantábrico','Desafío Pirenaico'], 'Vuelta de las Comunidades', 'mountain'),
  ('ET', array['የአዲስ አበባ ዙር','የአዋሳ ዋንጫ','የባሕር ዳር ክላሲክ','የሰሜን ተራሮች ፈተና'], 'የኢትዮጵያ ክልሎች ጉብኝት', 'mountain'),
  ('FR', array['Circuit de Bretagne','Coupe du Limousin','Classique des Vosges','Défi des Alpes'], 'Tour des Régions', 'mountain'),
  ('GB', array['London Circuit','Welsh Valleys Cup','Yorkshire Classic','Scottish Highlands Challenge'], 'Tour of the Counties', 'hilly'),
  ('GR', array['Γύρος Αθήνας','Κύπελλο Πελοποννήσου','Κλασική Μακεδονίας','Πρόκληση Πίνδου'], 'Μικρός Γύρος Ελλάδας', 'mountain'),
  ('IE', array['Dublin Circuit','Munster Cup','Connacht Classic','Wicklow Mountains Challenge'], 'Tour of the Counties of Ireland', 'hilly'),
  ('IT', array['Circuito di Bologna','Coppa delle Marche','Classica del Piemonte','Sfida delle Dolomiti'], 'Giro delle Regioni', 'mountain'),
  ('JP', array['東京サーキット','瀬戸内カップ','北海道クラシック','日本アルプスチャレンジ'], '地方一周ツアー', 'mountain'),
  ('KG', array['Бишкек айлампасы','Ысык-Көл кубогу','Чүй классикасы','Ала-Тоо чакырыгы'], 'Кыргызстандын аймактар туру', 'mountain'),
  ('KP', array['평양 순환경주','동해 컵','함경 클래식','백두산 도전'], '조선 지역 순환경주', 'mountain'),
  ('LS', array['Maseru Circuit','Lowlands Cup','Thaba-Tseka Classic','Maloti Challenge'], 'Lesotho District Tour', 'mountain'),
  ('LU', array['Circuit Lëtzebuerg','Coupe de la Moselle','Classique des Ardennes','Défi de l’Oesling'], 'Tour des Cantons', 'hilly'),
  ('MA', array['Circuit de Casablanca','Coupe du Rif','Classique de l’Atlantique','Défi de l’Atlas'], 'Tour des Régions du Maroc', 'mountain'),
  ('MD', array['Circuitul Chișinăului','Cupa Nistrului','Clasica Orheiului','Provocarea Codrilor'], 'Turul Raioanelor', 'hilly'),
  ('MU', array['Circuit de Port-Louis','Coupe du Nord','Classique du Sud Sauvage','Défi des Hauts Plateaux'], 'Tour des Districts', 'hilly'),
  ('NL', array['Ronde van Utrecht','Friese Beker','Limburgse Klassieker','Veluwe Challenge'], 'Nederlandse Gewestentour', 'cobbles'),
  ('NO', array['Oslo-runden','Vestlandscupen','Trøndelag-klassikeren','Fjellutfordringen'], 'Norsk Regiontour', 'mountain'),
  ('PE', array['Circuito de Lima','Copa de la Costa','Clásica de Arequipa','Desafío de los Andes Peruanos'], 'Vuelta de las Regiones del Perú', 'mountain'),
  ('PK', array['اسلام آباد سرکٹ','سندھ کپ','پنجاب کلاسک','قراقرم چیلنج'], 'پاکستان علاقائی ٹور', 'mountain'),
  ('PL', array['Pętla Warszawska','Puchar Mazur','Klasyk Małopolski','Wyzwanie Tatrzańskie'], 'Tour Regionów Polski', 'hilly'),
  ('PT', array['Circuito de Lisboa','Taça do Alentejo','Clássica do Minho','Desafio da Serra da Estrela'], 'Volta das Regiões de Portugal', 'mountain'),
  ('SN', array['Circuit de Dakar','Coupe du Sine','Classique de Casamance','Défi du Fouta'], 'Tour des Régions du Sénégal', 'hilly'),
  ('SZ', array['Mbabane Circuit','Lowveld Cup','Manzini Classic','Lubombo Challenge'], 'Tour of Eswatini Regions', 'mountain'),
  ('TG', array['Circuit de Lomé','Coupe de la Kara','Classique des Plateaux','Défi de l’Atakora'], 'Tour des Régions du Togo', 'hilly'),
  ('TZ', array['Mzunguko wa Dodoma','Kombe la Zanzibar','Mbio za Kilimanjaro','Changamoto ya Usambara'], 'Ziara ya Mikoa', 'mountain'),
  ('US', array['Boston Circuit','Great Lakes Cup','Pacific Coast Classic','Rocky Mountain Challenge'], 'Tour of the States', 'mountain'),
  ('UY', array['Circuito de Montevideo','Copa del Litoral','Clásica de Colonia','Desafío de las Sierras'], 'Vuelta de los Departamentos', 'hilly'),
  ('VN', array['Vòng đua Hà Nội','Cúp Đồng bằng','Cổ điển Miền Trung','Thử thách Tây Bắc'], 'Tour các Tỉnh Việt Nam', 'mountain')
on conflict (country_code)
do update set
  classic_names = excluded.classic_names,
  tour_name = excluded.tour_name,
  signature_profile = excluded.signature_profile;

create or replace function private.find_free_standard_race_start_day(
  p_season_id uuid,
  p_country_id uuid,
  p_preferred_day integer,
  p_duration integer,
  p_excluded_edition_id uuid default null
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select candidate.start_day
  from generate_series(1, 29 - p_duration) as candidate(start_day)
  where not exists (
    select 1
    from generate_series(
      candidate.start_day,
      candidate.start_day + p_duration - 1
    ) as occupied(day_number)
    join public.season_days as day
      on day.season_id = p_season_id
     and day.day_number = occupied.day_number
    join public.stages as stage
      on stage.season_day_id = day.id
    join public.race_editions as edition
      on edition.id = stage.race_edition_id
     and edition.season_id = p_season_id
     and edition.status <> 'cancelled'
    join public.races as race
      on race.id = edition.race_id
     and race.status = 'active'
     and race.competition_type = 'standard'
     and race.country_id = p_country_id
    where edition.id is distinct from p_excluded_edition_id
  )
  order by abs(candidate.start_day - p_preferred_day), candidate.start_day
  limit 1;
$$;

create or replace function private.ensure_local_race_calendar_for_country(
  p_season_id uuid,
  p_country_id uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_season public.seasons%rowtype;
  v_country public.countries%rowtype;
  v_catalog record;
  v_category_id uuid;
  v_existing_count integer;
  v_event_index integer;
  v_classic_index integer;
  v_stage_number integer;
  v_duration integer;
  v_preferred_day integer;
  v_start_day integer;
  v_day_slot text;
  v_name text;
  v_slug text;
  v_short_name text;
  v_race_format text;
  v_profile text;
  v_distance numeric;
  v_race_id uuid;
  v_edition_id uuid;
  v_stage_id uuid;
  v_day record;
  v_status text;
begin
  select * into v_season
  from public.seasons
  where id = p_season_id;

  if not found or v_season.game_year < 4
    or v_season.status not in ('planned', 'active') then
    return 0;
  end if;

  select * into v_country
  from public.countries
  where id = p_country_id;
  if not found then
    return 0;
  end if;

  select * into v_catalog
  from private.local_race_country_catalog
  where country_code = v_country.iso_alpha2;

  if not found then
    v_catalog := row(
      v_country.iso_alpha2,
      array[
        v_country.name || ' Circuit',
        v_country.name || ' Cup',
        v_country.name || ' Classic',
        v_country.name || ' Challenge'
      ],
      v_country.name || ' Local Tour',
      'hilly'
    );
  end if;

  select count(*)::integer into v_existing_count
  from public.race_editions as edition
  join public.race_categories as category
    on category.id = edition.race_category_id
   and category.code = 'local'
  join public.races as race
    on race.id = edition.race_id
   and race.country_id = p_country_id
  where edition.season_id = p_season_id;

  if v_existing_count >= 5 then
    return 0;
  end if;

  select id into v_category_id
  from public.race_categories
  where code = 'local';

  for v_event_index in 1..5 loop
    v_duration := case when v_event_index = 3 then 3 else 1 end;
    v_preferred_day := case v_event_index
      when 1 then 2 when 2 then 7 when 3 then 12 when 4 then 20 else 26
    end;
    v_classic_index := case
      when v_event_index < 3 then v_event_index
      else v_event_index - 1
    end;
    v_name := case
      when v_event_index = 3 then v_catalog.tour_name
      else v_catalog.classic_names[v_classic_index]
    end;
    v_slug := 'local-' || lower(v_country.iso_alpha2) || case
      when v_event_index = 3 then '-tour'
      else '-classic-' || v_classic_index::text
    end;
    v_short_name := 'L' || upper(v_country.iso_alpha2) || case
      when v_event_index = 3 then 'T' else v_classic_index::text
    end;
    v_race_format := case when v_event_index = 3 then 'stage_race' else 'one_day' end;

    select edition.id into v_edition_id
    from public.race_editions as edition
    join public.races as race on race.id = edition.race_id
    where edition.season_id = p_season_id
      and race.slug = v_slug;

    v_start_day := private.find_free_standard_race_start_day(
      p_season_id,
      p_country_id,
      v_preferred_day,
      v_duration,
      v_edition_id
    );
    if v_start_day is null then
      raise exception 'Aucun créneau local disponible pour % en saison %.',
        v_country.name, v_season.game_year;
    end if;

    insert into public.races (
      country_id, name, short_name, race_format, status, slug,
      competition_type, is_grand_tour
    )
    values (
      p_country_id, v_name, v_short_name, v_race_format, 'active', v_slug,
      'standard', false
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

    v_status := case
      when v_season.status = 'active'
       and v_start_day <= coalesce(v_season.current_day_number, 0)
        then 'cancelled'
      else 'registration_open'
    end;

    insert into public.race_editions as current_edition (
      race_id, season_id, race_category_id, edition_number, display_name,
      status, minimum_reputation, registration_policy, field_limit
    )
    values (
      v_race_id, p_season_id, v_category_id, greatest(1, v_season.game_year),
      v_name, v_status, 0, 'open', 16
    )
    on conflict (race_id, season_id)
    do update set
      race_category_id = excluded.race_category_id,
      display_name = excluded.display_name,
      status = case
        when current_edition.status in ('planned', 'registration_open', 'cancelled')
          then excluded.status
        else current_edition.status
      end,
      minimum_reputation = excluded.minimum_reputation,
      registration_policy = excluded.registration_policy,
      field_limit = excluded.field_limit
    returning id into v_edition_id;

    delete from public.stages
    where race_edition_id = v_edition_id
      and status in ('planned', 'cancelled');

    for v_stage_number in 1..v_duration loop
      select id, calendar_date into v_day
      from public.season_days
      where season_id = p_season_id
        and day_number = v_start_day + v_stage_number - 1;

      v_day_slot := case when (v_event_index + v_stage_number) % 2 = 0
        then 'early' else 'late' end;
      v_profile := case
        when v_event_index = 3 and v_stage_number = 1 then 'sprint'
        when v_event_index = 3 and v_stage_number = 2 then 'hilly'
        when v_event_index = 3 then v_catalog.signature_profile
        when v_classic_index = 1 then 'flat'
        when v_classic_index = 2 then 'hilly'
        when v_classic_index = 3 then 'sprint'
        else v_catalog.signature_profile
      end;
      v_distance := case
        when v_event_index = 3 then (array[104,126,142])[v_stage_number]
        else 112 + v_classic_index * 10
      end;

      insert into public.stages (
        race_edition_id, season_day_id, day_slot, stage_number, name,
        stage_type, distance_km, status, departure_at, profile_type
      )
      values (
        v_edition_id,
        v_day.id,
        v_day_slot,
        v_stage_number,
        case when v_duration = 1 then v_name
          else v_name || ' — ' || v_stage_number::text end,
        'road',
        v_distance,
        case when v_status = 'cancelled' then 'cancelled' else 'planned' end,
        (v_day.calendar_date::timestamp + case v_day_slot
          when 'early' then time '14:00' else time '18:00' end)
          at time zone 'Europe/Paris',
        v_profile
      )
      returning id into v_stage_id;

      insert into public.stage_segments (
        stage_id, segment_number, distance_km, terrain_type,
        surface_type, average_gradient_pct
      )
      select
        v_stage_id,
        segment_number,
        least(10.0, v_distance - ((segment_number - 1) * 10.0)),
        case
          when v_profile = 'mountain' and segment_number >= ceil(v_distance / 10.0) - 3 then 'climb'
          when v_profile in ('mountain', 'hilly') and segment_number % 7 in (2, 3) then 'climb'
          when v_profile in ('mountain', 'hilly') and segment_number % 7 = 4 then 'descent'
          else 'flat'
        end,
        case when v_profile = 'cobbles' and segment_number % 3 <> 0
          then 'cobbles' else 'asphalt' end,
        case
          when v_profile = 'mountain' and segment_number >= ceil(v_distance / 10.0) - 3
            then 6.0 + (segment_number % 3) * 0.7
          when v_profile in ('mountain', 'hilly') and segment_number % 7 in (2, 3)
            then 3.4 + (segment_number % 4) * 0.5
          when v_profile in ('mountain', 'hilly') and segment_number % 7 = 4
            then -(3.0 + (segment_number % 3) * 0.6)
          else 0
        end
      from generate_series(1, ceil(v_distance / 10.0)::integer)
        as generated(segment_number);
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

  return 5;
end;
$$;

create or replace function public.get_current_team_race_access_context()
returns table (
  team_season_id uuid,
  team_country_code text,
  team_continent_code text,
  is_amateur boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    team_season.id,
    country.iso_alpha2,
    country.continent_code,
    not exists (
      select 1
      from public.team_sponsor_contracts as contract
      where contract.team_id = team_season.team_id
        and contract.role = 'principal'
        and contract.status = 'active'
    )
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  join public.countries as country
    on country.id = team_season.registration_country_id
  where director.auth_user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.get_current_team_race_access_context()
from public, anon;
grant execute on function public.get_current_team_race_access_context()
to authenticated;

create or replace function public.get_current_team_visible_calendar_edition_ids(
  p_season_id uuid
)
returns table (race_edition_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with context as (
    select
      team_season.registration_country_id,
      country.continent_code,
      not exists (
        select 1
        from public.team_sponsor_contracts as contract
        where contract.team_id = team_season.team_id
          and contract.role = 'principal'
          and contract.status = 'active'
      ) as is_amateur
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    join public.team_seasons as team_season
      on team_season.team_id = assignment.team_id
     and team_season.season_id = p_season_id
    join public.countries as country
      on country.id = team_season.registration_country_id
    where director.auth_user_id = auth.uid()
    limit 1
  )
  select edition.id
  from public.race_editions as edition
  join public.race_categories as category
    on category.id = edition.race_category_id
  join public.races as race on race.id = edition.race_id
  join public.countries as race_country
    on race_country.id = coalesce(edition.host_country_id, race.country_id)
  cross join context
  where edition.season_id = p_season_id
    and (
      category.code not in ('local', 'regional')
      or (
        category.code = 'local'
        and context.registration_country_id = race_country.id
      )
      or (
        category.code = 'regional'
        and context.is_amateur
        and context.continent_code = race_country.continent_code
      )
    );
$$;

revoke all on function public.get_current_team_visible_calendar_edition_ids(uuid)
from public, anon;
grant execute on function public.get_current_team_visible_calendar_edition_ids(uuid)
to authenticated;

create or replace function public.enforce_restricted_race_registration_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_code text;
  v_race_country_id uuid;
  v_race_continent_code text;
  v_team_country_id uuid;
  v_team_continent_code text;
  v_team_id uuid;
begin
  if new.status not in ('pending', 'accepted') then
    return new;
  end if;

  select
    category.code,
    race_country.id,
    race_country.continent_code,
    team_country.id,
    team_country.continent_code,
    team_season.team_id
  into
    v_category_code,
    v_race_country_id,
    v_race_continent_code,
    v_team_country_id,
    v_team_continent_code,
    v_team_id
  from public.race_editions as edition
  join public.race_categories as category
    on category.id = edition.race_category_id
  join public.races as race on race.id = edition.race_id
  join public.countries as race_country
    on race_country.id = coalesce(edition.host_country_id, race.country_id)
  join public.team_seasons as team_season
    on team_season.id = new.team_season_id
   and team_season.season_id = edition.season_id
  join public.countries as team_country
    on team_country.id = team_season.registration_country_id
  where edition.id = new.race_edition_id;

  if v_category_code = 'local' then
    if v_team_country_id is distinct from v_race_country_id then
      raise exception 'Cette course locale est réservée aux équipes de son pays.';
    end if;
    return new;
  end if;

  if v_category_code is distinct from 'regional' then
    return new;
  end if;

  if exists (
    select 1 from public.team_sponsor_contracts as contract
    where contract.team_id = v_team_id
      and contract.role = 'principal'
      and contract.status = 'active'
  ) then
    raise exception 'Les courses régionales sont réservées aux équipes amateures.';
  end if;

  if v_team_continent_code is null
    or v_race_continent_code is null
    or v_team_continent_code is distinct from v_race_continent_code then
    raise exception 'Cette course régionale est réservée aux équipes amateures de son continent.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_regional_registration_insert
  on public.race_registrations;
drop trigger if exists enforce_regional_registration_update
  on public.race_registrations;
drop trigger if exists enforce_restricted_registration_insert
  on public.race_registrations;
drop trigger if exists enforce_restricted_registration_update
  on public.race_registrations;

create trigger enforce_restricted_registration_insert
before insert on public.race_registrations
for each row
execute function public.enforce_restricted_race_registration_eligibility();

create trigger enforce_restricted_registration_update
before update of race_edition_id, team_season_id, status
on public.race_registrations
for each row
execute function public.enforce_restricted_race_registration_eligibility();

create or replace function public.enforce_restricted_race_reconnaissance_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_code text;
  v_race_country_id uuid;
  v_race_continent_code text;
  v_team_country_id uuid;
  v_team_continent_code text;
  v_team_id uuid;
begin
  select
    category.code,
    race_country.id,
    race_country.continent_code,
    team_country.id,
    team_country.continent_code,
    team_season.team_id
  into
    v_category_code,
    v_race_country_id,
    v_race_continent_code,
    v_team_country_id,
    v_team_continent_code,
    v_team_id
  from public.stages as stage
  join public.race_editions as edition on edition.id = stage.race_edition_id
  join public.race_categories as category on category.id = edition.race_category_id
  join public.races as race on race.id = edition.race_id
  join public.countries as race_country
    on race_country.id = coalesce(edition.host_country_id, race.country_id)
  join public.team_seasons as team_season
    on team_season.id = new.team_season_id
   and team_season.season_id = edition.season_id
  join public.countries as team_country
    on team_country.id = team_season.registration_country_id
  where stage.id = new.target_stage_id;

  if v_category_code = 'local' then
    if v_team_country_id is distinct from v_race_country_id then
      raise exception 'Cette reconnaissance locale est réservée aux équipes de son pays.';
    end if;
    return new;
  end if;

  if v_category_code is distinct from 'regional' then
    return new;
  end if;

  if exists (
    select 1 from public.team_sponsor_contracts as contract
    where contract.team_id = v_team_id
      and contract.role = 'principal'
      and contract.status = 'active'
  ) then
    raise exception 'Les courses régionales sont réservées aux équipes amateures.';
  end if;

  if v_team_continent_code is null
    or v_race_continent_code is null
    or v_team_continent_code is distinct from v_race_continent_code then
    raise exception 'Cette course régionale est réservée aux équipes amateures de son continent.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_regional_reconnaissance_insert
  on public.stage_reconnaissances;
drop trigger if exists enforce_regional_reconnaissance_update
  on public.stage_reconnaissances;
drop trigger if exists enforce_restricted_reconnaissance_insert
  on public.stage_reconnaissances;
drop trigger if exists enforce_restricted_reconnaissance_update
  on public.stage_reconnaissances;

create trigger enforce_restricted_reconnaissance_insert
before insert on public.stage_reconnaissances
for each row
execute function public.enforce_restricted_race_reconnaissance_eligibility();

create trigger enforce_restricted_reconnaissance_update
before update of team_season_id, target_stage_id
on public.stage_reconnaissances
for each row
execute function public.enforce_restricted_race_reconnaissance_eligibility();

create or replace function private.sync_s4_local_calendar_for_team_season()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_year integer;
begin
  select game_year into v_game_year
  from public.seasons
  where id = new.season_id;

  if v_game_year < 4 or new.status not in ('planned', 'active') then
    return new;
  end if;

  perform private.ensure_local_race_calendar_for_country(
    new.season_id,
    new.registration_country_id
  );

  if tg_op = 'UPDATE'
    and old.registration_country_id is distinct from new.registration_country_id then
    update public.race_rosters as roster
    set status = 'withdrawn'
    from public.race_registrations as registration
    join public.race_editions as edition
      on edition.id = registration.race_edition_id
    join public.races as race on race.id = edition.race_id
    join public.race_categories as category
      on category.id = edition.race_category_id
     and category.code = 'local'
    where roster.race_registration_id = registration.id
      and registration.team_season_id = new.id
      and race.country_id = old.registration_country_id
      and registration.status in ('pending', 'accepted')
      and roster.status in ('selected', 'confirmed');

    update public.race_registrations as registration
    set status = 'withdrawn', decided_at = now()
    from public.race_editions as edition,
         public.races as race,
         public.race_categories as category
    where registration.team_season_id = new.id
      and registration.race_edition_id = edition.id
      and edition.race_id = race.id
      and edition.race_category_id = category.id
      and category.code = 'local'
      and race.country_id = old.registration_country_id
      and registration.status in ('pending', 'accepted');
  end if;

  return new;
end;
$$;

drop trigger if exists sync_s4_local_calendar_for_team_season
  on public.team_seasons;
create trigger sync_s4_local_calendar_for_team_season
after insert or update of registration_country_id, status
on public.team_seasons
for each row
execute function private.sync_s4_local_calendar_for_team_season();

do $$
declare
  v_target record;
begin
  for v_target in
    with s4_seasons as (
      select id
      from public.seasons
      where game_year >= 4
        and status in ('planned', 'active')
    ), direct_countries as (
      select distinct season.id as season_id, team_season.registration_country_id
      from s4_seasons as season
      join public.team_seasons as team_season
        on team_season.season_id = season.id
       and team_season.status in ('planned', 'active')
    ), carried_countries as (
      select distinct future.id as season_id, current_team.registration_country_id
      from s4_seasons as future
      join public.seasons as current_season on current_season.status = 'active'
      join public.team_seasons as current_team
        on current_team.season_id = current_season.id
       and current_team.status in ('planned', 'active')
      where not exists (
        select 1 from direct_countries as direct
        where direct.season_id = future.id
      )
    )
    select * from direct_countries
    union
    select * from carried_countries
  loop
    perform private.ensure_local_race_calendar_for_country(
      v_target.season_id,
      v_target.registration_country_id
    );
  end loop;
end;
$$;

create index if not exists race_editions_season_status_category_idx
  on public.race_editions (season_id, status, race_category_id);

create index if not exists race_registrations_edition_status_idx
  on public.race_registrations (race_edition_id, status);

comment on function public.get_current_team_visible_calendar_edition_ids(uuid) is
  'Filtre en base les éditions du calendrier : Locales du pays, Régionales amateures du continent, autres catégories visibles.';

comment on function private.ensure_local_race_calendar_for_country(uuid, uuid) is
  'Crée à partir de la saison 4 quatre classiques et un mini-tour locaux pour un pays actif.';

notify pgrst, 'reload schema';

commit;
