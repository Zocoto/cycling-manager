begin;

-- ============================================================
-- SPORTING DIRECTORS
-- Profil métier associé à un compte Supabase Auth.
-- L'identité métier est conservée même si le compte utilisateur
-- est supprimé ou dissocié ultérieurement.
-- ============================================================

create table public.sporting_directors (
  id uuid primary key default gen_random_uuid(),

  auth_user_id uuid unique
    references auth.users(id)
    on delete set null,

  country_id uuid
    references public.countries(id)
    on delete restrict,

  username text not null,
  display_name text not null,

  status text not null default 'active',
  onboarding_completed boolean not null default false,

  created_at timestamptz not null default now(),

  constraint sporting_directors_username_not_empty
    check (btrim(username) <> ''),

  constraint sporting_directors_display_name_not_empty
    check (btrim(display_name) <> ''),

  constraint sporting_directors_status_allowed
    check (
      status in (
        'active',
        'suspended',
        'retired'
      )
    )
);

-- L'unicité du pseudonyme ne dépend pas des majuscules.
create unique index sporting_directors_username_lower_unique_idx
  on public.sporting_directors (lower(username));


-- ============================================================
-- SPONSORS
-- Organisations susceptibles de financer une équipe.
-- Un sponsor reste distinct de l'équipe qu'il finance.
-- ============================================================

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),

  country_id uuid not null
    references public.countries(id)
    on delete restrict,

  name text not null,
  short_name text,
  industry text,

  status text not null default 'active',

  created_at timestamptz not null default now(),

  constraint sponsors_name_not_empty
    check (btrim(name) <> ''),

  constraint sponsors_short_name_not_empty
    check (
      short_name is null
      or btrim(short_name) <> ''
    ),

  constraint sponsors_status_allowed
    check (
      status in (
        'active',
        'inactive',
        'withdrawn'
      )
    )
);

create unique index sponsors_name_lower_unique_idx
  on public.sponsors (lower(name));

create index sponsors_country_id_idx
  on public.sponsors (country_id);


-- ============================================================
-- SPONSOR OFFERS
-- Offres disponibles pour les directeurs sportifs.
-- Les objectifs détaillés seront ajoutés dans une migration
-- ultérieure et reliés à ces offres.
-- ============================================================

create table public.sponsor_offers (
  id uuid primary key default gen_random_uuid(),

  sponsor_id uuid not null
    references public.sponsors(id)
    on delete restrict,

  season_id uuid not null
    references public.seasons(id)
    on delete restrict,

  title text not null,
  description text,

  budget_per_season numeric(14, 2) not null,
  currency_code text not null default 'EUR',
  contract_duration_seasons smallint not null,

  available_from timestamptz,
  available_until timestamptz,

  status text not null default 'draft',

  created_at timestamptz not null default now(),

  constraint sponsor_offers_title_not_empty
    check (btrim(title) <> ''),

  constraint sponsor_offers_budget_non_negative
    check (budget_per_season >= 0),

  constraint sponsor_offers_currency_format
    check (
      char_length(currency_code) = 3
      and currency_code = upper(currency_code)
    ),

  constraint sponsor_offers_duration_positive
    check (contract_duration_seasons > 0),

  constraint sponsor_offers_availability_valid
    check (
      available_from is null
      or available_until is null
      or available_until > available_from
    ),

  constraint sponsor_offers_status_allowed
    check (
      status in (
        'draft',
        'open',
        'accepted',
        'expired',
        'withdrawn'
      )
    )
);

create index sponsor_offers_sponsor_id_idx
  on public.sponsor_offers (sponsor_id);

create index sponsor_offers_season_id_idx
  on public.sponsor_offers (season_id);

create index sponsor_offers_status_idx
  on public.sponsor_offers (status);


-- ============================================================
-- TEAMS
-- Identité historique permanente d'une équipe.
-- Le nom commercial, la division et la nationalité sportive
-- d'une saison sont conservés dans team_seasons.
-- ============================================================

