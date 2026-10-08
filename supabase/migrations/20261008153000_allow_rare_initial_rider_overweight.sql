begin;
set local lock_timeout = '2s';
set local statement_timeout = '10s';

-- Roughly 5% of births have a modest, deterministic initial excess. Independent
-- seeds keep this trait stable and prevent correlation with height or physique.
create or replace function public.get_rider_initial_overweight_allowance_bmi(p_seed text)
returns numeric language sql immutable set search_path = public as $$
  select case when public.physiology_seed_fraction(p_seed || ':initial-overweight') < 0.05
    then 0.15 + public.physiology_seed_fraction(p_seed || ':initial-overweight-amount') * 0.60
    else 0 end;
$$;

create or replace function public.generate_rider_weight_kg(
  p_profile text, p_height_cm numeric, p_seed text
)
returns numeric language sql immutable set search_path = public as $$
  with physique as (
    select public.get_rider_initial_weight_limit_kg(p_profile, p_height_cm) as healthy_limit,
      public.get_rider_initial_overweight_allowance_bmi(p_seed) as excess_bmi,
      public.get_physiology_reference_weight(p_profile) /
        power(public.get_physiology_reference_height(p_profile) / 100.0, 2) +
        case p_profile when 'climber' then 0.5 when 'puncheur' then 0.7
          when 'stage_racer' then 0.6 when 'northern_classics' then 1
          when 'rouleur' then 1 when 'sprinter' then 1 else 0.8 end as threshold_bmi
  )
  select case when excess_bmi > 0 then
    least(120,
      floor((threshold_bmi + 0.75) * power(p_height_cm / 100.0, 2) * 10) / 10,
      greatest(ceil((threshold_bmi + 0.15) * power(p_height_cm / 100.0, 2) * 10) / 10,
        round((threshold_bmi + excess_bmi) * power(p_height_cm / 100.0, 2), 1)))
  else least(healthy_limit, round(least(102, greatest(48,
    public.get_physiology_reference_weight(p_profile) +
    (p_height_cm - public.get_physiology_reference_height(p_profile)) * 0.35 +
    (public.physiology_seed_fraction(p_seed || ':weight') - 0.5) * 5
  )), 1)) end from physique;
$$;

-- A pre-filled physique is a real inherited trait, not a reason to force a diet
-- whenever ratings are inserted (promotion, renewal or a future season).
create or replace function public.assign_new_professional_physiology()
returns trigger language plpgsql set search_path = public as $$
declare
  v_rider public.riders%rowtype;
  v_profile text;
  v_height numeric;
  v_weight numeric;
begin
  select * into v_rider from public.riders where id = new.rider_id for update;
  if v_rider.height_cm is not null then return new; end if;
  v_profile := public.infer_rider_physiology_profile(
    new.mountain, new.hills, new.flat, new.time_trial, new.cobbles,
    new.sprint, new.acceleration, new.endurance, new.resistance,
    new.recovery, new.breakaway);
  v_height := public.generate_rider_height_cm(v_profile, v_rider.country_id, v_rider.id::text);
  v_weight := public.generate_rider_weight_kg(v_profile, v_height, v_rider.id::text);
  update public.riders set height_cm = v_height, weight_kg = v_weight,
    baseline_weight_kg = v_weight, physiology_version = 1 where id = new.rider_id;
  return new;
end;
$$;

create or replace function public.copy_promoted_youth_physiology()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.promoted_rider_id is not null
    and new.promoted_rider_id is distinct from old.promoted_rider_id then
    update public.riders set height_cm = new.adult_height_cm,
      weight_kg = new.adult_weight_kg, baseline_weight_kg = new.adult_weight_kg,
      physiology_version = new.physiology_version
    where id = new.promoted_rider_id;
  end if;
  return new;
end;
$$;

-- Functions only. Do not reverse the one-off correction, replay nutrition,
-- regenerate scouting reports or change already created/promoted riders.
notify pgrst, 'reload schema';
commit;
