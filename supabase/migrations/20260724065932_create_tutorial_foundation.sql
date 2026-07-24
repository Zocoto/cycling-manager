begin;

-- ============================================================
-- TUTORIAL PROGRESS
-- État global d'un parcours pour un Directeur Sportif.
--
-- Une ligne existe par joueur et par parcours.
--
-- Le parcours général peut être proposé automatiquement
-- uniquement lorsque son statut est "not_started".
--
-- Après "completed" ou "skipped", il ne doit plus être relancé
-- automatiquement. Une relecture manuelle reste possible grâce
-- aux sessions, sans effacer ce statut historique.
-- ============================================================

create table public.tutorial_progress (
  id uuid primary key default gen_random_uuid(),

  sporting_director_id uuid not null
    references public.sporting_directors(id)
    on delete cascade,

  tutorial_key text not null,
  tutorial_type text not null,
  tutorial_version integer not null default 1,

  status text not null default 'not_started',

  current_step_key text,
  current_route text,

  started_at timestamptz,
  completed_at timestamptz,
  skipped_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tutorial_progress_key_not_empty
    check (btrim(tutorial_key) <> ''),

  constraint tutorial_progress_key_format
    check (
      tutorial_key ~ '^[a-z0-9][a-z0-9._-]*$'
    ),

  constraint tutorial_progress_type_allowed
    check (
      tutorial_type in (
        'onboarding',
        'contextual',
        'race_scenario'
      )
    ),

  constraint tutorial_progress_version_positive
    check (tutorial_version > 0),

  constraint tutorial_progress_status_allowed
    check (
      status in (
        'not_started',
        'in_progress',
        'completed',
        'skipped'
      )
    ),

  constraint tutorial_progress_step_not_empty
    check (
      current_step_key is null
      or btrim(current_step_key) <> ''
    ),

  constraint tutorial_progress_step_format
    check (
      current_step_key is null
      or current_step_key ~ '^[a-z0-9][a-z0-9._-]*$'
    ),

  constraint tutorial_progress_route_not_empty
    check (
      current_route is null
      or btrim(current_route) <> ''
    ),

  constraint tutorial_progress_metadata_is_object
    check (
      jsonb_typeof(metadata) = 'object'
    ),

  constraint tutorial_progress_status_timestamps_consistent
    check (
      (
        status = 'not_started'
        and started_at is null
        and completed_at is null
        and skipped_at is null
      )
      or (
        status = 'in_progress'
        and started_at is not null
        and completed_at is null
        and skipped_at is null
      )
      or (
        status = 'completed'
        and started_at is not null
        and completed_at is not null
        and skipped_at is null
      )
      or (
        status = 'skipped'
        and completed_at is null
        and skipped_at is not null
      )
    ),

  constraint tutorial_progress_not_started_has_no_step
    check (
      status <> 'not_started'
      or (
        current_step_key is null
        and current_route is null
      )
    ),

  constraint tutorial_progress_director_key_unique
    unique (
      sporting_director_id,
      tutorial_key
    )
);

create index tutorial_progress_director_status_idx
  on public.tutorial_progress (
    sporting_director_id,
    status
  );

create index tutorial_progress_key_status_idx
  on public.tutorial_progress (
    tutorial_key,
    status
  );


-- ============================================================
-- TUTORIAL SESSIONS
-- Historique des exécutions d'un parcours.
--
-- Une session représente :
-- - un lancement automatique ;
-- - un lancement manuel ;
-- - une reprise ;
-- - une relecture volontaire.
--
-- Rejouer un parcours terminé crée une nouvelle session sans
-- remettre tutorial_progress à "not_started".
-- ============================================================

create table public.tutorial_sessions (
  id uuid primary key default gen_random_uuid(),

  tutorial_progress_id uuid not null
    references public.tutorial_progress(id)
    on delete cascade,

  tutorial_version integer not null,

  launch_source text not null,
  status text not null default 'in_progress',

  first_step_key text,
  last_step_key text,

  started_at timestamptz not null default now(),
  ended_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tutorial_sessions_version_positive
    check (tutorial_version > 0),

  constraint tutorial_sessions_launch_source_allowed
    check (
      launch_source in (
        'automatic',
        'manual',
        'resume',
        'replay'
      )
    ),

  constraint tutorial_sessions_status_allowed
    check (
      status in (
        'in_progress',
        'completed',
        'abandoned',
        'skipped'
      )
    ),

  constraint tutorial_sessions_first_step_not_empty
    check (
      first_step_key is null
      or btrim(first_step_key) <> ''
    ),

  constraint tutorial_sessions_last_step_not_empty
    check (
      last_step_key is null
      or btrim(last_step_key) <> ''
    ),

  constraint tutorial_sessions_first_step_format
    check (
      first_step_key is null
      or first_step_key ~ '^[a-z0-9][a-z0-9._-]*$'
    ),

  constraint tutorial_sessions_last_step_format
    check (
      last_step_key is null
      or last_step_key ~ '^[a-z0-9][a-z0-9._-]*$'
    ),

  constraint tutorial_sessions_metadata_is_object
    check (
      jsonb_typeof(metadata) = 'object'
    ),

  constraint tutorial_sessions_end_date_consistent
    check (
      (
        status = 'in_progress'
        and ended_at is null
      )
      or (
        status <> 'in_progress'
        and ended_at is not null
      )
    )
);

create index tutorial_sessions_progress_started_idx
  on public.tutorial_sessions (
    tutorial_progress_id,
    started_at desc
  );

create index tutorial_sessions_status_idx
  on public.tutorial_sessions (status);

