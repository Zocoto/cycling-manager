-- ============================================================
-- Courses régionales : sept épreuves par continent, réservées aux équipes
-- amateures inscrites sur le même continent que le pays organisateur.
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
  'regional',
  'Régional',
  'both',
  5,
  'Courses locales réservées aux équipes amateures du continent organisateur.',
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

update public.race_categories
set description = 'Épreuves continentales de niveau intermédiaire.'
where code = 'continental';

alter table public.stage_reconnaissances
drop constraint if exists stage_reconnaissances_category_allowed;

alter table public.stage_reconnaissances
add constraint stage_reconnaissances_category_allowed
check (category_code in ('elite', 'world', 'continental', 'national', 'regional'));

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
    else null
  end;
end;
$$;

create temporary table regional_race_seed (
  slug text primary key,
  name text not null,
  short_name text not null,
  country_code text not null,
  continent_code text not null check (
    continent_code in ('africa', 'america', 'asia', 'europe', 'oceania')
  ),
  day_number smallint not null check (day_number between 1 and 28),
  day_slot text not null check (day_slot in ('early', 'late')),
  profile_type text not null check (
    profile_type in ('flat', 'sprint', 'hilly', 'mountain', 'cobbles')
  ),
  distance_km numeric(6, 2) not null check (distance_km > 0)
) on commit drop;

insert into regional_race_seed (
  slug,
  name,
  short_name,
  country_code,
  continent_code,
  day_number,
  day_slot,
  profile_type,
  distance_km
)
values
  -- Afrique
  ('circuit-du-lac-rose', 'Circuit du Lac Rose', 'CLR', 'SN', 'africa', 4, 'early', 'flat', 142),
  ('gold-coast-classic', 'Gold Coast Classic', 'GCC', 'GH', 'africa', 8, 'late', 'sprint', 148),
  ('ronde-des-collines-de-kampala', 'Ronde des Collines de Kampala', 'RCK', 'UG', 'africa', 12, 'early', 'hilly', 151),
  ('criterium-du-nil', 'Critérium du Nil', 'CDN2', 'EG', 'africa', 16, 'late', 'flat', 146),
  ('classica-da-baia-de-maputo', 'Clássica da Baía de Maputo', 'CBM', 'MZ', 'africa', 20, 'early', 'sprint', 154),
  ('copperbelt-challenge', 'Copperbelt Challenge', 'CBC', 'ZM', 'africa', 24, 'late', 'hilly', 157),
  ('kalahari-regional-classic', 'Kalahari Regional Classic', 'KRC', 'BW', 'africa', 28, 'early', 'flat', 150),

  -- Amérique
  ('volta-do-cerrado', 'Volta do Cerrado', 'VDC', 'BR', 'america', 4, 'early', 'hilly', 156),
  ('clasica-de-oaxaca', 'Clásica de Oaxaca', 'CDO', 'MX', 'america', 8, 'late', 'mountain', 164),
  ('circuito-de-la-costa-verde', 'Circuito de la Costa Verde', 'CCV', 'PE', 'america', 12, 'early', 'sprint', 149),
  ('ruta-de-los-volcanes', 'Ruta de los Volcanes', 'RLV', 'EC', 'america', 16, 'late', 'mountain', 168),
  ('vuelta-de-la-banda-oriental', 'Vuelta de la Banda Oriental', 'VBO', 'UY', 'america', 20, 'early', 'flat', 158),
  ('gran-premio-de-guanacaste', 'Gran Premio de Guanacaste', 'GPG', 'CR', 'america', 24, 'late', 'hilly', 153),
  ('clasica-del-lago-atitlan', 'Clásica del Lago Atitlán', 'CLA', 'GT', 'america', 28, 'early', 'mountain', 162),

  -- Asie
  ('deccan-plateau-classic', 'Deccan Plateau Classic', 'DPC', 'IN', 'asia', 4, 'early', 'hilly', 159),
  ('tour-de-l-isan', 'Tour de l’Isan', 'TDI', 'TH', 'asia', 8, 'late', 'sprint', 152),
  ('langkawi-regional-challenge', 'Langkawi Regional Challenge', 'LRC', 'MY', 'asia', 12, 'early', 'mountain', 166),
  ('luzon-coastal-classic', 'Luzon Coastal Classic', 'LCC', 'PH', 'asia', 16, 'late', 'sprint', 155),
  ('islamabad-hills-trophy', 'Islamabad Hills Trophy', 'IHT', 'PK', 'asia', 20, 'early', 'hilly', 161),
  ('steppe-d-oulan-bator', 'Steppe d’Oulan-Bator', 'SOB', 'MN', 'asia', 24, 'late', 'flat', 158),
  ('route-de-samarcande', 'Route de Samarcande', 'RDS', 'UZ', 'asia', 28, 'early', 'hilly', 160),

  -- Europe
  ('velika-nagrada-de-la-soca', 'Velika Nagrada de la Soča', 'VNS', 'SI', 'europe', 4, 'early', 'hilly', 157),
  ('trophee-des-tatras', 'Trophée des Tatras', 'TDT', 'SK', 'europe', 8, 'late', 'mountain', 165),
  ('classique-des-carpates-ukrainiennes', 'Classique des Carpates ukrainiennes', 'CCU', 'UA', 'europe', 12, 'early', 'mountain', 169),
  ('ronde-de-sumadija', 'Ronde de Šumadija', 'RDSU', 'RS', 'europe', 16, 'late', 'hilly', 158),
  ('circuit-de-la-neretva', 'Circuit de la Neretva', 'CLN', 'BA', 'europe', 20, 'early', 'hilly', 154),
  ('boucle-des-rhodopes', 'Boucle des Rhodopes', 'BDR', 'BG', 'europe', 24, 'late', 'mountain', 167),
  ('classique-du-peloponnese', 'Classique du Péloponnèse', 'CDP2', 'GR', 'europe', 28, 'early', 'hilly', 162),

  -- Océanie
  ('fiji-coral-coast-classic', 'Fiji Coral Coast Classic', 'FCCC', 'FJ', 'oceania', 4, 'early', 'sprint', 146),
  ('highlands-of-papua-challenge', 'Highlands of Papua Challenge', 'HPC', 'PG', 'oceania', 8, 'late', 'mountain', 160),
  ('solomon-islands-coastal-race', 'Solomon Islands Coastal Race', 'SICR', 'SB', 'oceania', 12, 'early', 'flat', 148),
  ('vanuatu-volcano-classic', 'Vanuatu Volcano Classic', 'VVC', 'VU', 'oceania', 16, 'late', 'hilly', 152),
  ('tour-d-upolu', 'Tour d’Upolu', 'TDU', 'WS', 'oceania', 20, 'early', 'hilly', 150),
  ('tonga-royal-circuit', 'Tonga Royal Circuit', 'TRC', 'TO', 'oceania', 24, 'late', 'sprint', 145),
  ('caledonia-lagoon-classic', 'Caledonia Lagoon Classic', 'CLC', 'NC', 'oceania', 28, 'early', 'flat', 153);