create table public.teams (
  id uuid primary key default gen_random_uuid(),

  home_country_id uuid not null
    references public.countries(id)
    on delete restrict,

  founded_season_id uuid not null
    references public.seasons(id)
    on delete restrict,

  internal_name text not null,

  status text not null default 'active',

  created_at timestamptz not null default now(),

  constraint teams_internal_name_not_empty
    check (btrim(internal_name) <> ''),

  constraint teams_status_allowed
    check (
      status in (
        'active',
        'inactive',
        'dissolved'
      )
    )
);

create index teams_home_country_id_idx
  on public.teams (home_country_id);

create index teams_founded_season_id_idx
  on public.teams (founded_season_id);


-- ============================================================
-- TEAM MANAGER ASSIGNMENTS
-- Historique des directeurs sportifs ayant dirigé une équipe.
-- Pour le MVP, un directeur ne peut gérer qu'une seule équipe
-- active et une équipe ne possède qu'un manager principal actif.
-- ============================================================

create table public.team_manager_assignments (
  id uuid primary key default gen_random_uuid(),

  sporting_director_id uuid not null
    references public.sporting_directors(id)
    on delete restrict,

  team_id uuid not null
    references public.teams(id)
    on delete restrict,

  start_season_id uuid not null
    references public.seasons(id)
    on delete restrict,

  end_season_id uuid
    references public.seasons(id)
    on delete restrict,

  role text not null default 'general_manager',
  status text not null default 'planned',

  created_at timestamptz not null default now(),

  constraint team_manager_assignments_role_allowed
    check (
      role in (
        'general_manager',
        'assistant_manager'
      )
    ),

  constraint team_manager_assignments_status_allowed
    check (
      status in (
        'planned',
        'active',
        'completed',
        'terminated'
      )
    ),

  constraint team_manager_assignments_unique
    unique (
      sporting_director_id,
      team_id,
      start_season_id
    )
);

create index team_manager_assignments_director_id_idx
  on public.team_manager_assignments (sporting_director_id);

create index team_manager_assignments_team_id_idx
  on public.team_manager_assignments (team_id);

-- Un directeur sportif ne peut gérer qu'une équipe active.
create unique index team_manager_one_active_team_per_director_idx
  on public.team_manager_assignments (sporting_director_id)
  where status = 'active'
    and role = 'general_manager';

-- Une équipe ne peut avoir qu'un manager principal actif.
create unique index team_manager_one_active_manager_per_team_idx
  on public.team_manager_assignments (team_id)
  where status = 'active'
    and role = 'general_manager';


-- ============================================================
-- TEAM SPONSOR CONTRACTS
-- Relation historisée entre une équipe et ses sponsors.
-- Cette structure permet déjà les équipes multisponsors.
-- ============================================================

create table public.team_sponsor_contracts (
  id uuid primary key default gen_random_uuid(),

  team_id uuid not null
    references public.teams(id)
    on delete restrict,

  sponsor_id uuid not null
    references public.sponsors(id)
    on delete restrict,

  sponsor_offer_id uuid unique
    references public.sponsor_offers(id)
    on delete restrict,

  start_season_id uuid not null
    references public.seasons(id)
    on delete restrict,

  end_season_id uuid not null
    references public.seasons(id)
    on delete restrict,

  role text not null default 'principal',

  budget_per_season numeric(14, 2) not null,
  currency_code text not null default 'EUR',

  status text not null default 'planned',

  created_at timestamptz not null default now(),

  constraint team_sponsor_contracts_role_allowed
    check (
      role in (
        'principal',
        'co_sponsor',
        'equipment_partner'
      )
    ),

  constraint team_sponsor_contracts_budget_non_negative
    check (budget_per_season >= 0),

  constraint team_sponsor_contracts_currency_format
    check (
      char_length(currency_code) = 3
      and currency_code = upper(currency_code)
    ),

  constraint team_sponsor_contracts_status_allowed
    check (
      status in (
        'planned',
        'active',
        'completed',
        'terminated'
      )
    ),

  constraint team_sponsor_contracts_unique
    unique (
      team_id,
      sponsor_id,
      start_season_id,
      role
    )
);

