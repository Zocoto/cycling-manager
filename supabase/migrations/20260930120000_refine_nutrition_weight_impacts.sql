begin;

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
  v_risk_pct numeric;
  v_gain numeric;
  v_roll numeric;
begin
  select * into v_rider from public.riders where id = new.rider_id for update;
  if v_rider.weight_kg is null then return new; end if;

  select team_season.team_id, season.id, season.game_year, day.day_number
  into v_team_id, v_season_id, v_game_year, v_day_number
  from public.team_seasons as team_season
  join public.seasons as season on season.id = team_season.season_id
  join public.season_days as day on day.id = new.season_day_id
  where team_season.id = new.team_season_id;

  v_risk_pct := greatest(
    1,
    case new.intervention_code
      when 'recovery_snack' then 4
      when 'tailored_plan' then 7
      else 12
    end - greatest(0, new.nutritionist_level - 1) * 0.5
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
  'Applique un risque de prise de poids rare et croissant avec la puissance du complément : 0,1 kg, 0,2 kg ou 0,3 kg.';

notify pgrst, 'reload schema';

commit;
