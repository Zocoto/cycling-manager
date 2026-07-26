-- ============================================================
-- Déclin exponentiel, longévité naturelle et capacité Santé de fer
-- ============================================================

begin;

create or replace function public.calculate_initial_rider_decline_resistance(
  p_rider_id uuid
)
returns numeric
language sql
immutable
set search_path = public
as $$
  with roll as (
    select abs(hashtextextended(p_rider_id::text || ':longevity', 0) % 10000)::integer as value
  )
  select case
    when value < 100 then 0.65
    when value < 600 then 0.80
    when value < 2200 then 0.92
    else 1.00
  end::numeric
  from roll;
$$;

alter table public.riders
  add column decline_resistance_multiplier numeric(4, 2);

update public.riders as rider
set decline_resistance_multiplier =
  public.calculate_initial_rider_decline_resistance(rider.id)
where decline_resistance_multiplier is null;

alter table public.riders
  alter column decline_resistance_multiplier set not null,
  add constraint riders_decline_resistance_multiplier_range
    check (decline_resistance_multiplier between 0.55 and 1.00);

create or replace function public.assign_default_rider_decline_resistance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.decline_resistance_multiplier is null then
    new.decline_resistance_multiplier :=
      public.calculate_initial_rider_decline_resistance(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists assign_default_rider_decline_resistance_before_insert
  on public.riders;
create trigger assign_default_rider_decline_resistance_before_insert
before insert on public.riders
for each row execute function public.assign_default_rider_decline_resistance();

alter table public.special_ability_catalog
  drop constraint special_ability_catalog_code_allowed;

alter table public.special_ability_catalog
  add constraint special_ability_catalog_code_allowed check (
    code in (
      'flahute',
      'panache',
      'bottle_carrier',
      'locomotive',
      'giclette',
      'chase_potato',
      'sandwich_man',
      'iron_health'
    )
  );

insert into public.special_ability_catalog (
  code,
  name,
  effect_description,
  icon_key,
  medallion_tone
)
values (
  'iron_health',
  'Santé de fer',
  'Repousse le déclin d’un an et réduit ensuite de 30 % la perte naturelle de caractéristiques.',
  'walking_cane',
  'slate'
)
on conflict (code) do update set
  name = excluded.name,
  effect_description = excluded.effect_description,
  icon_key = excluded.icon_key,
  medallion_tone = excluded.medallion_tone,
  is_active = true;

insert into public.inventory_catalog_items (
  item_key,
  name,
  category,
  rarity,
  description,
  effect_summary,
  effect_payload,
  icon_key,
  is_consumable
)
values (
  'medallion-iron-health',
  'Médaillon Santé de fer',
  'special_ability',
  'epic',
  'Un médaillon sombre orné d’une canne, symbole d’une longévité hors norme.',
  'Repousse le déclin d’un an puis réduit sa vitesse de 30 %.',
  '{"abilityCode":"iron_health"}'::jsonb,
  'medallion',
  true
)
on conflict (item_key) do update set
  name = excluded.name,
  category = excluded.category,
  rarity = excluded.rarity,
  description = excluded.description,
  effect_summary = excluded.effect_summary,
  effect_payload = excluded.effect_payload,
  icon_key = excluded.icon_key,
  is_consumable = excluded.is_consumable,
  status = 'active',
  updated_at = now();

create or replace function public.get_rider_season_decline_points(
  p_age integer,
  p_decline_resistance_multiplier numeric default 1,
  p_has_iron_health boolean default false
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p_age - case when p_has_iron_health then 1 else 0 end < 32 then 0::numeric
    else
      least(
        8.0,
        3.6 * power(
          1.05,
          p_age - case when p_has_iron_health then 1 else 0 end - 32
        )
      )
      * least(1.0, greatest(0.55, coalesce(p_decline_resistance_multiplier, 1.0)))
      * case when p_has_iron_health then 0.70 else 1.0 end
  end;
$$;
create or replace function public.settle_due_training_sessions()
returns table (
  processed_sessions integer,
  completed_sessions integer,
  current_day_number integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season record;
  v_day record;
  v_rider record;
  v_plan record;
  v_setting record;
  v_trainer record;
  v_progress record;
  v_stat record;
  v_session_id uuid;
  v_status text;
  v_intensity integer;
  v_domain text;
  v_minimum_form integer;
  v_trainer_level integer;
  v_trainer_specialty text;
  v_trainer_country_match boolean;
  v_physio_level integer;
  v_previous_form integer;
  v_form_delta integer;
  v_next_form integer;
  v_domain_weight numeric;
  v_age_factor numeric;
  v_decline_multiplier numeric;
  v_has_iron_health boolean;
  v_potential_factor numeric;
  v_rating_factor numeric;
  v_trainer_factor numeric;
  v_training_milli integer;
  v_decline_milli integer;
  v_balance integer;
  v_rating_change integer;
  v_gain_cap integer;
  v_rating_total integer;
  v_potential_total_cap integer;
  v_progress_json jsonb;
  v_decline_json jsonb;
  v_changes_json jsonb;
  v_processed integer := 0;
  v_completed integer := 0;
begin
  perform public.sync_active_season_day();

  select season.*
  into v_season
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_season is null then
    return query select 0, 0, null::integer;
    return;
  end if;

  for v_day in
    select day.*
    from public.season_days as day
    where day.season_id = v_season.id
      and day.day_number <= coalesce(v_season.current_day_number, 1)
      and now() >= ((day.calendar_date::timestamp + time '08:00') at time zone 'Europe/Paris')
    order by day.day_number
  loop
    for v_rider in
      select
        rider.id,
        rider.potential_steps,
        rider.decline_resistance_multiplier,
        contract.team_id,
        rating.age,
        rating.mountain,
        rating.hills,
        rating.flat,
        rating.time_trial,
        rating.cobbles,
        rating.sprint,
        rating.acceleration,
        rating.downhill,
        rating.endurance,
        rating.resistance,
        rating.recovery,
        rating.breakaway,
        rating.prologue
      from public.riders as rider
      join public.rider_contracts as contract
        on contract.rider_id = rider.id
       and contract.status = 'active'
      join public.rider_season_ratings as rating
        on rating.rider_id = rider.id
       and rating.season_id = v_season.id
      join public.seasons as start_season
        on start_season.id = contract.start_season_id
       and start_season.game_year <= v_season.game_year
      join public.seasons as end_season
        on end_season.id = contract.end_season_id
       and end_season.game_year >= v_season.game_year
      where rider.status = 'active'
        and not exists (
          select 1 from public.rider_training_sessions as existing
          where existing.rider_id = rider.id
            and existing.season_day_id = v_day.id
        )
      order by rider.id
    loop
      select plan.*
      into v_plan
      from public.rider_training_plan_versions as plan
      where plan.rider_id = v_rider.id
        and plan.team_id = v_rider.team_id
        and plan.season_id = v_season.id
        and plan.effective_from_day_number <= v_day.day_number
      order by plan.effective_from_day_number desc, plan.created_at desc
      limit 1;

      select setting.*
      into v_setting
      from public.team_training_setting_versions as setting
      where setting.team_id = v_rider.team_id
        and setting.season_id = v_season.id
        and setting.effective_from_day_number <= v_day.day_number
      order by setting.effective_from_day_number desc, setting.created_at desc
      limit 1;

      v_intensity := coalesce(v_plan.intensity, 0);
      v_domain := coalesce(v_plan.domain, 'stage_racer');
      v_minimum_form := coalesce(v_setting.minimum_form, 50);
      v_trainer_level := 0;
      v_trainer_specialty := null;
      v_trainer_country_match := false;

      if v_plan.trainer_contract_id is not null then
        select member.level, member.trainer_specialty, member.country_id
        into v_trainer
        from public.staff_contracts as contract
        join public.staff_members as member
          on member.id = contract.staff_member_id
         and member.role = 'trainer'
        where contract.id = v_plan.trainer_contract_id
          and contract.team_id = v_rider.team_id
          and contract.status = 'active';

        v_trainer_level := coalesce(v_trainer.level, 0);
        v_trainer_specialty := v_trainer.trainer_specialty;
        v_trainer_country_match := v_trainer.country_id = (
          select rider.country_id from public.riders as rider where rider.id = v_rider.id
        );
      end if;

      v_physio_level := public.get_active_rider_physiotherapist_level(
        v_rider.team_id,
        v_rider.id
      );
      v_decline_multiplier := coalesce(
        v_rider.decline_resistance_multiplier,
        1
      );
      v_has_iron_health := exists (
        select 1
        from public.rider_special_abilities as ability
        where ability.rider_id = v_rider.id
          and ability.ability_code = 'iron_health'
      );

      select state.form
      into v_previous_form
      from public.rider_condition_states as state
      join public.season_days as state_day on state_day.id = state.season_day_id
      where state.rider_id = v_rider.id
        and state_day.season_id = v_season.id
        and state_day.day_number <= v_day.day_number
      order by state_day.day_number desc, state.updated_at desc
      limit 1;

      v_previous_form := coalesce(v_previous_form, 75);
      v_status := 'completed';

      if exists (
        select 1
        from public.rider_injuries as injury
        where injury.rider_id = v_rider.id
          and injury.status = 'active'
          and injury.started_at < (
            (v_day.calendar_date::timestamp + time '08:00') at time zone 'Europe/Paris'
          )
          and injury.expected_recovery_at > (
            (v_day.calendar_date::timestamp + time '08:00') at time zone 'Europe/Paris'
          )
      ) then
        v_status := 'skipped_injury';
      elsif exists (
        select 1
        from public.rider_form_camps as camp
        where camp.rider_id = v_rider.id
          and camp.season_id = v_season.id
          and camp.status <> 'cancelled'
          and v_day.day_number between camp.start_day_number and camp.end_day_number
      ) then
        v_status := 'skipped_form_camp';
      elsif v_previous_form < v_minimum_form then
        v_status := 'skipped_low_form';
      end if;

      if v_status = 'completed' then
        if v_intensity <= 50 then
          v_form_delta := round(2 * (1 - v_intensity / 50.0))::integer;
        else
          v_form_delta := -round((v_intensity - 50) / 2.0)::integer;
        end if;

        if v_form_delta < 0 and v_physio_level > 0 then
          v_form_delta := least(-1, v_form_delta + v_physio_level);
        end if;
      else
        v_form_delta := 0;
      end if;

      v_next_form := greatest(0, least(100, v_previous_form + v_form_delta));
      v_session_id := null;

      insert into public.rider_training_sessions (
        rider_id,
        team_id,
        season_id,
        season_day_id,
        status,
        intensity,
        domain,
        minimum_form,
        trainer_contract_id,
        trainer_level,
        trainer_specialty,
        trainer_country_match,
        physiotherapist_level,
        form_before,
        form_delta,
        form_after
      ) values (
        v_rider.id,
        v_rider.team_id,
        v_season.id,
        v_day.id,
        v_status,
        v_intensity,
        v_domain,
        v_minimum_form,
        v_plan.trainer_contract_id,
        v_trainer_level,
        v_trainer_specialty,
        v_trainer_country_match,
        v_physio_level,
        v_previous_form,
        v_form_delta,
        v_next_form
      )
      on conflict (rider_id, season_day_id) do nothing
      returning id into v_session_id;

      if v_session_id is null then
        continue;
      end if;

      if v_status = 'completed' then
        insert into public.rider_daily_condition_effects (
          rider_id,
          season_day_id,
          effect_type,
          form_delta,
          form_before,
          form_after
        ) values (
          v_rider.id,
          v_day.id,
          'training',
          v_form_delta,
          v_previous_form,
          v_next_form
        )
        on conflict (rider_id, season_day_id) do nothing;

        insert into public.rider_condition_states (
          rider_id,
          season_day_id,
          form,
          fatigue,
          source
        ) values (
          v_rider.id,
          v_day.id,
          v_next_form,
          0,
          'training'
        )
        on conflict (rider_id, season_day_id)
        do update set
          form = greatest(0, least(100, public.rider_condition_states.form + v_form_delta)),
          fatigue = 0,
          source = 'training',
          updated_at = now();

        v_completed := v_completed + 1;
      end if;

      v_rating_total :=
        v_rider.mountain + v_rider.hills + v_rider.flat + v_rider.time_trial
        + v_rider.cobbles + v_rider.sprint + v_rider.acceleration
        + v_rider.downhill + v_rider.endurance + v_rider.resistance
        + v_rider.recovery + v_rider.breakaway + v_rider.prologue;
      v_potential_total_cap := public.get_rider_potential_overall_cap(
        v_rider.potential_steps
      ) * 13;
      v_progress_json := '{}'::jsonb;
      v_decline_json := '{}'::jsonb;
      v_changes_json := '{}'::jsonb;

      for v_stat in
        select *
        from (values
          ('mountain', v_rider.mountain),
          ('hills', v_rider.hills),
          ('flat', v_rider.flat),
          ('time_trial', v_rider.time_trial),
          ('cobbles', v_rider.cobbles),
          ('sprint', v_rider.sprint),
          ('acceleration', v_rider.acceleration),
          ('downhill', v_rider.downhill),
          ('endurance', v_rider.endurance),
          ('resistance', v_rider.resistance),
          ('recovery', v_rider.recovery),
          ('breakaway', v_rider.breakaway),
          ('prologue', v_rider.prologue)
        ) as stats(stat_code, current_rating)
      loop
        insert into public.rider_training_stat_progress (
          rider_id, season_id, stat_code, initial_rating
        ) values (
          v_rider.id, v_season.id, v_stat.stat_code, v_stat.current_rating
        )
        on conflict (rider_id, season_id, stat_code) do nothing;

        select progress.*
        into v_progress
        from public.rider_training_stat_progress as progress
        where progress.rider_id = v_rider.id
          and progress.season_id = v_season.id
          and progress.stat_code = v_stat.stat_code
        for update;

        v_domain_weight := case
          when v_domain = 'climber' and v_stat.stat_code = any(array['mountain','endurance']) then 1
          when v_domain = 'climber' and v_stat.stat_code = any(array['hills','recovery','downhill','acceleration']) then 0.55
          when v_domain = 'puncheur' and v_stat.stat_code = any(array['hills','acceleration']) then 1
          when v_domain = 'puncheur' and v_stat.stat_code = any(array['mountain','sprint','resistance','breakaway']) then 0.55
          when v_domain = 'stage_racer' and v_stat.stat_code = any(array['recovery','endurance','time_trial']) then 1
          when v_domain = 'stage_racer' and v_stat.stat_code = any(array['mountain','hills','resistance','prologue']) then 0.55
          when v_domain = 'northern_classics' and v_stat.stat_code = any(array['cobbles','resistance','flat']) then 1
          when v_domain = 'northern_classics' and v_stat.stat_code = any(array['endurance','acceleration','sprint','breakaway']) then 0.55
          when v_domain = 'rouleur' and v_stat.stat_code = any(array['time_trial','flat','prologue']) then 1
          when v_domain = 'rouleur' and v_stat.stat_code = any(array['endurance','resistance','recovery']) then 0.55
          when v_domain = 'breakaway' and v_stat.stat_code = any(array['breakaway','endurance','resistance']) then 1
          when v_domain = 'breakaway' and v_stat.stat_code = any(array['hills','flat','recovery','downhill']) then 0.55
          when v_domain = 'sprinter' and v_stat.stat_code = any(array['sprint','acceleration','flat']) then 1
          when v_domain = 'sprinter' and v_stat.stat_code = any(array['resistance','prologue','cobbles']) then 0.55
          else 0.1
        end;

        v_age_factor := case
          when v_rider.age <= 21 then 1
          when v_rider.age <= 24 then 0.95
          when v_rider.age <= 27 then 0.85
          when v_rider.age <= 29 then 0.72
          when v_rider.age <= 31 then 0.55
          when v_rider.age <= 36 then 0.5 - (v_rider.age - 32) * 0.04
          else greatest(0.3, 0.34 - (v_rider.age - 36) * 0.01)
        end;
        v_potential_factor := 0.6 + least(8, greatest(1, v_rider.potential_steps)) * 0.05;
        v_rating_factor := case
          when v_stat.current_rating < 50 then 1.8
          when v_stat.current_rating < 60 then 1.35
          when v_stat.current_rating < 70 then 1
          when v_stat.current_rating < 80 then 0.65
          when v_stat.current_rating < 90 then 0.35
          else 0.15
        end;
        v_trainer_factor := case
          when v_trainer_specialty = 'mountain' and v_stat.stat_code = 'mountain' then 1 + v_trainer_level * 0.04
          when v_trainer_specialty = 'hills' and v_stat.stat_code = 'hills' then 1 + v_trainer_level * 0.04
          when v_trainer_specialty = 'flat' and v_stat.stat_code = 'flat' then 1 + v_trainer_level * 0.04
          when v_trainer_specialty = 'sprint' and v_stat.stat_code = any(array['sprint','acceleration']) then 1 + v_trainer_level * 0.04
          when v_trainer_specialty = 'time_trial' and v_stat.stat_code = any(array['time_trial','prologue']) then 1 + v_trainer_level * 0.04
          when v_trainer_specialty = 'cobbles' and v_stat.stat_code = 'cobbles' then 1 + v_trainer_level * 0.04
          when v_trainer_specialty = 'endurance' and v_stat.stat_code = any(array['endurance','resistance','recovery','breakaway','downhill']) then 1 + v_trainer_level * 0.04
          else 1
        end;
        if v_trainer_country_match then
          v_trainer_factor := v_trainer_factor + 0.05;
        end if;

        if v_status = 'completed' then
          v_training_milli := greatest(0, round(
            (10000.0 / 28.0)
            * (v_intensity / 100.0)
            * v_age_factor
            * v_potential_factor
            * v_rating_factor
            * v_domain_weight
            * v_trainer_factor
          )::integer);
        else
          v_training_milli := 0;
        end if;

        v_decline_milli := round(
          public.get_rider_season_decline_points(
            v_rider.age,
            v_decline_multiplier,
            v_has_iron_health
          ) * 1000.0 / 28.0
        )::integer;
        v_balance := v_progress.balance_milli + v_training_milli - v_decline_milli;
        v_rating_change := 0;
        v_gain_cap := case
          when v_progress.initial_rating < 60 then 18
          when v_progress.initial_rating < 70 then 12
          when v_progress.initial_rating < 80 then 8
          when v_progress.initial_rating < 90 then 4
          else 2
        end;

        if v_rider.age < 32 then
          if v_balance >= 1000
            and v_stat.current_rating < 100
            and v_progress.rating_gain < v_gain_cap
            and v_rating_total < v_potential_total_cap then
            v_rating_change := least(
              floor(v_balance / 1000.0)::integer,
              100 - v_stat.current_rating,
              v_gain_cap - v_progress.rating_gain,
              v_potential_total_cap - v_rating_total
            );
            v_balance := v_balance - v_rating_change * 1000;
          elsif v_progress.rating_gain >= v_gain_cap
            or v_stat.current_rating >= 100
            or v_rating_total >= v_potential_total_cap then
            v_balance := least(v_balance, 999);
          end if;
        else
          if v_balance <= -1000 and v_stat.current_rating > 0 then
            v_rating_change := -least(
              floor(abs(v_balance) / 1000.0)::integer,
              v_stat.current_rating
            );
            v_balance := v_balance - v_rating_change * 1000;
          elsif v_balance >= 1000
            and v_stat.current_rating < v_progress.initial_rating
            and v_rating_total < v_potential_total_cap then
            v_rating_change := least(
              floor(v_balance / 1000.0)::integer,
              v_progress.initial_rating - v_stat.current_rating,
              v_potential_total_cap - v_rating_total
            );
            v_balance := v_balance - v_rating_change * 1000;
          elsif v_stat.current_rating >= v_progress.initial_rating then
            v_balance := least(v_balance, 999);
          end if;
        end if;

        update public.rider_training_stat_progress
        set
          balance_milli = v_balance,
          total_training_milli = total_training_milli + v_training_milli,
          rating_gain = rating_gain + greatest(0, v_rating_change),
          rating_loss = rating_loss + greatest(0, -v_rating_change),
          updated_at = now()
        where rider_id = v_rider.id
          and season_id = v_season.id
          and stat_code = v_stat.stat_code;

        v_rating_total := v_rating_total + v_rating_change;
        v_progress_json := v_progress_json || jsonb_build_object(
          v_stat.stat_code, v_training_milli
        );
        v_decline_json := v_decline_json || jsonb_build_object(
          v_stat.stat_code, v_decline_milli
        );
        if v_rating_change <> 0 then
          v_changes_json := v_changes_json || jsonb_build_object(
            v_stat.stat_code, v_rating_change
          );
        end if;
      end loop;

      update public.rider_season_ratings
      set
        mountain = greatest(0, least(100, mountain + coalesce((v_changes_json ->> 'mountain')::integer, 0))),
        hills = greatest(0, least(100, hills + coalesce((v_changes_json ->> 'hills')::integer, 0))),
        flat = greatest(0, least(100, flat + coalesce((v_changes_json ->> 'flat')::integer, 0))),
        time_trial = greatest(0, least(100, time_trial + coalesce((v_changes_json ->> 'time_trial')::integer, 0))),
        cobbles = greatest(0, least(100, cobbles + coalesce((v_changes_json ->> 'cobbles')::integer, 0))),
        sprint = greatest(0, least(100, sprint + coalesce((v_changes_json ->> 'sprint')::integer, 0))),
        acceleration = greatest(0, least(100, acceleration + coalesce((v_changes_json ->> 'acceleration')::integer, 0))),
        downhill = greatest(0, least(100, downhill + coalesce((v_changes_json ->> 'downhill')::integer, 0))),
        endurance = greatest(0, least(100, endurance + coalesce((v_changes_json ->> 'endurance')::integer, 0))),
        resistance = greatest(0, least(100, resistance + coalesce((v_changes_json ->> 'resistance')::integer, 0))),
        recovery = greatest(0, least(100, recovery + coalesce((v_changes_json ->> 'recovery')::integer, 0))),
        breakaway = greatest(0, least(100, breakaway + coalesce((v_changes_json ->> 'breakaway')::integer, 0))),
        prologue = greatest(0, least(100, prologue + coalesce((v_changes_json ->> 'prologue')::integer, 0))),
        updated_at = now()
      where rider_id = v_rider.id
        and season_id = v_season.id;

      update public.rider_training_sessions
      set
        progress_milli = v_progress_json,
        decline_milli = v_decline_json,
        rating_changes = v_changes_json
      where id = v_session_id;

      v_processed := v_processed + 1;
    end loop;
  end loop;

  return query
  select
    v_processed,
    v_completed,
    coalesce(v_season.current_day_number, 1)::integer;
end;
$$;
revoke all on function public.calculate_initial_rider_decline_resistance(uuid) from public;
revoke all on function public.get_rider_season_decline_points(integer, numeric, boolean) from public;
grant execute on function public.settle_due_training_sessions() to authenticated, service_role;

comment on column public.riders.decline_resistance_multiplier is
  'Multiplicateur caché du déclin naturel : 1 standard, 0,65 pour la longévité exceptionnelle (1 % des coureurs).';
comment on function public.get_rider_season_decline_points(integer, numeric, boolean) is
  'Courbe annuelle composée de 5 % à partir de 32 ans, modulée par la longévité naturelle et Santé de fer.';
comment on function public.settle_due_training_sessions() is
  'Règle les séances quotidiennes et applique le déclin exponentiel des vétérans, compensable par l’entraînement.';

notify pgrst, 'reload schema';

commit;