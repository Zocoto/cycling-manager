begin;

-- ============================================================
-- CONTINENTS CYCLISTES
-- Les championnats continentaux suivent les cinq confédérations
-- usuelles : Afrique, Amérique, Asie, Europe et Océanie.
-- ============================================================

alter table public.countries
add column continent_code text;

alter table public.countries
add constraint countries_continent_code_allowed
check (
  continent_code is null
  or continent_code in ('africa', 'america', 'asia', 'europe', 'oceania')
);

update public.countries
set continent_code = 'africa'
where iso_alpha2 in (
  'DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CI','CD','DJ',
  'EG','GQ','ER','SZ','ET','TF','GA','GM','GH','GN','GW','KE','LS','LR',
  'LY','MG','MW','ML','MR','MU','YT','MA','MZ','NA','NE','NG','CG','RW',
  'RE','SH','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG',
  'EH','ZM','ZW'
);

update public.countries
set continent_code = 'america'
where iso_alpha2 in (
  'AI','AG','AR','AW','BS','BB','BZ','BM','BO','BQ','BR','CA','KY','CL',
  'CO','CR','CU','CW','DM','DO','EC','SV','FK','GF','GL','GD','GP','GT',
  'GY','HT','HN','JM','MQ','MX','MS','NI','PA','PY','PE','PR','BL','KN',
  'LC','MF','PM','VC','SX','SR','TT','TC','UM','US','UY','VE','VG','VI'
);

update public.countries
set continent_code = 'asia'
where iso_alpha2 in (
  'AF','AM','AZ','BH','BD','BT','IO','BN','KH','CN','CX','CC','GE','HK',
  'IN','ID','IR','IQ','IL','JP','JO','KZ','KW','KG','LA','LB','MO','MY',
  'MV','MN','MM','NP','KP','OM','PK','PH','QA','SA','SG','KR','LK','PS',
  'SY','TW','TJ','TH','TL','TM','TR','AE','UZ','VN','YE'
);

update public.countries
set continent_code = 'europe'
where iso_alpha2 in (
  'AX','AL','AD','AT','BY','BE','BA','BG','HR','CY','CZ','DK','EE','FO',
  'FI','FR','DE','GI','GR','GG','VA','HU','IS','IE','IM','IT','JE','LV',
  'LI','LT','LU','MT','MD','MC','ME','NL','MK','NO','PL','PT','RO','RU',
  'SM','RS','SK','SI','ES','SJ','SE','CH','UA','GB'
);

update public.countries
set continent_code = 'oceania'
where iso_alpha2 in (
  'AS','AU','CK','FM','FJ','PF','GU','KI','MH','NR','NC','NZ','NU','NF',
  'MP','PW','PG','PN','WS','SB','TK','TO','TV','VU','WF'
);

create index countries_continent_code_idx
  on public.countries (continent_code);

comment on column public.countries.continent_code is
  'Confédération continentale utilisée pour les sélections internationales.';

-- ============================================================
-- ÉPREUVES INTERNATIONALES
-- Une course mondiale et cinq courses continentales sont créées
-- pour chaque saison. Leur inscription est exclusivement automatique.
-- ============================================================

alter table public.races
drop constraint races_competition_type_allowed;

alter table public.races
add constraint races_competition_type_allowed
check (
  competition_type in (
    'standard',
    'national_road',
    'national_time_trial',
    'continental_championship',
    'world_championship'
  )
);

alter table public.races
add column championship_continent_code text;

alter table public.races
add constraint races_championship_continent_allowed
check (
  championship_continent_code is null
  or championship_continent_code in (
    'africa',
    'america',
    'asia',
    'europe',
    'oceania'
  )
);

alter table public.races
add constraint races_championship_continent_matches_type
check (
  (
    competition_type = 'continental_championship'
    and championship_continent_code is not null
  )
  or (
    competition_type <> 'continental_championship'
    and championship_continent_code is null
  )
);

create index races_championship_continent_idx
  on public.races (championship_continent_code)
  where championship_continent_code is not null;

