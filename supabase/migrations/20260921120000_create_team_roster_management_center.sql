begin;

-- ---------------------------------------------------------------------------
-- Pôle de gestion sportive : catalogue et construction.
-- ---------------------------------------------------------------------------

alter table public.team_infrastructures
  drop constraint if exists team_infrastructures_code_allowed,
  drop constraint if exists team_infrastructures_level_range;

alter table public.team_infrastructures
  add constraint team_infrastructures_code_allowed check (infrastructure_code in (
    'recruitment_data_room', 'staff_academy', 'training_center',
    'roster_management_center', 'fan_club_headquarters', 'club_shop',
    'indoor_track', 'cryotherapy_center', 'wind_tunnel', 'research_lab',
    'international_welcome_center', 'weather_center', 'tactical_center',
    'media_center'
  )),
  add constraint team_infrastructures_level_range check (
    (infrastructure_code = 'recruitment_data_room' and level between 1 and 3)
    or (infrastructure_code = 'research_lab' and level between 1 and 7)
    or (infrastructure_code not in ('recruitment_data_room', 'research_lab')
        and level between 1 and 5)
  );

alter table public.infrastructure_projects
  drop constraint if exists infrastructure_projects_code_allowed,
  drop constraint if exists infrastructure_projects_country_shape,
  drop constraint if exists infrastructure_projects_target_level_range;

alter table public.infrastructure_projects
  add constraint infrastructure_projects_code_allowed check (infrastructure_code in (
    'recruitment_data_room', 'staff_academy', 'training_center',
    'roster_management_center', 'fan_club_headquarters', 'club_shop',
    'international_youth_center', 'indoor_track', 'cryotherapy_center',
    'wind_tunnel', 'research_lab', 'international_welcome_center',
    'weather_center', 'tactical_center', 'media_center'
  )),
  add constraint infrastructure_projects_country_shape check (
    (infrastructure_code = 'international_youth_center' and country_id is not null)
    or (infrastructure_code <> 'international_youth_center' and country_id is null)
  ),
  add constraint infrastructure_projects_target_level_range check (
    (infrastructure_code = 'recruitment_data_room' and target_level between 1 and 3)
    or (infrastructure_code = 'research_lab' and target_level between 1 and 7)
    or (infrastructure_code = 'international_youth_center' and target_level between 1 and 5)
    or (infrastructure_code not in ('recruitment_data_room', 'research_lab', 'international_youth_center')
        and target_level between 1 and 5)
  );

create or replace function public.get_team_infrastructure_base_cost(
  p_infrastructure_code text,
  p_target_level integer
)
returns numeric
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_costs integer[];
begin
  case p_infrastructure_code
    when 'recruitment_data_room' then v_costs := array[200000, 350000, 550000];
    when 'staff_academy' then v_costs := array[1500000, 2100000, 2900000, 3900000, 5100000];
    when 'training_center' then v_costs := array[100000, 250000, 500000, 900000, 1500000];
    when 'roster_management_center' then v_costs := array[600000, 1100000, 1800000, 2800000, 4200000];
    when 'fan_club_headquarters' then v_costs := array[200000, 450000, 850000, 1400000, 2200000];
    when 'club_shop' then v_costs := array[150000, 350000, 650000, 1050000, 1600000];
    when 'international_youth_center' then v_costs := array[500000, 800000, 1200000, 1700000, 2300000];
    when 'indoor_track' then v_costs := array[180000, 450000, 900000, 1550000, 2400000];
    when 'cryotherapy_center' then v_costs := array[150000, 275000, 450000, 700000, 1000000];
    when 'wind_tunnel' then v_costs := array[400000, 850000, 1500000, 2400000, 3600000];
    when 'weather_center' then v_costs := array[50000, 90000, 150000, 230000, 350000];
    when 'media_center' then v_costs := array[650000, 1200000, 2000000, 3000000, 4300000];
    when 'international_welcome_center' then v_costs := array[800000, 1500000, 2500000, 3800000, 5500000];
    when 'research_lab' then v_costs := array[1200000, 2000000, 3000000, 4200000, 5600000, 7200000, 9000000];
    when 'tactical_center' then v_costs := array[3000000, 3900000, 5100000, 6600000, 8400000];
    else raise exception 'Cette infrastructure d’équipe n’existe pas.';
  end case;

  if p_target_level < 1 or p_target_level > cardinality(v_costs) then
    raise exception 'Niveau d’infrastructure d’équipe invalide.';
  end if;
  return v_costs[p_target_level];
