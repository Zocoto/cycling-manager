begin;

-- Une forme ne peut jamais devenir negative. Si la valeur theorique passe sous
-- zero, le coureur est immobilise par une blessure de fatigue pendant 72 h.
alter table public.rider_injuries
  drop constraint rider_injuries_type_allowed,
  drop constraint rider_injuries_diagnosis_allowed;

alter table public.rider_injuries
  add constraint rider_injuries_type_allowed check (
    injury_type in ('abrasions', 'contusion', 'concussion', 'fracture', 'fatigue')
  ),
  add constraint rider_injuries_diagnosis_allowed check (
    diagnosis_code in (
      'rib_fracture',
      'wrist_fracture',
      'clavicle_fracture',
      'fatigue_exhaustion',
      'legacy_fracture',
      'legacy_concussion',
      'legacy_contusion',
      'legacy_abrasions'
    )
  );

create unique index rider_injuries_one_active_fatigue_idx
  on public.rider_injuries (rider_id)
  where status = 'active' and diagnosis_code = 'fatigue_exhaustion';

create or replace function public.ensure_rider_fatigue_injury(
  p_rider_id uuid,
  p_attempted_form integer,
  p_occurred_at timestamptz default now(),
  p_source_stage_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing_id uuid;
  v_injury_id uuid := gen_random_uuid();
  v_started_at timestamptz := coalesce(p_occurred_at, now());
begin
  if p_attempted_form >= 0 then
    return null;
  end if;

  -- Serialise les changements de forme du meme coureur afin que deux effets
  -- simultanes ne puissent pas creer deux blessures de fatigue.
  perform pg_advisory_xact_lock(hashtextextended(p_rider_id::text, 0));

  update public.rider_injuries
  set
    status = 'recovered',
    recovered_at = coalesce(recovered_at, expected_recovery_at),
    updated_at = now()
  where rider_id = p_rider_id
    and diagnosis_code = 'fatigue_exhaustion'
    and status = 'active'
    and expected_recovery_at <= v_started_at;

  select injury.id
  into v_existing_id
  from public.rider_injuries as injury
  where injury.rider_id = p_rider_id
    and injury.diagnosis_code = 'fatigue_exhaustion'
    and injury.status = 'active'
    and injury.expected_recovery_at > v_started_at
  limit 1;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  insert into public.rider_injuries (
    id,
    rider_id,
    source_stage_id,
    injury_type,
    diagnosis_code,
    severity,
    status,
    recovery_days,
    recovery_hours,
    started_at,
    base_expected_recovery_at,
    expected_recovery_at,
    form_loss_per_day,
    protocol_code,
    doctor_recovery_hours_reduced
  ) values (
    v_injury_id,
    p_rider_id,
    p_source_stage_id,
    'fatigue',
    'fatigue_exhaustion',
    'minor',
    'active',
    3,
    72,
    v_started_at,
    v_started_at + interval '3 days',
    v_started_at + interval '3 days',
    0,
    null,
    0
  );

  return v_injury_id;
end;
$$;

create or replace function public.enforce_exact_fatigue_injury_duration()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.diagnosis_code <> 'fatigue_exhaustion' then
    return new;
  end if;

  new.injury_type := 'fatigue';
  new.severity := 'minor';
  new.recovery_days := 3;
  new.recovery_hours := 72;
  new.base_expected_recovery_at := new.started_at + interval '3 days';
  new.expected_recovery_at := new.started_at + interval '3 days';
  new.form_loss_per_day := 0;
  new.protocol_code := null;
  new.doctor_recovery_hours_reduced := 0;
  return new;
end;
$$;

-- Ce trigger s'execute apres le trigger du medecin (ordre alphabetique) et
-- garantit que les trois jours restent fixes pour cette blessure particuliere.
create trigger zz_enforce_exact_fatigue_injury_duration
before insert on public.rider_injuries
for each row execute function public.enforce_exact_fatigue_injury_duration();

create or replace function public.prevent_fatigue_injury_treatment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.rider_injuries as injury
    where injury.id = new.rider_injury_id
      and injury.diagnosis_code = 'fatigue_exhaustion'
  ) then
    raise exception 'Une blessure de fatigue impose trois jours de repos fixes.';
  end if;

  return new;
end;
$$;

create trigger rider_injury_treatment_rejects_fatigue
before insert on public.rider_injury_treatments
for each row execute function public.prevent_fatigue_injury_treatment();

create or replace function public.detect_stage_condition_fatigue_injury()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_rider_fatigue_injury(
    new.rider_id,
    new.form_before + new.form_delta,
    new.applied_at,
    new.stage_id
  );
  return new;
end;
$$;

create trigger stage_condition_detects_fatigue_injury
after insert on public.stage_rider_condition_effects
for each row
when ((new.form_before + new.form_delta) < 0)
execute function public.detect_stage_condition_fatigue_injury();

create or replace function public.detect_training_fatigue_injury()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_rider_fatigue_injury(
    new.rider_id,
    new.form_before + new.form_delta,
    new.processed_at,
    null
  );
  return new;
end;
$$;

create trigger rider_training_detects_fatigue_injury
after insert on public.rider_training_sessions
for each row
when ((new.form_before + new.form_delta) < 0)
execute function public.detect_training_fatigue_injury();

create or replace function public.detect_daily_condition_fatigue_injury()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_rider_fatigue_injury(
    new.rider_id,
    new.form_before + new.form_delta,
    new.applied_at,
    null
  );
  return new;
end;
$$;

create trigger rider_daily_condition_detects_fatigue_injury
after insert on public.rider_daily_condition_effects
for each row
when ((new.form_before + new.form_delta) < 0)
execute function public.detect_daily_condition_fatigue_injury();

create or replace function public.detect_injury_penalty_fatigue_injury()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_rider_fatigue_injury(
    new.rider_id,
    new.form_before + new.form_delta,
    new.applied_at,
    null
  );
  return new;
end;
$$;

create trigger rider_injury_penalty_detects_fatigue_injury
after insert on public.rider_injury_form_effects
for each row
when ((new.form_before + new.form_delta) < 0)
execute function public.detect_injury_penalty_fatigue_injury();

create or replace function public.clamp_rider_form_and_lock_fatigue_injury()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.form < 0 then
    perform public.ensure_rider_fatigue_injury(
      new.rider_id,
      new.form,
      now(),
      null
    );
    new.form := 0;
  end if;

  if exists (
    select 1
    from public.rider_injuries as injury
    where injury.rider_id = new.rider_id
      and injury.diagnosis_code = 'fatigue_exhaustion'
      and injury.status = 'active'
      and injury.expected_recovery_at > now()
  ) then
    new.form := 0;
  end if;

  return new;
end;
$$;

-- Le nom en zz garantit que le verrou de fatigue s'applique apres les autres
-- ajustements de forme executes avant l'ecriture de l'etat.
create trigger zz_rider_condition_fatigue_floor
before insert or update of form on public.rider_condition_states
for each row execute function public.clamp_rider_form_and_lock_fatigue_injury();

revoke all on function public.ensure_rider_fatigue_injury(uuid, integer, timestamptz, uuid)
  from public;

comment on function public.ensure_rider_fatigue_injury(uuid, integer, timestamptz, uuid) is
  'Cree une blessure de fatigue de 72 h lorsque la forme theorique passe strictement sous zero.';

commit;
