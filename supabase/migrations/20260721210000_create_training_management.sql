-- ============================================================
-- CYCLO STRATÈGE — Potentiel et entraînement quotidien
-- ============================================================

begin;

-- Le potentiel est une donnée permanente du coureur. Les huit valeurs
-- représentent les demi-étoiles de 0,5 à 4 et plafonnent la moyenne générale.
alter table public.riders
  add column potential_steps smallint;

create or replace function public.calculate_initial_rider_potential_steps(
  p_rider_id uuid,
  p_generation_source text default 'amateur'
)
returns integer
language sql
immutable
set search_path = public
as $$
  with roll as (
    select (
      (hashtextextended(p_rider_id::text || ':potential:' || p_generation_source, 0) % 100 + 100)
      % 100
    )::integer as value
  )
  select case
    when p_generation_source = 'auction' and value < 45 then 1
    when p_generation_source = 'auction' and value < 85 then 2
    when p_generation_source = 'auction' then 3
    when value < 70 then 1
    else 2
  end
  from roll;
$$;

update public.riders as rider
set potential_steps = public.calculate_initial_rider_potential_steps(
  rider.id,
  case
    when exists (
      select 1
      from public.transfer_market_listings as listing
      where listing.rider_id = rider.id
        and listing.listing_type = 'daily'
    ) then 'auction'
    else 'amateur'
  end
);

alter table public.riders
  alter column potential_steps set not null,
  add constraint riders_potential_steps_range check (potential_steps between 1 and 8);

create or replace function public.assign_default_rider_potential()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.potential_steps is null then
    new.potential_steps := public.calculate_initial_rider_potential_steps(new.id, 'amateur');
  end if;
  return new;
end;
$$;

create trigger assign_default_rider_potential_before_insert
before insert on public.riders
for each row execute function public.assign_default_rider_potential();

create or replace function public.assign_daily_auction_rider_potential()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.listing_type = 'daily' then
    update public.riders
    set potential_steps = public.calculate_initial_rider_potential_steps(new.rider_id, 'auction')
    where id = new.rider_id;
  end if;
  return new;
end;
$$;

create trigger assign_daily_auction_rider_potential_after_insert
after insert on public.transfer_market_listings
for each row execute function public.assign_daily_auction_rider_potential();

-- Les réglages sont historisés : une modification passée après la séance de
-- 8 h prend effet le lendemain sans réécrire les séances antérieures.
create table public.team_training_setting_versions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  minimum_form smallint not null default 50,
  effective_from_day_number smallint not null,
  created_at timestamptz not null default now(),
  constraint team_training_settings_minimum_form_range check (minimum_form between 0 and 100),
  constraint team_training_settings_day_range check (effective_from_day_number between 1 and 28),
  constraint team_training_settings_unique unique (team_id, season_id, effective_from_day_number)
);

create table public.rider_training_plan_versions (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  intensity smallint not null default 0,
  domain text not null default 'stage_racer',
  trainer_contract_id uuid references public.staff_contracts(id) on delete set null,
  effective_from_day_number smallint not null,
  created_at timestamptz not null default now(),
  constraint rider_training_plans_intensity_range check (intensity between 0 and 100),
  constraint rider_training_plans_domain_allowed check (
    domain in (
      'climber', 'puncheur', 'stage_racer', 'northern_classics',
      'rouleur', 'breakaway', 'sprinter'
    )
  ),
  constraint rider_training_plans_day_range check (effective_from_day_number between 1 and 28),
  constraint rider_training_plans_unique unique (rider_id, season_id, effective_from_day_number)
);

