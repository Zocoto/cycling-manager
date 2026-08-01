begin;

drop trigger if exists zz_rider_condition_fatigue_floor
  on public.rider_condition_states;
drop trigger if exists rider_condition_sync_physio_race_finish
  on public.rider_condition_states;
drop trigger if exists rider_condition_apply_medical_staff
  on public.rider_condition_states;

drop trigger if exists stage_condition_assigned_physio_reduction
  on public.stage_rider_condition_effects;

drop trigger if exists stage_condition_detects_fatigue_injury
  on public.stage_rider_condition_effects;

drop trigger if exists rider_daily_recovery_nutritionist_bonus
  on public.rider_daily_condition_effects;

drop trigger if exists rider_daily_condition_detects_fatigue_injury
  on public.rider_daily_condition_effects;

drop trigger if exists rider_injury_form_assigned_physio_reduction
  on public.rider_injury_form_effects;

drop trigger if exists rider_injury_penalty_detects_fatigue_injury
  on public.rider_injury_form_effects;

drop trigger if exists apply_low_form_training_recovery_after_insert
  on public.rider_training_sessions;

drop trigger if exists rider_training_detects_fatigue_injury
  on public.rider_training_sessions;

drop trigger if exists label_reconnaissance_training_skip_after_insert
  on public.rider_training_sessions;



-- La forme accepte désormais les dixièmes afin de cumuler exactement les
-- effets quotidiens de plusieurs nutritionnistes.
alter table public.rider_condition_states
  alter column form type numeric(5, 2) using form::numeric;
alter table public.race_rosters
  alter column starting_form type numeric(5, 2) using starting_form::numeric;
alter table public.stage_rider_condition_effects
  alter column form_delta type numeric(5, 2) using form_delta::numeric,
  alter column form_before type numeric(5, 2) using form_before::numeric,
  alter column form_after type numeric(5, 2) using form_after::numeric;

alter table public.rider_daily_condition_effects
  drop constraint rider_daily_condition_effects_delta_range,
  alter column form_delta type numeric(5, 2) using form_delta::numeric,
  alter column form_before type numeric(5, 2) using form_before::numeric,
  alter column form_after type numeric(5, 2) using form_after::numeric,
  add constraint rider_daily_condition_effects_delta_range
    check (form_delta between -100 and 100);

alter table public.rider_injury_form_effects
  alter column form_delta type numeric(5, 2) using form_delta::numeric,
  alter column form_before type numeric(5, 2) using form_before::numeric,
  alter column form_after type numeric(5, 2) using form_after::numeric;

alter table public.rider_training_sessions
  drop constraint rider_training_sessions_form_range,
  alter column form_before type numeric(5, 2) using form_before::numeric,
  alter column form_delta type numeric(5, 2) using form_delta::numeric,
  alter column form_after type numeric(5, 2) using form_after::numeric,
  add constraint rider_training_sessions_form_range check (
    form_before between 0 and 100
    and form_after between 0 and 100
    and form_delta between -25 and 100
  );

alter table public.rider_nutrition_interventions
  drop constraint rider_nutrition_interventions_gain_range,
  alter column actual_form_gain type numeric(5, 2) using actual_form_gain::numeric,
  alter column form_before type numeric(5, 2) using form_before::numeric,
  alter column form_after type numeric(5, 2) using form_after::numeric,
  add constraint rider_nutrition_interventions_gain_range check (
    base_form_gain between 1 and 10
    and level_form_bonus between 0 and 2
    and actual_form_gain between 0 and 100
  );

-- Coût d'une étape : le profil est déterminant, puis la distance, le relief
-- d'un CLM et la récupération du coureur affinent le résultat.
create or replace function public.calculate_stage_form_cost(
  p_stage_id uuid,
  p_recovery numeric default 50
)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v_stage record;
  v_total_segment_distance numeric;
  v_climb_distance numeric;
  v_cobble_distance numeric;
  v_climb_share numeric := 0;
  v_cobble_share numeric := 0;
  v_base_cost numeric;
  v_is_time_trial boolean;
