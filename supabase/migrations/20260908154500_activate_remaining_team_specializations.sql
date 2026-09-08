begin;

-- Centralise la puissance progressive des orientations d'équipe : 60 % au
-- niveau 3, 80 % au niveau 4 et 100 % au niveau 5. La Dataroom, déjà à son
-- niveau maximal au niveau 3, applique directement 100 % de son orientation.
create or replace function public.get_team_specialization_power(
  p_team_id uuid,
  p_infrastructure_code text,
  p_specialization_code text
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when public.get_team_infrastructure_specialization(
        p_team_id,
        p_infrastructure_code
      ) = p_specialization_code
      then case
        when p_infrastructure_code = 'recruitment_data_room' then 1
        else public.get_infrastructure_specialization_power_multiplier(
          infrastructure.level
        )
      end
      else 0
    end
    from public.team_infrastructures as infrastructure
    where infrastructure.team_id = p_team_id
      and infrastructure.infrastructure_code = p_infrastructure_code
    limit 1
  ), 0)::numeric
$$;

-- -------------------------------------------------------------------------
-- Centre de cryothérapie et protection de forme de la Soufflerie
-- -------------------------------------------------------------------------

alter table public.stage_rider_condition_effects
  add column if not exists wind_tunnel_form_protection numeric(5, 2)
    not null default 0;
alter table public.rider_injuries
  add column if not exists cryotherapy_recovery_hours_reduced smallint
    not null default 0,
  alter column form_loss_per_day type numeric(5, 2)
    using form_loss_per_day::numeric(5, 2);

create or replace function public.apply_assigned_physio_to_race_condition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_physio_level integer;
  v_physio integer := 0;
  v_cryo integer := 0;
  v_after_physio numeric;
  v_before_wind numeric;
  v_original numeric := new.form_delta;
  v_stage_distance numeric := 0;
  v_day_number integer;
  v_season_id uuid;
  v_rapid_power numeric := 0;
  v_load_power numeric := 0;
  v_wind_power numeric := 0;
  v_recent_race_days integer := 0;
  v_weather jsonb := '{}'::jsonb;
  v_is_difficult_weather boolean := false;
begin
  new.physiotherapist_level := 0;
  new.physiotherapist_form_protection := 0;
  new.cryotherapy_form_protection := 0;
  new.wind_tunnel_form_protection := 0;

  select
    team_season.team_id,
    stage.distance_km,
    season_day.day_number,
    season_day.season_id
  into v_team_id, v_stage_distance, v_day_number, v_season_id
  from public.stages as stage
  join public.season_days as season_day on season_day.id = stage.season_day_id
  join public.race_registrations as registration
    on registration.race_edition_id = stage.race_edition_id
   and registration.status = 'accepted'
  join public.race_rosters as roster
    on roster.race_registration_id = registration.id
   and roster.rider_id = new.rider_id
  join public.team_seasons as team_season
    on team_season.id = registration.team_season_id
  where stage.id = new.stage_id
  limit 1;
  if v_team_id is null then return new; end if;

  v_physio_level := public.get_active_rider_physiotherapist_level(
    v_team_id,
    new.rider_id
  );
  if v_physio_level > 0 then
    v_physio := public.get_rider_physio_form_protection(
      v_team_id,
      new.rider_id,
      'race'
    );
  end if;
  new.form_delta := least(-1, new.form_delta + v_physio);
  v_after_physio := new.form_delta;

  select coalesce(max(level), 0) * 10
  into v_cryo
  from public.team_infrastructures
  where team_id = v_team_id
    and infrastructure_code = 'cryotherapy_center';
  if v_cryo > 0 then
    new.form_delta := -round(abs(new.form_delta) * (1 - v_cryo / 100.0), 2);
  end if;
  v_rapid_power := public.get_team_specialization_power(
    v_team_id,
    'cryotherapy_center',
    'rapid_recovery'
  );
  v_load_power := public.get_team_specialization_power(
    v_team_id,
    'cryotherapy_center',
    'load_management'
  );
  if v_day_number is not null and v_day_number >= 3 and v_load_power > 0 then
    select count(distinct previous_day.day_number)::integer
    into v_recent_race_days
    from public.stage_rider_condition_effects as previous_effect
    join public.stages as previous_stage
      on previous_stage.id = previous_effect.stage_id
    join public.season_days as previous_day
      on previous_day.id = previous_stage.season_day_id
    where previous_effect.rider_id = new.rider_id
      and previous_day.season_id = v_season_id
      and previous_day.day_number between v_day_number - 2 and v_day_number - 1;
  end if;
  new.form_delta := -round(
    abs(new.form_delta) * (
      1 - (
        v_rapid_power * (0.05 + case when v_stage_distance > 200 then 0.03 else 0 end)
        + case when v_recent_race_days = 2 then v_load_power * 0.04 else 0 end
      )
    ),
    2
  );
  v_before_wind := new.form_delta;

  select coalesce(simulation.input_data -> 'weather', '{}'::jsonb)
  into v_weather
  from public.official_stage_simulations as simulation
  where simulation.stage_id = new.stage_id;
  v_is_difficult_weather :=
    coalesce((v_weather ->> 'isWet')::boolean, false)
    or coalesce(v_weather ->> 'windIntensity', '') in ('strong', 'gale')
    or coalesce(v_weather ->> 'condition', '') in ('storm', 'snow')
    or coalesce((v_weather ->> 'temperatureC')::numeric, 20) >= 32
    or coalesce((v_weather ->> 'temperatureC')::numeric, 20) <= 7;
  if v_is_difficult_weather then
    v_wind_power := public.get_team_specialization_power(
      v_team_id,
      'wind_tunnel',
      'versatile_aero'
    );
    new.form_delta := -round(
      abs(new.form_delta) * (1 - 0.02 * v_wind_power),
      2
    );
  end if;

  new.form_after := greatest(0, new.form_before + new.form_delta);
  new.physiotherapist_level := least(5, greatest(0, v_physio_level));
  new.physiotherapist_form_protection := greatest(
    0,
    v_after_physio - v_original
  );
  new.cryotherapy_form_protection := greatest(
    0,
    v_before_wind - v_after_physio
  );
  new.wind_tunnel_form_protection := greatest(
    0,
    new.form_delta - v_before_wind
  );
  return new;
