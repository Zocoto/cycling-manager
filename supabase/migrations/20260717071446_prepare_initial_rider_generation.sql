begin;

-- ============================================================
-- PROFILS DE NOMS DES COUREURS
-- Un profil regroupe des prénoms et noms cohérents avec un pays
-- ou une zone culturelle.
--
-- Exemples futurs :
--   france
--   italy
--   iberian
--   north_africa
--   east_asia
-- ============================================================

create table public.rider_name_profiles (
  code text primary key,
  label text not null,
  description text,

  created_at timestamptz not null default now(),

  constraint rider_name_profiles_code_not_empty
    check (btrim(code) <> ''),

  constraint rider_name_profiles_code_format
    check (code ~ '^[a-z0-9_]+$'),

  constraint rider_name_profiles_label_not_empty
    check (btrim(label) <> '')
);


-- ============================================================
-- ÉLÉMENTS DE NOMS
-- Bibliothèque de prénoms et noms de famille disponibles pour
-- chaque profil de génération.
--
-- Le poids permettra plus tard de rendre certains noms plus
-- fréquents que d'autres lors du tirage aléatoire.
-- ============================================================

create table public.rider_name_parts (
  id uuid primary key default gen_random_uuid(),

  profile_code text not null
    references public.rider_name_profiles(code)
    on delete cascade,

  name_type text not null,
  value text not null,

  weight smallint not null default 1,

  created_at timestamptz not null default now(),

  constraint rider_name_parts_type_allowed
    check (
      name_type in (
        'first_name',
        'last_name'
      )
    ),

  constraint rider_name_parts_value_not_empty
    check (btrim(value) <> ''),

  constraint rider_name_parts_weight_positive
    check (weight > 0)
);

create index rider_name_parts_profile_code_idx
  on public.rider_name_parts (profile_code);

create index rider_name_parts_profile_type_idx
  on public.rider_name_parts (
    profile_code,
    name_type
  );

create unique index rider_name_parts_unique_idx
  on public.rider_name_parts (
    profile_code,
    name_type,
    lower(value)
  );


-- ============================================================
-- PROFIL DE GÉNÉRATION PAR PAYS
-- Chaque pays actif est associé :
--   - à une bibliothèque de noms ;
--   - à un futur profil visuel régional.
--
-- Plusieurs pays peuvent partager le même profil régional.
-- ============================================================

create table public.country_rider_generation_profiles (
  country_id uuid primary key
    references public.countries(id)
    on delete cascade,

  name_profile_code text not null
    references public.rider_name_profiles(code)
    on delete restrict,

  avatar_profile_key text not null,

  created_at timestamptz not null default now(),

  constraint country_rider_generation_avatar_profile_not_empty
    check (btrim(avatar_profile_key) <> ''),

  constraint country_rider_generation_avatar_profile_format
    check (
      avatar_profile_key ~ '^[a-z0-9_]+$'
    )
);

create index country_rider_generation_name_profile_idx
  on public.country_rider_generation_profiles (
    name_profile_code
  );

create index country_rider_generation_avatar_profile_idx
  on public.country_rider_generation_profiles (
    avatar_profile_key
  );


-- ============================================================
-- PRÉPARATION DES FUTURS AVATARS DE COUREURS
--
-- Pendant l'US12, l'interface affichera une silhouette générique.
-- Ces informations permettront plus tard de construire un visage
-- stable et reproductible à partir d'éléments graphiques.
-- ============================================================

alter table public.riders
add column generated_name_profile_code text
  references public.rider_name_profiles(code)
  on delete set null;

alter table public.riders
add column avatar_profile_key text;

alter table public.riders
add column avatar_seed bigint;

alter table public.riders
add constraint riders_avatar_profile_key_not_empty
check (
  avatar_profile_key is null
  or btrim(avatar_profile_key) <> ''
);

alter table public.riders
add constraint riders_avatar_profile_key_format
check (
  avatar_profile_key is null
  or avatar_profile_key ~ '^[a-z0-9_]+$'
);

alter table public.riders
add constraint riders_avatar_seed_non_negative
check (
  avatar_seed is null
  or avatar_seed >= 0
);

create index riders_generated_name_profile_idx
  on public.riders (
    generated_name_profile_code
  );

create index riders_avatar_profile_key_idx
  on public.riders (
    avatar_profile_key
  );


-- ============================================================
-- REGISTRE DES GÉNÉRATIONS DE CARRIÈRE
-- Cette table protège contre la création multiple d'une équipe
-- et de plusieurs effectifs initiaux pour un même DS.
--
-- La future fonction transactionnelle enregistrera une seule
-- ligne après la création réussie de l'équipe et des 7 coureurs.
-- En cas d'échec, toute la transaction sera annulée.
-- ============================================================

create table public.initial_career_generations (
  id uuid primary key default gen_random_uuid(),

  sporting_director_id uuid not null
    references public.sporting_directors(id)
    on delete restrict,

  team_id uuid not null
    references public.teams(id)
    on delete restrict,

  season_id uuid not null
    references public.seasons(id)
    on delete restrict,

  rider_count smallint not null default 7,
  generation_version smallint not null default 1,

  created_at timestamptz not null default now(),

  constraint initial_career_generations_director_unique
    unique (sporting_director_id),

  constraint initial_career_generations_team_unique
    unique (team_id),

  constraint initial_career_generations_rider_count
    check (rider_count = 7),

  constraint initial_career_generations_version_positive
    check (generation_version > 0)
);

create index initial_career_generations_season_id_idx
  on public.initial_career_generations (
    season_id
  );


-- ============================================================
-- SÉCURITÉ
-- Ces référentiels et registres restent fermés par défaut.
-- La génération sera effectuée plus tard par une fonction
-- transactionnelle sécurisée.
-- ============================================================

alter table public.rider_name_profiles
enable row level security;

alter table public.rider_name_parts
enable row level security;

alter table public.country_rider_generation_profiles
enable row level security;

alter table public.initial_career_generations
enable row level security;


-- ============================================================
-- DOCUMENTATION POSTGRES
-- ============================================================

comment on table public.rider_name_profiles is
  'Profils nationaux ou régionaux utilisés pour générer des noms de coureurs cohérents.';

comment on table public.rider_name_parts is
  'Bibliothèque pondérée de prénoms et noms de famille par profil de génération.';

comment on table public.country_rider_generation_profiles is
  'Association entre chaque pays, son profil de noms et son futur profil visuel régional.';

comment on table public.initial_career_generations is
  'Registre empêchant la génération multiple de la carrière initiale d’un Directeur Sportif.';

comment on column public.riders.generated_name_profile_code is
  'Profil national ou régional ayant servi à générer le nom du coureur.';

comment on column public.riders.avatar_profile_key is
  'Profil visuel régional destiné au futur générateur d’avatars.';

comment on column public.riders.avatar_seed is
  'Graine numérique permettant de reproduire de manière stable le futur avatar du coureur.';

commit;