end;
$$;

create or replace function public.get_team_infrastructure_base_duration_days(
  p_infrastructure_code text,
  p_target_level integer
)
returns integer
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_durations integer[];
begin
  case p_infrastructure_code
    when 'recruitment_data_room' then v_durations := array[7, 14, 21];
    when 'staff_academy' then v_durations := array[10, 16, 22, 28, 35];
    when 'training_center' then v_durations := array[5, 9, 14, 20, 28];
    when 'roster_management_center' then v_durations := array[7, 12, 18, 24, 30];
    when 'fan_club_headquarters' then v_durations := array[6, 10, 15, 21, 28];
    when 'club_shop' then v_durations := array[5, 9, 14, 20, 26];
    when 'international_youth_center' then v_durations := array[10, 16, 22, 28, 35];
    when 'indoor_track' then v_durations := array[7, 11, 16, 22, 28];
    when 'cryotherapy_center' then v_durations := array[6, 10, 15, 21, 28];
    when 'wind_tunnel' then v_durations := array[9, 14, 20, 27, 35];
    when 'weather_center' then v_durations := array[6, 10, 15, 21, 28];
    when 'tactical_center' then v_durations := array[12, 18, 24, 30, 35];
    when 'media_center' then v_durations := array[9, 14, 20, 27, 35];
    when 'international_welcome_center' then v_durations := array[10, 16, 22, 28, 35];
    when 'research_lab' then v_durations := array[10, 15, 20, 25, 30, 33, 35];
    else raise exception 'Cette infrastructure d’équipe n’existe pas.';
  end case;

  if p_target_level < 1 or p_target_level > cardinality(v_durations) then
    raise exception 'Niveau d’infrastructure d’équipe invalide.';
  end if;
  return v_durations[p_target_level];
end;
$$;

do $migration$
declare
  v_definition text;
  v_allowlist_needle text := E'    ''training_center'',\n    ''fan_club_headquarters'',';
  v_case_needle text := E'    when ''fan_club_headquarters'' then';
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.start_current_team_infrastructure_project(text,uuid,uuid)'::regprocedure
  ), chr(13), '') into v_definition;

  if position('''roster_management_center''' in v_definition) = 0 then
    if position(v_allowlist_needle in v_definition) = 0
      or position(v_case_needle in v_definition) = 0
    then
      raise exception 'Catalogue courant des infrastructures inattendu.';
    end if;
    v_definition := replace(
      v_definition,
      v_allowlist_needle,
      E'    ''training_center'',\n    ''roster_management_center'',\n    ''fan_club_headquarters'','
    );
    v_definition := replace(
      v_definition,
      v_case_needle,
      E'    when ''roster_management_center'' then\n'
        || E'      v_base_cost := 600000;\n'
        || E'      v_base_duration := (array[7,12,18,24,30]::integer[])[v_target_level];\n'
        || E'      v_description := ''Pôle de gestion sportive'';\n'
        || v_case_needle
    );
    execute v_definition;
  end if;

  select replace(pg_catalog.pg_get_functiondef(
    'public.start_current_team_infrastructure_project(text,uuid,uuid)'::regprocedure
  ), chr(13), '') into v_definition;
  if position('''roster_management_center''' in v_definition) = 0
    or position('''Pôle de gestion sportive''' in v_definition) = 0
  then
    raise exception 'Le Pôle de gestion sportive n’a pas été raccordé au lancement des chantiers.';
  end if;
end;
$migration$;