end;
$$;

create or replace function public.apply_cryotherapy_rest_recovery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_power numeric;
begin
  if new.effect_type <> 'rest' or new.form_delta <= 0 then return new; end if;
  select contract.team_id
  into v_team_id
  from public.rider_contracts as contract
  where contract.rider_id = new.rider_id
    and contract.status = 'active'
  order by contract.signed_at desc
  limit 1;
  if v_team_id is null then return new; end if;
  v_power := public.get_team_specialization_power(
    v_team_id,
    'cryotherapy_center',
    'load_management'
  );
  new.form_delta := round(new.form_delta * (1 + 0.03 * v_power), 2);
  new.form_after := least(100, new.form_before + new.form_delta);
  return new;
end;
$$;

drop trigger if exists apply_cryotherapy_rest_recovery_trigger
  on public.rider_daily_condition_effects;
create trigger apply_cryotherapy_rest_recovery_trigger
before insert on public.rider_daily_condition_effects
for each row execute function public.apply_cryotherapy_rest_recovery();

create or replace function public.apply_team_doctor_to_new_injury()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team_id uuid;
  v_doctor_reduction_percentage numeric;
  v_federal_reduction_percentage numeric;
  v_doctor_reduction_hours integer;
  v_total_reduction_hours integer;
  v_cryo_reduction_hours integer := 0;
  v_rehab_power numeric := 0;
  v_form_protection integer;
