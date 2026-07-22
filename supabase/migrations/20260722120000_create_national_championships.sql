-- ============================================================
-- CYCLO STRATÈGE — Championnats nationaux
-- Deux vraies courses par pays et par saison, inscriptions réservées
-- aux ressortissants et conservation permanente du palmarès.
-- ============================================================

begin;

alter table public.race_editions
  add column national_championship_type text;

alter table public.race_editions
  add constraint race_editions_national_championship_type_allowed
  check (
    national_championship_type is null
    or national_championship_type in ('road', 'time_trial')
  );

create index race_editions_national_championship_idx
  on public.race_editions (season_id, national_championship_type)
  where national_championship_type is not null;

create table public.national_championship_titles (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  country_id uuid not null references public.countries(id) on delete restrict,
  discipline text not null,
  rider_id uuid not null references public.riders(id) on delete restrict,
  race_edition_id uuid not null references public.race_editions(id) on delete restrict,
  stage_id uuid not null references public.stages(id) on delete restrict,
  won_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint national_championship_titles_discipline_allowed
    check (discipline in ('road', 'time_trial')),
  constraint national_championship_titles_country_season_unique
    unique (season_id, country_id, discipline),
  constraint national_championship_titles_edition_unique
    unique (race_edition_id)
);

create index national_championship_titles_rider_season_idx
  on public.national_championship_titles (rider_id, season_id, discipline);

create table public.national_championship_title_holders (
  country_id uuid not null references public.countries(id) on delete cascade,
  discipline text not null,
  rider_id uuid not null references public.riders(id) on delete cascade,
  title_id uuid not null references public.national_championship_titles(id) on delete cascade,
  appointed_at timestamptz not null default now(),
  primary key (country_id, discipline),
  constraint national_championship_title_holders_discipline_allowed
    check (discipline in ('road', 'time_trial'))
);

create index national_championship_title_holders_rider_idx
  on public.national_championship_title_holders (rider_id);

alter table public.national_championship_titles enable row level security;
alter table public.national_championship_title_holders enable row level security;

create policy national_championship_titles_read_authenticated
on public.national_championship_titles for select to authenticated using (true);

create policy national_championship_title_holders_read_authenticated
on public.national_championship_title_holders for select to authenticated using (true);

-- Les deux événements du calendrier deviennent cliquables.
update public.season_events
set href = case event_type
  when 'national_time_trial_championships'
    then '/jeu/championnats-nationaux?discipline=time_trial'
  when 'national_road_championships'
    then '/jeu/championnats-nationaux?discipline=road'
  else href
end
where event_type in (
  'national_time_trial_championships',
  'national_road_championships'
);

-- Pour la saison déjà entamée, les CN restent testables s'il reste au moins
-- trois journées. Les saisons peu avancées conservent J8 et J9.
do $$
declare
  v_season_id uuid;
  v_current_day integer;
  v_tt_day integer;
  v_road_day integer;
begin
  select season.id, coalesce(season.current_day_number, 1)
  into v_season_id, v_current_day
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_season_id is null then
    raise exception 'Aucune saison active pour créer les championnats nationaux.';
  end if;

  if v_current_day <= 7 then
    v_tt_day := 8;
    v_road_day := 9;
  elsif v_current_day <= 25 then
    v_tt_day := v_current_day + 2;
    v_road_day := v_current_day + 3;
  else
    v_tt_day := 8;
    v_road_day := 9;
  end if;

  update public.season_events as event
  set season_day_id = day.id
  from public.season_days as day
  where day.season_id = v_season_id
    and day.day_number = case event.event_type
      when 'national_time_trial_championships' then v_tt_day
      when 'national_road_championships' then v_road_day
    end
    and event.event_type in (
      'national_time_trial_championships',
      'national_road_championships'
    );
end;
$$;

create temporary table national_championship_seed (
  country_id uuid not null,
  country_name text not null,
  country_code text not null,
  discipline text not null,
  slug text not null,
  race_name text not null,
  short_name text not null,
  day_number integer not null,
  primary key (country_id, discipline)
) on commit drop;

