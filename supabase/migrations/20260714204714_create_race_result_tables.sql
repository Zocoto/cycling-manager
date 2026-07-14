begin;

-- ============================================================
-- STAGE RESULTS
-- Résultat individuel d'un coureur sur une étape.
--
-- La référence à race_rosters permet de conserver le contexte
-- exact de participation : coureur, équipe et édition de course.
-- ============================================================

create table public.stage_results (
  id uuid primary key default gen_random_uuid(),

  stage_id uuid not null
    references public.stages(id)
    on delete cascade,

  race_roster_id uuid not null
    references public.race_rosters(id)
    on delete restrict,

  status text not null default 'finished',

  rank smallint,

  elapsed_time_ms bigint,
  gap_to_winner_ms bigint,

  time_bonus_seconds smallint not null default 0,
  time_penalty_seconds smallint not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stage_results_status_allowed
    check (
      status in (
        'finished',
        'did_not_start',
        'did_not_finish',
        'disqualified',
        'outside_time_limit'
      )
    ),

  constraint stage_results_rank_positive
    check (
      rank is null
      or rank > 0
    ),

  constraint stage_results_elapsed_time_positive
    check (
      elapsed_time_ms is null
      or elapsed_time_ms > 0
    ),

  constraint stage_results_gap_non_negative
    check (
      gap_to_winner_ms is null
      or gap_to_winner_ms >= 0
    ),

  constraint stage_results_bonus_non_negative
    check (time_bonus_seconds >= 0),

  constraint stage_results_penalty_non_negative
    check (time_penalty_seconds >= 0),

  constraint stage_results_finished_data_required
    check (
      (
        status = 'finished'
        and rank is not null
        and elapsed_time_ms is not null
      )
      or (
        status <> 'finished'
        and rank is null
      )
    ),

  constraint stage_results_rider_unique
    unique (
      stage_id,
      race_roster_id
    ),

  constraint stage_results_rank_unique
    unique (
      stage_id,
      rank
    )
);

create index stage_results_stage_id_idx
  on public.stage_results (stage_id);

create index stage_results_race_roster_id_idx
  on public.stage_results (race_roster_id);

create index stage_results_status_idx
  on public.stage_results (status);


-- ============================================================
-- RACE RESULTS
-- Classement final individuel d'une édition de course.
--
-- Pour une course d'un jour, ce résultat correspond au
-- classement de son unique étape.
--
-- Pour un tour, il représente le classement général final.
-- ============================================================

create table public.race_results (
  id uuid primary key default gen_random_uuid(),

  race_edition_id uuid not null
    references public.race_editions(id)
    on delete cascade,

  race_roster_id uuid not null
    references public.race_rosters(id)
    on delete restrict,

  status text not null default 'classified',

  final_rank smallint,

  total_time_ms bigint,
  gap_to_winner_ms bigint,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint race_results_status_allowed
    check (
      status in (
        'classified',
        'did_not_start',
        'did_not_finish',
        'disqualified',
        'outside_time_limit',
        'withdrawn'
      )
    ),

  constraint race_results_rank_positive
    check (
      final_rank is null
      or final_rank > 0
    ),

  constraint race_results_total_time_positive
    check (
      total_time_ms is null
      or total_time_ms > 0
    ),

  constraint race_results_gap_non_negative
    check (
      gap_to_winner_ms is null
      or gap_to_winner_ms >= 0
    ),

  constraint race_results_classified_data_required
    check (
      (
        status = 'classified'
        and final_rank is not null
        and total_time_ms is not null
      )
      or (
        status <> 'classified'
        and final_rank is null
      )
    ),

  constraint race_results_rider_unique
    unique (
      race_edition_id,
      race_roster_id
    ),

  constraint race_results_rank_unique
    unique (
      race_edition_id,
      final_rank
    )
);

create index race_results_race_edition_id_idx
  on public.race_results (race_edition_id);