create table public.rider_training_sessions (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  season_day_id uuid not null references public.season_days(id) on delete cascade,
  status text not null,
  intensity smallint not null,
  domain text not null,
  minimum_form smallint not null,
  trainer_contract_id uuid references public.staff_contracts(id) on delete set null,
  trainer_level smallint not null default 0,
  trainer_specialty text,
  trainer_country_match boolean not null default false,
  physiotherapist_level smallint not null default 0,
  form_before smallint not null,
  form_delta smallint not null default 0,
  form_after smallint not null,
  progress_milli jsonb not null default '{}'::jsonb,
  decline_milli jsonb not null default '{}'::jsonb,
  rating_changes jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  constraint rider_training_sessions_unique unique (rider_id, season_day_id),
  constraint rider_training_sessions_status_allowed check (
    status in ('completed', 'skipped_low_form', 'skipped_injury', 'skipped_form_camp')
  ),
  constraint rider_training_sessions_intensity_range check (intensity between 0 and 100),
  constraint rider_training_sessions_domain_allowed check (
    domain in (
      'climber', 'puncheur', 'stage_racer', 'northern_classics',
      'rouleur', 'breakaway', 'sprinter'
    )
  ),
  constraint rider_training_sessions_staff_level_range check (
    trainer_level between 0 and 5 and physiotherapist_level between 0 and 5
  ),
  constraint rider_training_sessions_form_range check (
    form_before between 0 and 100
    and form_after between 0 and 100
    and form_delta between -25 and 2
  )
);

create index rider_training_sessions_team_day_idx
  on public.rider_training_sessions (team_id, season_day_id, processed_at desc);

create index rider_training_sessions_rider_idx
  on public.rider_training_sessions (rider_id, processed_at desc);