do $migration$
declare
  v_definition text;
  v_list_needle text := E'        ''international_welcome_center'', ''weather_center'', ''tactical_center'', ''media_center''';
  v_name_needle text := E'      when ''tactical_center'' then ''Centre tactique''\n      else ''Média Center'' end;';
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.settle_due_infrastructure_projects()'::regprocedure
  ), chr(13), '') into v_definition;

  if position('''roster_management_center''' in v_definition) = 0 then
    if position(v_list_needle in v_definition) = 0
      or position(v_name_needle in v_definition) = 0
    then
      raise exception 'Règlement courant des chantiers inattendu.';
    end if;
    v_definition := replace(
      v_definition,
      v_list_needle,
      E'        ''international_welcome_center'', ''weather_center'', ''tactical_center'',\n'
        || E'        ''roster_management_center'', ''media_center'''
    );
    v_definition := replace(
      v_definition,
      v_name_needle,
      E'      when ''tactical_center'' then ''Centre tactique''\n'
        || E'      when ''roster_management_center'' then ''Pôle de gestion sportive''\n'
        || E'      else ''Média Center'' end;'
    );
    execute v_definition;
  end if;

  select replace(pg_catalog.pg_get_functiondef(
    'public.settle_due_infrastructure_projects()'::regprocedure
  ), chr(13), '') into v_definition;
  if position('''roster_management_center''' in v_definition) = 0
    or position('''Pôle de gestion sportive''' in v_definition) = 0
  then
    raise exception 'Le Pôle de gestion sportive n’a pas été raccordé au règlement des chantiers.';
  end if;
end;
$migration$;

-- ---------------------------------------------------------------------------
-- Spécialisations du niveau 3.
-- ---------------------------------------------------------------------------