create index team_sponsor_contracts_team_id_idx
  on public.team_sponsor_contracts (team_id);

create index team_sponsor_contracts_sponsor_id_idx
  on public.team_sponsor_contracts (sponsor_id);

-- Une équipe ne peut avoir qu'un sponsor principal actif.
create unique index team_sponsor_one_active_principal_per_team_idx
  on public.team_sponsor_contracts (team_id)
  where status = 'active'
    and role = 'principal';


-- ============================================================
-- TEAM SEASONS
-- État sportif et financier d'une équipe pour une saison.
-- L'identité permanente reste stockée dans teams.
-- ============================================================

create table public.team_seasons (
  id uuid primary key default gen_random_uuid(),

  team_id uuid not null
    references public.teams(id)
    on delete cascade,

  season_id uuid not null
    references public.seasons(id)
    on delete cascade,

  division_id uuid
    references public.divisions(id)
    on delete restrict,

  registration_country_id uuid not null
    references public.countries(id)
    on delete restrict,

  display_name text not null,
  short_name text,

  points integer not null default 0,
  final_rank integer,

  operating_budget numeric(14, 2) not null default 0,
  spent_budget numeric(14, 2) not null default 0,
  currency_code text not null default 'EUR',

  status text not null default 'planned',

  created_at timestamptz not null default now(),

  constraint team_seasons_display_name_not_empty
    check (btrim(display_name) <> ''),

  constraint team_seasons_short_name_not_empty
    check (
      short_name is null
      or btrim(short_name) <> ''
    ),

  constraint team_seasons_points_non_negative
    check (points >= 0),

  constraint team_seasons_final_rank_positive
    check (
      final_rank is null
      or final_rank > 0
    ),

  constraint team_seasons_operating_budget_non_negative
    check (operating_budget >= 0),

  constraint team_seasons_spent_budget_non_negative
    check (spent_budget >= 0),

  constraint team_seasons_spending_within_budget
    check (spent_budget <= operating_budget),

  constraint team_seasons_currency_format
    check (
      char_length(currency_code) = 3
      and currency_code = upper(currency_code)
    ),

  constraint team_seasons_status_allowed
    check (
      status in (
        'planned',
        'active',
        'completed',
        'withdrawn'
      )
    ),

  constraint team_seasons_team_unique
    unique (team_id, season_id),

  constraint team_seasons_display_name_unique
    unique (season_id, display_name)
);

create index team_seasons_season_id_idx
  on public.team_seasons (season_id);

create index team_seasons_division_id_idx
  on public.team_seasons (division_id);

create index team_seasons_registration_country_id_idx
  on public.team_seasons (registration_country_id);


-- ============================================================
-- SECURITY
-- Fermeture par défaut : les politiques seront ajoutées lorsque
-- les écrans et cas d'utilisation correspondants existeront.
-- ============================================================

alter table public.sporting_directors enable row level security;
alter table public.sponsors enable row level security;
alter table public.sponsor_offers enable row level security;
alter table public.teams enable row level security;
alter table public.team_manager_assignments enable row level security;
alter table public.team_sponsor_contracts enable row level security;
alter table public.team_seasons enable row level security;


-- ============================================================
-- DOCUMENTATION POSTGRES
-- ============================================================

comment on table public.sporting_directors is
  'Profils métier des joueurs incarnant des directeurs sportifs.';

comment on table public.sponsors is
  'Organisations susceptibles de financer une ou plusieurs équipes.';

comment on table public.sponsor_offers is
  'Offres de sponsoring proposées avant la création ou le renouvellement d’une équipe.';

comment on table public.teams is
  'Identités historiques permanentes des structures sportives.';

comment on table public.team_manager_assignments is
  'Historique des directeurs sportifs affectés aux équipes.';

comment on table public.team_sponsor_contracts is
  'Contrats historisés entre les équipes et leurs sponsors.';

comment on table public.team_seasons is
  'État sportif, commercial et financier d’une équipe pour une saison.';

commit;