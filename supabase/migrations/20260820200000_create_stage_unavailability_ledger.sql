begin;

-- Ce registre appartient au résultat sportif de la course. Il ne dépend ni
-- de la Gazette, ni de l'état médical courant, ni d'un recalcul ultérieur.
create table public.stage_rider_unavailabilities (
  stage_id uuid not null
    references public.stages(id) on delete cascade,
  race_edition_id uuid not null
    references public.race_editions(id) on delete cascade,
  rider_id uuid not null
    references public.riders(id) on delete restrict,
  reason text not null,
  result_status text not null,
  injury_id uuid
    references public.rider_injuries(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (stage_id, rider_id),
  constraint stage_rider_unavailabilities_reason_allowed check (
    reason in (
      'injury',
      'did_not_start',
      'did_not_finish',
      'disqualified',
      'outside_time_limit'
    )
  ),
  constraint stage_rider_unavailabilities_status_allowed check (
    result_status in (
      'finished',
      'did_not_start',
      'did_not_finish',
      'disqualified',
      'outside_time_limit'
    )
  )
);

create index stage_rider_unavailabilities_edition_idx
  on public.stage_rider_unavailabilities (race_edition_id, stage_id);

create index stage_rider_unavailabilities_rider_idx
  on public.stage_rider_unavailabilities (rider_id);

alter table public.stage_rider_unavailabilities enable row level security;
grant all privileges on table public.stage_rider_unavailabilities
  to service_role;

-- Reprise de toutes les indisponibilités encore présentes dans les résultats.
insert into public.stage_rider_unavailabilities (
  stage_id,
  race_edition_id,
  rider_id,
  reason,
  result_status,
  injury_id
)
select
  result.stage_id,
  stage.race_edition_id,
  roster.rider_id,
  case
    when result.injury_id is not null then 'injury'
    else result.status
  end,
  result.status,
  result.injury_id
from public.stage_results as result
join public.stages as stage
  on stage.id = result.stage_id
join public.race_rosters as roster
  on roster.id = result.race_roster_id
where result.injury_id is not null
   or result.status in (
     'did_not_start',
     'did_not_finish',
     'disqualified',
     'outside_time_limit'
   )
on conflict (stage_id, rider_id) do nothing;

-- Une blessure médicale de course reste également une preuve sportive, même
-- si sa ligne de résultat avait été partiellement réparée auparavant.
insert into public.stage_rider_unavailabilities (
  stage_id,
  race_edition_id,
  rider_id,
  reason,
  result_status,
  injury_id
)
select
  injury.source_stage_id,
  stage.race_edition_id,
  injury.rider_id,
  'injury',
  coalesce(result.status, 'finished'),
  injury.id
from public.rider_injuries as injury
join public.stages as stage
  on stage.id = injury.source_stage_id
left join public.race_registrations as registration
  on registration.race_edition_id = stage.race_edition_id
left join public.race_rosters as roster
  on roster.race_registration_id = registration.id
 and roster.rider_id = injury.rider_id
left join public.stage_results as result
  on result.stage_id = injury.source_stage_id
 and result.race_roster_id = roster.id
where injury.source_stage_id is not null
on conflict (stage_id, rider_id) do nothing;

-- Réparation ciblée du fait sportif de la Corsa, confirmé avant ce patch.
-- Les deux coureurs touchés ont terminé l'étape 9 ; les deux autres ont
-- abandonné. Aucun texte de Gazette n'est lu par cette migration.
with target_stage as (
  select
    stage.id as stage_id,
    edition.id as race_edition_id
  from public.stages as stage
  join public.race_editions as edition
    on edition.id = stage.race_edition_id
  join public.races as race
    on race.id = edition.race_id
  join public.seasons as season
    on season.id = edition.season_id
  where race.slug = 'corsa-delle-regioni'
    and stage.stage_number = 9
    and season.status = 'active'
), confirmed_incident(first_name, last_name, reason, result_status) as (
  values
    ('Arjan', 'Nikolić', 'injury', 'finished'),
    ('Zain', 'Chowdhury', 'injury', 'finished'),
    ('Mateus', 'Bérenger', 'did_not_finish', 'did_not_finish'),
    ('Daouda', 'Mensah', 'did_not_finish', 'did_not_finish')
), target_riders as (
  select
    target.stage_id,
    target.race_edition_id,
    rider.id as rider_id,
    incident.reason,
    incident.result_status,
    roster.id as race_roster_id
  from target_stage as target
  join public.race_registrations as registration
    on registration.race_edition_id = target.race_edition_id
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
  join public.riders as rider
    on rider.id = roster.rider_id
  join confirmed_incident as incident
    on incident.first_name = rider.first_name
   and incident.last_name = rider.last_name
), recorded_incident as (
  insert into public.stage_rider_unavailabilities (
    stage_id,
    race_edition_id,
    rider_id,
    reason,
    result_status
  )
  select
    target.stage_id,
    target.race_edition_id,
    target.rider_id,
    target.reason,
    target.result_status
  from target_riders as target
  on conflict (stage_id, rider_id) do nothing
  returning stage_id, rider_id
)
update public.stage_results as result
set
  status = 'did_not_finish',
  rank = null,
  elapsed_time_ms = null,
  gap_to_winner_ms = null,
  abandonment_reason = 'crash',
  updated_at = now()
from target_riders as target
where target.reason = 'did_not_finish'
  and result.stage_id = target.stage_id
  and result.race_roster_id = target.race_roster_id;

comment on table public.stage_rider_unavailabilities is
  'Registre sportif immuable des coureurs qui ne peuvent plus repartir sur les étapes suivantes de la même édition.';

commit;