create or replace function public.ensure_international_championship_editions(
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
  v_distance numeric(6, 2);
begin
  select season.*
  into v_season
  from public.seasons as season
  where season.id = p_season_id;

  if not found then
    return;
  end if;

  for v_championship in
    select *
    from (
      values
        (
          'continental_championship',
          'africa',
          'ZA',
          'championnats-continentaux-afrique',
          'Championnats d''Afrique',
          'CC Afrique',
          'continental',
          22,
          190::numeric
        ),
        (
          'continental_championship',
          'america',
          'CA',
          'championnats-continentaux-amerique',
          'Championnats d''Amérique',
          'CC Amérique',
          'continental',
          22,
          190::numeric
        ),
        (
          'continental_championship',
          'asia',
          'JP',
          'championnats-continentaux-asie',
          'Championnats d''Asie',
          'CC Asie',
          'continental',
          22,
          190::numeric
        ),
        (
          'continental_championship',
          'europe',
          'CH',
          'championnats-continentaux-europe',
          'Championnats d''Europe',
          'CC Europe',
          'continental',
          22,
          190::numeric
        ),
        (
          'continental_championship',
          'oceania',
          'AU',
          'championnats-continentaux-oceanie',
          'Championnats d''Océanie',
          'CC Océanie',
          'continental',
          22,
          190::numeric
        ),
        (
          'world_championship',
          null,
          'FR',
          'championnats-du-monde',
          'Championnats du monde',
          'CM',
          'world',
          26,
          210::numeric
        )
    ) as championship(
      competition_type,
      continent_code,
      host_country_code,
      slug,
      display_name,
      short_name,
      category_code,
      day_number,
      distance_km
    )
  loop
    select country.id
    into v_host_country_id
    from public.countries as country
    where country.iso_alpha2 = v_championship.host_country_code;

    select category.id
    into v_category_id
    from public.race_categories as category
    where category.code = v_championship.category_code
      and category.is_active = true;

    select
      day.id,
      (
        day.calendar_date::timestamp + interval '18 hours'
      ) at time zone 'Europe/Paris'
    into v_day_id, v_departure_at
    from public.season_days as day
    where day.season_id = v_season.id
      and day.day_number = v_championship.day_number;

    if v_host_country_id is null
      or v_category_id is null
      or v_day_id is null
    then
      raise exception
        'Impossible de préparer l''épreuve internationale %.',
        v_championship.display_name;
    end if;

    v_distance := v_championship.distance_km;

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
      v_championship.competition_type,
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
      'road',
      v_distance,
      'planned',
      v_departure_at,
      'hilly',
      'late'
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
      least(
        10,
        v_distance - ((generated.segment_number - 1) * 10)
      ),
      case generated.segment_number % 7
        when 2 then 'climb'
        when 3 then 'climb'
        when 4 then 'descent'
        when 6 then 'climb'
        when 0 then 'descent'
        else 'flat'
      end,
      'asphalt',
      case generated.segment_number % 7
        when 2 then 4.2
        when 3 then 6.1
        when 4 then -5.4
        when 6 then 5.2
        when 0 then -4.6
        else 0
      end
    from generate_series(
      1,
      ceil(v_distance / 10.0)::integer
    ) as generated(segment_number);
  end loop;
end;
$$;

revoke all
on function public.ensure_international_championship_editions(uuid)
from public, anon, authenticated;

grant execute
on function public.ensure_international_championship_editions(uuid)
to service_role;

do $$
declare
  v_season_id uuid;
begin
  for v_season_id in
    select season.id
    from public.seasons as season
    where season.status = 'active'
  loop
    perform public.ensure_international_championship_editions(v_season_id);
  end loop;
end;
$$;

create or replace function public.ensure_season_international_championships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
    perform public.ensure_international_championship_editions(new.id);
  end if;

  return new;
end;
$$;

create trigger ensure_season_international_championships
after insert or update of status
on public.seasons
for each row
when (new.status = 'active')
execute function public.ensure_season_international_championships();

update public.season_events
set
  href = '/jeu/selections-internationales',
  description = 'Les 20 meilleures nations de chaque continent sélectionnent automatiquement leurs huit meilleurs coureurs à H-24.'
where event_type = 'continental_championships';

update public.season_events
set
  href = '/jeu/selections-internationales',
  description = 'Les 20 meilleures nations mondiales sélectionnent automatiquement leurs huit meilleurs coureurs à H-24.'
where event_type = 'world_championships';

-- ============================================================
-- INSTANTANÉS DE SÉLECTION
-- Le classement des nations et celui des coureurs sont conservés
-- afin qu'une évolution ultérieure des points ne réécrive pas la liste.
-- ============================================================

create table public.international_championship_nation_selections (
  id uuid primary key default gen_random_uuid(),
  race_edition_id uuid not null
    references public.race_editions(id)
    on delete cascade,
  country_id uuid not null
    references public.countries(id)
    on delete restrict,
  continent_code text,
  nation_rank smallint not null,
  nation_points integer not null,
  captured_at timestamptz not null default now(),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),

  constraint international_nation_selection_continent_allowed
    check (
      continent_code is null
      or continent_code in ('africa', 'america', 'asia', 'europe', 'oceania')
    ),
  constraint international_nation_selection_rank_range
    check (nation_rank between 1 and 20),
  constraint international_nation_selection_points_non_negative
    check (nation_points >= 0),
  constraint international_nation_selection_unique
    unique (race_edition_id, country_id)
);

