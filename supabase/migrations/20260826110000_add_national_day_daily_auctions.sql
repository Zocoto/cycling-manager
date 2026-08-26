-- Ajoute cinq coureurs bonus lors de la fête nationale mise en avant.
-- Chaque pays concerné apporte cinq profils ; le maximum observé est borné à 35.

begin;

alter table public.transfer_daily_batches
  drop constraint if exists transfer_daily_batches_rider_count;
alter table public.transfer_daily_batches
  add constraint transfer_daily_batches_rider_count
    check (rider_count in (5, 10, 15, 20, 25, 30, 35));

alter table public.transfer_market_listings
  add column is_national_day_bonus boolean not null default false;

alter table public.transfer_market_listings
  drop constraint if exists transfer_market_daily_shape;
alter table public.transfer_market_listings
  add constraint transfer_market_daily_shape check (
    (
      listing_type = 'daily'
      and seller_team_id is null
      and market_date is not null
      and daily_slot between 1 and 35
    )
    or
    (
      listing_type = 'director'
      and seller_team_id is not null
      and market_date is null
      and daily_slot is null
      and is_national_day_bonus = false
    )
  );

alter table public.transfer_market_listings
  add constraint transfer_market_national_day_bonus_shape check (
    is_national_day_bonus = false or listing_type = 'daily'
  );

create or replace function public.calculate_initial_rider_potential_steps(
  p_rider_id uuid,
  p_generation_source text default 'amateur'
)
returns integer
language sql
immutable
set search_path = public
as $$
  with roll as (
    select (
      (
        hashtextextended(
          p_rider_id::text || ':potential:' || p_generation_source,
          0
        ) % 10000 + 10000
      ) % 10000
    )::integer as value
  )
  select case
    -- Bonus discret : +0,17 étoile de potentiel moyen par rapport au lot normal.
    when p_generation_source = 'national_day_auction' and value < 2500 then 1
    when p_generation_source = 'national_day_auction' and value < 6800 then 2
    when p_generation_source = 'national_day_auction' and value < 9300 then 3
    when p_generation_source = 'national_day_auction' and value < 9800 then 4
    when p_generation_source = 'national_day_auction' and value < 9920 then 5
    when p_generation_source = 'national_day_auction' and value < 9970 then 6
    when p_generation_source = 'national_day_auction' and value < 9995 then 7
    when p_generation_source = 'national_day_auction' then 8
    when p_generation_source = 'auction' and value < 4200 then 1
    when p_generation_source = 'auction' and value < 8000 then 2
    when p_generation_source = 'auction' and value < 9700 then 3
    when p_generation_source = 'auction' and value < 9900 then 4
    when p_generation_source = 'auction' and value < 9955 then 5
    when p_generation_source = 'auction' and value < 9980 then 6
    when p_generation_source = 'auction' and value < 9995 then 7
    when p_generation_source = 'auction' then 8
    when value < 7000 then 1
    else 2
  end
  from roll;
$$;

comment on function public.calculate_initial_rider_potential_steps(uuid, text)
is 'Attribue un potentiel déterministe selon la source ; la sélection de fête nationale reçoit un léger bonus moyen.';

create or replace function public.assign_daily_auction_rider_potential()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.listing_type = 'daily' then
    update public.riders
    set potential_steps = public.calculate_initial_rider_potential_steps(
      new.rider_id,
      case
        when new.is_national_day_bonus then 'national_day_auction'
        else 'auction'
      end
    )
    where id = new.rider_id;
  end if;
  return new;
end;
$$;