do $$
declare
  v_continent text;
begin
  if (select count(*) from regional_race_seed) <> 35 then
    raise exception 'Le calendrier régional doit contenir exactement 35 courses.';
  end if;

  foreach v_continent in array array['africa', 'america', 'asia', 'europe', 'oceania']
  loop
    if (
      select count(*)
      from regional_race_seed
      where continent_code = v_continent
    ) <> 7 then
      raise exception 'Le continent % doit disposer de sept courses régionales.', v_continent;
    end if;
  end loop;

  if exists (
    select 1
    from regional_race_seed as seed
    left join public.countries as country
      on country.iso_alpha2 = seed.country_code
     and country.continent_code = seed.continent_code
    where country.id is null
  ) then
    raise exception 'Un pays régional est absent du bon continent.';
  end if;
end;
$$;

insert into public.races (
  country_id,
  name,
  short_name,
  race_format,
  status,
  slug,
  competition_type,
  is_grand_tour
)
select
  country.id,
  seed.name,
  seed.short_name,
  'one_day',
  'active',
  seed.slug,
  'standard',
  false
from regional_race_seed as seed
join public.countries as country
  on country.iso_alpha2 = seed.country_code
on conflict (slug)
do update set
  country_id = excluded.country_id,
  name = excluded.name,
  short_name = excluded.short_name,
  race_format = excluded.race_format,
  status = excluded.status,
  competition_type = excluded.competition_type,
  is_grand_tour = excluded.is_grand_tour;

