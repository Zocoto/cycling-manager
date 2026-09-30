begin;

-- Morale is a persistent psychological state. Contrary to form it never
-- recovers or decays on its own: only an explicit, auditable event changes it.
alter table public.rider_condition_states
  add column if not exists morale numeric(5, 2) not null default 60;

alter table public.rider_condition_states
  drop constraint if exists rider_condition_states_morale_range;
alter table public.rider_condition_states
  add constraint rider_condition_states_morale_range
  check (morale between 0 and 100);

-- Every new daily condition row inherits the latest earlier morale. Existing
-- form settlement jobs can therefore keep inserting only form/fatigue without
-- ever resetting this persistent score to its column default.
create or replace function public.inherit_persistent_rider_morale()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previous_morale numeric(5, 2);
begin
  select previous_state.morale
  into v_previous_morale
  from public.season_days as target_day
  join public.season_days as previous_day
    on previous_day.season_id = target_day.season_id
   and previous_day.day_number < target_day.day_number
  join public.rider_condition_states as previous_state
    on previous_state.season_day_id = previous_day.id
   and previous_state.rider_id = new.rider_id
  where target_day.id = new.season_day_id
  order by previous_day.day_number desc, previous_state.updated_at desc
  limit 1;

  if v_previous_morale is not null then new.morale := v_previous_morale; end if;
  return new;
end;
$$;

drop trigger if exists rider_condition_states_inherit_morale
  on public.rider_condition_states;
create trigger rider_condition_states_inherit_morale
before insert on public.rider_condition_states
for each row execute function public.inherit_persistent_rider_morale();

create table public.rider_morale_events (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders(id) on delete cascade,
  season_day_id uuid references public.season_days(id) on delete set null,
  source_type text not null,
  source_reference text not null,
  requested_delta numeric(5, 2) not null,
  applied_delta numeric(5, 2) not null,
  morale_before numeric(5, 2) not null,
  morale_after numeric(5, 2) not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint rider_morale_events_source_allowed check (
    source_type in (
      'social_integration', 'team_tenure', 'stage_result', 'race_result',
      'favorite_race', 'injury', 'training_overload', 'mixed_zone_interview',
      'academy_promotion', 'manual_adjustment'
    )
  ),
  constraint rider_morale_events_reference_not_empty
    check (btrim(source_reference) <> ''),
  constraint rider_morale_events_description_not_empty
    check (btrim(description) <> ''),
  constraint rider_morale_events_requested_delta_range
    check (requested_delta between -100 and 100 and requested_delta <> 0),
  constraint rider_morale_events_applied_delta_range
    check (applied_delta between -100 and 100),
  constraint rider_morale_events_values_range check (
    morale_before between 0 and 100 and morale_after between 0 and 100
  ),
  constraint rider_morale_events_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint rider_morale_events_unique
    unique (rider_id, source_type, source_reference)
);

create index rider_morale_events_rider_history_idx
  on public.rider_morale_events (rider_id, occurred_at desc);
create index rider_morale_events_day_idx
  on public.rider_morale_events (season_day_id, occurred_at desc);

alter table public.rider_morale_events enable row level security;
revoke all on public.rider_morale_events from public, anon, authenticated;
grant select, insert on public.rider_morale_events to service_role;

