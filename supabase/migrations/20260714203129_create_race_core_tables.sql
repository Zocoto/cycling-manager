begin;

-- ============================================================
-- RACES
-- Identité permanente d'une course.
-- Une course possède une nationalité et peut être organisée
-- sous la forme d'une course d'un jour ou d'un tour.
-- ============================================================

create table public.races (
  id uuid primary key default gen_random_uuid(),

  country_id uuid not null
    references public.countries(id)
    on delete restrict,

  name text not null,
  short_name text,

  race_format text not null,

  status text not null default 'active',

  created_at timestamptz not null default now(),

  constraint races_name_not_empty
    check (btrim(name) <> ''),

  constraint races_short_name_not_empty
    check (
      short_name is null
      or btrim(short_name) <> ''
    ),

  constraint races_format_allowed
    check (
      race_format in (
        'one_day',
        'stage_race'
      )
    ),

  constraint races_status_allowed
    check (
      status in (
        'active',
        'inactive',
        'discontinued'
      )
    )
);

create unique index races_name_lower_unique_idx
  on public.races (lower(name));

create index races_country_id_idx
  on public.races (country_id);

create index races_format_idx
  on public.races (race_format);


-- ============================================================
-- RACE EDITIONS
-- Édition d'une course pour une saison donnée.
-- La catégorie peut évoluer d'une saison à l'autre sans
-- modifier l'identité historique de la course.
-- ============================================================