begin
  select contract.team_id into v_team_id
  from public.rider_contracts as contract
  where contract.rider_id = new.rider_id
    and contract.status = 'active'
  order by contract.signed_at desc
  limit 1;
  if v_team_id is null then return new; end if;

  v_doctor_reduction_percentage := least(
    80,
    public.get_active_team_staff_base_strength(v_team_id, 'doctor', 6)
      + public.get_active_team_staff_talent_strength(
          v_team_id,
          'doctor_recovery_time',
          3
        )
  );
  v_federal_reduction_percentage := coalesce(
    public.get_team_national_federation_infrastructure_level(
      v_team_id,
      'federal_medical_network'
    ),
    0
  );
  v_doctor_reduction_hours := ceil(
    new.recovery_hours * v_doctor_reduction_percentage / 100.0
  )::integer;
  v_total_reduction_hours := ceil(
    new.recovery_hours * least(
      85,
      v_doctor_reduction_percentage + v_federal_reduction_percentage
    ) / 100.0
  )::integer;
  new.doctor_recovery_hours_reduced := v_doctor_reduction_hours;
  new.federal_recovery_hours_reduced := greatest(
    0,
    v_total_reduction_hours - v_doctor_reduction_hours
  );

  if new.severity in ('minor', 'moderate') then
    v_rehab_power := public.get_team_specialization_power(
      v_team_id,
      'cryotherapy_center',
      'rehabilitation'
    );
    v_cryo_reduction_hours := ceil(
      greatest(0, new.recovery_hours - v_total_reduction_hours)
      * 0.08 * v_rehab_power
    )::integer;
  end if;
  new.cryotherapy_recovery_hours_reduced := v_cryo_reduction_hours;
  new.expected_recovery_at := new.expected_recovery_at
    - make_interval(hours => v_total_reduction_hours + v_cryo_reduction_hours);

  select count(*)::integer into v_form_protection
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'doctor'
  join public.staff_member_talents as talent
    on talent.staff_member_id = member.id
   and talent.talent_code = 'doctor_injury_form_loss'
  where contract.team_id = v_team_id
    and contract.status = 'active';
  new.form_loss_per_day := greatest(
    0,
    new.form_loss_per_day - coalesce(v_form_protection, 0)
  );
  if v_rehab_power > 0 then
    new.form_loss_per_day := round(
      new.form_loss_per_day * (1 - 0.05 * v_rehab_power),
      2
    );
  end if;
  return new;
end;
$$;

-- -------------------------------------------------------------------------
-- Dataroom et scouting junior
-- -------------------------------------------------------------------------

alter table public.youth_scouting_missions
  add column if not exists data_room_quality_bonus_percentage numeric(5, 2)
    not null default 0,
  add column if not exists data_room_report_precision_bonus_percentage numeric(5, 2)
    not null default 0;

alter table public.youth_scouting_candidates
  add column if not exists data_room_tuition_reduction_percentage numeric(5, 2)
    not null default 0,
  add column if not exists welcome_center_tuition_reduction_percentage numeric(5, 2)
    not null default 0;

create or replace function public.apply_data_room_salary_discount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_power numeric;
begin
  if new.salary_per_season <= 0 then return new; end if;
  v_power := public.get_team_specialization_power(
    new.team_id,
    'recruitment_data_room',
    'deal_room'
  );
  if v_power > 0 then
    new.salary_per_season := round(
      new.salary_per_season * (1 - 0.03 * v_power),
      2
    );
  end if;
  return new;
end;
$$;

drop trigger if exists apply_data_room_salary_discount_trigger
  on public.rider_contracts;
create trigger apply_data_room_salary_discount_trigger
before insert on public.rider_contracts
for each row execute function public.apply_data_room_salary_discount();

create or replace function public.apply_data_room_transfer_rebate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_power numeric;
  v_rebate numeric(14, 2);
  v_team_season_id uuid;
  v_season_day_id uuid;
  v_day_number integer;
begin
  if coalesce(new.transfer_fee, 0) <= 0 then return new; end if;
  if tg_op = 'UPDATE'
    and new.transfer_fee is not distinct from old.transfer_fee then
    return new;
  end if;

  v_power := public.get_team_specialization_power(
    new.team_id,
    'recruitment_data_room',
    'deal_room'
  );
  v_rebate := round(new.transfer_fee * 0.04 * v_power, 2);
  if v_rebate <= 0 then return new; end if;

  select team_season.id, season_day.id, season.current_day_number
  into v_team_season_id, v_season_day_id, v_day_number
  from public.seasons as season
  join public.team_seasons as team_season
    on team_season.season_id = season.id
   and team_season.team_id = new.team_id
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = season.current_day_number
  where season.status = 'active'
  limit 1;
  if v_team_season_id is null then return new; end if;

  insert into public.team_finance_transactions (
    team_season_id, season_day_id, day_number, amount, category, status,
    description, source_reference, posted_at
  ) values (
    v_team_season_id, v_season_day_id, v_day_number, v_rebate,
    'transfer', 'posted', 'Dataroom — économie sur une signature',
    'data-room-transfer-rebate:' || new.id::text, now()
  ) on conflict (team_season_id, source_reference) do nothing;
  if found then
    update public.team_seasons
    set cash_balance = cash_balance + v_rebate
    where id = v_team_season_id;
  end if;
  return new;