insert into public.race_editions as current_edition (
  race_id,
  season_id,
  race_category_id,
  edition_number,
  display_name,
  status,
  minimum_reputation,
  registration_policy,
  field_limit
)
select
  race.id,
  season.id,
  category.id,
  greatest(1, season.game_year),
  seed.name,
  case
    when season.status = 'active'
      and seed.day_number <= coalesce(season.current_day_number, 0)
      then 'cancelled'
    else 'registration_open'
  end,
  0,
  'open',
  16
from regional_race_seed as seed
join public.races as race
  on race.slug = seed.slug
cross join public.seasons as season
cross join public.race_categories as category
where season.status in ('active', 'planned')
  and category.code = 'regional'
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
  field_limit = excluded.field_limit;

insert into public.stages as current_stage (
  race_edition_id,
  season_day_id,
  day_slot,
  stage_number,
  name,
  stage_type,
  distance_km,
  status,
  departure_at,
  profile_type
)
select
  edition.id,
  season_day.id,
  seed.day_slot,
  1,
  seed.name,
  'road',
  seed.distance_km,
  case
    when season.status = 'active'
      and seed.day_number <= coalesce(season.current_day_number, 0)
      then 'cancelled'
    else 'planned'
  end,
  (
    season_day.calendar_date::timestamp
    + case seed.day_slot
        when 'early' then time '14:00'
        else time '18:00'
      end
  ) at time zone 'Europe/Paris',
  seed.profile_type
from regional_race_seed as seed
join public.races as race
  on race.slug = seed.slug
join public.race_editions as edition
  on edition.race_id = race.id
join public.seasons as season
  on season.id = edition.season_id
 and season.status in ('active', 'planned')
join public.season_days as season_day
  on season_day.season_id = season.id
 and season_day.day_number = seed.day_number
on conflict (race_edition_id, stage_number)
do update set
  season_day_id = excluded.season_day_id,
  day_slot = excluded.day_slot,
  name = excluded.name,
  stage_type = excluded.stage_type,
  distance_km = excluded.distance_km,
  status = case
    when current_stage.status in ('planned', 'cancelled')
      then excluded.status
    else current_stage.status
  end,
  departure_at = excluded.departure_at,
  profile_type = excluded.profile_type;

delete from public.stage_segments as segment
using public.stages as stage,
      public.race_editions as edition,
      public.seasons as season,
      public.races as race,
      regional_race_seed as seed
where segment.stage_id = stage.id
  and stage.race_edition_id = edition.id
  and edition.season_id = season.id
  and edition.race_id = race.id
  and race.slug = seed.slug
  and season.status in ('active', 'planned')
  and stage.status = 'planned';

with target_stages as (
  select
    stage.id as stage_id,
    stage.profile_type,
    stage.distance_km,
    ceil(stage.distance_km / 10.0)::integer as segment_count
  from public.stages as stage
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.seasons as season
    on season.id = edition.season_id
   and season.status in ('active', 'planned')
  join public.races as race
    on race.id = edition.race_id
  join regional_race_seed as seed
    on seed.slug = race.slug
  where stage.status = 'planned'
), generated as (
  select
    target.*,
    generated.segment_number,
    least(
      10.0,
      target.distance_km - ((generated.segment_number - 1) * 10.0)
    )::numeric(5, 2) as segment_distance_km
  from target_stages as target
  cross join lateral generate_series(1, target.segment_count)
    as generated(segment_number)
), shaped as (
  select
    generated.*,
    case
      when generated.profile_type = 'mountain' then
        case
          when generated.segment_number >= generated.segment_count - 3 then 'climb'
          when generated.segment_number % 7 in (2, 3) then 'climb'
          when generated.segment_number % 7 = 4 then 'descent'
          else 'flat'
        end
      when generated.profile_type = 'hilly' then
        case generated.segment_number % 8
          when 2 then 'climb'
          when 3 then 'descent'
          when 5 then 'climb'
          when 6 then 'descent'
          else 'flat'
        end
      else 'flat'
    end as terrain_type
  from generated
)
insert into public.stage_segments (
  stage_id,
  segment_number,
  distance_km,
  terrain_type,
  surface_type,
  average_gradient_pct
)
select
  shaped.stage_id,
  shaped.segment_number,
  shaped.segment_distance_km,
  shaped.terrain_type,
  'asphalt',
  case
    when shaped.terrain_type = 'climb' then
      case
        when shaped.profile_type = 'mountain'
          and shaped.segment_number >= shaped.segment_count - 3
          then 5.8 + (shaped.segment_number % 4) * 0.7
        else 3.4 + (shaped.segment_number % 4) * 0.6
      end
    when shaped.terrain_type = 'descent'
      then -(3.0 + (shaped.segment_number % 4) * 0.6)
    else 0
  end
