begin;

-- The nutrition ledger used to be written before the next day's condition
-- row existed for a rider who had trained. The subsequent UPDATE touched
-- zero rows, while the unique ledger entry prevented any later retry.
alter table public.rider_daily_nutrition_effects
  add column if not exists condition_applied_at timestamptz;

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
        -- The next-day row may not exist until the 08:00 training job. Create
        -- it now, or add the bonus to the already existing overnight state.
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

        -- A delayed settlement also has to propagate into later snapshots.
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

comment on column public.rider_daily_nutrition_effects.condition_applied_at is
  'Actual settlement time of a nutrition gain on rider condition states; older rows remain null because the former routine did not verify its UPDATE.';

comment on function public.settle_due_daily_nutrition_recovery() is
  'Credits each daily nutrition gain exactly once to the next game-day condition, creating that state before 08:00 training when necessary.';

commit;