insert into national_championship_seed (
  country_id,
  country_name,
  country_code,
  discipline,
  slug,
  race_name,
  short_name,
  day_number
)
select
  country.id,
  country.name,
  country.iso_alpha2,
  discipline.code,
  'championnat-national-' || lower(country.iso_alpha2) || '-'
    || case when discipline.code = 'time_trial' then 'clm' else 'route' end,
  'Championnat national de ' || country.name || ' — '
    || case when discipline.code = 'time_trial' then 'contre-la-montre' else 'course en ligne' end,
  'CN ' || country.iso_alpha2 || ' '
    || case when discipline.code = 'time_trial' then 'CLM' else 'Route' end,
  day.day_number
from public.countries as country
cross join (values ('time_trial'), ('road')) as discipline(code)
join public.seasons as season on season.status = 'active'
join public.season_events as event
  on event.event_type = case discipline.code
    when 'time_trial' then 'national_time_trial_championships'
    else 'national_road_championships'
  end
join public.season_days as day
  on day.id = event.season_day_id
 and day.season_id = season.id
where country.is_active;

insert into public.races (
  country_id,
  name,
  short_name,
  race_format,
  status,
  slug
)
select
  seed.country_id,
  seed.race_name,
  seed.short_name,
  'one_day',
  'active',
  seed.slug
from national_championship_seed as seed
on conflict (slug)
do update set
  country_id = excluded.country_id,
  name = excluded.name,
  short_name = excluded.short_name,
  race_format = excluded.race_format,
  status = excluded.status;

insert into public.race_editions (
  race_id,
  season_id,
  race_category_id,
  edition_number,
  display_name,
  status,
  minimum_reputation,
  registration_policy,
  field_limit,
  national_championship_type
)
select
  race.id,
  season.id,
  category.id,
  season.game_year,
  seed.race_name,
  'registration_open',
  0,
  'open',
  null,
  seed.discipline
from national_championship_seed as seed
join public.races as race on race.slug = seed.slug
join public.race_categories as category on category.code = 'elite'
join public.seasons as season on season.status = 'active'
on conflict (race_id, season_id)
do update set
  race_category_id = excluded.race_category_id,
  display_name = excluded.display_name,
  status = excluded.status,
  minimum_reputation = excluded.minimum_reputation,
  registration_policy = excluded.registration_policy,
  field_limit = excluded.field_limit,
  national_championship_type = excluded.national_championship_type;