create or replace function public.apply_rider_morale_event(
  p_rider_id uuid,
  p_season_day_id uuid,
  p_source_type text,
  p_source_reference text,
  p_requested_delta numeric,
  p_description text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day record;
  v_existing public.rider_morale_events%rowtype;
  v_previous_condition record;
  v_condition public.rider_condition_states%rowtype;
  v_before numeric(5, 2);
  v_after numeric(5, 2);
  v_applied numeric(5, 2);
begin
  if p_rider_id is null or p_season_day_id is null then
    raise exception 'Le coureur et la journée sont requis pour modifier le moral.';
  end if;
  if p_source_type not in (
    'social_integration', 'team_tenure', 'stage_result', 'race_result',
    'favorite_race', 'injury', 'training_overload', 'mixed_zone_interview',
    'academy_promotion', 'manual_adjustment'
  ) then
    raise exception 'Cette source de moral n’est pas autorisée.';
  end if;
  if btrim(coalesce(p_source_reference, '')) = ''
    or btrim(coalesce(p_description, '')) = '' then
    raise exception 'La variation de moral doit être traçable et expliquée.';
  end if;
  if p_requested_delta is null
    or p_requested_delta = 0
    or p_requested_delta not between -100 and 100 then
    raise exception 'La variation de moral doit être comprise entre −100 et +100.';
  end if;
  if coalesce(jsonb_typeof(p_metadata), 'null') <> 'object' then
    raise exception 'Les métadonnées de moral doivent former un objet.';
  end if;

  -- Serialize every rider independently. This also makes trigger retries safe.
  perform pg_advisory_xact_lock(hashtextextended(p_rider_id::text, 0));

  select * into v_existing
  from public.rider_morale_events as event
  where event.rider_id = p_rider_id
    and event.source_type = p_source_type
    and event.source_reference = p_source_reference;
  if v_existing.id is not null then
    return jsonb_build_object(
      'alreadyApplied', true,
      'eventId', v_existing.id,
      'moraleBefore', v_existing.morale_before,
      'moraleAfter', v_existing.morale_after,
      'appliedDelta', v_existing.applied_delta
    );
  end if;

  select day.id, day.season_id, day.day_number
  into v_day
  from public.season_days as day
  where day.id = p_season_day_id;
  if v_day.id is null then
    raise exception 'La journée de saison du moral est introuvable.';
  end if;

  select
    state.form,
    state.fatigue,
    state.morale
  into v_previous_condition
  from public.rider_condition_states as state
  join public.season_days as state_day on state_day.id = state.season_day_id
  where state.rider_id = p_rider_id
    and state_day.season_id = v_day.season_id
    and state_day.day_number <= v_day.day_number
  order by state_day.day_number desc, state.updated_at desc
  limit 1;

  insert into public.rider_condition_states (
    rider_id, season_day_id, form, fatigue, morale, source
  ) values (
    p_rider_id,
    p_season_day_id,
    coalesce(v_previous_condition.form, 75),
    coalesce(v_previous_condition.fatigue, 0),
    coalesce(v_previous_condition.morale, 60),
    'morale:' || p_source_type
  )
  on conflict (rider_id, season_day_id) do nothing;

  select * into v_condition
  from public.rider_condition_states as state
  where state.rider_id = p_rider_id
    and state.season_day_id = p_season_day_id
  for update;

  v_before := coalesce(v_condition.morale, 60);
  v_after := least(100, greatest(0, v_before + p_requested_delta));
  v_applied := v_after - v_before;

  update public.rider_condition_states
  set
    morale = v_after,
    updated_at = now()
  where id = v_condition.id;

  insert into public.rider_morale_events (
    rider_id, season_day_id, source_type, source_reference,
    requested_delta, applied_delta, morale_before, morale_after,
    description, metadata
  ) values (
    p_rider_id, p_season_day_id, p_source_type, p_source_reference,
    p_requested_delta, v_applied, v_before, v_after,
    btrim(p_description), coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_existing.id;

  return jsonb_build_object(
    'alreadyApplied', false,
    'eventId', v_existing.id,
    'moraleBefore', v_before,
    'moraleAfter', v_after,
    'appliedDelta', v_applied
  );
end;
$$;

revoke all on function public.apply_rider_morale_event(
  uuid, uuid, text, text, numeric, text, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_rider_morale_event(
  uuid, uuid, text, text, numeric, text, jsonb
) to service_role;

comment on function public.apply_rider_morale_event(
  uuid, uuid, text, text, numeric, text, jsonb
) is
  'Applique une variation persistante, plafonnée et idempotente du moral d’un coureur.';

create or replace function public.apply_interview_morale()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rider_id uuid;
  v_season_day_id uuid;
  v_delta numeric;
  v_title text;
begin
  if new.status <> 'submitted'
    or old.status = 'submitted'
    or jsonb_typeof(new.event_outcome) <> 'object' then
    return new;
  end if;

  v_delta := coalesce(
    (new.event_outcome -> 'outcome' ->> 'riderMoraleDelta')::numeric,
    0
  );
  if v_delta = 0 then return new; end if;

  v_rider_id := nullif(new.context ->> 'riderId', '')::uuid;
  if v_rider_id is null then return new; end if;
  select stage.season_day_id into v_season_day_id
  from public.stages as stage where stage.id = new.stage_id;
  if v_season_day_id is null then return new; end if;

  v_title := coalesce(
    new.context -> 'zoneMixteEvent' ->> 'title',
    'Décision en zone mixte'
  );
  perform public.apply_rider_morale_event(
    v_rider_id,
    v_season_day_id,
    'mixed_zone_interview',
    new.id::text,
    v_delta,
    'Zone mixte — ' || v_title,
    jsonb_build_object(
      'interviewId', new.id,
      'choiceId', new.event_choice_id,
      'outcomeSummary', new.event_outcome -> 'outcome' ->> 'summary'
    )
  );
  return new;
end;
$$;

drop trigger if exists post_race_interviews_apply_morale
  on public.post_race_interviews;
create trigger post_race_interviews_apply_morale
after update of status, event_outcome on public.post_race_interviews
for each row execute function public.apply_interview_morale();

create or replace function public.apply_stage_result_morale()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_delta numeric;
  v_description text;
begin
  if new.status <> 'finished' or new.rank is null or new.rank > 3 then
    return new;
  end if;

  select roster.rider_id, stage.season_day_id, stage.name as stage_name
  into v_context
  from public.race_rosters as roster
  join public.stages as stage on stage.id = new.stage_id
  where roster.id = new.race_roster_id;
  if v_context.rider_id is null or v_context.season_day_id is null then
    return new;
  end if;

  v_delta := case when new.rank = 1 then 4 else 2 end;
  v_description := case
    when new.rank = 1 then 'Victoire d’étape — ' || coalesce(v_context.stage_name, 'étape')
    else 'Podium d’étape — ' || coalesce(v_context.stage_name, 'étape')
  end;
  perform public.apply_rider_morale_event(
    v_context.rider_id,
    v_context.season_day_id,
    'stage_result',
    new.id::text,
    v_delta,
    v_description,
    jsonb_build_object('stageResultId', new.id, 'rank', new.rank)
  );
  return new;
end;
$$;

drop trigger if exists stage_results_apply_morale on public.stage_results;
create trigger stage_results_apply_morale
after insert on public.stage_results
for each row execute function public.apply_stage_result_morale();

create or replace function public.apply_race_result_morale()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_stage_count integer;
begin
  if new.status <> 'classified' or new.final_rank is null then
    return new;
  end if;

  select
    roster.rider_id,
    edition.race_id,
    edition.season_id,
    edition.display_name,
    last_stage.season_day_id
  into v_context
  from public.race_rosters as roster
  join public.race_editions as edition on edition.id = new.race_edition_id
  left join lateral (
    select stage.season_day_id
    from public.stages as stage
    where stage.race_edition_id = edition.id
    order by stage.stage_number desc
    limit 1
  ) as last_stage on true
  where roster.id = new.race_roster_id;
  if v_context.rider_id is null or v_context.season_day_id is null then
    return new;
  end if;

  select count(*)::integer into v_stage_count
  from public.stages as stage
  where stage.race_edition_id = new.race_edition_id;

  if v_stage_count > 1 and new.final_rank <= 3 then
    perform public.apply_rider_morale_event(
      v_context.rider_id,
      v_context.season_day_id,
      'race_result',
      new.id::text,
      case when new.final_rank = 1 then 5 else 3 end,
      case
        when new.final_rank = 1 then 'Victoire au classement général — '
        else 'Podium au classement général — '
      end || coalesce(v_context.display_name, 'course par étapes'),
      jsonb_build_object('raceResultId', new.id, 'rank', new.final_rank)
    );
  end if;

  if exists (
    select 1
    from public.rider_favorite_races as favorite
    where favorite.season_id = v_context.season_id
      and favorite.rider_id = v_context.rider_id
      and favorite.race_id = v_context.race_id
  ) then
    perform public.apply_rider_morale_event(
      v_context.rider_id,
      v_context.season_day_id,
      'favorite_race',
      new.race_edition_id::text,
      2,
      'Course préférée disputée — ' || coalesce(v_context.display_name, 'course'),
      jsonb_build_object('raceEditionId', new.race_edition_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists race_results_apply_morale on public.race_results;
create trigger race_results_apply_morale
after insert on public.race_results
for each row execute function public.apply_race_result_morale();

create or replace function public.apply_injury_morale()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day_id uuid;
  v_delta numeric;
begin
  if new.source_stage_id is not null then
    select stage.season_day_id into v_day_id
    from public.stages as stage
    where stage.id = new.source_stage_id;
  end if;
  if v_day_id is null then
    select day.id into v_day_id
    from public.seasons as season
    join public.season_days as day
      on day.season_id = season.id
     and day.day_number = coalesce(season.current_day_number, 1)
    where season.status = 'active'
    limit 1;
  end if;
  if v_day_id is null then return new; end if;

  v_delta := case new.severity
    when 'serious' then -9
    when 'moderate' then -6
    else -3
  end;
  perform public.apply_rider_morale_event(
    new.rider_id,
    v_day_id,
    'injury',
    new.id::text,
    v_delta,
    case new.severity
      when 'serious' then 'Blessure grave en course'
      when 'moderate' then 'Blessure en course'
      else 'Blessure légère en course'
    end,
    jsonb_build_object('injuryId', new.id, 'severity', new.severity)
  );
  return new;
end;
$$;

drop trigger if exists rider_injuries_apply_morale on public.rider_injuries;
create trigger rider_injuries_apply_morale
after insert on public.rider_injuries
for each row execute function public.apply_injury_morale();

create or replace function public.apply_training_overload_morale()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_day integer;
  v_recent_hard_sessions integer;
  v_delta numeric := 0;
begin
  if new.status <> 'completed' or new.intensity < 80 then
    return new;
  end if;
  select day.day_number into v_current_day
  from public.season_days as day where day.id = new.season_day_id;

  select count(*)::integer into v_recent_hard_sessions
  from public.rider_training_sessions as session
  join public.season_days as day on day.id = session.season_day_id
  where session.rider_id = new.rider_id
    and session.season_id = new.season_id
    and session.status = 'completed'
    and session.intensity >= 80
    and day.day_number between greatest(1, v_current_day - 2) and v_current_day;

  if v_recent_hard_sessions >= 2 and new.form_before <= 70 then
    v_delta := -2;
  elsif new.intensity >= 95 and new.form_before <= 50 then
    v_delta := -1;
  end if;
  if v_delta = 0 then return new; end if;

  perform public.apply_rider_morale_event(
    new.rider_id,
    new.season_day_id,
    'training_overload',
    new.id::text,
    v_delta,
    'Surcharge d’entraînement',
    jsonb_build_object(
      'trainingSessionId', new.id,
      'intensity', new.intensity,
      'formBefore', new.form_before,
      'recentHardSessions', v_recent_hard_sessions
    )
  );
  return new;
end;
$$;

drop trigger if exists rider_training_sessions_apply_morale
  on public.rider_training_sessions;
create trigger rider_training_sessions_apply_morale
after insert on public.rider_training_sessions
for each row execute function public.apply_training_overload_morale();

-- Academy riders have their own persistent morale because they do not exist in
-- public.riders yet. Their score and complete audit trail follow them when they
-- are promoted to the professional roster.
alter table public.youth_academy_riders
  add column if not exists morale numeric(5, 2) not null default 60;

alter table public.youth_academy_riders
  drop constraint if exists youth_academy_riders_morale_range;
alter table public.youth_academy_riders
  add constraint youth_academy_riders_morale_range
  check (morale between 0 and 100);

create table public.youth_rider_morale_events (
  id uuid primary key default gen_random_uuid(),
  academy_rider_id uuid not null
    references public.youth_academy_riders(id) on delete cascade,
  season_day_id uuid references public.season_days(id) on delete set null,
  source_type text not null,
  source_reference text not null,
  requested_delta numeric(5, 2) not null,
  applied_delta numeric(5, 2) not null,
  morale_before numeric(5, 2) not null,
  morale_after numeric(5, 2) not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint youth_rider_morale_events_source_allowed check (
    source_type in ('social_integration', 'development_result', 'manual_adjustment')
  ),
  constraint youth_rider_morale_events_reference_not_empty
    check (btrim(source_reference) <> ''),
  constraint youth_rider_morale_events_description_not_empty
    check (btrim(description) <> ''),
  constraint youth_rider_morale_events_requested_delta_range
    check (requested_delta between -100 and 100 and requested_delta <> 0),
  constraint youth_rider_morale_events_applied_delta_range
    check (applied_delta between -100 and 100),
  constraint youth_rider_morale_events_values_range check (
    morale_before between 0 and 100 and morale_after between 0 and 100
  ),
  constraint youth_rider_morale_events_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint youth_rider_morale_events_unique
    unique (academy_rider_id, source_type, source_reference)
);

create index youth_rider_morale_events_rider_history_idx
  on public.youth_rider_morale_events (academy_rider_id, occurred_at desc);

alter table public.youth_rider_morale_events enable row level security;
revoke all on public.youth_rider_morale_events from public, anon, authenticated;
grant select, insert on public.youth_rider_morale_events to service_role;

create or replace function public.apply_youth_rider_morale_event(
  p_academy_rider_id uuid,
  p_season_day_id uuid,
  p_source_type text,
  p_source_reference text,
  p_requested_delta numeric,
  p_description text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.youth_rider_morale_events%rowtype;
  v_before numeric(5, 2);
  v_after numeric(5, 2);
  v_applied numeric(5, 2);
begin
  if p_academy_rider_id is null then
    raise exception 'Le junior est requis pour modifier son moral.';
  end if;
  if p_source_type not in (
    'social_integration', 'development_result', 'manual_adjustment'
  ) then
    raise exception 'Cette source de moral junior n’est pas autorisée.';
  end if;
  if btrim(coalesce(p_source_reference, '')) = ''
    or btrim(coalesce(p_description, '')) = '' then
    raise exception 'La variation de moral junior doit être traçable et expliquée.';
  end if;
  if p_requested_delta is null
    or p_requested_delta = 0
    or p_requested_delta not between -100 and 100 then
    raise exception 'La variation de moral junior doit être comprise entre −100 et +100.';
  end if;
  if coalesce(jsonb_typeof(p_metadata), 'null') <> 'object' then
    raise exception 'Les métadonnées de moral junior doivent former un objet.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_academy_rider_id::text, 1));

  select * into v_existing
  from public.youth_rider_morale_events as event
  where event.academy_rider_id = p_academy_rider_id
    and event.source_type = p_source_type
    and event.source_reference = p_source_reference;
  if v_existing.id is not null then
    return jsonb_build_object(
      'alreadyApplied', true,
      'eventId', v_existing.id,
      'moraleBefore', v_existing.morale_before,
      'moraleAfter', v_existing.morale_after,
      'appliedDelta', v_existing.applied_delta
    );
  end if;

  select morale into v_before
  from public.youth_academy_riders
  where id = p_academy_rider_id
  for update;
  if not found then raise exception 'Le junior est introuvable.'; end if;

  v_before := coalesce(v_before, 60);
  v_after := least(100, greatest(0, v_before + p_requested_delta));
  v_applied := v_after - v_before;

  update public.youth_academy_riders
  set morale = v_after, updated_at = now()
  where id = p_academy_rider_id;

  insert into public.youth_rider_morale_events (
    academy_rider_id, season_day_id, source_type, source_reference,
    requested_delta, applied_delta, morale_before, morale_after,
    description, metadata
  ) values (
    p_academy_rider_id, p_season_day_id, p_source_type, p_source_reference,
    p_requested_delta, v_applied, v_before, v_after,
    btrim(p_description), coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_existing.id;

  return jsonb_build_object(
    'alreadyApplied', false,
    'eventId', v_existing.id,
    'moraleBefore', v_before,
    'moraleAfter', v_after,
    'appliedDelta', v_applied
  );
end;
$$;

revoke all on function public.apply_youth_rider_morale_event(
  uuid, uuid, text, text, numeric, text, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_youth_rider_morale_event(
  uuid, uuid, text, text, numeric, text, jsonb
) to service_role;

create or replace function public.apply_development_result_morale()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_delta numeric;
  v_description text;
begin
  if new.academy_rider_id is null or new.rank > 3 then return new; end if;

  select
    edition.name as race_name,
    edition.race_format,
    day.id as season_day_id
  into v_context
  from public.development_race_editions as edition
  left join public.development_race_stages as stage on stage.id = new.stage_id
  left join public.season_days as day
    on day.season_id = edition.season_id
   and day.day_number = coalesce(stage.day_number, edition.end_day_number)
  where edition.id = new.race_edition_id;

  if v_context.season_day_id is null then return new; end if;
  if new.result_scope = 'general' and v_context.race_format <> 'stage_race' then
    return new;
  end if;

  v_delta := case
    when new.result_scope = 'general' and new.rank = 1 then 5
    when new.result_scope = 'general' then 3
    when new.rank = 1 then 4
    else 2
  end;
  v_description := case
    when new.result_scope = 'general' and new.rank = 1 then 'Victoire au classement général junior — '
    when new.result_scope = 'general' then 'Podium au classement général junior — '
    when new.rank = 1 then 'Victoire junior — '
    else 'Podium junior — '
  end || coalesce(v_context.race_name, 'course Development Team');

  perform public.apply_youth_rider_morale_event(
    new.academy_rider_id,
    v_context.season_day_id,
    'development_result',
    new.id::text,
    v_delta,
    v_description,
    jsonb_build_object(
      'developmentRaceResultId', new.id,
      'scope', new.result_scope,
      'rank', new.rank
    )
  );
  return new;
end;
$$;

drop trigger if exists development_race_results_apply_morale
  on public.development_race_results;
create trigger development_race_results_apply_morale
after insert on public.development_race_results
for each row execute function public.apply_development_result_morale();

create or replace function public.settle_due_youth_rider_morale()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_season record;
  v_rider record;
  v_same_country integer;
  v_social_reference text;
  v_applied integer := 0;
begin
  select season.id, day.id as season_day_id
  into v_season
  from public.seasons as season
  join public.season_days as day
    on day.season_id = season.id
   and day.day_number = coalesce(season.current_day_number, 1)
  where season.status = 'active'
  limit 1;
  if v_season.id is null then return 0; end if;

  for v_rider in
    select academy.id, academy.team_id, academy.country_id
    from public.youth_academy_riders as academy
    where academy.status in ('active', 'recruited', 'release_pending')
  loop
    select count(*)::integer into v_same_country
    from public.youth_academy_riders as teammate
    where teammate.team_id = v_rider.team_id
      and teammate.id <> v_rider.id
      and teammate.country_id = v_rider.country_id
      and teammate.status in ('active', 'recruited', 'release_pending');
    v_social_reference := v_rider.team_id::text || ':' || case
      when v_same_country = 0 then 'isolated'
      when v_same_country = 1 then 'one-compatriot'
      else 'compatriot-group'
    end;

    if not exists (
      select 1 from public.youth_rider_morale_events as event
      where event.academy_rider_id = v_rider.id
        and event.source_type = 'social_integration'
        and event.source_reference = v_social_reference
    ) then
      perform public.apply_youth_rider_morale_event(
        v_rider.id,
        v_season.season_day_id,
        'social_integration',
        v_social_reference,
        case when v_same_country = 0 then -3 when v_same_country = 1 then 1 else 2 end,
        case
          when v_same_country = 0 then 'Adaptation à l’école sans compatriote'
          when v_same_country = 1 then 'Intégration facilitée par un compatriote à l’école'
          else 'Bonne intégration auprès de plusieurs compatriotes à l’école'
        end,
        jsonb_build_object('teamId', v_rider.team_id, 'compatibleTeammates', v_same_country)
      );
      v_applied := v_applied + 1;
    end if;
  end loop;
  return v_applied;
end;
$$;

revoke all on function public.settle_due_youth_rider_morale()
  from public, anon, authenticated;
grant execute on function public.settle_due_youth_rider_morale()
  to service_role;

create or replace function public.carry_youth_morale_to_professional()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day_id uuid;
  v_delta numeric;
  v_history_count integer;
begin
  if new.promoted_rider_id is null
    or new.promoted_rider_id is not distinct from old.promoted_rider_id then
    return new;
  end if;

  v_delta := coalesce(new.morale, 60) - 60;

  select day.id into v_day_id
  from public.seasons as season
  join public.season_days as day
    on day.season_id = season.id
   and day.day_number = coalesce(season.current_day_number, 1)
  where season.status = 'active'
  limit 1;
  if v_day_id is null then return new; end if;

  insert into public.rider_condition_states (
    rider_id, season_day_id, form, fatigue, morale, source
  ) values (
    new.promoted_rider_id, v_day_id, 75, 0, 60, 'academy-promotion'
  ) on conflict (rider_id, season_day_id) do nothing;

  update public.rider_condition_states
  set morale = coalesce(new.morale, 60), updated_at = now()
  where rider_id = new.promoted_rider_id and season_day_id = v_day_id;

  -- Preserve every academy influence in the professional tooltip instead of
  -- collapsing the whole junior story into one opaque transfer adjustment.
  insert into public.rider_morale_events (
    rider_id, season_day_id, source_type, source_reference,
    requested_delta, applied_delta, morale_before, morale_after,
    description, metadata, occurred_at
  )
  select
    new.promoted_rider_id,
    youth_event.season_day_id,
    'academy_promotion',
    new.id::text || ':' || youth_event.id::text,
    youth_event.requested_delta,
    youth_event.applied_delta,
    youth_event.morale_before,
    youth_event.morale_after,
    'Centre de formation — ' || youth_event.description,
    youth_event.metadata || jsonb_build_object(
      'academyRiderId', new.id,
      'academyMoraleEventId', youth_event.id
    ),
    youth_event.occurred_at
  from public.youth_rider_morale_events as youth_event
  where youth_event.academy_rider_id = new.id
  on conflict (rider_id, source_type, source_reference) do nothing;
  get diagnostics v_history_count = row_count;

  if v_history_count = 0 and v_delta <> 0 then
    insert into public.rider_morale_events (
      rider_id, season_day_id, source_type, source_reference,
      requested_delta, applied_delta, morale_before, morale_after,
      description, metadata
    ) values (
      new.promoted_rider_id,
      v_day_id,
      'academy_promotion',
      new.id::text,
      v_delta,
      v_delta,
      60,
      coalesce(new.morale, 60),
      'Moral acquis au centre de formation',
      jsonb_build_object('academyRiderId', new.id, 'academyMorale', new.morale)
    ) on conflict (rider_id, source_type, source_reference) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists youth_academy_riders_carry_morale
  on public.youth_academy_riders;
create trigger youth_academy_riders_carry_morale
after update of promoted_rider_id on public.youth_academy_riders
for each row execute function public.carry_youth_morale_to_professional();

create or replace function public.settle_due_rider_morale()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_season record;
  v_contract record;
  v_same_country integer;
  v_social_reference text;
  v_first_team_year integer;
  v_desired_tenure integer;
  v_existing_tenure numeric;
  v_applied integer := 0;
begin
  select season.id, season.game_year, day.id as season_day_id
  into v_season
  from public.seasons as season
  join public.season_days as day
    on day.season_id = season.id
   and day.day_number = coalesce(season.current_day_number, 1)
  where season.status = 'active'
  limit 1;
  if v_season.id is null then return 0; end if;

  for v_contract in
    select contract.id, contract.rider_id, contract.team_id, rider.country_id
    from public.rider_contracts as contract
    join public.riders as rider on rider.id = contract.rider_id
    where contract.status = 'active'
  loop
    select count(*)::integer into v_same_country
    from public.rider_contracts as teammate_contract
    join public.riders as teammate on teammate.id = teammate_contract.rider_id
    where teammate_contract.team_id = v_contract.team_id
      and teammate_contract.status = 'active'
      and teammate_contract.rider_id <> v_contract.rider_id
      and teammate.country_id = v_contract.country_id;
    v_social_reference := v_contract.team_id::text || ':' || case
      when v_same_country = 0 then 'isolated'
      when v_same_country = 1 then 'one-compatriot'
      else 'compatriot-group'
    end;

    if not exists (
      select 1 from public.rider_morale_events as event
      where event.rider_id = v_contract.rider_id
        and event.source_type = 'social_integration'
        and event.source_reference = v_social_reference
    ) then
      perform public.apply_rider_morale_event(
        v_contract.rider_id,
        v_season.season_day_id,
        'social_integration',
        v_social_reference,
        case when v_same_country = 0 then -3 when v_same_country = 1 then 1 else 2 end,
        case
          when v_same_country = 0 then 'Adaptation dans un groupe sans compatriote'
          when v_same_country = 1 then 'Intégration facilitée par un compatriote'
          else 'Bonne intégration auprès de plusieurs compatriotes'
        end,
        jsonb_build_object('teamId', v_contract.team_id, 'compatibleTeammates', v_same_country)
      );
      v_applied := v_applied + 1;
    end if;

    select min(start_season.game_year)::integer into v_first_team_year
    from public.rider_contracts as history
    join public.seasons as start_season on start_season.id = history.start_season_id
    where history.rider_id = v_contract.rider_id
      and history.team_id = v_contract.team_id
      and history.status in ('active', 'completed');
    v_desired_tenure := least(3, greatest(0, v_season.game_year - coalesce(v_first_team_year, v_season.game_year)));
    select coalesce(sum(event.applied_delta), 0) into v_existing_tenure
    from public.rider_morale_events as event
    where event.rider_id = v_contract.rider_id
      and event.source_type = 'team_tenure'
      and event.metadata ->> 'teamId' = v_contract.team_id::text;

    if v_desired_tenure > v_existing_tenure then
      perform public.apply_rider_morale_event(
        v_contract.rider_id,
        v_season.season_day_id,
        'team_tenure',
        v_contract.team_id::text || ':' || v_season.id::text,
        least(3, v_desired_tenure - v_existing_tenure),
        'Ancienneté et repères dans l’équipe',
        jsonb_build_object('teamId', v_contract.team_id, 'seasonsAtTeam', v_season.game_year - v_first_team_year + 1)
      );
      v_applied := v_applied + 1;
    end if;
  end loop;

  return v_applied;
end;
$$;

revoke all on function public.settle_due_rider_morale()
  from public, anon, authenticated;
grant execute on function public.settle_due_rider_morale() to service_role;

-- Initialize current riders from the stable factors without replaying old
-- sporting results. Future gains and losses start at deployment time.
select public.settle_due_rider_morale();
select public.settle_due_youth_rider_morale();

commit;
