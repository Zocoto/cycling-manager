begin;

set local lock_timeout = '1s';
set local statement_timeout = '5s';

-- Fail closed if the reviewed live function has changed in the meantime.
-- The raw hash intentionally preserves the CRLF body stored in production.
do $verified_live_core$
begin
  if md5(pg_catalog.pg_get_functiondef(
    'public.calculate_prepared_stage_form_cost(uuid,uuid,numeric)'::regprocedure
  )) <> '5140d253ae4f9e78ec1620cd55577a50' then
    raise exception 'Le calcul de forme CLM a changé : revue du rééquilibrage nécessaire.';
  end if;
end;
$verified_live_core$;

-- A smaller performance boost is paired with twice the normal form cost.
-- Existing locked engines through v49 retain their former cost, even for a
-- future stage. The effort balance starts at v50, after the sprint-train v49.
-- CN results-only races have no saved simulation: use a fixed departure cutoff
-- for that path, never the settlement/replay time. No historical effects move.
create or replace function public.calculate_prepared_stage_form_cost(
  p_stage_id uuid,
  p_rider_id uuid,
  p_recovery numeric default 50
)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v_stage_type text;
  v_stage_departure_at timestamptz;
  v_base_cost numeric;
  v_effort_mode text := 'normal';
  v_effort_multiplier numeric := 1;
  v_engine_version text;
  v_relay_share numeric;
  v_roster_count integer;
  v_relay_multiplier numeric := 1;
begin
  v_base_cost := public.calculate_stage_form_cost(p_stage_id, p_recovery);

  select stage.stage_type, stage.departure_at
  into v_stage_type, v_stage_departure_at
  from public.stages as stage
  where stage.id = p_stage_id;

  if v_stage_type not in (
    'individual_time_trial',
    'team_time_trial',
    'prologue'
  ) then
    return v_base_cost;
  end if;

  -- The existing plan lookup also reads just the engine version, via the
  -- snapshot primary key, only for all-in TT riders. No extra round trip,
  -- snapshot payload read, or lookup for road/normal/conserve riders.
  select plan.effort_mode, plan.relay_share_pct, simulation.engine_version
  into v_effort_mode, v_relay_share, v_engine_version
  from public.race_time_trial_rider_plans as plan
  left join public.official_stage_simulations as simulation
    on simulation.stage_id = plan.stage_id
   and plan.effort_mode = 'all_in'
  where plan.stage_id = p_stage_id
    and plan.rider_id = p_rider_id;

  v_effort_multiplier := case coalesce(v_effort_mode, 'normal')
    when 'conserve' then 0.7
    when 'all_in' then case
      when v_engine_version is not null then case
        when coalesce(
          substring(v_engine_version from '-v([0-9]+)$')::numeric,
          0
        ) >= 50 then 2
        else 1.35
      end
      when v_stage_departure_at >= timestamptz '2026-10-22 14:30:00+00'
        then 2
      else 1.35
    end
    else 1
  end;

  if v_stage_type = 'team_time_trial' and v_relay_share is not null then
    select count(*)::integer
    into v_roster_count
    from public.race_time_trial_rider_plans as teammate_plan
    where teammate_plan.stage_id = p_stage_id
      and teammate_plan.race_registration_id = (
        select own_plan.race_registration_id
        from public.race_time_trial_rider_plans as own_plan
        where own_plan.stage_id = p_stage_id
          and own_plan.rider_id = p_rider_id
        limit 1
      );

    v_relay_multiplier := greatest(
      0.55,
      least(
        1.8,
        0.65 + (v_relay_share * greatest(1, v_roster_count) / 100) * 0.35
      )
    );
  end if;

  return round(greatest(1, v_base_cost * v_effort_multiplier * v_relay_multiplier), 1);
end;
$$;

-- CREATE OR REPLACE preserves the existing owner, grants and security mode.
-- In particular this migration never replays a condition settlement.
comment on function public.calculate_prepared_stage_form_cost(uuid, uuid, numeric)
is 'Applique l’effort CLM et les relais au coût de forme ; Tout donner coûte x2 dès le moteur v50, sans modifier les scénarios antérieurs.';

commit;