insert into public.stages (
  race_edition_id,
  season_day_id,
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
  day.id,
  1,
  seed.race_name,
  case when seed.discipline = 'time_trial' then 'individual_time_trial' else 'road' end,
  case when seed.discipline = 'time_trial' then 42 else 180 end,
  'planned',
  ((day.calendar_date::timestamp + time '20:00') at time zone 'Europe/Paris'),
  case
    when seed.discipline = 'time_trial' then 'time_trial'
    when seed.country_code in ('BE', 'NL') then 'cobbles'
    when seed.country_code in ('CO', 'EC', 'BO', 'PE', 'SI', 'ES', 'IT', 'FR', 'PT', 'CH', 'AT', 'ER', 'ET', 'RW', 'UG', 'KE') then 'hilly'
    else 'sprint'
  end
from national_championship_seed as seed
join public.races as race on race.slug = seed.slug
join public.seasons as season on season.status = 'active'
join public.race_editions as edition
  on edition.race_id = race.id
 and edition.season_id = season.id
join public.season_days as day
  on day.season_id = season.id
 and day.day_number = seed.day_number
on conflict (race_edition_id, stage_number)
do update set
  season_day_id = excluded.season_day_id,
  name = excluded.name,
  stage_type = excluded.stage_type,
  distance_km = excluded.distance_km,
  departure_at = excluded.departure_at,
  profile_type = excluded.profile_type;

update public.race_editions as edition
set
  registration_closes_at = stage.departure_at - interval '8 hours',
  withdrawal_closes_at = stage.departure_at - interval '12 hours'
from public.stages as stage
where stage.race_edition_id = edition.id
  and edition.national_championship_type is not null
  and edition.season_id = (
    select id from public.seasons where status = 'active' limit 1
  );

-- Les profils sont déterministes et suffisamment distincts pour le moteur :
-- six tronçons de 7 km en CLM, douze tronçons de 15 km sur route.
insert into public.stage_segments (
  stage_id,
  segment_number,
  distance_km,
  terrain_type,
  surface_type,
  average_gradient_pct
)
select
  stage.id,
  segment.number,
  case when edition.national_championship_type = 'time_trial' then 7 else 15 end,
  case
    when edition.national_championship_type = 'time_trial' then 'flat'
    when stage.profile_type = 'hilly' and segment.number in (4, 8) then 'climb'
    when stage.profile_type = 'hilly' and segment.number in (5, 9) then 'descent'
    else 'flat'
  end,
  case
    when stage.profile_type = 'cobbles' and segment.number in (3, 4, 7, 8, 10)
      then 'cobbles'
    else 'asphalt'
  end,
  case
    when stage.profile_type = 'hilly' and segment.number in (4, 8) then 4.5
    when stage.profile_type = 'hilly' and segment.number in (5, 9) then -4.5
    else 0
  end
from public.race_editions as edition
join public.stages as stage on stage.race_edition_id = edition.id
cross join lateral generate_series(
  1,
  case when edition.national_championship_type = 'time_trial' then 6 else 12 end
) as segment(number)
where edition.national_championship_type is not null
  and edition.season_id = (
    select id from public.seasons where status = 'active' limit 1
  )
on conflict (stage_id, segment_number)
do update set
  distance_km = excluded.distance_km,
  terrain_type = excluded.terrain_type,
  surface_type = excluded.surface_type,
  average_gradient_pct = excluded.average_gradient_pct;

-- Inscription spécialisée : 1 à 8 coureurs, tous de la nation de l'épreuve.
create or replace function public.save_current_team_national_championship_roster(
  p_race_edition_id uuid,
  p_roster jsonb
)
returns table (
  registration_id uuid,
  registration_status text,
  registered_rider_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_director public.sporting_directors%rowtype;
  v_edition public.race_editions%rowtype;
  v_team_id uuid;
  v_team_season_id uuid;
  v_game_year integer;
  v_country_id uuid;
  v_rider_ids uuid[];
  v_selected_count integer;
  v_valid_count integer;
  v_registration public.race_registrations%rowtype;
  v_active_roster_count integer;
  v_rider_id uuid;
  v_conflict record;
begin
  if v_auth_user_id is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté pour vous inscrire.';
  end if;

  if p_roster is null or jsonb_typeof(p_roster) <> 'array' then
    raise exception 'La composition transmise est invalide.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_roster) as entry(value)
    where not (entry.value ->> 'riderId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
      or coalesce(entry.value ->> 'role', 'auto') not in (
        'auto', 'leader', 'sprinter', 'leadout', 'free_agent', 'domestique'
      )
  ) then
    raise exception 'Un coureur ou un rôle transmis est invalide.';
  end if;

  if (select count(*) from jsonb_array_elements(p_roster) as entry(value) where entry.value ->> 'role' = 'leader') > 1
    or (select count(*) from jsonb_array_elements(p_roster) as entry(value) where entry.value ->> 'role' = 'sprinter') > 1
  then
    raise exception 'Un seul leader et un seul sprinteur peuvent être désignés.';
  end if;

  select array_agg((entry.value ->> 'riderId')::uuid order by entry.ordinality)
  into v_rider_ids
  from jsonb_array_elements(p_roster) with ordinality as entry(value, ordinality);

  v_selected_count := cardinality(coalesce(v_rider_ids, array[]::uuid[]));
  if v_selected_count < 1 or v_selected_count > 8 then
    raise exception 'Vous devez sélectionner entre 1 et 8 coureurs.';
  end if;
  if v_selected_count <> (select count(distinct id) from unnest(v_rider_ids) as selected(id)) then
    raise exception 'La composition contient un coureur en double.';
  end if;

  select director.* into v_director
  from public.sporting_directors as director
  where director.auth_user_id = v_auth_user_id and director.status = 'active';
  if not found then raise exception 'Aucun Directeur Sportif actif.'; end if;

  select edition.*
  into v_edition
  from public.race_editions as edition
  where edition.id = p_race_edition_id
    and edition.national_championship_type is not null
  for update of edition;
  if not found then raise exception 'Ce championnat national est introuvable.'; end if;

  select race.country_id
  into v_country_id
  from public.races as race
  where race.id = v_edition.race_id;

  if v_edition.status in ('completed', 'cancelled', 'in_progress')
    or v_edition.registration_policy <> 'open'
    or v_edition.registration_closes_at is null
    or now() >= v_edition.registration_closes_at
  then
    raise exception 'Les inscriptions de ce championnat sont fermées.';
  end if;

  select assignment.team_id into v_team_id
  from public.team_manager_assignments as assignment
  where assignment.sporting_director_id = v_director.id
    and assignment.role = 'general_manager'
    and assignment.status = 'active';
  if not found then raise exception 'Vous ne dirigez actuellement aucune équipe.'; end if;

  select team_season.id, season.game_year
  into v_team_season_id, v_game_year
  from public.team_seasons as team_season
  join public.seasons as season on season.id = team_season.season_id
  where team_season.team_id = v_team_id
    and team_season.season_id = v_edition.season_id
    and team_season.status in ('planned', 'active');
  if not found then raise exception 'Votre équipe ne participe pas à cette saison.'; end if;

  select count(distinct rider.id) into v_valid_count
  from public.riders as rider
  join public.rider_contracts as contract
    on contract.rider_id = rider.id
   and contract.team_id = v_team_id
   and contract.status = 'active'
  join public.seasons as start_season on start_season.id = contract.start_season_id
  join public.seasons as end_season on end_season.id = contract.end_season_id
  where rider.id = any(v_rider_ids)
    and rider.status = 'active'
    and rider.country_id = v_country_id
    and start_season.game_year <= v_game_year
    and end_season.game_year >= v_game_year;
  if v_valid_count <> v_selected_count then
    raise exception 'Tous les coureurs doivent appartenir à votre effectif et avoir la nationalité du championnat.';
  end if;

  for v_rider_id in select id from unnest(v_rider_ids) as selected(id) order by id
  loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_rider_id::text, 0));
  end loop;

  select registration.* into v_registration
  from public.race_registrations as registration
  where registration.race_edition_id = v_edition.id
    and registration.team_season_id = v_team_season_id
  for update;

  if found then
    select count(*) into v_active_roster_count
    from public.race_rosters as roster
    where roster.race_registration_id = v_registration.id
      and roster.status in ('selected', 'confirmed');
    if v_registration.status = 'accepted' and v_active_roster_count > 0 then
      raise exception 'La composition validée est verrouillée. Retirez-la avant de vous réinscrire.';
    end if;
    if v_registration.status = 'withdrawn'
      and (v_edition.withdrawal_closes_at is null or now() >= v_edition.withdrawal_closes_at)
    then
      raise exception 'La limite de réinscription est dépassée.';
    end if;
  end if;

  select
    rider.first_name || ' ' || rider.last_name as rider_name,
    other_race.display_name as race_name
  into v_conflict
  from unnest(v_rider_ids) as selected(rider_id)
  join public.riders as rider on rider.id = selected.rider_id
  join public.race_rosters as other_roster
    on other_roster.rider_id = rider.id
   and other_roster.status in ('selected', 'confirmed')
  join public.race_registrations as other_registration
    on other_registration.id = other_roster.race_registration_id
   and other_registration.status = 'accepted'
  join public.race_editions as other_race
    on other_race.id = other_registration.race_edition_id
   and other_race.season_id = v_edition.season_id
   and other_race.id <> v_edition.id
  where exists (
    select 1
    from public.stages as target_stage
    join public.stages as other_stage
      on other_stage.season_day_id = target_stage.season_day_id
     and other_stage.race_edition_id = other_race.id
    where target_stage.race_edition_id = v_edition.id
  )
  limit 1;
  if found then
    raise exception '% est déjà engagé sur % le même jour.', v_conflict.rider_name, v_conflict.race_name;
  end if;

  if v_registration.id is null then
    insert into public.race_registrations (
      race_edition_id, team_season_id, entry_method, status, registered_at, decided_at
    ) values (
      v_edition.id, v_team_season_id, 'requested', 'accepted', now(), now()
    ) returning * into v_registration;
  else
    update public.race_registrations
    set status = 'accepted', entry_method = 'requested', registered_at = now(), decided_at = now()
    where id = v_registration.id
    returning * into v_registration;
  end if;

  update public.race_rosters set status = 'withdrawn'
  where race_registration_id = v_registration.id;

  insert into public.race_rosters (
    race_registration_id, rider_id, race_role, status, selected_at
  )
  select
    v_registration.id,
    (entry.value ->> 'riderId')::uuid,
    coalesce(entry.value ->> 'role', 'auto'),
    'confirmed',
    now()
  from jsonb_array_elements(p_roster) as entry(value)
  on conflict (race_registration_id, rider_id)
  do update set
    race_role = excluded.race_role,
    status = 'confirmed',
    selected_at = excluded.selected_at;

  return query select v_registration.id, v_registration.status, v_selected_count;