begin
  select stage.profile_type, stage.stage_type, stage.distance_km
  into v_stage
  from public.stages as stage
  where stage.id = p_stage_id;

  if v_stage is null then
    raise exception 'Étape introuvable pour le calcul du coût de forme.';
  end if;

  v_is_time_trial := v_stage.profile_type = 'time_trial'
    or v_stage.stage_type in (
      'individual_time_trial', 'team_time_trial', 'prologue'
    );

  if v_is_time_trial then
    v_base_cost := case
      when v_stage.distance_km <= 12 then 2
      when v_stage.distance_km <= 25 then 3.5
      when v_stage.distance_km <= 45 then 5
      else 6
    end;
  else
    v_base_cost := case v_stage.profile_type
      when 'flat' then 3
      when 'sprint' then 3
      when 'hilly' then 5
      when 'mountain' then 7
      when 'cobbles' then 6
      else 4.5
    end;

    if v_stage.distance_km < 80 then v_base_cost := v_base_cost - 0.5; end if;
    if v_stage.distance_km >= 180 then v_base_cost := v_base_cost + 0.5; end if;
    if v_stage.distance_km >= 220 then v_base_cost := v_base_cost + 0.5; end if;
  end if;

  select
    coalesce(sum(segment.distance_km), 0),
    coalesce(sum(segment.distance_km) filter (
      where segment.terrain_type = 'climb'
    ), 0),
    coalesce(sum(segment.distance_km) filter (
      where segment.surface_type = 'cobbles'
    ), 0)
  into v_total_segment_distance, v_climb_distance, v_cobble_distance
  from public.stage_segments as segment
  where segment.stage_id = p_stage_id;

  if v_total_segment_distance > 0 then
    v_climb_share := v_climb_distance / v_total_segment_distance;
    v_cobble_share := v_cobble_distance / v_total_segment_distance;
  end if;

  if v_is_time_trial then
    if v_climb_share >= 0.25 then
      v_base_cost := v_base_cost + 1.5;
    elsif v_climb_share >= 0.10 then
      v_base_cost := v_base_cost + 0.75;
    end if;
  elsif v_stage.profile_type <> 'cobbles' and v_cobble_share >= 0.25 then
    v_base_cost := v_base_cost + 1;
  end if;

  return round(
    greatest(1, v_base_cost * (
      1.1 - least(100, greatest(0, coalesce(p_recovery, 50))) * 0.002
    )),
    1
  );
end;
$$;

-- Le bonus automatique historique (+1 maximum, uniquement au repos) est
-- remplacé par un règlement collectif, quotidien et cumulatif.
drop trigger if exists rider_daily_recovery_nutritionist_bonus
  on public.rider_daily_condition_effects;

create or replace function public.sync_medical_staff_condition_effects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bonus numeric := 0;
begin
  if new.source = 'injury' then
    select coalesce(effect.physiotherapist_form_protection, 0)
    into v_bonus
    from public.rider_injury_form_effects as effect
    where effect.rider_id = new.rider_id
      and effect.season_day_id = new.season_day_id
    order by effect.applied_at desc
    limit 1;
  end if;

  new.form := least(100, new.form + coalesce(v_bonus, 0));
  return new;
end;
$$;

create table public.form_management_rollout (
  singleton boolean primary key default true check (singleton),
  nutrition_stacking_starts_on date not null
    default ((now() at time zone 'Europe/Paris')::date)
);

insert into public.form_management_rollout (singleton)
values (true)
on conflict (singleton) do nothing;

create table public.rider_daily_nutrition_effects (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  season_day_id uuid not null references public.season_days(id) on delete cascade,
  form_delta numeric(5, 2) not null,
  form_before numeric(5, 2) not null,
  form_after numeric(5, 2) not null,
  contributions jsonb not null default '[]'::jsonb,
  applied_at timestamptz not null default now(),
  constraint rider_daily_nutrition_effects_unique
    unique (rider_id, season_day_id),
  constraint rider_daily_nutrition_effects_form_range check (
    form_delta between 0 and 100
    and form_before between 0 and 100
    and form_after between 0 and 100
  )
);

create index rider_daily_nutrition_effects_rider_applied_idx
  on public.rider_daily_nutrition_effects (rider_id, applied_at desc);

alter table public.rider_daily_nutrition_effects enable row level security;
create policy rider_daily_nutrition_effects_authenticated_read
on public.rider_daily_nutrition_effects for select
to authenticated using (true);

create or replace function public.get_team_daily_nutrition_form_gain(
  p_team_id uuid
)
returns numeric
language sql
stable
set search_path = public
as $$
  select round(coalesce(sum(
    member.level / 5.0
      * public.get_staff_contract_nationality_multiplier(contract.id)
      + public.get_staff_contract_talent_flat_bonus(
          contract.id,
          'nutrition_daily_form',
          1
        )
  ), 0), 2)
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'nutritionist'
  where contract.team_id = p_team_id
    and contract.status = 'active';
