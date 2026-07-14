begin;

-- ============================================================
-- SPONSOR OBJECTIVES
-- Définition commune des objectifs attachés à une offre.
-- Chaque objectif possède ensuite une table spécialisée selon
-- son type : résultat sportif, nationalité ou victoires.
-- ============================================================

create table public.sponsor_objectives (
  id uuid primary key default gen_random_uuid(),

  sponsor_offer_id uuid not null
    references public.sponsor_offers(id)
    on delete cascade,

  season_id uuid not null
    references public.seasons(id)
    on delete restrict,

  name text not null,
  description text,

  objective_type text not null,
  priority text not null default 'standard',

  evaluation_timing text not null default 'season_end',
  evaluation_day_number smallint,

  status text not null default 'draft',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sponsor_objectives_name_not_empty
    check (btrim(name) <> ''),

  constraint sponsor_objectives_type_allowed
    check (
      objective_type in (
        'race_result',
        'nationality_quota',
        'season_wins'
      )
    ),

  constraint sponsor_objectives_priority_allowed
    check (
      priority in (
        'optional',
        'standard',
        'important',
        'mandatory'
      )
    ),

  constraint sponsor_objectives_evaluation_timing_allowed
    check (
      evaluation_timing in (
        'season_start',
        'season_end',
        'day_number',
        'continuous'
      )
    ),

  constraint sponsor_objectives_evaluation_day_valid
    check (
      (
        evaluation_timing = 'day_number'
        and evaluation_day_number between 1 and 28
      )
      or (
        evaluation_timing <> 'day_number'
        and evaluation_day_number is null
      )
    ),

  constraint sponsor_objectives_status_allowed
    check (
      status in (
        'draft',
        'active',
        'completed',
        'cancelled'
      )
    ),

  constraint sponsor_objectives_name_unique
    unique (
      sponsor_offer_id,
      season_id,
      name
    )
);

create index sponsor_objectives_offer_id_idx
  on public.sponsor_objectives (sponsor_offer_id);

create index sponsor_objectives_season_id_idx
  on public.sponsor_objectives (season_id);

create index sponsor_objectives_type_idx
  on public.sponsor_objectives (objective_type);

create index sponsor_objectives_status_idx
  on public.sponsor_objectives (status);


-- ============================================================
-- RACE RESULT OBJECTIVES
-- Objectifs liés à une édition de course ou à une étape.
--
-- Exemples :
-- - Participer à Paris-Roubaix.
-- - Terminer dans le Top 5 du Tour des Flandres.
-- - Remporter une étape d'un tour.
-- - Remporter deux étapes pendant une même édition.
-- ============================================================

create table public.race_result_objectives (
  objective_id uuid primary key
    references public.sponsor_objectives(id)
    on delete cascade,

  race_edition_id uuid not null
    references public.race_editions(id)
    on delete restrict,

  stage_id uuid
    references public.stages(id)
    on delete restrict,

  target_scope text not null default 'race_final',
  achievement_type text not null,

  target_rank smallint,
  required_count smallint not null default 1,

  created_at timestamptz not null default now(),

  constraint race_result_objectives_scope_allowed
    check (
      target_scope in (
        'race_final',
        'specific_stage',
        'any_stage'
      )
    ),

  constraint race_result_objectives_stage_matches_scope
    check (
      (
        target_scope = 'specific_stage'
        and stage_id is not null
      )
      or (
        target_scope in (
          'race_final',
          'any_stage'
        )
        and stage_id is null
      )
    ),

  constraint race_result_objectives_achievement_allowed
    check (
      achievement_type in (
        'participation',
        'win',
        'top_n'
      )
    ),

  constraint race_result_objectives_target_rank_valid
    check (
      (
        achievement_type = 'top_n'
        and target_rank is not null
        and target_rank > 0
      )
      or (
        achievement_type <> 'top_n'
        and target_rank is null
      )
    ),

  constraint race_result_objectives_required_count_positive
    check (required_count > 0)
);

create index race_result_objectives_race_edition_id_idx
  on public.race_result_objectives (race_edition_id);

create index race_result_objectives_stage_id_idx
  on public.race_result_objectives (stage_id);


-- ============================================================
-- NATIONALITY OBJECTIVES
-- Contingent minimal de coureurs d'une nationalité déterminée.
-- Le calcul portera sur les contrats actifs à la date prévue
-- par sponsor_objectives.evaluation_timing.
-- ============================================================