end;
$$;

create or replace function public.award_national_championship_title(
  p_race_edition_id uuid,
  p_rider_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_title_id uuid;
begin
  select
    edition.season_id,
    edition.national_championship_type as discipline,
    race.country_id,
    stage.id as stage_id
  into v_context
  from public.race_editions as edition
  join public.races as race on race.id = edition.race_id
  join public.stages as stage
    on stage.race_edition_id = edition.id
   and stage.stage_number = 1
  join public.race_results as result
    on result.race_edition_id = edition.id
   and result.final_rank = 1
   and result.status = 'classified'
  join public.race_rosters as roster
    on roster.id = result.race_roster_id
   and roster.rider_id = p_rider_id
  join public.riders as rider
    on rider.id = roster.rider_id
   and rider.country_id = race.country_id
  where edition.id = p_race_edition_id
    and edition.national_championship_type is not null;

  if v_context is null then
    raise exception 'Le titre national ne correspond pas au vainqueur officiel.';
  end if;

  insert into public.national_championship_titles (
    season_id, country_id, discipline, rider_id, race_edition_id, stage_id, won_at
  ) values (
    v_context.season_id, v_context.country_id, v_context.discipline,
    p_rider_id, p_race_edition_id, v_context.stage_id, now()
  )
  on conflict (season_id, country_id, discipline)
  do update set
    rider_id = excluded.rider_id,
    race_edition_id = excluded.race_edition_id,
    stage_id = excluded.stage_id,
    won_at = excluded.won_at
  returning id into v_title_id;

  insert into public.national_championship_title_holders (
    country_id, discipline, rider_id, title_id, appointed_at
  ) values (
    v_context.country_id, v_context.discipline, p_rider_id, v_title_id, now()
  )
  on conflict (country_id, discipline)
  do update set
    rider_id = excluded.rider_id,
    title_id = excluded.title_id,
    appointed_at = excluded.appointed_at;

  return v_title_id;
end;
$$;

grant select on table public.national_championship_titles to authenticated;
grant select on table public.national_championship_title_holders to authenticated;
grant all privileges on table public.national_championship_titles to service_role;
grant all privileges on table public.national_championship_title_holders to service_role;

revoke all on function public.save_current_team_national_championship_roster(uuid, jsonb) from public, anon;
grant execute on function public.save_current_team_national_championship_roster(uuid, jsonb) to authenticated;
revoke all on function public.award_national_championship_title(uuid, uuid) from public, anon, authenticated;
grant execute on function public.award_national_championship_title(uuid, uuid) to service_role;

comment on table public.national_championship_titles is
  'Palmarès permanent des champions nationaux route et CLM.';
comment on table public.national_championship_title_holders is
  'Champions en titre, remplacés uniquement à la nomination du vainqueur suivant.';

notify pgrst, 'reload schema';

commit;