end;
$$;

drop trigger if exists apply_data_room_transfer_rebate_trigger
  on public.rider_contracts;
create trigger apply_data_room_transfer_rebate_trigger
after insert or update of transfer_fee on public.rider_contracts
for each row execute function public.apply_data_room_transfer_rebate();

-- -------------------------------------------------------------------------
-- Piste indoor : l'effet course est géré par le moteur TypeScript ; ce
-- multiplicateur ajoute l'effet d'Explosivité aux séances Accélération.
-- -------------------------------------------------------------------------

create or replace function public.get_team_training_center_specialization_progress_multiplier(
  p_team_id uuid,
  p_stat_code text,
  p_current_rating numeric,
  p_trainer_country_match boolean default false
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_level integer := 0;
  v_specialization text;
  v_full_power_bonus numeric := 0;
  v_power numeric := 0;
begin
  select coalesce(max(infrastructure.level), 0)
  into v_level
  from public.team_infrastructures as infrastructure
  where infrastructure.team_id = p_team_id
    and infrastructure.infrastructure_code = 'training_center';

  if v_level >= 3 then
    v_specialization := public.get_team_infrastructure_specialization(
      p_team_id,
      'training_center'
    );
    v_power := public.get_infrastructure_specialization_power_multiplier(v_level);

    if v_specialization = 'individualization' then
      if p_current_rating < 70 then
        v_full_power_bonus := v_full_power_bonus + 0.05;
      end if;
      if p_current_rating < 65
        and p_stat_code = any(array[
          'acceleration', 'downhill', 'endurance', 'resistance',
          'recovery', 'breakaway', 'prologue'
        ])
      then
        v_full_power_bonus := v_full_power_bonus + 0.05;
      end if;
    elsif v_specialization = 'elite_performance' then
      if p_current_rating between 75 and 82 then
        v_full_power_bonus := v_full_power_bonus + 0.02;
      end if;
      if coalesce(p_trainer_country_match, false) then
        v_full_power_bonus := v_full_power_bonus + 0.05;
      end if;
    end if;
  end if;

  return (
    1 + v_full_power_bonus * v_power +
    case when p_stat_code = 'acceleration' then
      0.03 * public.get_team_specialization_power(
        p_team_id,
        'indoor_track',
        'explosiveness'
      )
    else 0 end
  )::numeric;
end;
$$;

-- -------------------------------------------------------------------------
-- Siège du Fan Club et Média Center
-- -------------------------------------------------------------------------

do $migration$
declare
  v_definition text;
  v_marker constant text :=
    'if v_required_level is null then raise exception ''Ce modèle de car n’existe pas.''; end if;';
begin
  select pg_get_functiondef(
    'public.purchase_current_team_fan_club_car(text)'::regprocedure
  ) into v_definition;
  if position('get_team_specialization_power' in v_definition) = 0 then
    if position(v_marker in v_definition) = 0 then
      raise exception 'Point d’intégration du prix des cars introuvable.';
    end if;
    v_definition := replace(
      v_definition,
      v_marker,
      v_marker || chr(10) ||
        '  v_purchase_price := round(v_purchase_price * (1 - 0.05 * ' ||
        'public.get_team_specialization_power(v_context.team_id, ' ||
        '''fan_club_headquarters'', ''loyalty_program'')), 2);'
    );
    execute v_definition;
  end if;
end;
$migration$;

create or replace function public.get_auth_user_media_game_reward_multiplier(
  p_auth_user_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select 1 + 0.50 * public.get_team_specialization_power(
      assignment.team_id,
      'media_center',
      'prestige_press'
    )
    from public.sporting_directors as director
    join public.team_manager_assignments as assignment
      on assignment.sporting_director_id = director.id
     and assignment.role = 'general_manager'
     and assignment.status = 'active'
    where director.auth_user_id = p_auth_user_id
      and director.status = 'active'
    limit 1
  ), 1)::numeric
$$;

create or replace function public.get_current_team_media_game_reward()
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(
    1000 * public.get_auth_user_media_game_reward_multiplier(auth.uid()),
    2
  )::numeric
$$;

do $migration$
declare
  v_definition text;
  v_marker constant text := 'v_game_reward numeric(14, 2) := 1000;';
begin
  select pg_get_functiondef(
    'public.complete_cyclogazette_game_for_user(uuid,uuid,text)'::regprocedure
  ) into v_definition;
  if position('get_auth_user_media_game_reward_multiplier' in v_definition) = 0 then
    if position(v_marker in v_definition) = 0 then
      raise exception 'Point d’intégration du gain des jeux Gazette introuvable.';
    end if;
    v_definition := replace(
      v_definition,
      v_marker,
      'v_game_reward numeric(14, 2) := round(1000 * ' ||
        'public.get_auth_user_media_game_reward_multiplier(p_auth_user_id), 2);'
    );
    execute v_definition;
  end if;
end;
$migration$;

create or replace function public.apply_media_sponsor_contract_bonus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_power numeric;
begin
  if new.role <> 'principal' then return new; end if;
  v_power := public.get_team_specialization_power(
    new.team_id,
    'media_center',
    'community_media'
  );
  new.budget_per_season := round(
    new.budget_per_season * (1 + 0.05 * v_power),
    2
  );
  return new;
end;
$$;

drop trigger if exists apply_media_sponsor_contract_bonus_trigger
  on public.team_sponsor_contracts;
create trigger apply_media_sponsor_contract_bonus_trigger
before insert on public.team_sponsor_contracts
for each row execute function public.apply_media_sponsor_contract_bonus();

create or replace function public.get_sponsor_objective_satisfaction_score(
  p_contract_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select least(
    100,
    round(
      coalesce(sum(objective.satisfaction_points) filter (
        where objective.status = 'completed'
      ), 0) * (
        1 + 0.10 * public.get_team_specialization_power(
          contract.team_id,
          'media_center',
          'community_media'
        )
      )
    )
  )::integer
  from public.team_sponsor_contracts as contract
  left join public.sponsor_objectives as objective
    on objective.sponsor_offer_id = contract.sponsor_offer_id
   and objective.season_id = coalesce(
     contract.objective_season_id,
     contract.start_season_id
   )
  where contract.id = p_contract_id
  group by contract.team_id;
$$;

create table public.team_media_intervention_rewards (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  source_type text not null check (
    source_type in ('pre_race_press', 'post_race_interview')
  ),
  source_id uuid not null,
  rider_id uuid references public.riders(id) on delete set null,
  supporter_bonus integer not null default 0 check (supporter_bonus >= 0),
  fervor_bonus numeric(5, 2) not null default 0 check (fervor_bonus >= 0),
  rider_popularity_bonus numeric(5, 2) not null default 0
    check (rider_popularity_bonus >= 0),
  created_at timestamptz not null default now(),
  unique (source_type, source_id)
);

alter table public.rider_popularity_profiles
  alter column popularity_points type numeric(8, 2)
    using popularity_points::numeric(8, 2);

create index team_media_intervention_rewards_team_idx
  on public.team_media_intervention_rewards (team_id, season_id);
alter table public.team_media_intervention_rewards enable row level security;
grant all privileges on public.team_media_intervention_rewards to service_role;

create or replace function public.reward_media_center_intervention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_team_id uuid := (v_row ->> 'team_id')::uuid;
  v_season_id uuid := (v_row ->> 'season_id')::uuid;
  v_source_type text;
  v_source_id uuid := (v_row ->> 'id')::uuid;
  v_rider_id uuid;
  v_power numeric;
  v_reward_id uuid;
  v_popularity_bonus numeric(5, 2);
begin
  if tg_table_name = 'post_race_interviews' then
    if tg_op <> 'UPDATE'
      or coalesce(v_row ->> 'status', '') <> 'submitted'
      or coalesce(to_jsonb(old) ->> 'status', '') = 'submitted' then
      return new;
    end if;
    v_source_type := 'post_race_interview';
    v_rider_id := nullif(v_row -> 'context' ->> 'riderId', '')::uuid;
  else
    if coalesce(v_row ->> 'status', '') <> 'published' then return new; end if;
    v_source_type := 'pre_race_press';
    v_rider_id := nullif(v_row ->> 'leader_rider_id', '')::uuid;
  end if;

  v_power := public.get_team_specialization_power(
    v_team_id,
    'media_center',
    'crisis_room'
  );
  if v_power <= 0 then return new; end if;
  v_popularity_bonus := round(1 * v_power, 2);

  insert into public.team_media_intervention_rewards (
    team_id, season_id, source_type, source_id, rider_id,
    supporter_bonus, fervor_bonus, rider_popularity_bonus
  ) values (
    v_team_id, v_season_id, v_source_type, v_source_id, v_rider_id,
    round(10 * v_power)::integer, round(1 * v_power, 2), v_popularity_bonus
  )
  on conflict (source_type, source_id) do nothing
  returning id into v_reward_id;

  if v_reward_id is not null and v_rider_id is not null then
    insert into public.rider_popularity_profiles (
      rider_id,
      popularity_points,
      updated_at
    ) values (
      v_rider_id,
      v_popularity_bonus,
      now()
    )
    on conflict (rider_id) do update
    set
      popularity_points = public.rider_popularity_profiles.popularity_points
        + excluded.popularity_points,
      updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists reward_media_center_pre_race_press_trigger
  on public.pre_race_press_conferences;
create trigger reward_media_center_pre_race_press_trigger
after insert on public.pre_race_press_conferences
for each row execute function public.reward_media_center_intervention();

drop trigger if exists reward_media_center_post_race_interview_trigger
  on public.post_race_interviews;
create trigger reward_media_center_post_race_interview_trigger
after update of status on public.post_race_interviews
for each row execute function public.reward_media_center_intervention();

-- -------------------------------------------------------------------------
-- Centre d'accueil international
-- -------------------------------------------------------------------------

create or replace function public.get_team_professional_naturalization_days(
  p_team_id uuid
)
returns integer
language sql
stable
as $$
  with context as (
    select
      least(
      ceil(
        (array[84,70,56,42,28,14]::integer[])[
          least(5, greatest(0, public.get_team_welcome_center_level(p_team_id))) + 1
        ] / public.get_team_infrastructure_efficiency_multiplier(
          p_team_id,
          'international_welcome_center'
        )
      ),
      ceil(
        84 * (
          1 - coalesce(
            public.get_team_national_federation_infrastructure_level(
              p_team_id,
              'federal_integration_office'
            ),
            0
          ) * 0.04
        )
      )
      )::integer as base_days,
      public.get_team_specialization_power(
        p_team_id,
        'international_welcome_center',
        'administrative_path'
      ) as specialization_power
  )
  select greatest(
    0,
    base_days - case
      when base_days > 0 and specialization_power > 0 then greatest(
        1,
        round(base_days * 0.05 * specialization_power)::integer
      )
      else 0
    end
  )
  from context
$$;

create or replace function public.get_team_youth_naturalization_days(
  p_team_id uuid
)
returns integer
language sql
stable
as $$
  with context as (
    select
      least(
      ceil(
        (array[28,21,14,7,3,0]::integer[])[
          least(5, greatest(0, public.get_team_welcome_center_level(p_team_id))) + 1
        ] / public.get_team_infrastructure_efficiency_multiplier(
          p_team_id,
          'international_welcome_center'
        )
      ),
      ceil(
        28 * (
          1 - coalesce(
            public.get_team_national_federation_infrastructure_level(
              p_team_id,
              'federal_integration_office'
            ),
            0
          ) * 0.04
        )
      )
      )::integer as base_days,
      public.get_team_specialization_power(
        p_team_id,
        'international_welcome_center',
        'youth_gateway'
      ) as specialization_power
  )
  select greatest(
    0,
    base_days - case
      when base_days > 0 and specialization_power > 0 then greatest(
        1,
        round(base_days * 0.05 * specialization_power)::integer
      )
      else 0
    end
  )
  from context
$$;

create or replace function public.get_staff_contract_nationality_multiplier(
  p_contract_id uuid,
  p_rider_id uuid default null
)
returns numeric
language sql
stable
set search_path = public
as $$
with context as (
  select
    contract.team_id,
    member.country_id as staff_country_id,
    member.role,
    team_season.registration_country_id as team_country_id,
    case
      when member.role = 'trainer' and p_rider_id is not null
        then rider.country_id
      else team_season.registration_country_id
    end as target_country_id,
    staff_country.continent_code as staff_continent,
    target_country.continent_code as target_continent,
    public.get_team_welcome_center_level(contract.team_id) as welcome_level
  from public.staff_contracts as contract
  join public.staff_members as member on member.id = contract.staff_member_id
  left join public.riders as rider on rider.id = p_rider_id
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = contract.team_id
   and team_season.season_id = season.id
  join public.countries as staff_country on staff_country.id = member.country_id
  join public.countries as target_country
    on target_country.id = case
      when member.role = 'trainer' and p_rider_id is not null
        then rider.country_id
      else team_season.registration_country_id
    end
  where contract.id = p_contract_id
    and contract.status = 'active'
)
select coalesce((
  select (
    case when
      staff_country_id = target_country_id
      or (
        welcome_level >= 3 and exists (
          select 1 from public.country_adjacencies as adjacency
          where adjacency.country_id = staff_country_id
            and adjacency.adjacent_country_id = target_country_id
        )
      )
      or (
        welcome_level >= 4
        and staff_continent is not null
        and staff_continent = target_continent
      )
      then 1.10 else 1.00
    end
  ) * (
    1 + case when staff_country_id <> team_country_id then
      0.04 * public.get_team_specialization_power(
        team_id,
        'international_welcome_center',
        'sporting_integration'
      )
    else 0 end
  )
  from context
), 1)::numeric
$$;

do $migration$
declare
  v_definition text;
  v_marker constant text :=
    'v_limit := least(5, greatest(0, v_welcome_center_level));';
begin
  select pg_get_functiondef(
    'public.naturalize_current_team_staff(uuid)'::regprocedure
  ) into v_definition;
  if position('administrative_path' in v_definition) = 0 then
    if position(v_marker in v_definition) = 0 then
      raise exception 'Point d’intégration du quota de naturalisation du staff introuvable.';
    end if;
    v_definition := replace(
      v_definition,
      v_marker,
      'v_limit := least(5, greatest(0, v_welcome_center_level)) +' ||
        ' case when public.get_team_specialization_power(' ||
        'v_context.team_id, ''international_welcome_center'', ' ||
        '''administrative_path'') > 0 then 1 else 0 end;'
    );
    execute v_definition;
  end if;