$$;

create or replace function public.settle_due_daily_nutrition_recovery()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season record;
  v_day record;
  v_rider record;
  v_previous_form numeric(5, 2);
  v_previous_fatigue integer;
  v_bonus numeric(5, 2);
  v_actual_bonus numeric(5, 2);
  v_inserted_id uuid;
  v_processed integer := 0;
begin
  select season.* into v_season
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  if v_season is null then return 0; end if;

  for v_day in
    select day.id, day.day_number, day.calendar_date, next_day.id as next_day_id
    from public.season_days as day
    join public.season_days as next_day
      on next_day.season_id = day.season_id
     and next_day.day_number = day.day_number + 1
    cross join public.form_management_rollout as rollout
    where rollout.singleton
      and day.season_id = v_season.id
      and day.day_number < coalesce(v_season.current_day_number, 1)
      and day.calendar_date >= rollout.nutrition_stacking_starts_on
    order by day.day_number
  loop
    for v_rider in
      select distinct rider.id, contract.team_id
      from public.riders as rider
      join public.rider_contracts as contract
        on contract.rider_id = rider.id
       and contract.status = 'active'
      join public.seasons as start_season
        on start_season.id = contract.start_season_id
       and start_season.game_year <= v_season.game_year
      join public.seasons as end_season
        on end_season.id = contract.end_season_id
       and end_season.game_year >= v_season.game_year
      where rider.status = 'active'
      order by rider.id, contract.team_id
    loop
      if exists (
        select 1 from public.rider_daily_nutrition_effects as existing
        where existing.rider_id = v_rider.id
          and existing.season_day_id = v_day.id
      ) then
        continue;
      end if;

      v_bonus := public.get_team_daily_nutrition_form_gain(v_rider.team_id);
      if v_bonus <= 0 then continue; end if;

      select state.form, state.fatigue
      into v_previous_form, v_previous_fatigue
      from public.rider_condition_states as state
      join public.season_days as state_day
        on state_day.id = state.season_day_id
      where state.rider_id = v_rider.id
        and state_day.season_id = v_season.id
        and state_day.day_number <= v_day.day_number + 1
      order by state_day.day_number desc
      limit 1;

      v_previous_form := coalesce(v_previous_form, 75);
      v_previous_fatigue := coalesce(v_previous_fatigue, 0);
      v_actual_bonus := round(least(v_bonus, 100 - v_previous_form), 2);
      v_inserted_id := null;

      insert into public.rider_daily_nutrition_effects (
        rider_id,
        team_id,
        season_day_id,
        form_delta,
        form_before,
        form_after,
        contributions
      ) values (
        v_rider.id,
        v_rider.team_id,
        v_day.id,
        v_actual_bonus,
        v_previous_form,
        v_previous_form + v_actual_bonus,
        (
          select coalesce(jsonb_agg(jsonb_build_object(
            'contractId', contract.id,
            'name', member.first_name || ' ' || member.last_name,
            'gain', round(
              member.level / 5.0
                * public.get_staff_contract_nationality_multiplier(contract.id)
                + public.get_staff_contract_talent_flat_bonus(
                    contract.id,
                    'nutrition_daily_form',
                    1
                  ),
              2
            )
          ) order by member.last_name, member.first_name), '[]'::jsonb)
          from public.staff_contracts as contract
          join public.staff_members as member
            on member.id = contract.staff_member_id
           and member.role = 'nutritionist'
          where contract.team_id = v_rider.team_id
            and contract.status = 'active'
        )
      )
      on conflict (rider_id, season_day_id) do nothing
      returning id into v_inserted_id;

      if v_inserted_id is not null then
        update public.rider_condition_states as state
        set
          form = least(100, state.form + v_actual_bonus),
          source = 'nutritionist',
          updated_at = now()
        from public.season_days as state_day
        where state.season_day_id = state_day.id
          and state.rider_id = v_rider.id
          and state_day.season_id = v_season.id
          and state_day.day_number >= v_day.day_number + 1;

        v_processed := v_processed + 1;
      end if;
    end loop;
  end loop;

  return v_processed;
end;
$$;

-- Adapter les variables PL/pgSQL qui manipulent la forme afin de ne jamais
-- arrondir silencieusement les nouveaux dixièmes.
do $migration$
declare
  v_definition text;
  v_formula_start integer;
  v_formula_end integer;
  v_replacement text;
