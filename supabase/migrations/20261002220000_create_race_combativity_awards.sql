begin;

create table if not exists public.race_combativity_awards (
  id uuid primary key default gen_random_uuid(),
  award_key text not null unique,
  race_edition_id uuid not null
    references public.race_editions(id)
    on delete cascade,
  stage_id uuid
    references public.stages(id)
    on delete cascade,
  race_roster_id uuid not null
    references public.race_rosters(id)
    on delete cascade,
  award_scope text not null,
  combativity_score numeric(12, 2) not null,
  score_breakdown jsonb not null default '{}'::jsonb,
  cash_prize integer not null default 0,
  experience_points integer not null default 0,
  awarded_at timestamptz not null default now(),

  constraint race_combativity_awards_scope_allowed check (
    award_scope in ('stage', 'race')
  ),
  constraint race_combativity_awards_stage_scope_coherent check (
    (award_scope = 'stage' and stage_id is not null)
    or (award_scope = 'race' and stage_id is null)
  ),
  constraint race_combativity_awards_score_non_negative check (
    combativity_score >= 0
  ),
  constraint race_combativity_awards_rewards_non_negative check (
    cash_prize >= 0 and experience_points >= 0
  )
);

create unique index if not exists race_combativity_awards_stage_unique_idx
  on public.race_combativity_awards(stage_id)
  where award_scope = 'stage';

create unique index if not exists race_combativity_awards_race_unique_idx
  on public.race_combativity_awards(race_edition_id)
  where award_scope = 'race';

create index if not exists race_combativity_awards_roster_idx
  on public.race_combativity_awards(race_roster_id, race_edition_id);

create index if not exists race_combativity_awards_edition_stage_idx
  on public.race_combativity_awards(race_edition_id, stage_id);

alter table public.race_combativity_awards enable row level security;

drop policy if exists race_combativity_awards_read_authenticated
on public.race_combativity_awards;

create policy race_combativity_awards_read_authenticated
on public.race_combativity_awards
for select
to authenticated
using (true);

grant select on table public.race_combativity_awards to authenticated;
grant all privileges on table public.race_combativity_awards to service_role;

comment on table public.race_combativity_awards is
  'Prix de la combativité officiels des étapes et super-combatifs des courses par étapes.';
comment on column public.race_combativity_awards.score_breakdown is
  'Faits de course figés ayant justifié le trophée : kilomètres devant, relais, attaques, poursuite et écart maximal.';

commit;