create or replace function public.create_daily_transfer_market(
  p_market_date date,
  p_rider_identities jsonb,
  p_force boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market_date date := coalesce(
    p_market_date,
    (now() at time zone 'Europe/Paris')::date
  );
  v_open_at timestamptz;
  v_close_at timestamptz;
  v_active_season public.seasons%rowtype;
  v_identity jsonb;
  v_identity_count integer;
  v_bonus_count integer;
  v_is_national_day_bonus boolean;
  v_slot integer;
  v_rider_id uuid;
  v_seed text;
  v_age integer;
  v_stat_minimum integer;
  v_stat_maximum integer;
  v_overall_cap integer;
  v_overall numeric;
  v_adjustment integer;
  v_salary numeric;
  v_minimum_bid numeric;
  v_country_profile text;
  v_ability_code text;
  v_bonus_ability_codes text[] := array[
    'bottle_carrier',
    'chase_potato',
    'cyclocrossman',
    'flahute',
    'giclette',
    'iron_health',
    'locomotive',
    'metronome',
    'panache',
    'pistard',
    'sandwich_man',
    'three_lungs'
  ];
begin
  v_open_at := (v_market_date + time '09:00') at time zone 'Europe/Paris';
  v_close_at := (v_market_date + time '18:00') at time zone 'Europe/Paris';

  if not p_force and now() < v_open_at then
    return 0;
  end if;

  if jsonb_typeof(p_rider_identities) <> 'array' then
    raise exception 'Les identités du marché quotidien doivent former un tableau.';
  end if;

  v_identity_count := jsonb_array_length(p_rider_identities);
  if v_identity_count < 10
    or v_identity_count > 35
    or (v_identity_count - 10) % 5 <> 0 then
    raise exception 'Le marché quotidien exige dix identités, plus cinq par fête nationale.';
  end if;

  select count(*)::integer
  into v_bonus_count
  from jsonb_array_elements(p_rider_identities) as identity
  where coalesce((identity ->> 'is_national_day_bonus')::boolean, false);

  if v_bonus_count <> v_identity_count - 10 then
    raise exception 'Le nombre de coureurs bonus ne correspond pas aux fêtes nationales.';
  end if;

  if v_bonus_count > 0 then
    if exists (
      select 1
      from jsonb_array_elements(p_rider_identities) as identity
      where coalesce((identity ->> 'is_national_day_bonus')::boolean, false)
      group by identity ->> 'country_id'
      having count(*) <> 5
    ) then
      raise exception 'Chaque fête nationale doit apporter exactement cinq coureurs.';
    end if;
  end if;

  select *
  into v_active_season
  from public.seasons
  where status = 'active'
  limit 1;

  if v_active_season is null then
    raise exception 'Aucune saison active n’est disponible.';
  end if;

  insert into public.transfer_daily_batches (market_date, rider_count)
  values (v_market_date, v_identity_count)
  on conflict (market_date) do nothing;

  if not found then
    return 0;
  end if;

  for v_identity, v_slot in
    select value, ordinality::integer
    from jsonb_array_elements(p_rider_identities) with ordinality
  loop
    if coalesce(v_identity ->> 'first_name', '') = ''
      or coalesce(v_identity ->> 'last_name', '') = '' then
      raise exception 'Une identité de coureur est incomplète.';
    end if;

    v_is_national_day_bonus := coalesce(
      (v_identity ->> 'is_national_day_bonus')::boolean,
      false
    );
    v_stat_minimum := case when v_is_national_day_bonus then 44 else 42 end;
    v_stat_maximum := case when v_is_national_day_bonus then 72 else 70 end;
    v_overall_cap := case when v_is_national_day_bonus then 67 else 65 end;

    select profile.name_profile_code
    into v_country_profile
    from public.countries as country
    join public.country_rider_generation_profiles as profile
      on profile.country_id = country.id
    where country.id = (v_identity ->> 'country_id')::uuid
      and country.is_active = true;

    if v_country_profile is null then
      raise exception 'Le pays d’un coureur ne permet pas sa génération.';
    end if;

    insert into public.riders (
      country_id,
      first_name,
      last_name,
      status,
      generated_name_profile_code
    )
    values (
      (v_identity ->> 'country_id')::uuid,
      left(btrim(v_identity ->> 'first_name'), 80),
      left(btrim(v_identity ->> 'last_name'), 80),
      'free_agent',
      v_country_profile
    )
    returning id into v_rider_id;

    v_seed :=
      v_market_date::text || ':' || v_slot::text || ':' || v_rider_id::text;
    v_age := public.calculate_market_random_stat(v_seed, 'age', 18, 30);

    insert into public.rider_season_ratings (
      rider_id,
      season_id,
      age,
      mountain,
      hills,
      flat,
      time_trial,
      cobbles,
      sprint,
      acceleration,
      downhill,
      endurance,
      resistance,
      recovery,
      breakaway,
      prologue
    )
    values (
      v_rider_id,
      v_active_season.id,
      v_age,
      public.calculate_market_random_stat(v_seed, 'mountain', v_stat_minimum, v_stat_maximum),
      public.calculate_market_random_stat(v_seed, 'hills', v_stat_minimum, v_stat_maximum),
      public.calculate_market_random_stat(v_seed, 'flat', v_stat_minimum, v_stat_maximum),
      public.calculate_market_random_stat(v_seed, 'time_trial', v_stat_minimum, v_stat_maximum),
      public.calculate_market_random_stat(v_seed, 'cobbles', v_stat_minimum, v_stat_maximum),
      public.calculate_market_random_stat(v_seed, 'sprint', v_stat_minimum, v_stat_maximum),
      public.calculate_market_random_stat(v_seed, 'acceleration', v_stat_minimum, v_stat_maximum),
      public.calculate_market_random_stat(v_seed, 'downhill', v_stat_minimum, v_stat_maximum),
      public.calculate_market_random_stat(v_seed, 'endurance', v_stat_minimum, v_stat_maximum),
      public.calculate_market_random_stat(v_seed, 'resistance', v_stat_minimum, v_stat_maximum),
      public.calculate_market_random_stat(v_seed, 'recovery', v_stat_minimum, v_stat_maximum),
      public.calculate_market_random_stat(v_seed, 'breakaway', v_stat_minimum, v_stat_maximum),
      public.calculate_market_random_stat(v_seed, 'prologue', v_stat_minimum, v_stat_maximum)
    );

    v_overall :=
      public.calculate_rider_overall(v_rider_id, v_active_season.id);

    if v_overall > v_overall_cap then
      v_adjustment := ceil(v_overall - v_overall_cap)::integer;

      update public.rider_season_ratings
      set
        mountain = greatest(0, mountain - v_adjustment),
        hills = greatest(0, hills - v_adjustment),
        flat = greatest(0, flat - v_adjustment),
        time_trial = greatest(0, time_trial - v_adjustment),
        cobbles = greatest(0, cobbles - v_adjustment),
        sprint = greatest(0, sprint - v_adjustment),
        acceleration = greatest(0, acceleration - v_adjustment),
        downhill = greatest(0, downhill - v_adjustment),
        endurance = greatest(0, endurance - v_adjustment),
        resistance = greatest(0, resistance - v_adjustment),
        recovery = greatest(0, recovery - v_adjustment),
        breakaway = greatest(0, breakaway - v_adjustment),
        prologue = greatest(0, prologue - v_adjustment)
      where rider_id = v_rider_id
        and season_id = v_active_season.id;

      v_overall :=
        public.calculate_rider_overall(v_rider_id, v_active_season.id);
    end if;

    v_salary :=
      public.calculate_rider_season_salary(v_rider_id, v_active_season.id);
    v_minimum_bid := greatest(
      2500,
      round(
        (
          3000
          + power(greatest(0, v_overall - 45), 2) * 80
          + greatest(0, 24 - v_age) * 250
        ) / 500
      ) * 500
    );

    insert into public.transfer_market_listings (
      rider_id,
      season_id,
      listing_type,
      market_date,
      daily_slot,
      is_national_day_bonus,
      minimum_bid,
      salary_per_season,
      opens_at,
      closes_at
    )
    values (
      v_rider_id,
      v_active_season.id,
      'daily',
      v_market_date,
      v_slot,
      v_is_national_day_bonus,
      v_minimum_bid,
      v_salary,
      v_open_at,
      v_close_at
    );

    -- 4 % par coureur : environ une journée spéciale sur cinq révèle un talent inné.
    if v_is_national_day_bonus
      and public.calculate_market_random_stat(
        v_seed,
        'national_day_ability_roll',
        0,
        999
      ) < 40 then
      v_ability_code := v_bonus_ability_codes[
        1 + public.calculate_market_random_stat(
          v_seed,
          'national_day_ability_code',
          0,
          array_length(v_bonus_ability_codes, 1) - 1
        )
      ];

      insert into public.rider_special_abilities (
        rider_id,
        ability_code,
        source_type,
        source_reference
      )
      select
        v_rider_id,
        ability.code,
        'national_day_auction',
        'national-day:' || v_market_date::text
      from public.special_ability_catalog as ability
      where ability.code = v_ability_code
        and ability.is_active
      on conflict (rider_id, ability_code) do nothing;
    end if;
  end loop;

  return v_identity_count;
exception
  when others then
    delete from public.transfer_daily_batches
    where market_date = v_market_date;
    raise;
end;
$$;

comment on function public.create_daily_transfer_market(date, jsonb, boolean)
is 'Génère dix enchères quotidiennes, plus cinq profils légèrement renforcés pour chaque fête nationale du jour.';

comment on column public.transfer_market_listings.is_national_day_bonus
is 'Identifie une des cinq annonces légèrement renforcées de la fête nationale du jour.';

notify pgrst, 'reload schema';

commit;