create index international_nation_selection_edition_idx
  on public.international_championship_nation_selections (race_edition_id);

create table public.international_championship_rider_selections (
  id uuid primary key default gen_random_uuid(),
  nation_selection_id uuid not null
    references public.international_championship_nation_selections(id)
    on delete cascade,
  rider_id uuid not null
    references public.riders(id)
    on delete restrict,
  team_id uuid
    references public.teams(id)
    on delete set null,
  sporting_director_id uuid
    references public.sporting_directors(id)
    on delete set null,
  rider_rank integer not null,
  uci_points integer not null,
  overall_rating numeric(5, 2) not null,
  response_status text not null default 'pending',
  is_selected boolean not null default false,
  selected_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),

  constraint international_rider_selection_rank_positive
    check (rider_rank > 0),
  constraint international_rider_selection_points_non_negative
    check (uci_points >= 0),
  constraint international_rider_selection_overall_range
    check (overall_rating between 0 and 100),
  constraint international_rider_selection_response_allowed
    check (
      response_status in (
        'pending',
        'confirmed',
        'automatic',
        'declined',
        'ineligible_injury',
        'unavailable'
      )
    ),
  constraint international_rider_selection_unique
    unique (nation_selection_id, rider_id),
  constraint international_rider_selection_rank_unique
    unique (nation_selection_id, rider_rank)
);

create index international_rider_selection_director_idx
  on public.international_championship_rider_selections (
    sporting_director_id,
    is_selected,
    response_status
  );

create index international_rider_selection_rider_idx
  on public.international_championship_rider_selections (rider_id);

alter table public.international_championship_nation_selections
enable row level security;

alter table public.international_championship_rider_selections
enable row level security;

grant all privileges
on table
  public.international_championship_nation_selections,
  public.international_championship_rider_selections
to service_role;

comment on table public.international_championship_nation_selections is
  'Top 20 des nations figé à H-24 pour chaque championnat mondial ou continental.';

comment on table public.international_championship_rider_selections is
  'Classement figé des coureurs d''une nation, réponses des DS et huit places actives.';

-- ============================================================
-- SYNCHRONISATION AVEC LES STARTLISTS
-- Les rosters de course restent la source consommée par le simulateur.
-- Une place internationale est donc matérialisée dans le roster de
-- l'équipe propriétaire du coureur, avec une méthode automatique.
-- ============================================================