begin
  select pg_get_functiondef(
    'public.settle_finished_race_conditions()'::regprocedure
  ) into v_definition;
  v_definition := replace(v_definition, 'previous_form integer;', 'previous_form numeric(5, 2);');
  v_definition := replace(v_definition, 'form_loss integer;', 'form_loss numeric(5, 2);');
  v_definition := replace(v_definition, 'next_form integer;', 'next_form numeric(5, 2);');
  if position('form_loss := public.calculate_stage_form_cost(' in v_definition) = 0 then
    v_formula_start := position('form_loss := case' in v_definition);
    if v_formula_start = 0 then
      raise exception 'Formule historique de coût de course introuvable.';
    end if;

    v_formula_end :=
      v_formula_start - 1 +
      position('end;' in substring(v_definition from v_formula_start));
    if v_formula_end < v_formula_start then
      raise exception 'Fin de la formule historique de coût de course introuvable.';
    end if;

    v_replacement :=
      'form_loss := public.calculate_stage_form_cost(' || chr(10) ||
      '        target_stage.id,' || chr(10) ||
      '        target_roster.recovery' || chr(10) ||
      '      );';

    v_definition :=
      substring(v_definition from 1 for v_formula_start - 1) ||
      v_replacement ||
      substring(v_definition from v_formula_end + length('end;'));
  end if;
  execute v_definition;

  select pg_get_functiondef(
    'public.settle_current_health_and_form()'::regprocedure
  ) into v_definition;
  v_definition := replace(v_definition, 'v_previous_form integer;', 'v_previous_form numeric(5, 2);');
  v_definition := replace(v_definition, 'v_delta integer;', 'v_delta numeric(5, 2);');
  v_definition := replace(v_definition, 'v_next_form integer;', 'v_next_form numeric(5, 2);');
  if position('perform public.settle_due_daily_nutrition_recovery();' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      '  return query' || chr(10) || '  select' || chr(10) || '    v_daily_count,',
      '  perform public.settle_due_daily_nutrition_recovery();' || chr(10) || chr(10) ||
        '  return query' || chr(10) || '  select' || chr(10) || '    v_daily_count,'
    );
  end if;
  execute v_definition;

  select pg_get_functiondef(
    'public.settle_due_training_sessions()'::regprocedure
  ) into v_definition;
  v_definition := replace(v_definition, 'v_previous_form integer;', 'v_previous_form numeric(5, 2);');
  v_definition := replace(v_definition, 'v_form_delta integer;', 'v_form_delta numeric(5, 2);');
  v_definition := replace(v_definition, 'v_next_form integer;', 'v_next_form numeric(5, 2);');
  execute v_definition;

  select pg_get_functiondef(
    'public.apply_low_form_training_recovery(uuid)'::regprocedure
  ) into v_definition;
  v_definition := replace(v_definition, 'v_form_delta integer;', 'v_form_delta numeric(5, 2);');
  v_definition := replace(v_definition, 'v_form_after integer;', 'v_form_after numeric(5, 2);');
  execute v_definition;

  select pg_get_functiondef(
    'public.apply_current_team_nutrition_intervention(uuid,uuid,text)'::regprocedure
  ) into v_definition;
  v_definition := replace(v_definition, 'v_actual_gain integer;', 'v_actual_gain numeric(5, 2);');
  v_definition := replace(v_definition, 'v_form_before integer;', 'v_form_before numeric(5, 2);');
  v_definition := replace(v_definition, 'v_form_after integer;', 'v_form_after numeric(5, 2);');
  execute v_definition;

  select pg_get_functiondef(
    'public.sync_race_finish_form_with_physio_effect()'::regprocedure
  ) into v_definition;
  v_definition := replace(v_definition, 'v_adjusted_form integer;', 'v_adjusted_form numeric(5, 2);');
  execute v_definition;

  select pg_get_functiondef(
    'public.ensure_rider_fatigue_injury(uuid,integer,timestamp with time zone,uuid)'::regprocedure
  ) into v_definition;
  v_definition := replace(
    v_definition,
    'p_attempted_form integer',
    'p_attempted_form numeric'
  );
  execute v_definition;
end;
$migration$;