create table public.rider_training_stat_progress (
  rider_id uuid not null references public.riders(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  stat_code text not null,
  initial_rating smallint not null,
  balance_milli integer not null default 0,
  total_training_milli integer not null default 0,
  rating_gain smallint not null default 0,
  rating_loss smallint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (rider_id, season_id, stat_code),
  constraint rider_training_progress_stat_allowed check (
    stat_code in (
      'mountain', 'hills', 'flat', 'time_trial', 'cobbles', 'sprint',
      'acceleration', 'downhill', 'endurance', 'resistance', 'recovery',
      'breakaway', 'prologue'
    )
  ),
  constraint rider_training_progress_rating_range check (initial_rating between 0 and 100),
  constraint rider_training_progress_totals_non_negative check (
    total_training_milli >= 0 and rating_gain >= 0 and rating_loss >= 0
  )
);

alter table public.team_training_setting_versions enable row level security;
alter table public.rider_training_plan_versions enable row level security;
alter table public.rider_training_sessions enable row level security;
alter table public.rider_training_stat_progress enable row level security;

-- Le registre quotidien existant devient également le verrou empêchant la
-- récupération de repos de s'ajouter une seconde fois à un entraînement.
alter table public.rider_daily_condition_effects
  drop constraint rider_daily_condition_effects_type_allowed,
  drop constraint rider_daily_condition_effects_delta_range;

alter table public.rider_daily_condition_effects
  add constraint rider_daily_condition_effects_type_allowed check (
    effect_type in ('rest', 'race', 'injury', 'form_camp', 'training')
  ),
  add constraint rider_daily_condition_effects_delta_range check (
    form_delta between -25 and 10
  );

-- La fatigue reste physiquement présente pour compatibilité avec les anciens
-- calculs, mais elle est neutralisée : seule la forme est utilisée et affichée.
update public.rider_condition_states set fatigue = 0 where fatigue <> 0;

create or replace function public.get_rider_potential_overall_cap(p_potential_steps integer)
returns integer
language sql
immutable
set search_path = public
as $$
  select 60 + least(8, greatest(1, coalesce(p_potential_steps, 1))) * 5;
$$;

create or replace function public.get_training_effective_day_number(
  p_season_id uuid
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_day record;
begin
  perform public.sync_active_season_day();

  select day.day_number, day.calendar_date
  into v_day
  from public.seasons as season
  join public.season_days as day
    on day.season_id = season.id
   and day.day_number = coalesce(season.current_day_number, 1)
  where season.id = p_season_id
    and season.status = 'active';

  if v_day is null then
    raise exception 'La saison active est introuvable.';
  end if;

  if now() < ((v_day.calendar_date::timestamp + time '08:00') at time zone 'Europe/Paris') then
    return v_day.day_number;
  end if;

  if v_day.day_number >= 28 then
    raise exception 'La dernière séance de la saison a déjà commencé.';
  end if;

  return v_day.day_number + 1;
end;
$$;

create or replace function public.save_current_team_training_settings(
  p_minimum_form integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_effective_day integer;
begin
  if p_minimum_form not between 0 and 100 then
    raise exception 'La forme minimale doit être comprise entre 0 et 100.';
  end if;

  select assignment.team_id, season.id as season_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Votre équipe active est introuvable.';
  end if;

  v_effective_day := public.get_training_effective_day_number(v_context.season_id);

  insert into public.team_training_setting_versions (
    team_id, season_id, minimum_form, effective_from_day_number
  ) values (
    v_context.team_id, v_context.season_id, p_minimum_form, v_effective_day
  )
  on conflict (team_id, season_id, effective_from_day_number)
  do update set minimum_form = excluded.minimum_form, created_at = now();

  return v_effective_day;
end;
$$;

create or replace function public.save_current_rider_training_plan(
  p_rider_id uuid,
  p_intensity integer,
  p_domain text,
  p_trainer_contract_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_effective_day integer;
begin
  if p_intensity not between 0 and 100 then
    raise exception 'L’intensité doit être comprise entre 0 et 100.';
  end if;

  if p_domain not in (
    'climber', 'puncheur', 'stage_racer', 'northern_classics',
    'rouleur', 'breakaway', 'sprinter'
  ) then
    raise exception 'Le domaine d’entraînement est invalide.';
  end if;

  select assignment.team_id, season.id as season_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.rider_contracts as rider_contract
    on rider_contract.team_id = assignment.team_id
   and rider_contract.rider_id = p_rider_id
   and rider_contract.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Ce coureur ne fait pas partie de votre effectif actif.';
  end if;

  if p_trainer_contract_id is not null and not exists (
    select 1
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
     and member.role = 'trainer'
    where contract.id = p_trainer_contract_id
      and contract.team_id = v_context.team_id
      and contract.status = 'active'
  ) then
    raise exception 'L’entraîneur choisi ne fait pas partie de votre staff actif.';
  end if;

  v_effective_day := public.get_training_effective_day_number(v_context.season_id);

  insert into public.rider_training_plan_versions (
    rider_id,
    team_id,
    season_id,
    intensity,
    domain,
    trainer_contract_id,
    effective_from_day_number
  ) values (
    p_rider_id,
    v_context.team_id,
    v_context.season_id,
    p_intensity,
    p_domain,
    p_trainer_contract_id,
    v_effective_day
  )
  on conflict (rider_id, season_id, effective_from_day_number)
  do update set
    intensity = excluded.intensity,
    domain = excluded.domain,
    trainer_contract_id = excluded.trainer_contract_id,
    team_id = excluded.team_id,
    created_at = now();

  return v_effective_day;
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
          else greatest(0.2, 0.5 - (v_rider.age - 32) * 0.04)
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

        v_decline_milli := case
          when v_rider.age < 32 then 0
          else round(
            least(7.0, 1.0 + (v_rider.age - 32) * 0.5) * 1000.0 / 28.0
          )::integer
        end;
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

revoke all on function public.save_current_team_training_settings(integer) from public;
revoke all on function public.save_current_rider_training_plan(uuid, integer, text, uuid) from public;
revoke all on function public.settle_due_training_sessions() from public;

grant execute on function public.save_current_team_training_settings(integer) to authenticated;
grant execute on function public.save_current_rider_training_plan(uuid, integer, text, uuid) to authenticated;
grant execute on function public.settle_due_training_sessions() to authenticated, service_role;

grant all privileges on table public.team_training_setting_versions to service_role;
grant all privileges on table public.rider_training_plan_versions to service_role;
grant all privileges on table public.rider_training_sessions to service_role;
grant all privileges on table public.rider_training_stat_progress to service_role;

comment on column public.riders.potential_steps is
  'Potentiel permanent en huit demi-étoiles. Le plafond de moyenne vaut 60 + 5 × potential_steps.';

comment on table public.rider_training_plan_versions is
  'Historique des programmes individuels, prenant effet avant ou après la séance de 8 h.';

comment on table public.rider_training_sessions is
  'Compte rendu idempotent de chaque séance quotidienne, incluant forme, progression et déclin.';

comment on table public.rider_training_stat_progress is
  'Accumulateurs millipoints transformant la progression quotidienne en notes entières.';

commit;