create table public.nationality_objectives (
  objective_id uuid primary key
    references public.sponsor_objectives(id)
    on delete cascade,

  country_id uuid not null
    references public.countries(id)
    on delete restrict,

  minimum_rider_count smallint not null,

  created_at timestamptz not null default now(),

  constraint nationality_objectives_minimum_positive
    check (minimum_rider_count > 0)
);

create index nationality_objectives_country_id_idx
  on public.nationality_objectives (country_id);


-- ============================================================
-- SEASON WIN OBJECTIVES
-- Nombre minimal de victoires à obtenir pendant une saison.
--
-- Le périmètre permet de distinguer :
-- - toutes les victoires ;
-- - les courses d'un jour ;
-- - les étapes ;
-- - les classements généraux des tours.
-- ============================================================

create table public.season_win_objectives (
  objective_id uuid primary key
    references public.sponsor_objectives(id)
    on delete cascade,

  minimum_win_count smallint not null,
  win_scope text not null default 'all',

  created_at timestamptz not null default now(),

  constraint season_win_objectives_minimum_positive
    check (minimum_win_count > 0),

  constraint season_win_objectives_scope_allowed
    check (
      win_scope in (
        'all',
        'one_day_races',
        'stages',
        'stage_race_general'
      )
    )
);


-- ============================================================
-- OBJECTIVE PROGRESS
-- État d'avancement d'un objectif pour le contrat sponsor
-- réellement accepté par une équipe.
--
-- current_value peut représenter selon l'objectif :
-- - le nombre de victoires obtenu ;
-- - le nombre de coureurs de la nationalité demandée ;
-- - le meilleur classement obtenu ;
-- - une participation validée.
--
-- details permet de conserver des informations complémentaires
-- sans rigidifier prématurément le modèle.
-- ============================================================

create table public.objective_progress (
  id uuid primary key default gen_random_uuid(),

  sponsor_objective_id uuid not null
    references public.sponsor_objectives(id)
    on delete cascade,

  team_sponsor_contract_id uuid not null
    references public.team_sponsor_contracts(id)
    on delete cascade,

  season_id uuid not null
    references public.seasons(id)
    on delete cascade,

  status text not null default 'not_started',

  current_value numeric(10, 2) not null default 0,
  details jsonb not null default '{}'::jsonb,

  last_evaluated_at timestamptz,
  achieved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint objective_progress_status_allowed
    check (
      status in (
        'not_started',
        'in_progress',
        'achieved',
        'failed'
      )
    ),

  constraint objective_progress_current_value_non_negative
    check (current_value >= 0),

  constraint objective_progress_achieved_at_valid
    check (
      (
        status = 'achieved'
        and achieved_at is not null
      )
      or (
        status <> 'achieved'
      )
    ),

  constraint objective_progress_unique
    unique (
      sponsor_objective_id,
      team_sponsor_contract_id,
      season_id
    )
);

create index objective_progress_objective_id_idx
  on public.objective_progress (sponsor_objective_id);

create index objective_progress_contract_id_idx
  on public.objective_progress (team_sponsor_contract_id);

create index objective_progress_season_id_idx
  on public.objective_progress (season_id);

create index objective_progress_status_idx
  on public.objective_progress (status);


-- ============================================================
-- SECURITY
-- Les tables restent fermées jusqu'à la mise en place des
-- écrans, de l'authentification et des politiques métier.
-- ============================================================

alter table public.sponsor_objectives enable row level security;
alter table public.race_result_objectives enable row level security;
alter table public.nationality_objectives enable row level security;
alter table public.season_win_objectives enable row level security;
alter table public.objective_progress enable row level security;


-- ============================================================
-- DOCUMENTATION POSTGRES
-- ============================================================

comment on table public.sponsor_objectives is
  'Définitions communes des objectifs inclus dans les offres de sponsoring.';

comment on table public.race_result_objectives is
  'Objectifs portant sur la participation ou le résultat obtenu lors d’une course ou d’une étape.';

comment on table public.nationality_objectives is
  'Objectifs imposant un contingent minimal de coureurs d’une nationalité.';

comment on table public.season_win_objectives is
  'Objectifs imposant un nombre minimal de victoires pendant une saison.';

comment on table public.objective_progress is
  'Suivi de la progression des objectifs sponsor pour les contrats acceptés.';

comment on column public.objective_progress.details is
  'Informations complémentaires produites par le moteur d’évaluation de l’objectif.';

commit;