-- Étend les enchères quotidiennes de 5 à 10 coureurs.
-- Les lots historiques à 5 restent valides et conservent leur cardinalité réelle.

begin;

alter table public.transfer_daily_batches
  alter column rider_count set default 10;

alter table public.transfer_daily_batches
  drop constraint if exists transfer_daily_batches_rider_count;

alter table public.transfer_daily_batches
  add constraint transfer_daily_batches_rider_count
    check (rider_count in (5, 10));

alter table public.transfer_market_listings
  drop constraint if exists transfer_market_daily_shape;

alter table public.transfer_market_listings
  add constraint transfer_market_daily_shape check (
    (
      listing_type = 'daily'
      and seller_team_id is null
      and market_date is not null
      and daily_slot between 1 and 10
    )
    or
    (
      listing_type = 'director'
      and seller_team_id is not null
      and market_date is null
      and daily_slot is null
    )
  );

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
  v_slot integer;
  v_rider_id uuid;
  v_seed text;
  v_age integer;
  v_overall numeric;
  v_adjustment integer;
  v_salary numeric;
  v_minimum_bid numeric;
  v_country_profile text;
begin
  v_open_at := (v_market_date + time '09:00') at time zone 'Europe/Paris';
  v_close_at := (v_market_date + time '18:00') at time zone 'Europe/Paris';

  if not p_force and now() < v_open_at then
    return 0;
  end if;

  if jsonb_typeof(p_rider_identities) <> 'array'
    or jsonb_array_length(p_rider_identities) <> 10 then
    raise exception 'Le marché quotidien exige exactement dix identités.';
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
  values (v_market_date, 10)
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
      public.calculate_market_random_stat(v_seed, 'mountain'),
      public.calculate_market_random_stat(v_seed, 'hills'),
      public.calculate_market_random_stat(v_seed, 'flat'),
      public.calculate_market_random_stat(v_seed, 'time_trial'),
      public.calculate_market_random_stat(v_seed, 'cobbles'),
      public.calculate_market_random_stat(v_seed, 'sprint'),
      public.calculate_market_random_stat(v_seed, 'acceleration'),
      public.calculate_market_random_stat(v_seed, 'downhill'),
      public.calculate_market_random_stat(v_seed, 'endurance'),
      public.calculate_market_random_stat(v_seed, 'resistance'),
      public.calculate_market_random_stat(v_seed, 'recovery'),
      public.calculate_market_random_stat(v_seed, 'breakaway'),
      public.calculate_market_random_stat(v_seed, 'prologue')
    );

    v_overall :=
      public.calculate_rider_overall(v_rider_id, v_active_season.id);

    if v_overall > 65 then
      v_adjustment := ceil(v_overall - 65)::integer;

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
      v_minimum_bid,
      v_salary,
      v_open_at,
      v_close_at
    );
  end loop;

  return 10;
exception
  when others then
    delete from public.transfer_daily_batches
    where market_date = v_market_date;
    raise;
end;
$$;

comment on function public.create_daily_transfer_market(date, jsonb, boolean)
is 'Génère les dix coureurs et enchères du marché quotidien entre 9 h et 18 h, une seule fois par date.';

commit;