create trigger zz_rider_condition_fatigue_floor
before insert or update of form on public.rider_condition_states
for each row execute function public.clamp_rider_form_and_lock_fatigue_injury();
create trigger rider_condition_sync_physio_race_finish
before insert or update of form, source on public.rider_condition_states
for each row execute function public.sync_race_finish_form_with_physio_effect();
create trigger rider_condition_apply_medical_staff
before insert or update of form, source on public.rider_condition_states
for each row execute function public.sync_medical_staff_condition_effects();

create trigger stage_condition_assigned_physio_reduction
before insert
on public.stage_rider_condition_effects
for each row execute function public.apply_assigned_physio_to_race_condition();

create trigger stage_condition_detects_fatigue_injury
after insert on public.stage_rider_condition_effects
for each row
when ((new.form_before + new.form_delta) < 0)
execute function public.detect_stage_condition_fatigue_injury();

create trigger rider_daily_condition_detects_fatigue_injury
after insert on public.rider_daily_condition_effects
for each row
when ((new.form_before + new.form_delta) < 0)
execute function public.detect_daily_condition_fatigue_injury();

create trigger rider_injury_form_assigned_physio_reduction
before insert
on public.rider_injury_form_effects
for each row execute function public.apply_physio_to_injury_form_effect();

create trigger rider_injury_penalty_detects_fatigue_injury
after insert on public.rider_injury_form_effects
for each row
when ((new.form_before + new.form_delta) < 0)
execute function public.detect_injury_penalty_fatigue_injury();

create trigger apply_low_form_training_recovery_after_insert
after insert on public.rider_training_sessions
for each row
when (new.status = 'skipped_low_form')
execute function public.apply_low_form_training_recovery_after_insert();

create trigger rider_training_detects_fatigue_injury
after insert on public.rider_training_sessions
for each row
when ((new.form_before + new.form_delta) < 0)
execute function public.detect_training_fatigue_injury();

create trigger label_reconnaissance_training_skip_after_insert
after insert on public.rider_training_sessions
for each row
when (new.status = 'skipped_form_camp')
execute function public.label_reconnaissance_training_skip();



-- Plafond serveur : le contrôle résiste aux appels RPC directs et aux
-- recrutements concurrents.
create or replace function public.enforce_team_nutritionist_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active_count integer;
begin
  if new.status <> 'active' then return new; end if;

  select member.role into v_role
  from public.staff_members as member
  where member.id = new.staff_member_id;

  if v_role <> 'nutritionist' then return new; end if;

  perform pg_advisory_xact_lock(hashtextextended(new.team_id::text, 0));

  select count(*) into v_active_count
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'nutritionist'
  where contract.team_id = new.team_id
    and contract.status = 'active'
    and contract.id <> new.id;

  if v_active_count >= 3 then
    raise exception 'Une équipe ne peut employer que 3 nutritionnistes actifs.';
  end if;

  return new;
end;
$$;

drop trigger if exists staff_contracts_nutritionist_limit
  on public.staff_contracts;
create trigger staff_contracts_nutritionist_limit
before insert or update of staff_member_id, team_id, status
on public.staff_contracts
for each row execute function public.enforce_team_nutritionist_limit();

revoke all on function public.calculate_stage_form_cost(uuid, numeric) from public, anon;
grant execute on function public.calculate_stage_form_cost(uuid, numeric)
  to authenticated, service_role;
revoke all on function public.settle_due_daily_nutrition_recovery() from public, anon;
grant execute on function public.settle_due_daily_nutrition_recovery()
  to authenticated, service_role;
grant select on table public.rider_daily_nutrition_effects to authenticated;
grant all on table public.rider_daily_nutrition_effects to service_role;
grant select on table public.form_management_rollout to service_role;
revoke all on function public.ensure_rider_fatigue_injury(
  uuid,
  numeric,
  timestamptz,
  uuid
) from public, anon, authenticated;
revoke all on function public.enforce_team_nutritionist_limit()
  from public, anon, authenticated;
revoke all on function public.get_team_daily_nutrition_form_gain(uuid)
  from public, anon;

comment on function public.calculate_stage_form_cost(uuid, numeric) is
  'Calcule le coût de forme d’une étape selon son profil, sa distance, son relief et la récupération.';
comment on function public.settle_due_daily_nutrition_recovery() is
  'Cumule chaque jour les bonus exacts de tous les nutritionnistes actifs pour tous les coureurs de l’équipe.';
comment on function public.enforce_team_nutritionist_limit() is
  'Bloque tout contrat qui porterait une équipe au-delà de trois nutritionnistes actifs.';

notify pgrst, 'reload schema';

commit;
