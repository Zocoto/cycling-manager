begin;

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

  -- Une baisse de forme provoquee pendant une convalescence ne doit jamais
  -- transformer la blessure en cours en une nouvelle blessure de fatigue.
  if exists (
    select 1
    from public.rider_injuries as injury
    where injury.rider_id = p_rider_id
      and injury.status = 'active'
      and injury.started_at <= v_started_at
      and injury.expected_recovery_at > v_started_at
  ) then
    return null;
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

revoke all on function public.ensure_rider_fatigue_injury(uuid, integer, timestamptz, uuid)
  from public;

comment on function public.ensure_rider_fatigue_injury(uuid, integer, timestamptz, uuid) is
  'Cree une blessure de fatigue de 72 h lorsque la forme theorique passe strictement sous zero, uniquement si le coureur ne souffre pas deja d une blessure active.';

commit;
