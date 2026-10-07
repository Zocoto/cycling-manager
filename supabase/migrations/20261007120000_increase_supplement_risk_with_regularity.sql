begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

-- Shared by the authoritative insert trigger and the server-side nutrition preview.
-- Calendar dates handle off-season days and season changes without overlapping
-- game_year * 28 indices. Count actual doses, not selections or weight-gain events.
create or replace function public.get_recent_supplement_use_counts(
  p_rider_ids uuid[],
  p_season_day_id uuid
)
returns table (rider_id uuid, recent_use_count integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_date date;
begin
  if coalesce(cardinality(p_rider_ids), 0) > 100 then
    raise exception 'Au maximum 100 coureurs par lecture nutritionnelle.';
  end if;
  select day.calendar_date into strict v_date
  from public.season_days as day where day.id = p_season_day_id;

  return query
  select requested.id, (
    select count(distinct day.calendar_date)::integer
    from public.rider_nutrition_interventions as intervention
    join public.season_days as day on day.id = intervention.season_day_id
    where intervention.rider_id = requested.id
      and day.calendar_date >= v_date - 6
      and day.calendar_date < v_date
  )
  from (select distinct unnest(p_rider_ids) as id) as requested;
end;
$$;

revoke all on function public.get_recent_supplement_use_counts(uuid[], uuid)
  from public, anon, authenticated;
grant execute on function public.get_recent_supplement_use_counts(uuid[], uuid)
  to service_role;

create or replace function public.apply_supplement_weight_risk()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rider public.riders%rowtype;
  v_team_id uuid;
  v_season_id uuid;
  v_game_year integer;
  v_day_number integer;
  v_recent_uses integer;
  v_risk_pct numeric;
  v_gain numeric;
  v_roll numeric;
begin
  -- Preserve serialization and the existing rider/day uniqueness safeguard.
  select * into v_rider from public.riders where id = new.rider_id for update;
  if v_rider.weight_kg is null then return new; end if;

  select team_season.team_id, season.id, season.game_year, day.day_number
  into v_team_id, v_season_id, v_game_year, v_day_number
  from public.team_seasons as team_season
  join public.seasons as season on season.id = team_season.season_id
  join public.season_days as day on day.id = new.season_day_id
  where team_season.id = new.team_season_id;

  select recent_use_count into v_recent_uses
  from public.get_recent_supplement_use_counts(array[new.rider_id], new.season_day_id);
  v_risk_pct := greatest(
    1,
    case new.intervention_code
      when 'recovery_snack' then 4
      when 'tailored_plan' then 7
      else 12
    end - greatest(0, new.nutritionist_level - 1) * 0.5
      + least(6, greatest(0, coalesce(v_recent_uses, 0))) * 2
  );
  v_gain := case new.intervention_code
    when 'recovery_snack' then 0.1
    when 'tailored_plan' then 0.2
    else 0.3
  end;
  v_roll := public.physiology_seed_fraction(new.id::text || ':supplement') * 100;
  new.weight_before_kg := v_rider.weight_kg;
  new.weight_delta_kg := case when v_roll < v_risk_pct then v_gain else 0 end;
  new.weight_after_kg := least(120, v_rider.weight_kg + new.weight_delta_kg);

  if new.weight_delta_kg > 0 then
    update public.riders
    set weight_kg = new.weight_after_kg
    where id = new.rider_id;

    insert into public.rider_weight_events (
      rider_id, team_id, season_id, season_day_id, game_day_index, source,
      weight_before_kg, weight_delta_kg, weight_after_kg, source_reference
    ) values (
      new.rider_id, v_team_id, v_season_id, new.season_day_id,
      v_game_year * 28 + v_day_number - 1, 'supplement',
      new.weight_before_kg, new.weight_delta_kg, new.weight_after_kg,
      'nutrition-intervention:' || new.id::text
    );
  end if;

  return new;
end;
$$;

comment on function public.apply_supplement_weight_risk() is
  'Risque de base inchangé, majoré de 2 points par jour de prise dans les 6 jours précédents (maximum +12). Gains inchangés : 0,1 / 0,2 / 0,3 kg.';

notify pgrst, 'reload schema';
commit;