create or replace function public.sync_international_championship_lineup(
  p_nation_selection_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_selection public.international_championship_nation_selections%rowtype;
  v_candidate record;
  v_team_season_id uuid;
  v_registration_id uuid;
begin
  select selection.*
  into v_selection
  from public.international_championship_nation_selections as selection
  where selection.id = p_nation_selection_id
  for update;

  if not found then
    return;
  end if;

  with eligible as (
    select
      candidate.id,
      row_number() over (
        order by candidate.rider_rank, candidate.rider_id
      ) as eligible_rank
    from public.international_championship_rider_selections as candidate
    where candidate.nation_selection_id = v_selection.id
      and candidate.response_status not in (
        'declined',
        'ineligible_injury',
        'unavailable'
      )
  )
  update public.international_championship_rider_selections as candidate
  set
    is_selected = coalesce(eligible.eligible_rank <= 8, false),
    selected_at = case
      when eligible.eligible_rank <= 8
        then coalesce(candidate.selected_at, now())
      else candidate.selected_at
    end
  from eligible
  where candidate.id = eligible.id;

  update public.international_championship_rider_selections as candidate
  set
    is_selected = false
  where candidate.nation_selection_id = v_selection.id
    and candidate.response_status in (
      'declined',
      'ineligible_injury',
      'unavailable'
    );

  update public.race_rosters as roster
  set status = 'withdrawn'
  from public.race_registrations as registration,
       public.international_championship_rider_selections as candidate
  where registration.id = roster.race_registration_id
    and registration.race_edition_id = v_selection.race_edition_id
    and candidate.nation_selection_id = v_selection.id
    and candidate.rider_id = roster.rider_id
    and candidate.is_selected = false
    and roster.status in ('selected', 'confirmed');

  for v_candidate in
    select candidate.*
    from public.international_championship_rider_selections as candidate
    where candidate.nation_selection_id = v_selection.id
      and candidate.is_selected = true
    order by candidate.rider_rank
  loop
    select team_season.id
    into v_team_season_id
    from public.race_editions as edition
    join public.team_seasons as team_season
      on team_season.season_id = edition.season_id
     and team_season.team_id = v_candidate.team_id
     and team_season.status in ('planned', 'active')
    where edition.id = v_selection.race_edition_id
    limit 1;

    if v_team_season_id is null then
      update public.international_championship_rider_selections
      set
        response_status = 'unavailable',
        is_selected = false
      where id = v_candidate.id;
      continue;
    end if;

    insert into public.race_registrations (
      race_edition_id,
      team_season_id,
      entry_method,
      status,
      registered_at,
      decided_at
    )
    values (
      v_selection.race_edition_id,
      v_team_season_id,
      'automatic',
      'accepted',
      now(),
      now()
    )
    on conflict (race_edition_id, team_season_id)
    do update set
      entry_method = 'automatic',
      status = 'accepted',
      registered_at = coalesce(
        public.race_registrations.registered_at,
        excluded.registered_at
      ),
      decided_at = excluded.decided_at
    returning id into v_registration_id;

    insert into public.race_rosters (
      race_registration_id,
      rider_id,
      race_role,
      status,
      selected_at
    )
    values (
      v_registration_id,
      v_candidate.rider_id,
      'auto',
      'confirmed',
      now()
    )
    on conflict (race_registration_id, rider_id)
    do update set
      race_role = 'auto',
      status = 'confirmed',
      selected_at = excluded.selected_at;
  end loop;

  update public.race_registrations as registration
  set
    status = 'withdrawn',
    decided_at = now()
  where registration.race_edition_id = v_selection.race_edition_id
    and registration.entry_method = 'automatic'
    and not exists (
      select 1
      from public.race_rosters as roster
      where roster.race_registration_id = registration.id
        and roster.status in ('selected', 'confirmed')
    );

  -- Un propriétaire devenu indisponible peut faire entrer un réserviste.
  if (
    select count(*)
    from public.international_championship_rider_selections as candidate
    where candidate.nation_selection_id = v_selection.id
      and candidate.is_selected = true
  ) < 8 and exists (
    select 1
    from public.international_championship_rider_selections as candidate
    where candidate.nation_selection_id = v_selection.id
      and candidate.is_selected = false
      and candidate.response_status not in (
        'declined',
        'ineligible_injury',
        'unavailable'
      )
  ) then
    perform public.sync_international_championship_lineup(v_selection.id);
  end if;
end;
$$;

revoke all
on function public.sync_international_championship_lineup(uuid)
from public, anon, authenticated;

grant execute
on function public.sync_international_championship_lineup(uuid)
to service_role;

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
  v_selection public.international_championship_nation_selections%rowtype;
  v_target_start_day integer;
  v_target_end_day integer;
begin
  select selection.*
  into v_selection
  from public.international_championship_nation_selections as selection
  where selection.id = p_nation_selection_id;

  if not found then
    return;
  end if;

  select min(day.day_number), max(day.day_number)
  into v_target_start_day, v_target_end_day
  from public.stages as stage
  join public.season_days as day
    on day.id = stage.season_day_id
  where stage.race_edition_id = v_selection.race_edition_id;

  update public.race_rosters as roster
  set status = 'withdrawn'
  from public.race_registrations as registration,
       public.race_editions as other_edition
  where registration.id = roster.race_registration_id
    and other_edition.id = registration.race_edition_id
    and roster.rider_id = p_rider_id
    and roster.status in ('selected', 'confirmed')
    and registration.status = 'accepted'
    and other_edition.id <> v_selection.race_edition_id
    and exists (
      select 1
      from public.stages as other_stage
      join public.season_days as other_day
        on other_day.id = other_stage.season_day_id
      where other_stage.race_edition_id = other_edition.id
        and other_day.day_number between v_target_start_day and v_target_end_day
        and other_day.season_id = (
          select edition.season_id
          from public.race_editions as edition
          where edition.id = v_selection.race_edition_id
        )
    );

  update public.race_registrations as registration
  set
    status = 'withdrawn',
    decided_at = now()
  where registration.race_edition_id <> v_selection.race_edition_id
    and registration.status = 'accepted'
    and exists (
      select 1
      from public.race_rosters as affected_roster
      where affected_roster.race_registration_id = registration.id
        and affected_roster.rider_id = p_rider_id
    )
    and not exists (
      select 1
      from public.race_rosters as roster
      where roster.race_registration_id = registration.id
        and roster.status in ('selected', 'confirmed')
    );

  update public.rider_form_camps as camp
  set
    status = 'cancelled',
    completed_at = now()
  where camp.rider_id = p_rider_id
    and camp.status in ('planned', 'active')
    and camp.start_day_number <= v_target_end_day
    and camp.end_day_number >= v_target_start_day
    and camp.season_id = (
      select edition.season_id
      from public.race_editions as edition
      where edition.id = v_selection.race_edition_id
    );
end;
$$;

revoke all
on function public.prioritize_international_championship_rider(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.prioritize_international_championship_rider(uuid, uuid)
to service_role;

-- ============================================================
-- MOTEUR H-24
-- Idempotent : il peut être appelé par le cron et à l'ouverture du bureau.
-- ============================================================

create or replace function public.process_due_international_championship_selections(
  p_now timestamptz default now()
)
returns table (
  created_nation_selections integer,
  finalized_nation_selections integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_championship record;
  v_nation record;
  v_nation_selection_id uuid;
  v_created integer := 0;
  v_finalized integer := 0;
  v_selected_rider record;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'international-championship-selections',
      0
    )
  );

  for v_championship in
    select
      edition.id as race_edition_id,
      edition.season_id,
      race.competition_type,
      race.championship_continent_code as continent_code,
      stage.departure_at
    from public.race_editions as edition
    join public.seasons as season
      on season.id = edition.season_id
     and season.status = 'active'
    join public.races as race
      on race.id = edition.race_id
     and race.competition_type in (
       'continental_championship',
       'world_championship'
     )
    join lateral (
      select min(stage.departure_at) as departure_at
      from public.stages as stage
      where stage.race_edition_id = edition.id
    ) as stage on true
    where edition.status not in ('completed', 'cancelled')
      and stage.departure_at is not null
      and stage.departure_at <= p_now + interval '24 hours'
    order by stage.departure_at, edition.id
  loop
    if not exists (
      select 1
      from public.international_championship_nation_selections as existing
      where existing.race_edition_id = v_championship.race_edition_id
    ) then
      for v_nation in
        with nation_points as (
          select
            country.id as country_id,
            country.name as country_name,
            country.continent_code,
            sum(coalesce(summary.points, 0))::integer as points
          from public.countries as country
          join public.riders as rider
            on rider.country_id = country.id
           and rider.status = 'active'
          join public.rider_season_summaries as summary
            on summary.rider_id = rider.id
           and summary.season_id = v_championship.season_id
          where country.continent_code is not null
          group by
            country.id,
            country.name,
            country.continent_code
          having sum(coalesce(summary.points, 0)) > 0
        ),
        ranked as (
          select
            nation_points.*,
            row_number() over (
              partition by case
                when v_championship.competition_type = 'world_championship'
                  then 'world'
                else nation_points.continent_code
              end
              order by
                nation_points.points desc,
                nation_points.country_name,
                nation_points.country_id
            ) as nation_rank
          from nation_points
          where v_championship.competition_type = 'world_championship'
             or nation_points.continent_code = v_championship.continent_code
        )
        select *
        from ranked
        where nation_rank <= 20
        order by nation_rank
      loop
        insert into public.international_championship_nation_selections (
          race_edition_id,
          country_id,
          continent_code,
          nation_rank,
          nation_points,
          captured_at
        )
        values (
          v_championship.race_edition_id,
          v_nation.country_id,
          case
            when v_championship.competition_type = 'continental_championship'
              then v_nation.continent_code
            else null
          end,
          v_nation.nation_rank,
          v_nation.points,
          p_now
        )
        returning id into v_nation_selection_id;

        insert into public.international_championship_rider_selections (
          nation_selection_id,
          rider_id,
          team_id,
          sporting_director_id,
          rider_rank,
          uci_points,
          overall_rating,
          response_status
        )
        select
          v_nation_selection_id,
          ranked_riders.rider_id,
          ranked_riders.team_id,
          ranked_riders.sporting_director_id,
          ranked_riders.rider_rank,
          ranked_riders.uci_points,
          ranked_riders.overall_rating,
          case
            when ranked_riders.is_injured then 'ineligible_injury'
            when ranked_riders.team_id is null then 'unavailable'
            else 'pending'
          end
        from (
          select
            rider.id as rider_id,
            ownership.team_id,
            ownership.sporting_director_id,
            coalesce(summary.points, 0)::integer as uci_points,
            round(
              (
                rating.mountain
                + rating.hills
                + rating.flat
                + rating.time_trial
                + rating.cobbles
                + rating.sprint
                + rating.acceleration
                + rating.downhill
                + rating.endurance
                + rating.resistance
                + rating.recovery
                + rating.breakaway
                + rating.prologue
              )::numeric / 13,
              2
            ) as overall_rating,
            exists (
              select 1
              from public.rider_injuries as injury
              where injury.rider_id = rider.id
                and injury.status = 'active'
                and injury.started_at <= p_now
                and injury.expected_recovery_at > p_now
            ) as is_injured,
            row_number() over (
              order by
                coalesce(summary.points, 0) desc,
                (
                  rating.mountain
                  + rating.hills
                  + rating.flat
                  + rating.time_trial
                  + rating.cobbles
                  + rating.sprint
                  + rating.acceleration
                  + rating.downhill
                  + rating.endurance
                  + rating.resistance
                  + rating.recovery
                  + rating.breakaway
                  + rating.prologue
                ) desc,
                rider.last_name,
                rider.first_name,
                rider.id
            ) as rider_rank
          from public.riders as rider
          join public.rider_season_ratings as rating
            on rating.rider_id = rider.id
           and rating.season_id = v_championship.season_id
          left join public.rider_season_summaries as summary
            on summary.rider_id = rider.id
           and summary.season_id = v_championship.season_id
          left join lateral (
            select
              contract.team_id,
              assignment.sporting_director_id
            from public.rider_contracts as contract
            left join public.team_manager_assignments as assignment
              on assignment.team_id = contract.team_id
             and assignment.role = 'general_manager'
             and assignment.status = 'active'
            where contract.rider_id = rider.id
              and contract.status = 'active'
            order by
              (assignment.sporting_director_id is not null) desc,
              contract.created_at desc
            limit 1
          ) as ownership on true
          where rider.country_id = v_nation.country_id
            and rider.status = 'active'
        ) as ranked_riders
        order by ranked_riders.rider_rank;

        perform public.sync_international_championship_lineup(
          v_nation_selection_id
        );
        v_created := v_created + 1;
      end loop;
    end if;

    if v_championship.departure_at <= p_now then
      update public.international_championship_rider_selections as candidate
      set
        response_status = 'ineligible_injury',
        is_selected = false
      from public.international_championship_nation_selections as selection
      where selection.id = candidate.nation_selection_id
        and selection.race_edition_id = v_championship.race_edition_id
        and candidate.response_status in ('pending', 'confirmed')
        and exists (
          select 1
          from public.rider_injuries as injury
          where injury.rider_id = candidate.rider_id
            and injury.status = 'active'
            and injury.started_at < v_championship.departure_at
            and injury.expected_recovery_at > v_championship.departure_at
        );

      for v_nation_selection_id in
        select selection.id
        from public.international_championship_nation_selections as selection
        where selection.race_edition_id = v_championship.race_edition_id
          and selection.finalized_at is null
        order by selection.nation_rank
      loop
        perform public.sync_international_championship_lineup(
          v_nation_selection_id
        );

        update public.international_championship_rider_selections
        set
          response_status = 'automatic',
          responded_at = p_now
        where nation_selection_id = v_nation_selection_id
          and is_selected = true
          and response_status = 'pending';

        for v_selected_rider in
          select candidate.rider_id
          from public.international_championship_rider_selections as candidate
          where candidate.nation_selection_id = v_nation_selection_id
            and candidate.is_selected = true
            and candidate.response_status in ('confirmed', 'automatic')
        loop
          perform public.prioritize_international_championship_rider(
            v_nation_selection_id,
            v_selected_rider.rider_id
          );
        end loop;

        update public.international_championship_nation_selections
        set finalized_at = p_now
        where id = v_nation_selection_id;

        v_finalized := v_finalized + 1;
      end loop;
    end if;
  end loop;

  return query
  select v_created, v_finalized;
end;
$$;

revoke all
on function public.process_due_international_championship_selections(timestamptz)
from public, anon, authenticated;

grant execute
on function public.process_due_international_championship_selections(timestamptz)
to service_role;

-- ============================================================
-- RÉPONSE DU DIRECTEUR SPORTIF
-- L'identité et la propriété du coureur sont contrôlées côté base.
-- ============================================================

create or replace function public.respond_to_international_championship_selection(
  p_candidate_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_director_id uuid;
  v_candidate public.international_championship_rider_selections%rowtype;
  v_departure_at timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'international-championship-selections',
      0
    )
  );

  if p_accept is null then
    raise exception 'La décision de sélection est invalide.';
  end if;

  select director.id
  into v_director_id
  from public.sporting_directors as director
  where director.auth_user_id = auth.uid()
    and director.status = 'active';

  if v_director_id is null then
    raise exception using
      errcode = '42501',
      message = 'Aucun Directeur Sportif actif n''est associé à ce compte.';
  end if;

  select candidate.*
  into v_candidate
  from public.international_championship_rider_selections as candidate
  where candidate.id = p_candidate_id
  for update;

  if not found
    or v_candidate.sporting_director_id is distinct from v_director_id
  then
    raise exception using
      errcode = '42501',
      message = 'Vous ne pouvez pas répondre pour ce coureur.';
  end if;

  select min(stage.departure_at)
  into v_departure_at
  from public.international_championship_nation_selections as selection
  join public.stages as stage
    on stage.race_edition_id = selection.race_edition_id
  where selection.id = v_candidate.nation_selection_id;

  if v_candidate.response_status <> 'pending'
    or v_candidate.is_selected = false
  then
    raise exception
      'Une décision définitive a déjà été enregistrée pour ce coureur.';
  end if;

  if v_departure_at is null or now() >= v_departure_at then
    raise exception
      'Le départ est donné : la sélection est désormais définitive.';
  end if;

  if p_accept then
    update public.international_championship_rider_selections
    set
      response_status = 'confirmed',
      responded_at = now()
    where id = v_candidate.id;

    perform public.sync_international_championship_lineup(
      v_candidate.nation_selection_id
    );
    perform public.prioritize_international_championship_rider(
      v_candidate.nation_selection_id,
      v_candidate.rider_id
    );
  else
    update public.international_championship_rider_selections
    set
      response_status = 'declined',
      is_selected = false,
      responded_at = now()
    where id = v_candidate.id;

    perform public.sync_international_championship_lineup(
      v_candidate.nation_selection_id
    );
  end if;
end;
$$;

revoke all
on function public.respond_to_international_championship_selection(uuid, boolean)
from public, anon;

grant execute
on function public.respond_to_international_championship_selection(uuid, boolean)
to authenticated;

notify pgrst, 'reload schema';

commit;
