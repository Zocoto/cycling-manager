begin;

-- Keep a durable, per-rider record of the one-off form correction. Race
-- results and past condition snapshots are deliberately left unchanged.
create table if not exists public.rider_daily_nutrition_repair_audit (
  rider_id uuid not null references public.riders(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  state_season_day_id uuid not null references public.season_days(id) on delete cascade,
  effect_count integer not null,
  requested_form_gain numeric(7, 2) not null,
  credited_form_gain numeric(5, 2) not null,
  form_before numeric(5, 2) not null,
  form_after numeric(5, 2) not null,
  repaired_at timestamptz not null default now(),
  primary key (rider_id, season_id)
);

alter table public.rider_daily_nutrition_repair_audit enable row level security;

do $$
declare
  v_rider record;
  v_state record;
  v_after numeric(5, 2);
begin
  -- The old effect timestamp is the scheduled midnight, not the real insert
  -- time. A later condition row alone is therefore insufficient evidence.
  -- Require either an untouched subsequent state or a complete training ->
  -- race/intervention chain proving that the bonus was absent at the finish.
  create temp table verified_nutrition_gaps on commit drop as
  select
    effect.id as effect_id,
    effect.rider_id,
    season.id as season_id,
    effect.form_delta,
    case
      when state.updated_at = state.created_at
        and state.source <> 'nutritionist'
        then 'unchanged_state'
      when training.id is not null
        and abs(training.form_before - effect.form_before) < 0.011
        and first_stage.id is not null
        and abs(first_stage.form_before - training.form_after) < 0.011
        and state.source = 'race_finish'
        and state.updated_at = last_stage.applied_at
        then 'race_chain'
      when training.id is not null
        and abs(training.form_before - effect.form_before) < 0.011
        and intervention.id is not null
        and abs(intervention.form_before - training.form_after) < 0.011
        and state.source = 'nutrition'
        and state.updated_at = intervention.applied_at
        then 'intervention_chain'
    end as evidence
  from public.rider_daily_nutrition_effects as effect
  join public.season_days as day on day.id = effect.season_day_id
  join public.seasons as season
    on season.id = day.season_id
   and season.status = 'active'
   and day.day_number < season.current_day_number
  join public.season_days as next_day
    on next_day.season_id = day.season_id
   and next_day.day_number = day.day_number + 1
  join public.rider_condition_states as state
    on state.rider_id = effect.rider_id
   and state.season_day_id = next_day.id
   and state.created_at > effect.applied_at
  left join public.rider_training_sessions as training
    on training.rider_id = effect.rider_id
   and training.season_day_id = next_day.id
  left join public.rider_nutrition_interventions as intervention
    on intervention.rider_id = effect.rider_id
   and intervention.season_day_id = next_day.id
  left join lateral (
    select stage.id, stage.form_before
    from public.stage_rider_condition_effects as stage
    where stage.rider_id = effect.rider_id
      and stage.season_day_id = next_day.id
    order by stage.applied_at, stage.id
    limit 1
  ) as first_stage on true
  left join lateral (
    select stage.id, stage.applied_at
    from public.stage_rider_condition_effects as stage
    where stage.rider_id = effect.rider_id
      and stage.season_day_id = next_day.id
    order by stage.applied_at desc, stage.id desc
    limit 1
  ) as last_stage on true
  where effect.form_delta > 0
    and effect.condition_applied_at is null;

  delete from verified_nutrition_gaps where evidence is null;

  for v_rider in
    select rider_id, season_id,
      count(*)::integer as effect_count,
      sum(form_delta)::numeric(7, 2) as requested_gain
    from verified_nutrition_gaps
    group by rider_id, season_id
  loop
    select state.id, state.season_day_id, state.form
    into v_state
    from public.rider_condition_states as state
    join public.season_days as day on day.id = state.season_day_id
    join public.seasons as season on season.id = day.season_id
    where state.rider_id = v_rider.rider_id
      and day.season_id = v_rider.season_id
      and day.day_number <= season.current_day_number
    order by day.day_number desc, state.updated_at desc
    limit 1
    for update of state;

    if v_state.id is null then
      raise exception 'No current condition state for rider %', v_rider.rider_id;
    end if;

    v_after := least(100, v_state.form + v_rider.requested_gain);

    update public.rider_condition_states
    set form = v_after,
        source = 'nutrition_repair',
        updated_at = now()
    where id = v_state.id;

    insert into public.rider_daily_nutrition_repair_audit (
      rider_id, season_id, state_season_day_id, effect_count,
      requested_form_gain, credited_form_gain, form_before, form_after
    ) values (
      v_rider.rider_id, v_rider.season_id, v_state.season_day_id,
      v_rider.effect_count, v_rider.requested_gain,
      v_after - v_state.form, v_state.form, v_after
    );
  end loop;

  update public.rider_daily_nutrition_effects as effect
  set condition_applied_at = now()
  from verified_nutrition_gaps as gap
  where gap.effect_id = effect.id;
end;
$$;

comment on table public.rider_daily_nutrition_repair_audit is
  'Auditable one-off catch-up for proven nutrition gains omitted from active-season rider form; past race outcomes are unchanged.';

commit;