from shaped
on conflict (stage_id, segment_number)
do update set
  distance_km = excluded.distance_km,
  terrain_type = excluded.terrain_type,
  surface_type = excluded.surface_type,
  average_gradient_pct = excluded.average_gradient_pct;

update public.race_editions as edition
set
  registration_closes_at = deadline.closes_at,
  withdrawal_closes_at = deadline.closes_at
from (
  select
    target_edition.id as race_edition_id,
    (
      season_day.calendar_date::timestamp
      + case stage.day_slot
          when 'early' then time '08:00'
          else time '12:00'
        end
    ) at time zone 'Europe/Paris' as closes_at
  from public.race_editions as target_edition
  join public.seasons as season
    on season.id = target_edition.season_id
   and season.status in ('active', 'planned')
  join public.races as race
    on race.id = target_edition.race_id
  join regional_race_seed as seed
    on seed.slug = race.slug
  join public.stages as stage
    on stage.race_edition_id = target_edition.id
   and stage.stage_number = 1
  join public.season_days as season_day
    on season_day.id = stage.season_day_id
) as deadline
where edition.id = deadline.race_edition_id;

-- Contexte minimal exposé au serveur Next pour filtrer complètement les
-- Régionales du calendrier d'une équipe non éligible.
create or replace function public.get_current_team_regional_race_context()
returns table (
  team_season_id uuid,
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
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  join public.countries as country
    on country.id = team_season.registration_country_id
  where director.auth_user_id = auth.uid()
  limit 1;
$$;

revoke all
on function public.get_current_team_regional_race_context()
from public, anon;

grant execute
on function public.get_current_team_regional_race_context()
to authenticated;

-- Garde-fou universel : même un appel RPC direct ne peut inscrire une équipe
-- professionnelle ou rattachée à un autre continent.
create or replace function public.enforce_regional_race_registration_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_code text;
  v_race_continent_code text;
  v_team_continent_code text;
  v_team_id uuid;
  v_has_active_sponsor boolean;
begin
  if new.status not in ('pending', 'accepted') then
    return new;
  end if;

  select
    category.code,
    race_country.continent_code,
    team_country.continent_code,
    team_season.team_id
  into
    v_category_code,
    v_race_continent_code,
    v_team_continent_code,
    v_team_id
  from public.race_editions as edition
  join public.race_categories as category
    on category.id = edition.race_category_id
  join public.races as race
    on race.id = edition.race_id
  join public.countries as race_country
    on race_country.id = race.country_id
  join public.team_seasons as team_season
    on team_season.id = new.team_season_id
   and team_season.season_id = edition.season_id
  join public.countries as team_country
    on team_country.id = team_season.registration_country_id
  where edition.id = new.race_edition_id;

  if v_category_code is distinct from 'regional' then
    return new;
  end if;

  select exists (
    select 1
    from public.team_sponsor_contracts as contract
    where contract.team_id = v_team_id
      and contract.role = 'principal'
      and contract.status = 'active'
  ) into v_has_active_sponsor;

  if v_has_active_sponsor then
    raise exception 'Les courses régionales sont réservées aux équipes amateures.';
  end if;

  if v_team_continent_code is null
    or v_race_continent_code is null
    or v_team_continent_code is distinct from v_race_continent_code
  then
    raise exception 'Cette course régionale est réservée aux équipes amateures de son continent.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_regional_registration_insert
  on public.race_registrations;
drop trigger if exists enforce_regional_registration_update
  on public.race_registrations;

create trigger enforce_regional_registration_insert
before insert on public.race_registrations
for each row
execute function public.enforce_regional_race_registration_eligibility();

create trigger enforce_regional_registration_update
before update of race_edition_id, team_season_id, status
on public.race_registrations
for each row
execute function public.enforce_regional_race_registration_eligibility();

create or replace function public.enforce_regional_race_reconnaissance_eligibility()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_code text;
  v_race_continent_code text;
  v_team_continent_code text;
  v_team_id uuid;
begin
  select
    category.code,
    race_country.continent_code,
    team_country.continent_code,
    team_season.team_id
  into
    v_category_code,
    v_race_continent_code,
    v_team_continent_code,
    v_team_id
  from public.stages as stage
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.race_categories as category
    on category.id = edition.race_category_id
  join public.races as race
    on race.id = edition.race_id
  join public.countries as race_country
    on race_country.id = race.country_id
  join public.team_seasons as team_season
    on team_season.id = new.team_season_id
   and team_season.season_id = edition.season_id
  join public.countries as team_country
    on team_country.id = team_season.registration_country_id
  where stage.id = new.target_stage_id;

  if v_category_code is distinct from 'regional' then
    return new;
  end if;

  if exists (
    select 1
    from public.team_sponsor_contracts as contract
    where contract.team_id = v_team_id
      and contract.role = 'principal'
      and contract.status = 'active'
  ) then
    raise exception 'Les courses régionales sont réservées aux équipes amateures.';
  end if;

  if v_team_continent_code is null
    or v_race_continent_code is null
    or v_team_continent_code is distinct from v_race_continent_code
  then
    raise exception 'Cette course régionale est réservée aux équipes amateures de son continent.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_regional_reconnaissance_insert
  on public.stage_reconnaissances;
drop trigger if exists enforce_regional_reconnaissance_update
  on public.stage_reconnaissances;

create trigger enforce_regional_reconnaissance_insert
before insert on public.stage_reconnaissances
for each row
execute function public.enforce_regional_race_reconnaissance_eligibility();

create trigger enforce_regional_reconnaissance_update
before update of team_season_id, target_stage_id
on public.stage_reconnaissances
for each row
execute function public.enforce_regional_race_reconnaissance_eligibility();

-- Une signature de sponsor principal retire immédiatement l'équipe des
-- Régionales encore ouvertes auxquelles elle s'était inscrite comme amateur.
create or replace function public.withdraw_team_from_regional_races_after_sponsoring()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from 'principal' or new.status is distinct from 'active' then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.team_id = new.team_id
    and old.role = 'principal'
    and old.status = 'active'
  then
    return new;
  end if;

  update public.race_rosters as roster
  set status = 'withdrawn'
  from public.race_registrations as registration
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  join public.race_editions as edition
    on edition.id = registration.race_edition_id
  join public.race_categories as category
    on category.id = edition.race_category_id
   and category.code = 'regional'
  where roster.race_registration_id = registration.id
    and team_season.team_id = new.team_id
    and registration.status in ('pending', 'accepted')
    and edition.status in ('planned', 'registration_open')
    and roster.status in ('selected', 'confirmed');

  update public.race_registrations as registration
  set
    status = 'withdrawn',
    decided_at = now()
  from public.team_seasons as team_season,
       public.race_editions as edition,
       public.race_categories as category
  where registration.team_season_id = team_season.id
    and registration.race_edition_id = edition.id
    and edition.race_category_id = category.id
    and category.code = 'regional'
    and team_season.team_id = new.team_id
    and registration.status in ('pending', 'accepted')
    and edition.status in ('planned', 'registration_open');

  return new;
end;
$$;

drop trigger if exists withdraw_regional_races_after_sponsor_insert
  on public.team_sponsor_contracts;
drop trigger if exists withdraw_regional_races_after_sponsor_update
  on public.team_sponsor_contracts;

create trigger withdraw_regional_races_after_sponsor_insert
after insert on public.team_sponsor_contracts
for each row
execute function public.withdraw_team_from_regional_races_after_sponsoring();

create trigger withdraw_regional_races_after_sponsor_update
after update of team_id, role, status
on public.team_sponsor_contracts
for each row
execute function public.withdraw_team_from_regional_races_after_sponsoring();

comment on function public.get_current_team_regional_race_context() is
  'Expose le continent et le statut amateur de l’équipe active pour filtrer les Régionales.';

comment on function public.enforce_regional_race_registration_eligibility() is
  'Refuse toute inscription régionale d’une équipe sponsorisée ou issue d’un autre continent.';

comment on function public.enforce_regional_race_reconnaissance_eligibility() is
  'Refuse la reconnaissance d’une Régionale inaccessible à l’équipe.';

notify pgrst, 'reload schema';

commit;