end;
$migration$;

-- Les orientations du Laboratoire R&D, de l'Académie des métiers et du Centre
-- tactique ont été volontairement retirées du catalogue. Les bâtiments et
-- toutes leurs fonctions de base restent disponibles.
delete from public.team_infrastructure_specializations
where infrastructure_code in ('research_lab', 'staff_academy', 'tactical_center');

revoke all on function public.get_team_specialization_power(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.get_auth_user_media_game_reward_multiplier(uuid)
  from public, anon, authenticated;
revoke all on function public.get_current_team_media_game_reward()
  from public, anon, authenticated;
revoke all on function public.apply_data_room_salary_discount()
  from public, anon, authenticated;
revoke all on function public.apply_data_room_transfer_rebate()
  from public, anon, authenticated;
revoke all on function public.apply_cryotherapy_rest_recovery()
  from public, anon, authenticated;
revoke all on function public.apply_media_sponsor_contract_bonus()
  from public, anon, authenticated;
revoke all on function public.reward_media_center_intervention()
  from public, anon, authenticated;

grant execute on function public.get_current_team_media_game_reward()
  to authenticated, service_role;
grant execute on function public.get_team_specialization_power(uuid, text, text)
  to service_role;

comment on function public.get_team_training_center_specialization_progress_multiplier(
  uuid, text, numeric, boolean
) is
  'Cumule les orientations du Centre d’entraînement et le bonus Accélération de la Piste indoor.';
comment on table public.team_media_intervention_rewards is
  'Retombées Fan Club uniques des conférences et interviews bonifiées par le Média Center.';
comment on column public.youth_scouting_missions.data_room_quality_bonus_percentage is
  'Bonus de qualité réelle de la Dataroom figé au retour de mission.';
comment on column public.youth_scouting_missions.data_room_report_precision_bonus_percentage is
  'Bonus de précision de la Dataroom figé au retour de mission.';

notify pgrst, 'reload schema';

commit;
