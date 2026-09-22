begin;

-- A daily recovery belongs to the team which actually employed the rider on
-- that game day. The previous settlement only inspected the rider's current
-- active contract, so a mid-season signing was backfilled from J1.
create or replace function public.get_rider_contract_team_for_day(
  p_rider_id uuid,
  p_season_day_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select contract.team_id
  from public.rider_contracts as contract
  join public.season_days as day
    on day.id = p_season_day_id
  join public.seasons as day_season
    on day_season.id = day.season_id
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
  join public.seasons as end_season
    on end_season.id = contract.end_season_id
  left join public.seasons as left_season
    on left_season.id = contract.left_season_id
  where contract.rider_id = p_rider_id
    and contract.status in ('active', 'completed', 'terminated')
    and day_season.game_year between
      start_season.game_year and end_season.game_year
    and (
      start_season.game_year < day_season.game_year
      or day.day_number >= coalesce(contract.joined_day_number, 1)
    )
    and (
      left_season.id is null
      or left_season.game_year > day_season.game_year
      or (
        left_season.game_year = day_season.game_year
        and day.day_number <= coalesce(contract.left_day_number, 28)
      )
    )
    and coalesce(contract.signed_at, contract.created_at) < (
      (day.calendar_date::timestamp + interval '1 day')
        at time zone 'Europe/Paris'
    )
  order by
    start_season.game_year desc,
    coalesce(contract.joined_day_number, 1) desc,
    coalesce(contract.signed_at, contract.created_at) desc,
    contract.id desc
  limit 1;
$$;

create or replace function public.enforce_daily_condition_contract_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.get_rider_contract_team_for_day(
    new.rider_id,
    new.season_day_id
  ) is null then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists aa_enforce_daily_condition_contract_eligibility
  on public.rider_daily_condition_effects;
create trigger aa_enforce_daily_condition_contract_eligibility
before insert on public.rider_daily_condition_effects
for each row execute function
  public.enforce_daily_condition_contract_eligibility();

-- Keep the main settlement from repeatedly attempting rows which the trigger
-- rejects. The trigger above remains the final safety net for every writer.
do $migration$
declare
  v_definition text;
  v_marker constant text := 'where rider.status = ''active''';
  v_marker_count integer;
begin
  select pg_catalog.pg_get_functiondef(
    'public.settle_current_health_and_form()'::regprocedure
  ) into v_definition;

  if position(
    'public.get_rider_contract_team_for_day(rider.id, v_day.id) is not null'
    in lower(v_definition)
  ) = 0 then
    v_marker_count := (
      length(v_definition) - length(replace(v_definition, v_marker, ''))
    ) / length(v_marker);
    if v_marker_count <> 1 then
      raise exception
        'Filtre des récupérations quotidiennes inattendu (% marqueurs).',
        v_marker_count;
    end if;
    v_definition := replace(
      v_definition,
      v_marker,
      v_marker || E'\n      and public.get_rider_contract_team_for_day(rider.id, v_day.id) is not null'
    );
    execute v_definition;
  end if;
end;
$migration$;

-- Resolve team infrastructure bonuses from the contract valid on the source
-- day, rather than from the rider's present-day team.
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
  v_team_id := public.get_rider_contract_team_for_day(
    new.rider_id,
    new.season_day_id
  );
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

create or replace function public.apply_federal_medical_rest_recovery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
  v_power numeric;
  v_original_delta numeric;
begin
  if new.effect_type <> 'rest' or new.form_delta <= 0 then return new; end if;
  v_team_id := public.get_rider_contract_team_for_day(
    new.rider_id,
    new.season_day_id
  );
  if v_team_id is null then return new; end if;

  v_power := public.get_team_federal_medical_specialization_power(
    v_team_id,
    'prevention_network'
  );
  if v_power <= 0 then return new; end if;
  v_original_delta := new.form_delta;
  new.form_delta := round(new.form_delta * (1 + 0.04 * v_power), 2);
  new.form_after := least(100, new.form_before + new.form_delta);
  new.federal_medical_rest_bonus := greatest(
    0,
    new.form_delta - v_original_delta
  );
  return new;
end;
$$;

-- Nutrition now uses the historical team as well. This prevents both a
-- pre-contract credit and a former team's day being credited with the new
-- team's nutritionists after a transfer.
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
    select day.id, day.day_number, day.calendar_date,
      next_day.id as next_day_id
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
      select rider.id, contract_day.team_id
      from public.riders as rider
      cross join lateral (
        select public.get_rider_contract_team_for_day(
          rider.id,
          v_day.id
        ) as team_id
      ) as contract_day
      where contract_day.team_id is not null
      order by rider.id
    loop
      if exists (
        select 1
        from public.rider_daily_nutrition_effects as existing
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
      order by state_day.day_number desc, state.updated_at desc
      limit 1;

      v_previous_form := coalesce(v_previous_form, 75);
      v_previous_fatigue := coalesce(v_previous_fatigue, 0);
      v_actual_bonus := round(least(v_bonus, 100 - v_previous_form), 2);
      v_inserted_id := null;

      insert into public.rider_daily_nutrition_effects (
        rider_id, team_id, season_day_id, form_delta, form_before,
        form_after, contributions
      ) values (
        v_rider.id, v_rider.team_id, v_day.id, v_actual_bonus,
        v_previous_form, v_previous_form + v_actual_bonus,
        (
          select coalesce(jsonb_agg(jsonb_build_object(
            'contractId', contract.id,
            'name', member.first_name || ' ' || member.last_name,
            'gain', round(
              member.level / 5.0
                * public.get_staff_contract_nationality_multiplier(contract.id)
                + public.get_staff_contract_talent_flat_bonus(
                    contract.id, 'nutrition_daily_form', 1
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
        insert into public.rider_condition_states (
          rider_id, season_day_id, form, fatigue, source
        ) values (
          v_rider.id, v_day.next_day_id,
          least(100, v_previous_form + v_actual_bonus),
          v_previous_fatigue, 'nutritionist'
        )
        on conflict (rider_id, season_day_id) do update set
          form = least(100, public.rider_condition_states.form + v_actual_bonus),
          source = 'nutritionist',
          updated_at = now();

        update public.rider_condition_states as state
        set form = least(100, state.form + v_actual_bonus),
            source = 'nutritionist',
            updated_at = now()
        from public.season_days as state_day
        where state.season_day_id = state_day.id
          and state.rider_id = v_rider.id
          and state_day.season_id = v_season.id
          and state_day.day_number > v_day.day_number + 1;

        update public.rider_daily_nutrition_effects
        set condition_applied_at = now()
        where id = v_inserted_id;

        v_processed := v_processed + 1;
      end if;
    end loop;
  end loop;

  return v_processed;
end;
$$;

-- The roster-rotation bonus must also follow the source-day contract.
do $migration$
declare
  v_definition text;
  v_marker constant text :=
    'where current_rest.season_day_id = v_day.id';
  v_marker_count integer;
begin
  select pg_catalog.pg_get_functiondef(
    'public.settle_due_roster_rotation_recovery()'::regprocedure
  ) into v_definition;
  if position(
    'public.get_rider_contract_team_for_day(current_rest.rider_id, v_day.id) = v_team.team_id'
    in lower(v_definition)
  ) = 0 then
    v_marker_count := (
      length(v_definition) - length(replace(v_definition, v_marker, ''))
    ) / length(v_marker);
    if v_marker_count <> 1 then
      raise exception
        'Filtre de rotation des effectifs inattendu (% marqueurs).',
        v_marker_count;
    end if;
    v_definition := replace(
      v_definition,
      v_marker,
      v_marker || E'\n          and public.get_rider_contract_team_for_day(current_rest.rider_id, v_day.id) = v_team.team_id'
    );
    execute v_definition;
  end if;
end;
$migration$;

-- Durable audit of the one-time repair. Only service-role operations can read
-- it; the invalid ledger rows and every replaced condition state are retained
-- as JSON before deletion.
create table if not exists public.rider_form_contract_repairs (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete restrict,
  rider_id uuid not null references public.riders(id) on delete restrict,
  first_invalid_day_number smallint not null,
  repair_start_day_number smallint not null,
  form_before numeric(5, 2) not null,
  form_after numeric(5, 2),
  invalid_daily_effects jsonb not null default '[]'::jsonb,
  invalid_nutrition_effects jsonb not null default '[]'::jsonb,
  replaced_condition_states jsonb not null default '[]'::jsonb,
  repaired_at timestamptz not null default now(),
  constraint rider_form_contract_repairs_unique
    unique (season_id, rider_id)
);

alter table public.rider_form_contract_repairs enable row level security;
revoke all on table public.rider_form_contract_repairs
  from public, anon, authenticated;
grant all on table public.rider_form_contract_repairs to service_role;

create temporary table retroactive_daily_effects
on commit drop
as
select effect.*
from public.rider_daily_condition_effects as effect
join public.season_days as day on day.id = effect.season_day_id
join public.seasons as season on season.id = day.season_id
where season.status = 'active'
  and public.get_rider_contract_team_for_day(
    effect.rider_id,
    effect.season_day_id
  ) is null;

create temporary table retroactive_nutrition_effects
on commit drop
as
select effect.*
from public.rider_daily_nutrition_effects as effect
join public.season_days as day on day.id = effect.season_day_id
join public.seasons as season on season.id = day.season_id
where season.status = 'active'
  and public.get_rider_contract_team_for_day(
    effect.rider_id,
    effect.season_day_id
  ) is null;

create temporary table retroactive_form_affected_riders
on commit drop
as
select rider_id, min(day_number)::smallint as first_invalid_day_number
from (
  select effect.rider_id, day.day_number
  from retroactive_daily_effects as effect
  join public.season_days as day on day.id = effect.season_day_id
  union all
  select effect.rider_id, day.day_number
  from retroactive_nutrition_effects as effect
  join public.season_days as day on day.id = effect.season_day_id
) as invalid
group by rider_id;

do $repair$
declare
  v_season public.seasons%rowtype;
  v_rider record;
  v_day record;
  v_previous_day_id uuid;
  v_event record;
  v_form numeric(5, 2);
  v_form_before numeric(5, 2);
  v_actual_delta numeric(5, 2);
  v_potential_delta numeric(5, 2);
  v_original_form numeric(5, 2);
  v_start_day_number integer;
  v_source text;
  v_has_prior_contract boolean;
begin
  select * into v_season
  from public.seasons where status = 'active' limit 1;

  if v_season.id is null then return; end if;

  for v_rider in
    select affected.rider_id, affected.first_invalid_day_number
    from retroactive_form_affected_riders as affected
    order by affected.rider_id
  loop
    select exists (
      select 1
      from public.season_days as day
      where day.season_id = v_season.id
        and day.day_number < v_rider.first_invalid_day_number
        and public.get_rider_contract_team_for_day(
          v_rider.rider_id,
          day.id
        ) is not null
    ) into v_has_prior_contract;

    select min(day.day_number)::integer
    into v_start_day_number
    from public.season_days as day
    where day.season_id = v_season.id
      and day.day_number >= v_rider.first_invalid_day_number
      and public.get_rider_contract_team_for_day(
        v_rider.rider_id,
        day.id
      ) is not null;

    if v_start_day_number is null then continue; end if;

    select state.form into v_original_form
    from public.rider_condition_states as state
    join public.season_days as day on day.id = state.season_day_id
    where state.rider_id = v_rider.rider_id
      and day.season_id = v_season.id
      and day.day_number <= coalesce(v_season.current_day_number, 1)
    order by day.day_number desc, state.updated_at desc
    limit 1;
    v_original_form := coalesce(v_original_form, 75);

    if v_has_prior_contract then
      select state.form into v_form
      from public.rider_condition_states as state
      join public.season_days as day on day.id = state.season_day_id
      where state.rider_id = v_rider.rider_id
        and day.season_id = v_season.id
        and day.day_number <= v_rider.first_invalid_day_number
      order by day.day_number desc, state.updated_at desc
      limit 1;
      v_form := coalesce(v_form, 75);
    else
      v_form := 75;
    end if;

    insert into public.rider_form_contract_repairs (
      season_id, rider_id, first_invalid_day_number,
      repair_start_day_number, form_before,
      invalid_daily_effects, invalid_nutrition_effects,
      replaced_condition_states
    ) values (
      v_season.id,
      v_rider.rider_id,
      v_rider.first_invalid_day_number,
      v_start_day_number,
      v_original_form,
      coalesce((
        select jsonb_agg(to_jsonb(effect) order by effect.applied_at, effect.id)
        from retroactive_daily_effects as effect
        where effect.rider_id = v_rider.rider_id
      ), '[]'::jsonb),
      coalesce((
        select jsonb_agg(to_jsonb(effect) order by effect.applied_at, effect.id)
        from retroactive_nutrition_effects as effect
        where effect.rider_id = v_rider.rider_id
      ), '[]'::jsonb),
      coalesce((
        select jsonb_agg(to_jsonb(state) order by day.day_number)
        from public.rider_condition_states as state
        join public.season_days as day on day.id = state.season_day_id
        where state.rider_id = v_rider.rider_id
          and day.season_id = v_season.id
          and day.day_number > v_rider.first_invalid_day_number
          and day.day_number <= coalesce(v_season.current_day_number, 1)
      ), '[]'::jsonb)
    )
    on conflict (season_id, rider_id) do nothing;

    delete from public.rider_condition_states as state
    using public.season_days as day
    where state.season_day_id = day.id
      and state.rider_id = v_rider.rider_id
      and day.season_id = v_season.id
      and day.day_number > v_rider.first_invalid_day_number
      and day.day_number <= coalesce(v_season.current_day_number, 1);

    for v_day in
      select day.*
      from public.season_days as day
      where day.season_id = v_season.id
        and day.day_number between
          v_start_day_number and coalesce(v_season.current_day_number, 1)
      order by day.day_number
    loop
      if public.get_rider_contract_team_for_day(
        v_rider.rider_id,
        v_day.id
      ) is null then
        continue;
      end if;

      select previous_day.id into v_previous_day_id
      from public.season_days as previous_day
      where previous_day.season_id = v_season.id
        and previous_day.day_number = v_day.day_number - 1;

      v_source := 'contract_form_repair';

      if v_previous_day_id is not null
        and public.get_rider_contract_team_for_day(
          v_rider.rider_id,
          v_previous_day_id
        ) is not null then
        for v_event in
          select effect.id, effect.effect_type, effect.form_delta
          from public.rider_daily_condition_effects as effect
          where effect.rider_id = v_rider.rider_id
            and effect.season_day_id = v_previous_day_id
            and effect.effect_type <> 'training'
          order by effect.applied_at, effect.id
        loop
          v_form_before := v_form;
          v_actual_delta := v_event.form_delta;
          v_form := greatest(0, least(100, v_form + v_actual_delta));
          update public.rider_daily_condition_effects
          set form_before = v_form_before,
            form_after = v_form
          where id = v_event.id;
          v_source := v_event.effect_type;
        end loop;

        for v_event in
          select effect.id, effect.contributions, effect.form_delta
          from public.rider_daily_nutrition_effects as effect
          where effect.rider_id = v_rider.rider_id
            and effect.season_day_id = v_previous_day_id
          order by effect.applied_at, effect.id
        loop
          select coalesce(
            sum(coalesce((contribution ->> 'gain')::numeric, 0)),
            v_event.form_delta
          ) into v_potential_delta
          from jsonb_array_elements(v_event.contributions) as contribution;
          v_potential_delta := coalesce(
            nullif(v_potential_delta, 0),
            v_event.form_delta,
            0
          );
          v_form_before := v_form;
          v_actual_delta := greatest(
            0,
            least(v_potential_delta, 100 - v_form)
          );
          v_form := greatest(0, least(100, v_form + v_actual_delta));
          update public.rider_daily_nutrition_effects
          set form_delta = v_actual_delta,
            form_before = v_form_before,
            form_after = v_form
          where id = v_event.id;
          v_source := 'nutritionist';
        end loop;
      end if;

      for v_event in
        select event.*
        from (
          select 'training'::text as event_kind,
            session.id as event_id,
            session.form_delta::numeric as delta,
            session.processed_at as event_at,
            10 as event_priority
          from public.rider_training_sessions as session
          where session.rider_id = v_rider.rider_id
            and session.season_day_id = v_day.id
            and session.is_contract_eligible
          union all
          select 'nutrition_intervention', intervention.id,
            (intervention.base_form_gain + intervention.level_form_bonus)::numeric,
            intervention.applied_at, 20
          from public.rider_nutrition_interventions as intervention
          where intervention.rider_id = v_rider.rider_id
            and intervention.season_day_id = v_day.id
          union all
          select 'race', effect.id, effect.form_delta::numeric,
            effect.applied_at, 30
          from public.stage_rider_condition_effects as effect
          where effect.rider_id = v_rider.rider_id
            and effect.season_day_id = v_day.id
          union all
          select 'injury', effect.id, effect.form_delta::numeric,
            effect.applied_at, 40
          from public.rider_injury_form_effects as effect
          where effect.rider_id = v_rider.rider_id
            and effect.season_day_id = v_day.id
          union all
          select 'daily_reward', inventory.id,
            greatest(
              1,
              least(20, (catalog.effect_payload ->> 'amount')::integer)
            )::numeric,
            inventory.used_at, 25
          from public.daily_reward_inventory as inventory
          join public.daily_reward_catalog as catalog
            on catalog.reward_key = inventory.reward_key
           and catalog.effect_kind = 'form_boost'
          join public.team_seasons as team_season
            on team_season.id = inventory.team_season_id
           and team_season.season_id = v_season.id
          where inventory.status = 'used'
            and inventory.usage_payload ->> 'riderId' = v_rider.rider_id::text
            and (inventory.used_at at time zone 'Europe/Paris')::date =
              v_day.calendar_date
        ) as event
        order by event.event_at, event.event_priority, event.event_id
      loop
        v_form_before := v_form;
        v_actual_delta := case
          when v_event.delta >= 0
            then least(v_event.delta, 100 - v_form)
          else greatest(v_event.delta, -v_form)
        end;
        v_form := greatest(0, least(100, v_form + v_actual_delta));

        if v_event.event_kind = 'training' then
          update public.rider_training_sessions
          set form_before = v_form_before,
            form_after = v_form
          where id = v_event.event_id;
        elsif v_event.event_kind = 'nutrition_intervention' then
          update public.rider_nutrition_interventions
          set actual_form_gain = v_actual_delta,
            form_before = v_form_before,
            form_after = v_form
          where id = v_event.event_id;
        elsif v_event.event_kind = 'race' then
          update public.stage_rider_condition_effects
          set form_before = v_form_before,
            form_after = v_form
          where id = v_event.event_id;
        elsif v_event.event_kind = 'injury' then
          update public.rider_injury_form_effects
          set form_before = v_form_before,
            form_after = v_form
          where id = v_event.event_id;
        end if;
        v_source := v_event.event_kind;
      end loop;

      insert into public.rider_condition_states (
        rider_id, season_day_id, form, fatigue, source
      ) values (
        v_rider.rider_id, v_day.id, v_form, 0, v_source
      )
      on conflict (rider_id, season_day_id) do update set
        form = excluded.form,
        fatigue = excluded.fatigue,
        source = excluded.source,
        updated_at = now();
    end loop;

    update public.rider_form_contract_repairs
    set form_after = v_form,
      repaired_at = now()
    where season_id = v_season.id
      and rider_id = v_rider.rider_id;
  end loop;
end;
$repair$;

delete from public.rider_daily_condition_effects as effect
using retroactive_daily_effects as invalid
where effect.id = invalid.id;

delete from public.rider_daily_nutrition_effects as effect
using retroactive_nutrition_effects as invalid
where effect.id = invalid.id;

revoke all on function public.get_rider_contract_team_for_day(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.enforce_daily_condition_contract_eligibility()
  from public, anon, authenticated;
grant execute on function public.get_rider_contract_team_for_day(uuid, uuid)
  to service_role;

comment on function public.get_rider_contract_team_for_day(uuid, uuid) is
  'Returns the team which employed a rider on an exact game day, respecting mid-season arrivals, departures and transfers.';
comment on function public.enforce_daily_condition_contract_eligibility() is
  'Final write guard preventing daily form effects outside a real contract interval.';
comment on table public.rider_form_contract_repairs is
  'Auditable before/after backup for the S3 repair of pre-contract daily form and nutrition credits.';

notify pgrst, 'reload schema';

commit;
