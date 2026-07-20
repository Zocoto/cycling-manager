begin;

create table public.rider_injuries (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders(id) on delete restrict,
  source_stage_id uuid references public.stages(id) on delete set null,
  injury_type text not null,
  severity text not null,
  status text not null default 'active',
  recovery_days smallint not null,
  started_at timestamptz not null default now(),
  expected_recovery_at timestamptz not null,
  recovered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rider_injuries_type_allowed
    check (injury_type in ('abrasions', 'contusion', 'concussion', 'fracture')),
  constraint rider_injuries_severity_allowed
    check (severity in ('minor', 'moderate', 'serious')),
  constraint rider_injuries_status_allowed
    check (status in ('active', 'recovered')),
  constraint rider_injuries_recovery_days_positive
    check (recovery_days > 0),
  constraint rider_injuries_recovery_after_start
    check (expected_recovery_at > started_at)
);

create index rider_injuries_rider_id_idx
  on public.rider_injuries (rider_id);

create index rider_injuries_active_idx
  on public.rider_injuries (rider_id, expected_recovery_at)
  where status = 'active';

alter table public.stage_results
  add column abandonment_reason text,
  add column injury_id uuid references public.rider_injuries(id) on delete set null,
  add constraint stage_results_abandonment_reason_allowed
    check (
      abandonment_reason is null
      or abandonment_reason in ('crash', 'injury', 'illness', 'mechanical', 'other')
    ),
  add constraint stage_results_injury_requires_dnf
    check (injury_id is null or status = 'did_not_finish');

alter table public.race_results
  add column abandonment_reason text,
  add column injury_id uuid references public.rider_injuries(id) on delete set null,
  add constraint race_results_abandonment_reason_allowed
    check (
      abandonment_reason is null
      or abandonment_reason in ('crash', 'injury', 'illness', 'mechanical', 'other')
    ),
  add constraint race_results_injury_requires_dnf
    check (injury_id is null or status = 'did_not_finish');

create table public.race_secondary_results (
  id uuid primary key default gen_random_uuid(),
  race_edition_id uuid not null references public.race_editions(id) on delete cascade,
  classification_type text not null,
  race_roster_id uuid references public.race_rosters(id) on delete restrict,
  team_season_id uuid references public.team_seasons(id) on delete restrict,
  rank smallint not null,
  points integer,
  total_time_ms bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint race_secondary_results_type_allowed
    check (classification_type in ('mountain', 'sprint', 'youth', 'team')),
  constraint race_secondary_results_rank_positive check (rank > 0),
  constraint race_secondary_results_points_non_negative
    check (points is null or points >= 0),
  constraint race_secondary_results_time_positive
    check (total_time_ms is null or total_time_ms > 0),
  constraint race_secondary_results_competitor_matches_type
    check (
      (classification_type = 'team' and team_season_id is not null and race_roster_id is null)
      or
      (classification_type <> 'team' and race_roster_id is not null and team_season_id is null)
    ),
  constraint race_secondary_results_value_matches_type
    check (
      (classification_type in ('mountain', 'sprint') and points is not null)
      or
      (classification_type in ('youth', 'team') and total_time_ms is not null)
    ),
  unique (race_edition_id, classification_type, rank)
);

create index race_secondary_results_edition_idx
  on public.race_secondary_results (race_edition_id, classification_type);

alter table public.rider_injuries enable row level security;
alter table public.race_secondary_results enable row level security;

create policy rider_injuries_select_authenticated
on public.rider_injuries
for select
to authenticated
using (true);

create policy race_secondary_results_select_authenticated
on public.race_secondary_results
for select
to authenticated
using (true);

create or replace function public.get_stage_eligible_race_rosters(
  p_stage_id uuid
)
returns table (
  race_roster_id uuid,
  rider_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select roster.id, roster.rider_id
  from public.stages target_stage
  join public.race_registrations registration
    on registration.race_edition_id = target_stage.race_edition_id
   and registration.status = 'accepted'
  join public.race_rosters roster
    on roster.race_registration_id = registration.id
   and roster.status in ('selected', 'confirmed')
  where target_stage.id = p_stage_id
    and not exists (
      select 1
      from public.stage_results previous_result
      join public.stages previous_stage
        on previous_stage.id = previous_result.stage_id
      where previous_result.race_roster_id = roster.id
        and previous_stage.race_edition_id = target_stage.race_edition_id
        and previous_stage.stage_number < target_stage.stage_number
        and previous_result.status in (
          'did_not_finish',
          'disqualified',
          'outside_time_limit'
        )
    )
    and not exists (
      select 1
      from public.rider_injuries injury
      where injury.rider_id = roster.rider_id
        and injury.status = 'active'
        and injury.expected_recovery_at > now()
    );
$$;

revoke all on function public.get_stage_eligible_race_rosters(uuid) from public;
grant execute on function public.get_stage_eligible_race_rosters(uuid) to authenticated;

comment on table public.rider_injuries is
  'Blessures persistantes, notamment celles provoquées par une chute et un abandon.';

comment on table public.race_secondary_results is
  'Classements finaux montagne, points, jeunes et équipes des courses par étapes.';

comment on function public.get_stage_eligible_race_rosters(uuid) is
  'Engagés autorisés à prendre le départ d’une étape, hors abandons antérieurs du tour et blessures actives.';

commit;