-- Une seule session active par parcours et par joueur.
-- Une reprise réutilisera cette session au lieu d'en créer une
-- deuxième.
create unique index tutorial_sessions_one_active_idx
  on public.tutorial_sessions (tutorial_progress_id)
  where status = 'in_progress';


-- ============================================================
-- UPDATED_AT
-- Mise à jour automatique des horodatages lors d'une
-- modification.
-- ============================================================

create or replace function public.touch_tutorial_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tutorial_progress_touch_updated_at
before update on public.tutorial_progress
for each row
execute function public.touch_tutorial_updated_at();

create trigger tutorial_sessions_touch_updated_at
before update on public.tutorial_sessions
for each row
execute function public.touch_tutorial_updated_at();


-- ============================================================
-- ROW LEVEL SECURITY
-- Chaque utilisateur authentifié peut uniquement consulter,
-- créer et modifier les données rattachées à son propre profil
-- de Directeur Sportif.
--
-- La suppression directe depuis le navigateur n'est pas
-- autorisée.
-- ============================================================

alter table public.tutorial_progress
  enable row level security;

alter table public.tutorial_sessions
  enable row level security;


-- ------------------------------------------------------------
-- Progression : lecture
-- ------------------------------------------------------------

create policy tutorial_progress_select_own
on public.tutorial_progress
for select
to authenticated
using (
  exists (
    select 1
    from public.sporting_directors as director
    where director.id =
      tutorial_progress.sporting_director_id
      and director.auth_user_id =
        (select auth.uid())
  )
);


-- ------------------------------------------------------------
-- Progression : création
-- ------------------------------------------------------------

create policy tutorial_progress_insert_own
on public.tutorial_progress
for insert
to authenticated
with check (
  exists (
    select 1
    from public.sporting_directors as director
    where director.id =
      tutorial_progress.sporting_director_id
      and director.auth_user_id =
        (select auth.uid())
  )
);


-- ------------------------------------------------------------
-- Progression : modification
-- ------------------------------------------------------------

create policy tutorial_progress_update_own
on public.tutorial_progress
for update
to authenticated
using (
  exists (
    select 1
    from public.sporting_directors as director
    where director.id =
      tutorial_progress.sporting_director_id
      and director.auth_user_id =
        (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.sporting_directors as director
    where director.id =
      tutorial_progress.sporting_director_id
      and director.auth_user_id =
        (select auth.uid())
  )
);


-- ------------------------------------------------------------
-- Sessions : lecture
-- ------------------------------------------------------------

create policy tutorial_sessions_select_own
on public.tutorial_sessions
for select
to authenticated
using (
  exists (
    select 1
    from public.tutorial_progress as progress
    join public.sporting_directors as director
      on director.id = progress.sporting_director_id
    where progress.id =
      tutorial_sessions.tutorial_progress_id
      and director.auth_user_id =
        (select auth.uid())
  )
);


-- ------------------------------------------------------------
-- Sessions : création
-- ------------------------------------------------------------

create policy tutorial_sessions_insert_own
on public.tutorial_sessions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.tutorial_progress as progress
    join public.sporting_directors as director
      on director.id = progress.sporting_director_id
    where progress.id =
      tutorial_sessions.tutorial_progress_id
      and director.auth_user_id =
        (select auth.uid())
  )
);


-- ------------------------------------------------------------
-- Sessions : modification
-- ------------------------------------------------------------

create policy tutorial_sessions_update_own
on public.tutorial_sessions
for update
to authenticated
using (
  exists (
    select 1
    from public.tutorial_progress as progress
    join public.sporting_directors as director
      on director.id = progress.sporting_director_id
    where progress.id =
      tutorial_sessions.tutorial_progress_id
      and director.auth_user_id =
        (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.tutorial_progress as progress
    join public.sporting_directors as director
      on director.id = progress.sporting_director_id
    where progress.id =
      tutorial_sessions.tutorial_progress_id
      and director.auth_user_id =
        (select auth.uid())
  )
);


-- ============================================================
-- PRIVILEGES
-- Aucun accès pour les visiteurs anonymes.
-- Les joueurs authentifiés peuvent lire, créer et mettre à jour
-- leur propre progression grâce aux politiques RLS.
-- ============================================================

revoke all
on table public.tutorial_progress
from public, anon;

revoke all
on table public.tutorial_sessions
from public, anon;

grant select, insert, update
on table public.tutorial_progress
to authenticated;

grant select, insert, update
on table public.tutorial_sessions
to authenticated;

grant all privileges
on table public.tutorial_progress
to service_role;

grant all privileges
on table public.tutorial_sessions
to service_role;


-- ============================================================
-- DOCUMENTATION POSTGRES
-- ============================================================

comment on table public.tutorial_progress is
  'État global de chaque parcours didacticiel pour un Directeur Sportif.';

comment on column public.tutorial_progress.tutorial_key is
  'Identifiant stable du parcours, défini dans le catalogue TypeScript.';

comment on column public.tutorial_progress.tutorial_type is
  'Nature du parcours : onboarding général, parcours contextuel ou scénario de course.';

comment on column public.tutorial_progress.tutorial_version is
  'Version du parcours utilisée lors de la dernière progression enregistrée.';

comment on column public.tutorial_progress.current_step_key is
  'Identifiant stable de la dernière étape atteinte pour permettre une reprise.';

comment on column public.tutorial_progress.current_route is
  'Route à rouvrir lors de la reprise d’un parcours couvrant plusieurs pages.';

comment on table public.tutorial_sessions is
  'Historique des lancements, reprises et relectures des parcours didacticiels.';

comment on column public.tutorial_sessions.launch_source is
  'Origine du lancement : automatique, manuel, reprise ou relecture.';

comment on column public.tutorial_sessions.metadata is
  'Informations techniques complémentaires propres à une exécution du parcours.';

commit;