create index race_results_race_roster_id_idx
  on public.race_results (race_roster_id);

create index race_results_status_idx
  on public.race_results (status);


-- ============================================================
-- TEAM POINTS EVENTS
-- Journal détaillé de tous les points gagnés ou retirés à une
-- équipe pendant une saison.
--
-- Ce registre constitue la source permettant d'expliquer le
-- total présent dans team_seasons.points.
-- ============================================================

create table public.team_points_events (
  id uuid primary key default gen_random_uuid(),

  team_season_id uuid not null
    references public.team_seasons(id)
    on delete cascade,

  stage_result_id uuid
    references public.stage_results(id)
    on delete set null,

  race_result_id uuid
    references public.race_results(id)
    on delete set null,

  event_type text not null,
  reason_code text not null,

  points integer not null,

  description text,

  awarded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint team_points_events_type_allowed
    check (
      event_type in (
        'stage_result',
        'race_result',
        'manual_bonus',
        'penalty',
        'adjustment'
      )
    ),

  constraint team_points_events_reason_not_empty
    check (btrim(reason_code) <> ''),

  constraint team_points_events_points_non_zero
    check (points <> 0),

  constraint team_points_events_source_matches_type
    check (
      (
        event_type = 'stage_result'
        and stage_result_id is not null
        and race_result_id is null
      )
      or (
        event_type = 'race_result'
        and race_result_id is not null
        and stage_result_id is null
      )
      or (
        event_type in (
          'manual_bonus',
          'penalty',
          'adjustment'
        )
        and stage_result_id is null
        and race_result_id is null
      )
    ),

  constraint team_points_events_sign_matches_type
    check (
      (
        event_type in (
          'stage_result',
          'race_result',
          'manual_bonus'
        )
        and points > 0
      )
      or (
        event_type = 'penalty'
        and points < 0
      )
      or (
        event_type = 'adjustment'
        and points <> 0
      )
    )
);

create index team_points_events_team_season_id_idx
  on public.team_points_events (team_season_id);

create index team_points_events_stage_result_id_idx
  on public.team_points_events (stage_result_id);

create index team_points_events_race_result_id_idx
  on public.team_points_events (race_result_id);

create index team_points_events_awarded_at_idx
  on public.team_points_events (awarded_at);

-- Une même règle de points ne peut être appliquée deux fois
-- au même résultat d'étape pour la même équipe.
create unique index team_points_stage_rule_unique_idx
  on public.team_points_events (
    team_season_id,
    stage_result_id,
    reason_code
  )
  where stage_result_id is not null;

-- Même protection pour les classements finaux.
create unique index team_points_race_rule_unique_idx
  on public.team_points_events (
    team_season_id,
    race_result_id,
    reason_code
  )
  where race_result_id is not null;


-- ============================================================
-- SECURITY
-- Les tables restent fermées jusqu'à la définition des écrans,
-- des rôles utilisateurs et des politiques d'accès.
-- ============================================================

alter table public.stage_results enable row level security;
alter table public.race_results enable row level security;
alter table public.team_points_events enable row level security;


-- ============================================================
-- DOCUMENTATION POSTGRES
-- ============================================================

comment on table public.stage_results is
  'Résultats individuels des coureurs pour chaque étape.';

comment on column public.stage_results.elapsed_time_ms is
  'Temps total réalisé sur l’étape, enregistré en millisecondes.';

comment on column public.stage_results.gap_to_winner_ms is
  'Écart avec le vainqueur de l’étape, enregistré en millisecondes.';

comment on table public.race_results is
  'Classements finaux individuels des éditions de course.';

comment on column public.race_results.total_time_ms is
  'Temps final du coureur sur la course ou au classement général, en millisecondes.';

comment on table public.team_points_events is
  'Journal détaillé des points gagnés ou retirés aux équipes.';

comment on column public.team_points_events.reason_code is
  'Code identifiant la règle de barème ayant produit le mouvement de points.';

commit;