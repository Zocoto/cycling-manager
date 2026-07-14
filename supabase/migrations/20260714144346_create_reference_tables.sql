begin;

-- ============================================================
-- COUNTRIES
-- Référentiel partagé par les sponsors, équipes, coureurs
-- et courses.
-- ============================================================

create table public.countries (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  iso_alpha2 text not null,
  iso_alpha3 text not null,
  nationality_label text,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),

  constraint countries_name_not_empty
    check (btrim(name) <> ''),

  constraint countries_iso_alpha2_format
    check (
      char_length(iso_alpha2) = 2
      and iso_alpha2 = upper(iso_alpha2)
    ),

  constraint countries_iso_alpha3_format
    check (
      char_length(iso_alpha3) = 3
      and iso_alpha3 = upper(iso_alpha3)
    ),

  constraint countries_name_unique
    unique (name),

  constraint countries_iso_alpha2_unique
    unique (iso_alpha2),

  constraint countries_iso_alpha3_unique
    unique (iso_alpha3)
);


-- ============================================================
-- SEASONS
-- Une saison représente une année sportive du jeu.
-- La règle actuelle impose une durée de 28 jours consécutifs.
-- ============================================================

create table public.seasons (
  id uuid primary key default gen_random_uuid(),

  game_year integer not null,
  name text not null,

  starts_on date not null,
  ends_on date not null,

  status text not null default 'planned',
  current_day_number smallint,

  created_at timestamptz not null default now(),

  constraint seasons_game_year_positive
    check (game_year > 0),

  constraint seasons_name_not_empty
    check (btrim(name) <> ''),

  constraint seasons_duration_28_days
    check (ends_on = starts_on + 27),

  constraint seasons_status_allowed
    check (
      status in (
        'planned',
        'active',
        'completed',
        'cancelled'
      )
    ),

  constraint seasons_current_day_allowed
    check (
      current_day_number is null
      or current_day_number between 1 and 28
    ),

  constraint seasons_game_year_unique
    unique (game_year)
);

-- Une seule saison peut être active à la fois.
create unique index seasons_one_active_idx
  on public.seasons (status)
  where status = 'active';


-- ============================================================
-- SEASON DAYS
-- Les 28 journées constituant le calendrier d’une saison.
-- Une étape ou une course d’un jour occupera une journée.
-- ============================================================

create table public.season_days (
  id uuid primary key default gen_random_uuid(),

  season_id uuid not null
    references public.seasons(id)
    on delete cascade,

  day_number smallint not null,
  calendar_date date not null,

  label text,

  created_at timestamptz not null default now(),

  constraint season_days_number_allowed
    check (day_number between 1 and 28),

  constraint season_days_number_unique
    unique (season_id, day_number),

  constraint season_days_date_unique
    unique (season_id, calendar_date)
);


-- ============================================================
-- DIVISIONS
-- Référentiel des niveaux sportifs des équipes.
-- L’affectation d’une équipe sera historisée par saison dans
-- une future table team_seasons.
-- ============================================================

create table public.divisions (
  id uuid primary key default gen_random_uuid(),

  code text not null,
  name text not null,

  rank_order smallint not null,
  default_team_limit integer,

  description text,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),

  constraint divisions_code_not_empty
    check (btrim(code) <> ''),

  constraint divisions_name_not_empty
    check (btrim(name) <> ''),

  constraint divisions_rank_positive
    check (rank_order > 0),

  constraint divisions_team_limit_positive
    check (
      default_team_limit is null
      or default_team_limit > 0
    ),

  constraint divisions_code_unique
    unique (code),

  constraint divisions_name_unique
    unique (name),

  constraint divisions_rank_unique
    unique (rank_order)
);


-- ============================================================
-- RACE CATEGORIES
-- Référentiel des catégories de courses.
-- Le barème détaillé des points sera stocké plus tard dans
-- des règles dédiées afin de gérer les places, étapes et
-- classements généraux.
-- ============================================================

create table public.race_categories (
  id uuid primary key default gen_random_uuid(),

  code text not null,
  name text not null,

  race_format_scope text not null default 'both',
  prestige_rank smallint not null,

  description text,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),

  constraint race_categories_code_not_empty
    check (btrim(code) <> ''),

  constraint race_categories_name_not_empty
    check (btrim(name) <> ''),

  constraint race_categories_format_allowed
    check (
      race_format_scope in (
        'one_day',
        'stage_race',
        'both'
      )
    ),

  constraint race_categories_prestige_positive
    check (prestige_rank > 0),

  constraint race_categories_code_unique
    unique (code),

  constraint race_categories_name_unique
    unique (name)
);


-- ============================================================
-- SECURITY
-- Les tables sont fermées par défaut.
-- Les politiques d’accès seront ajoutées explicitement lorsque
-- les fonctionnalités concernées seront développées.
-- ============================================================

alter table public.countries enable row level security;
alter table public.seasons enable row level security;
alter table public.season_days enable row level security;
alter table public.divisions enable row level security;
alter table public.race_categories enable row level security;


-- ============================================================
-- DOCUMENTATION POSTGRES
-- ============================================================

comment on table public.countries is
  'Référentiel des pays utilisés par les entités métier.';

comment on table public.seasons is
  'Saisons sportives du jeu, composées de 28 jours consécutifs.';

comment on table public.season_days is
  'Journées constituant le calendrier d’une saison.';

comment on table public.divisions is
  'Référentiel des divisions sportives des équipes.';

comment on table public.race_categories is
  'Référentiel des catégories et niveaux de prestige des courses.';

commit;