create table public.race_editions (
  id uuid primary key default gen_random_uuid(),

  race_id uuid not null
    references public.races(id)
    on delete restrict,

  season_id uuid not null
    references public.seasons(id)
    on delete cascade,

  race_category_id uuid not null
    references public.race_categories(id)
    on delete restrict,

  edition_number smallint,
  display_name text not null,

  status text not null default 'planned',

  created_at timestamptz not null default now(),

  constraint race_editions_number_positive
    check (
      edition_number is null
      or edition_number > 0
    ),

  constraint race_editions_display_name_not_empty
    check (btrim(display_name) <> ''),

  constraint race_editions_status_allowed
    check (
      status in (
        'planned',
        'registration_open',
        'registration_closed',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),

  constraint race_editions_race_season_unique
    unique (race_id, season_id)
);

create index race_editions_race_id_idx
  on public.race_editions (race_id);

create index race_editions_season_id_idx
  on public.race_editions (season_id);

create index race_editions_category_id_idx
  on public.race_editions (race_category_id);

create index race_editions_status_idx
  on public.race_editions (status);


-- ============================================================
-- STAGES
-- Une édition comprend au minimum une étape.
-- Une course d'un jour est représentée par une seule étape.
-- Chaque étape occupe une journée du calendrier de 28 jours.
-- ============================================================

create table public.stages (
  id uuid primary key default gen_random_uuid(),

  race_edition_id uuid not null
    references public.race_editions(id)
    on delete cascade,

  season_day_id uuid not null
    references public.season_days(id)
    on delete restrict,

  stage_number smallint not null,
  name text not null,

  stage_type text not null default 'road',

  distance_km numeric(6, 2) not null,

  status text not null default 'planned',

  created_at timestamptz not null default now(),

  constraint stages_number_positive
    check (stage_number > 0),

  constraint stages_name_not_empty
    check (btrim(name) <> ''),

  constraint stages_distance_positive
    check (distance_km > 0),

  constraint stages_type_allowed
    check (
      stage_type in (
        'road',
        'individual_time_trial',
        'team_time_trial',
        'prologue'
      )
    ),

  constraint stages_status_allowed
    check (
      status in (
        'planned',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),

  constraint stages_number_unique
    unique (race_edition_id, stage_number),

  constraint stages_day_unique
    unique (race_edition_id, season_day_id)
);

create index stages_race_edition_id_idx
  on public.stages (race_edition_id);

create index stages_season_day_id_idx
  on public.stages (season_day_id);

create index stages_status_idx
  on public.stages (status);


-- ============================================================
-- STAGE SEGMENTS
-- Découpage ordonné du profil d'une étape.
-- La longueur standard envisagée est de 20 km, mais le dernier
-- tronçon peut être plus court et la longueur reste configurable.
--
-- Le relief et le revêtement sont deux notions distinctes :
-- une montée peut donc être bitumée ou pavée.
-- ============================================================

create table public.stage_segments (
  id uuid primary key default gen_random_uuid(),

  stage_id uuid not null
    references public.stages(id)
    on delete cascade,

  segment_number smallint not null,

  distance_km numeric(5, 2) not null,

  terrain_type text not null,
  surface_type text not null default 'asphalt',

  average_gradient_pct numeric(5, 2) not null default 0,

  created_at timestamptz not null default now(),

  constraint stage_segments_number_positive
    check (segment_number > 0),

  constraint stage_segments_distance_positive
    check (distance_km > 0),

  constraint stage_segments_terrain_allowed
    check (
      terrain_type in (
        'flat',
        'climb',
        'descent'
      )
    ),

  constraint stage_segments_surface_allowed
    check (
      surface_type in (
        'asphalt',
        'cobbles'
      )
    ),

  constraint stage_segments_gradient_range
    check (
      average_gradient_pct between -30 and 30
    ),

  constraint stage_segments_gradient_matches_terrain
    check (
      (
        terrain_type = 'flat'
        and average_gradient_pct = 0
      )
      or (
        terrain_type = 'climb'
        and average_gradient_pct > 0
      )
      or (
        terrain_type = 'descent'
        and average_gradient_pct < 0
      )
    ),

  constraint stage_segments_number_unique
    unique (stage_id, segment_number)
);

create index stage_segments_stage_id_idx
  on public.stage_segments (stage_id);

create index stage_segments_terrain_type_idx
  on public.stage_segments (terrain_type);

create index stage_segments_surface_type_idx
  on public.stage_segments (surface_type);


-- ============================================================
-- RACE REGISTRATIONS
-- Inscription d'une équipe, pour une saison donnée, à une
-- édition de course.
-- Une équipe peut courir plusieurs courses le même jour avec
-- des groupes de coureurs différents.
-- ============================================================

create table public.race_registrations (
  id uuid primary key default gen_random_uuid(),

  race_edition_id uuid not null
    references public.race_editions(id)
    on delete cascade,

  team_season_id uuid not null
    references public.team_seasons(id)
    on delete cascade,

  entry_method text not null default 'requested',
  status text not null default 'pending',

  registered_at timestamptz,
  decided_at timestamptz,

  created_at timestamptz not null default now(),

  constraint race_registrations_entry_method_allowed
    check (
      entry_method in (
        'requested',
        'invited',
        'automatic'
      )
    ),

  constraint race_registrations_status_allowed
    check (
      status in (
        'pending',
        'accepted',
        'rejected',
        'withdrawn'
      )
    ),

  constraint race_registrations_team_unique
    unique (race_edition_id, team_season_id)
);

create index race_registrations_race_edition_id_idx
  on public.race_registrations (race_edition_id);

create index race_registrations_team_season_id_idx
  on public.race_registrations (team_season_id);

create index race_registrations_status_idx
  on public.race_registrations (status);


-- ============================================================
-- RACE ROSTERS
-- Liste des coureurs sélectionnés par une équipe pour une course.
-- L'inscription de l'équipe et la sélection des coureurs sont
-- volontairement séparées.
-- ============================================================

create table public.race_rosters (
  id uuid primary key default gen_random_uuid(),

  race_registration_id uuid not null
    references public.race_registrations(id)
    on delete cascade,

  rider_id uuid not null
    references public.riders(id)
    on delete restrict,

  bib_number smallint,

  status text not null default 'selected',

  selected_at timestamptz not null default now(),

  created_at timestamptz not null default now(),

  constraint race_rosters_bib_number_positive
    check (
      bib_number is null
      or bib_number > 0
    ),

  constraint race_rosters_status_allowed
    check (
      status in (
        'selected',
        'confirmed',
        'withdrawn',
        'did_not_start'
      )
    ),

  constraint race_rosters_rider_unique
    unique (race_registration_id, rider_id),

  constraint race_rosters_bib_unique
    unique (race_registration_id, bib_number)
);

create index race_rosters_registration_id_idx
  on public.race_rosters (race_registration_id);

create index race_rosters_rider_id_idx
  on public.race_rosters (rider_id);

create index race_rosters_status_idx
  on public.race_rosters (status);


-- ============================================================
-- SECURITY
-- Les politiques d'accès seront créées lorsque les écrans et
-- les règles de gestion des courses seront développés.
-- ============================================================

alter table public.races enable row level security;
alter table public.race_editions enable row level security;
alter table public.stages enable row level security;
alter table public.stage_segments enable row level security;
alter table public.race_registrations enable row level security;
alter table public.race_rosters enable row level security;


-- ============================================================
-- DOCUMENTATION POSTGRES
-- ============================================================

comment on table public.races is
  'Identités permanentes des courses cyclistes.';

comment on table public.race_editions is
  'Éditions saisonnières des courses, associées à une catégorie.';

comment on table public.stages is
  'Étapes composant les éditions de course et occupant une journée du calendrier.';

comment on table public.stage_segments is
  'Tronçons ordonnés décrivant le relief et le revêtement du parcours d’une étape.';

comment on column public.stage_segments.distance_km is
  'Distance du tronçon. La longueur standard envisagée est de 20 km, sans constituer une contrainte.';

comment on column public.stage_segments.average_gradient_pct is
  'Pente moyenne signée : positive en montée, négative en descente et nulle sur le plat.';

comment on table public.race_registrations is
  'Inscriptions des équipes aux éditions de course.';

comment on table public.race_rosters is
  'Coureurs sélectionnés par une équipe pour participer à une édition de course.';

commit;