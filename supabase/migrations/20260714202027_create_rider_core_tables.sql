begin;

-- ============================================================
-- RIDERS
-- Identité permanente des coureurs.
-- L'âge et les caractéristiques sportives sont enregistrés
-- séparément pour chaque saison.
-- ============================================================

create table public.riders (
  id uuid primary key default gen_random_uuid(),

  country_id uuid not null
    references public.countries(id)
    on delete restrict,

  first_name text not null,
  last_name text not null,

  status text not null default 'active',

  created_at timestamptz not null default now(),

  constraint riders_first_name_not_empty
    check (btrim(first_name) <> ''),

  constraint riders_last_name_not_empty
    check (btrim(last_name) <> ''),

  constraint riders_status_allowed
    check (
      status in (
        'active',
        'free_agent',
        'retired',
        'suspended'
      )
    )
);

create index riders_country_id_idx
  on public.riders (country_id);

create index riders_last_name_idx
  on public.riders (last_name);

create index riders_status_idx
  on public.riders (status);


-- ============================================================
-- RIDER CONTRACTS
-- Relation historisée entre un coureur et une équipe.
-- Un coureur libre est un coureur sans contrat actif.
-- ============================================================

create table public.rider_contracts (
  id uuid primary key default gen_random_uuid(),

  rider_id uuid not null
    references public.riders(id)
    on delete restrict,

  team_id uuid not null
    references public.teams(id)
    on delete restrict,

  start_season_id uuid not null
    references public.seasons(id)
    on delete restrict,

  end_season_id uuid not null
    references public.seasons(id)
    on delete restrict,

  salary_per_season numeric(12, 2) not null default 0,
  currency_code text not null default 'EUR',

  status text not null default 'planned',

  signed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint rider_contracts_salary_non_negative
    check (salary_per_season >= 0),

  constraint rider_contracts_currency_format
    check (
      char_length(currency_code) = 3
      and currency_code = upper(currency_code)
    ),

  constraint rider_contracts_status_allowed
    check (
      status in (
        'planned',
        'active',
        'completed',
        'terminated',
        'cancelled'
      )
    ),

  constraint rider_contracts_unique
    unique (
      rider_id,
      team_id,
      start_season_id
    )
);

create index rider_contracts_rider_id_idx
  on public.rider_contracts (rider_id);

create index rider_contracts_team_id_idx
  on public.rider_contracts (team_id);

create index rider_contracts_start_season_id_idx
  on public.rider_contracts (start_season_id);

create index rider_contracts_end_season_id_idx
  on public.rider_contracts (end_season_id);

-- Un coureur ne peut avoir qu'un seul contrat actif.
create unique index rider_contracts_one_active_per_rider_idx
  on public.rider_contracts (rider_id)
  where status = 'active';


-- ============================================================
-- RIDER SEASON RATINGS
-- Âge et caractéristiques sportives d'un coureur pour une saison.
-- Une ligne par coureur et par saison permet d'historiser son
-- vieillissement, sa progression et son déclin.
-- ============================================================

create table public.rider_season_ratings (
  id uuid primary key default gen_random_uuid(),

  rider_id uuid not null
    references public.riders(id)
    on delete cascade,

  season_id uuid not null
    references public.seasons(id)
    on delete cascade,

  age smallint not null,

  mountain smallint not null,
  hills smallint not null,
  flat smallint not null,
  time_trial smallint not null,
  cobbles smallint not null,

  sprint smallint not null,
  acceleration smallint not null,
  downhill smallint not null,

  endurance smallint not null,
  resistance smallint not null,
  recovery smallint not null,

  breakaway smallint not null,
  prologue smallint not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rider_season_ratings_unique
    unique (rider_id, season_id),

  constraint rider_season_ratings_age_range
    check (age between 15 and 60),

  constraint rider_season_ratings_mountain_range
    check (mountain between 0 and 100),

  constraint rider_season_ratings_hills_range
    check (hills between 0 and 100),

  constraint rider_season_ratings_flat_range
    check (flat between 0 and 100),

  constraint rider_season_ratings_time_trial_range
    check (time_trial between 0 and 100),

  constraint rider_season_ratings_cobbles_range
    check (cobbles between 0 and 100),

  constraint rider_season_ratings_sprint_range
    check (sprint between 0 and 100),

  constraint rider_season_ratings_acceleration_range
    check (acceleration between 0 and 100),

  constraint rider_season_ratings_downhill_range
    check (downhill between 0 and 100),

  constraint rider_season_ratings_endurance_range
    check (endurance between 0 and 100),

  constraint rider_season_ratings_resistance_range
    check (resistance between 0 and 100),

  constraint rider_season_ratings_recovery_range
    check (recovery between 0 and 100),

  constraint rider_season_ratings_breakaway_range
    check (breakaway between 0 and 100),

  constraint rider_season_ratings_prologue_range
    check (prologue between 0 and 100)
);

create index rider_season_ratings_rider_id_idx
  on public.rider_season_ratings (rider_id);

create index rider_season_ratings_season_id_idx
  on public.rider_season_ratings (season_id);


-- ============================================================
-- SECURITY
-- Les tables restent fermées tant que les politiques métier
-- d'accès et de modification ne sont pas définies.
-- ============================================================

alter table public.riders enable row level security;
alter table public.rider_contracts enable row level security;
alter table public.rider_season_ratings enable row level security;


-- ============================================================
-- DOCUMENTATION POSTGRES
-- ============================================================

comment on table public.riders is
  'Identités permanentes des coureurs cyclistes.';

comment on table public.rider_contracts is
  'Contrats historisés liant les coureurs aux équipes.';

comment on table public.rider_season_ratings is
  'Âge et caractéristiques sportives des coureurs, historisés par saison.';

comment on column public.rider_season_ratings.age is
  'Âge du coureur pendant la saison concernée. Il augmente de 1 à chaque nouvelle saison.';

commit;