create or replace function public.is_valid_team_infrastructure_specialization(
  p_infrastructure_code text,
  p_specialization_code text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_infrastructure_code
    when 'recruitment_data_room' then p_specialization_code in ('market_intelligence', 'talent_network', 'deal_room')
    when 'staff_academy' then p_specialization_code in ('pedagogy', 'expertise', 'versatility')
    when 'training_center' then p_specialization_code in ('individualization', 'elite_performance', 'durability')
    when 'roster_management_center' then p_specialization_code in ('retention_cell', 'rotation_management', 'youth_pathway')
    when 'indoor_track' then p_specialization_code in ('pure_speed', 'explosiveness', 'leadout_school')
    when 'cryotherapy_center' then p_specialization_code in ('rapid_recovery', 'rehabilitation', 'load_management')
    when 'wind_tunnel' then p_specialization_code in ('solo_aero', 'team_aero', 'versatile_aero')
    when 'weather_center' then p_specialization_code in ('normal_weather', 'wet_protocol', 'extreme_weather')
    when 'tactical_center' then p_specialization_code in ('offensive_school', 'race_control', 'adaptive_cell')
    when 'media_center' then p_specialization_code in ('prestige_press', 'community_media', 'crisis_room')
    when 'international_welcome_center' then p_specialization_code in ('administrative_path', 'sporting_integration', 'youth_gateway')
    when 'research_lab' then p_specialization_code in ('pure_performance', 'reliability', 'frugal_innovation')
    when 'fan_club_headquarters' then p_specialization_code in ('recruitment_campaigns', 'loyalty_program', 'event_house')
    when 'club_shop' then p_specialization_code in ('volume_retail', 'premium_retail', 'limited_editions')
    else false
  end
$$;

-- ---------------------------------------------------------------------------
-- Capacité dynamique : 35 + 5 places par niveau, avec réserve jeunes.
-- ---------------------------------------------------------------------------

create or replace function public.get_team_roster_management_level(p_team_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select least(5, greatest(0, coalesce((
    select infrastructure.level
    from public.team_infrastructures as infrastructure
    where infrastructure.team_id = p_team_id
      and infrastructure.infrastructure_code = 'roster_management_center'
  ), 0)))::integer
$$;

create or replace function public.get_team_roster_base_limit(p_team_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select 35 + public.get_team_roster_management_level(p_team_id) * 5
$$;

create or replace function public.get_team_roster_youth_reserve(p_team_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.get_team_infrastructure_specialization(
      p_team_id, 'roster_management_center'
    ) is distinct from 'youth_pathway' then 0
    when public.get_team_roster_management_level(p_team_id) = 3 then 3
    when public.get_team_roster_management_level(p_team_id) = 4 then 4
    when public.get_team_roster_management_level(p_team_id) >= 5 then 5
    else 0
  end
$$;

create or replace function public.get_team_roster_limit(p_team_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_team_roster_base_limit(p_team_id)
    + public.get_team_roster_youth_reserve(p_team_id)
$$;

create or replace function public.is_team_homegrown_rider(
  p_team_id uuid,
  p_rider_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.youth_academy_riders as academy
    where academy.team_id = p_team_id
      and academy.promoted_rider_id = p_rider_id
  )
$$;

create or replace function public.get_team_non_homegrown_roster_commitment_count(
  p_team_id uuid,
  p_game_year integer
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with contract_slots as (
    select contract.rider_id, 'contract:' || contract.rider_id::text as slot_key
    from public.rider_contracts as contract
    join public.seasons as start_season on start_season.id = contract.start_season_id
    join public.seasons as end_season on end_season.id = contract.end_season_id
    where contract.team_id = p_team_id
      and contract.status in ('active', 'planned')
      and p_game_year between start_season.game_year and end_season.game_year
      and contract.acquisition_type is distinct from 'academy'
      and not public.is_team_homegrown_rider(p_team_id, contract.rider_id)
    group by contract.rider_id
  ),
  listing_leaders as (
    select distinct on (listing.id)
      listing.id as listing_id, listing.rider_id, listing.season_id, bid.team_id
    from public.transfer_market_listings as listing
    join public.transfer_market_bids as bid on bid.listing_id = listing.id
    where listing.status = 'open'
    order by listing.id, bid.amount desc, bid.created_at asc, bid.id asc
  ),
  transfer_slots as (
    select leader.rider_id, 'transfer:' || leader.listing_id::text as slot_key
    from listing_leaders as leader
    join public.seasons as listing_season on listing_season.id = leader.season_id
    where leader.team_id = p_team_id
      and p_game_year between listing_season.game_year and listing_season.game_year + 1
      and not public.is_team_homegrown_rider(p_team_id, leader.rider_id)
  )
  select count(*)::integer
  from (
    select slot_key from contract_slots
    union all
    select slot_key from transfer_slots
  ) as commitments
$$;

create or replace function public.can_team_reserve_roster_rider(
  p_team_id uuid,
  p_game_year integer,
  p_rider_id uuid,
  p_replace_existing_reservation boolean default false
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_is_homegrown boolean := public.is_team_homegrown_rider(p_team_id, p_rider_id);
  v_total integer := public.get_team_roster_commitment_count(p_team_id, p_game_year);
  v_non_homegrown integer := public.get_team_non_homegrown_roster_commitment_count(p_team_id, p_game_year);
begin
  if p_replace_existing_reservation then
    v_total := greatest(0, v_total - 1);
    if not v_is_homegrown then
      v_non_homegrown := greatest(0, v_non_homegrown - 1);
    end if;
  end if;

  return v_total + 1 <= public.get_team_roster_limit(p_team_id)
    and (
      v_is_homegrown
      or v_non_homegrown + 1 <= public.get_team_roster_base_limit(p_team_id)
    );
end;
$$;

create or replace function public.get_team_roster_capacity_summary(
  p_team_id uuid,
  p_game_year integer
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'buildingLevel', public.get_team_roster_management_level(p_team_id),
    'specialization', public.get_team_infrastructure_specialization(
      p_team_id, 'roster_management_center'
    ),
    'baseLimit', public.get_team_roster_base_limit(p_team_id),
    'youthReserveSlots', public.get_team_roster_youth_reserve(p_team_id),
    'totalLimit', public.get_team_roster_limit(p_team_id),
    'commitmentCount', public.get_team_roster_commitment_count(p_team_id, p_game_year),
    'nonHomegrownCommitmentCount',
      public.get_team_non_homegrown_roster_commitment_count(p_team_id, p_game_year)
  )
$$;

create or replace function public.enforce_team_roster_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start_game_year integer;
  v_end_game_year integer;
  v_game_year integer;
  v_commitment_count integer;
  v_non_homegrown_count integer;
  v_replaced_commitment integer;
  v_is_homegrown boolean;
begin
  if new.status not in ('active', 'planned') then return new; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('team-roster:' || new.team_id::text, 0)
  );

  select season.game_year into v_start_game_year
  from public.seasons as season where season.id = new.start_season_id;
  select season.game_year into v_end_game_year
  from public.seasons as season where season.id = new.end_season_id;
  if v_start_game_year is null or v_end_game_year is null then
    raise exception 'Les saisons du contrat coureur sont invalides.';
  end if;

  v_is_homegrown := new.acquisition_type = 'academy'
    or public.is_team_homegrown_rider(new.team_id, new.rider_id);

  for v_game_year in v_start_game_year..v_end_game_year loop
    v_commitment_count := public.get_team_roster_commitment_count(new.team_id, v_game_year);
    v_non_homegrown_count := public.get_team_non_homegrown_roster_commitment_count(
      new.team_id, v_game_year
    );
    v_replaced_commitment := 0;

    if new.acquisition_type in ('daily_auction', 'director_auction')
      and exists (
        select 1
        from public.transfer_market_listings as listing
        join public.seasons as listing_season on listing_season.id = listing.season_id
        join lateral (
          select bid.team_id
          from public.transfer_market_bids as bid
          where bid.listing_id = listing.id
          order by bid.amount desc, bid.created_at asc, bid.id asc
          limit 1
        ) as leader on leader.team_id = new.team_id
        where listing.rider_id = new.rider_id
          and listing.status = 'open'
          and v_game_year between listing_season.game_year and listing_season.game_year + 1
      )
    then
      v_replaced_commitment := 1;
    end if;

    if v_commitment_count - v_replaced_commitment > public.get_team_roster_limit(new.team_id)
      or (
        not v_is_homegrown
        and v_non_homegrown_count - v_replaced_commitment
          > public.get_team_roster_base_limit(new.team_id)
      )
    then
      raise exception
        'La capacité de l’effectif professionnel est atteinte pour la saison %.',
        v_game_year
        using errcode = '23514',
          hint = 'Améliorez le Pôle de gestion sportive ou libérez une place.';
    end if;
  end loop;
  return new;
end;
$$;

create or replace function public.enforce_transfer_bid_roster_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing record;
  v_current_leader_team_id uuid;
  v_game_year integer;
begin
  select listing.status, listing.rider_id, season.game_year
  into v_listing
  from public.transfer_market_listings as listing
  join public.seasons as season on season.id = listing.season_id
  where listing.id = new.listing_id;
  if not found or v_listing.status <> 'open' then return new; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('team-roster:' || new.team_id::text, 0)
  );
  select bid.team_id into v_current_leader_team_id
  from public.transfer_market_bids as bid
  where bid.listing_id = new.listing_id
  order by bid.amount desc, bid.created_at asc, bid.id asc
  limit 1;

  for v_game_year in v_listing.game_year..(v_listing.game_year + 1) loop
    if not public.can_team_reserve_roster_rider(
      new.team_id,
      v_game_year,
      v_listing.rider_id,
      v_current_leader_team_id = new.team_id
    ) then
      raise exception
        'La capacité de l’effectif professionnel est atteinte pour la saison %.',
        v_game_year
        using errcode = '23514',
          hint = 'Les places Passerelle espoirs sont réservées aux coureurs formés au club.';
    end if;
  end loop;
  return new;
end;
$$;

create or replace function private.get_team_roster_projection(
  p_team_id uuid,
  p_game_year integer
)
returns table (
  firm_commitment_count integer,
  scheduled_youth_count integer,
  projected_count integer,
  overflow_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with projection as (
    select
      public.get_team_roster_commitment_count(p_team_id, p_game_year)::integer
        as firm_commitment_count,
      (
        select count(*)::integer
        from public.youth_academy_riders as academy
        where academy.team_id = p_team_id
          and academy.status = 'recruited'
          and academy.promotion_game_year <= p_game_year
      ) as scheduled_youth_count
  )
  select projection.firm_commitment_count,
    projection.scheduled_youth_count,
    projection.firm_commitment_count + projection.scheduled_youth_count,
    greatest(
      0,
      projection.firm_commitment_count + projection.scheduled_youth_count
        - public.get_team_roster_limit(p_team_id)
    )::integer
  from projection
$$;

-- The J1 arbitration ranks only academy riders, so every remaining place,
-- including the youth reserve, is legitimately available to this block.
do $rollover$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.rollover_game_season(uuid,boolean)'::regprocedure
  ) into v_definition;
  v_definition := replace(v_definition, chr(13), '');

  if position('35 - coalesce(firm.rider_count, 0)' in v_definition) > 0 then
    v_definition := replace(
      v_definition,
      '35 - coalesce(firm.rider_count, 0)',
      'public.get_team_roster_limit(candidate.team_id) - coalesce(firm.rider_count, 0)'
    );
  end if;
  v_definition := replace(
    v_definition,
    'limitée à 35 coureurs, et rejoint les agents libres.',
    'dont la capacité disponible est atteinte, et rejoint les agents libres.'
  );
  if position('public.get_team_roster_limit(candidate.team_id)' in v_definition) = 0 then
    raise exception 'Arbitrage dynamique des promotions juniors introuvable.';
  end if;
  execute v_definition;
end;
$rollover$;

-- Les offres directes sont contrôlées avant leur dépôt puis à leur acceptation.
do $direct_offers$
declare
  v_definition text;
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.submit_direct_transfer_offer(uuid,numeric)'::regprocedure
  ), chr(13), '') into v_definition;
  if position('get_team_roster_commitment_count(v_context.team_id, v_context.game_year) >= 35' in v_definition) > 0 then
    v_definition := replace(
      v_definition,
      'public.get_team_roster_commitment_count(v_context.team_id, v_context.game_year) >= 35',
      E'not public.can_team_reserve_roster_rider(v_context.team_id, v_context.game_year, p_rider_id, false)\n'
        || E'    or not public.can_team_reserve_roster_rider(v_context.team_id, v_context.game_year + 1, p_rider_id, false)'
    );
    execute v_definition;
  end if;
  if position('public.can_team_reserve_roster_rider(v_context.team_id' in v_definition) = 0 then
    raise exception 'Capacité dynamique absente du dépôt des offres directes.';
  end if;

  select replace(pg_catalog.pg_get_functiondef(
    'public.respond_to_direct_transfer_offer(uuid,boolean)'::regprocedure
  ), chr(13), '') into v_definition;
  if position('get_team_roster_commitment_count(v_offer.buyer_team_id, v_context.game_year) >= 35' in v_definition) > 0 then
    v_definition := replace(
      v_definition,
      'public.get_team_roster_commitment_count(v_offer.buyer_team_id, v_context.game_year) >= 35',
      E'not public.can_team_reserve_roster_rider(v_offer.buyer_team_id, v_context.game_year, v_offer.rider_id, false)\n'
        || E'    or not public.can_team_reserve_roster_rider(v_offer.buyer_team_id, v_context.game_year + 1, v_offer.rider_id, false)'
    );
    execute v_definition;
  end if;
  if position('public.can_team_reserve_roster_rider(v_offer.buyer_team_id' in v_definition) = 0 then
    raise exception 'Capacité dynamique absente de l’acceptation des offres directes.';
  end if;
end;
$direct_offers$;

-- ---------------------------------------------------------------------------
-- Cellule de fidélisation : uniquement les futures prolongations.
-- ---------------------------------------------------------------------------

alter table public.rider_contracts
  add column if not exists roster_management_salary_before_discount numeric(12, 2),
  add column if not exists roster_management_discount_percent numeric(5, 2) not null default 0;

alter table public.rider_contracts
  drop constraint if exists rider_contracts_roster_management_discount_range;
alter table public.rider_contracts
  add constraint rider_contracts_roster_management_discount_range check (
    roster_management_discount_percent between 0 and 5
  );

create or replace function public.get_roster_management_renewal_discount(p_team_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.get_team_infrastructure_specialization(
      p_team_id, 'roster_management_center'
    ) is distinct from 'retention_cell' then 0::numeric
    when public.get_team_roster_management_level(p_team_id) = 3 then 3::numeric
    when public.get_team_roster_management_level(p_team_id) = 4 then 4::numeric
    when public.get_team_roster_management_level(p_team_id) >= 5 then 5::numeric
    else 0::numeric
  end
$$;

create or replace function public.apply_roster_management_renewal_discount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gross_salary numeric;
  v_discount numeric;
begin
  if new.acquisition_type <> 'renewal' or new.status <> 'planned' then
    new.roster_management_salary_before_discount := null;
    new.roster_management_discount_percent := 0;
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.salary_per_season is not distinct from old.salary_per_season
    and old.roster_management_salary_before_discount is not null
  then
    return new;
  end if;

  v_gross_salary := new.salary_per_season;
  v_discount := public.get_roster_management_renewal_discount(new.team_id);
  new.roster_management_salary_before_discount := v_gross_salary;
  new.roster_management_discount_percent := v_discount;
  new.salary_per_season := round(v_gross_salary * (1 - v_discount / 100), 2);
  return new;
end;
$$;

drop trigger if exists zz_apply_roster_management_renewal_discount
on public.rider_contracts;
create trigger zz_apply_roster_management_renewal_discount
before insert or update of salary_per_season, status, acquisition_type, team_id
on public.rider_contracts
for each row execute function public.apply_roster_management_renewal_discount();

do $renewal$
declare
  v_definition text;
  v_needle text := E'      v_existing.homegrown_salary_before_discount,\n      v_existing.salary_per_season';
begin
  select replace(pg_catalog.pg_get_functiondef(
    'public.renew_current_team_rider_until(uuid,integer)'::regprocedure
  ), chr(13), '') into v_definition;
  if position('v_existing.roster_management_salary_before_discount' in v_definition) = 0 then
    if position(v_needle in v_definition) = 0 then
      raise exception 'Base salariale des prolongations multi-saisons introuvable.';
    end if;
    v_definition := replace(
      v_definition,
      v_needle,
      E'      v_existing.homegrown_salary_before_discount,\n'
        || E'      v_existing.roster_management_salary_before_discount,\n'
        || E'      v_existing.salary_per_season'
    );
    execute v_definition;
  end if;
end;
$renewal$;

-- ---------------------------------------------------------------------------
-- Gestion des rotations : +1 après deux vrais jours consécutifs de repos.
-- ---------------------------------------------------------------------------

alter table public.rider_daily_condition_effects
  add column if not exists roster_rotation_bonus numeric(5, 2) not null default 0;

create table if not exists public.roster_management_rotation_recoveries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  rider_id uuid not null references public.riders(id) on delete cascade,
  source_season_day_id uuid not null references public.season_days(id) on delete cascade,
  target_season_day_id uuid not null references public.season_days(id) on delete cascade,
  form_gain numeric(5, 2) not null check (form_gain > 0 and form_gain <= 1),
  created_at timestamptz not null default now(),
  unique (rider_id, source_season_day_id)
);

alter table public.roster_management_rotation_recoveries enable row level security;
grant select on table public.roster_management_rotation_recoveries to authenticated;
grant all on table public.roster_management_rotation_recoveries to service_role;

create table if not exists public.roster_management_rollout (
  singleton boolean primary key default true check (singleton),
  starts_game_day_index integer not null
);

insert into public.roster_management_rollout (singleton, starts_game_day_index)
select true, season.game_year * 28 + coalesce(season.current_day_number, 1) - 1
from public.seasons as season
where season.status = 'active'
on conflict (singleton) do nothing;

create or replace function public.settle_due_roster_rotation_recovery()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season public.seasons%rowtype;
  v_day record;
  v_team record;
  v_candidate record;
  v_capacity integer;
  v_gain numeric;
  v_processed integer := 0;
begin
  select * into v_season
  from public.seasons where status = 'active' limit 1;
  if v_season.id is null then return 0; end if;

  for v_day in
    select day.id, day.day_number, previous_day.id as previous_day_id,
      next_day.id as next_day_id
    from public.season_days as day
    join public.season_days as previous_day
      on previous_day.season_id = day.season_id
     and previous_day.day_number = day.day_number - 1
    join public.season_days as next_day
      on next_day.season_id = day.season_id
     and next_day.day_number = day.day_number + 1
    cross join public.roster_management_rollout as rollout
    where day.season_id = v_season.id
      and day.day_number < coalesce(v_season.current_day_number, 1)
      and v_season.game_year * 28 + day.day_number - 1
        >= rollout.starts_game_day_index
    order by day.day_number
  loop
    for v_team in
      select infrastructure.team_id, infrastructure.level
      from public.team_infrastructures as infrastructure
      where infrastructure.infrastructure_code = 'roster_management_center'
        and infrastructure.level >= 3
        and public.get_team_infrastructure_specialization(
          infrastructure.team_id, 'roster_management_center'
        ) = 'rotation_management'
      order by infrastructure.team_id
    loop
      v_capacity := case v_team.level when 3 then 3 when 4 then 4 else 5 end;

      for v_candidate in
        select current_rest.id as effect_id, current_rest.rider_id,
          current_rest.form_after
        from public.rider_daily_condition_effects as current_rest
        join public.rider_daily_condition_effects as previous_rest
          on previous_rest.rider_id = current_rest.rider_id
         and previous_rest.season_day_id = v_day.previous_day_id
         and previous_rest.effect_type = 'rest'
        join public.rider_contracts as contract
          on contract.rider_id = current_rest.rider_id
         and contract.team_id = v_team.team_id
         and contract.status = 'active'
        join public.seasons as start_season on start_season.id = contract.start_season_id
        join public.seasons as end_season on end_season.id = contract.end_season_id
        where current_rest.season_day_id = v_day.id
          and current_rest.effect_type = 'rest'
          and current_rest.form_after < 100
          and v_season.game_year between start_season.game_year and end_season.game_year
          and not exists (
            select 1
            from public.roster_management_rotation_recoveries as recovery
            where recovery.rider_id = current_rest.rider_id
              and recovery.source_season_day_id = v_day.id
          )
        order by current_rest.form_after, current_rest.rider_id
        limit v_capacity
      loop
        v_gain := least(1, 100 - v_candidate.form_after);
        if v_gain <= 0 then continue; end if;

        insert into public.roster_management_rotation_recoveries (
          team_id, rider_id, source_season_day_id, target_season_day_id, form_gain
        ) values (
          v_team.team_id, v_candidate.rider_id, v_day.id, v_day.next_day_id, v_gain
        ) on conflict (rider_id, source_season_day_id) do nothing;
        if not found then continue; end if;

        update public.rider_daily_condition_effects
        set form_delta = form_delta + v_gain,
          form_after = least(100, form_after + v_gain),
          roster_rotation_bonus = roster_rotation_bonus + v_gain
        where id = v_candidate.effect_id;

        insert into public.rider_condition_states (
          rider_id, season_day_id, form, fatigue, source
        )
        select v_candidate.rider_id, v_day.next_day_id,
          least(100, v_candidate.form_after + v_gain),
          coalesce(previous_state.fatigue, 0), 'roster_rotation'
        from (select 1) as seed
        left join lateral (
          select state.fatigue
          from public.rider_condition_states as state
          join public.season_days as state_day on state_day.id = state.season_day_id
          where state.rider_id = v_candidate.rider_id
            and state_day.season_id = v_season.id
            and state_day.day_number <= v_day.day_number
          order by state_day.day_number desc
          limit 1
        ) as previous_state on true
        on conflict (rider_id, season_day_id) do update set
          form = least(100, public.rider_condition_states.form + v_gain),
          source = 'roster_rotation',
          updated_at = now();

        update public.rider_condition_states as state
        set form = least(100, state.form + v_gain),
          source = 'roster_rotation', updated_at = now()
        from public.season_days as state_day
        where state.season_day_id = state_day.id
          and state.rider_id = v_candidate.rider_id
          and state_day.season_id = v_season.id
          and state_day.day_number > v_day.day_number + 1;
        v_processed := v_processed + 1;
      end loop;
    end loop;
  end loop;
  return v_processed;
end;
$$;

revoke all on function public.get_team_roster_management_level(uuid)
  from public, anon, authenticated;
revoke all on function public.get_team_roster_base_limit(uuid)
  from public, anon, authenticated;
revoke all on function public.get_team_roster_youth_reserve(uuid)
  from public, anon, authenticated;
revoke all on function public.get_team_roster_limit(uuid)
  from public, anon, authenticated;
revoke all on function public.is_team_homegrown_rider(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.get_team_non_homegrown_roster_commitment_count(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.can_team_reserve_roster_rider(uuid, integer, uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.get_team_roster_capacity_summary(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.get_roster_management_renewal_discount(uuid)
  from public, anon, authenticated;
revoke all on function public.apply_roster_management_renewal_discount()
  from public, anon, authenticated;
revoke all on function public.settle_due_roster_rotation_recovery()
  from public, anon, authenticated;

grant execute on function public.get_team_roster_capacity_summary(uuid, integer)
  to authenticated, service_role;
grant execute on function public.settle_due_roster_rotation_recovery()
  to service_role;

comment on function public.get_team_roster_limit(uuid) is
  'Capacité totale de l’effectif professionnel, réserve jeunes incluse.';
comment on function public.get_team_roster_base_limit(uuid) is
  'Capacité ouverte à tous les coureurs : 35 plus cinq places par niveau du Pôle.';
comment on column public.rider_daily_condition_effects.roster_rotation_bonus is
  'Point de forme attribué par Gestion des rotations après 48 h de repos.';

notify pgrst, 'reload schema';
commit;
