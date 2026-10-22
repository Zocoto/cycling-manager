begin;
set local lock_timeout = '1s';
set local statement_timeout = '8s';
set local application_name = 'cyclostratege-sprint-train-20261022';

-- Metadata-only default on supported PostgreSQL: no historical plans rewritten.
alter table public.race_stage_strategies
  add column sprint_train_order uuid[] not null default '{}';

-- Existing preparation, authorization and race-settlement functions stay intact.
-- This helper only accepts already validated leadout roles in this registration.
create function private.store_sprint_train_order(
  p_registration_id uuid, p_stage_id uuid, p_roles jsonb, p_order jsonb
) returns void language sql security definer set search_path = '' as $$
  update public.race_stage_strategies as strategy
  set sprint_train_order = coalesce((
    select array_agg(chosen.rider_id order by chosen.position)
    from (
      select roster.rider_id, min(preference.position) as position
      from jsonb_array_elements_text(
        case when jsonb_typeof(p_order) = 'array' then p_order else '[]'::jsonb end
      ) with ordinality as preference(rider_id, position)
      join jsonb_array_elements(p_roles) as role(value)
        on role.value->>'riderId' = preference.rider_id
       and role.value->>'role' = 'leadout'
      join public.race_rosters as roster
        on roster.race_registration_id = p_registration_id
       and roster.rider_id::text = preference.rider_id
       and roster.status in ('selected', 'confirmed')
      group by roster.rider_id
    ) as chosen
  ), '{}'::uuid[])
  where strategy.race_registration_id = p_registration_id and strategy.stage_id = p_stage_id;
$$;
revoke all on function private.store_sprint_train_order(uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated;

create function public.save_current_team_race_preparation_with_sprint(
  p_race_edition_id uuid, p_stage_id uuid, p_roles jsonb, p_strategy jsonb
) returns table(stage_id uuid, stage_number integer, updated_rider_count integer)
language plpgsql security definer set search_path = '' as $$
declare v_saved record; v_registration_id uuid;
begin
  -- Canonical RPC retains every ownership, roster, deadline and mission check
  -- and holds its existing stage / registration locks until this RPC commits.
  select * into v_saved from public.save_current_team_race_preparation(
    p_race_edition_id, p_stage_id, p_roles, p_strategy
  );
  select strategy.race_registration_id into strict v_registration_id
  from public.race_stage_strategies as strategy
  join public.race_registrations as registration on registration.id = strategy.race_registration_id
  where strategy.stage_id = p_stage_id and registration.race_edition_id = p_race_edition_id
    and exists (
      select 1 from public.team_manager_assignments as assignment
      join public.sporting_directors as director on director.id = assignment.sporting_director_id
      where assignment.team_id = strategy.team_id and assignment.status = 'active'
        and assignment.role = 'general_manager' and director.auth_user_id = auth.uid()
    );
  perform private.store_sprint_train_order(
    v_registration_id, p_stage_id, p_roles, p_strategy->'sprintTrainOrder'
  );
  return query select v_saved.stage_id, v_saved.stage_number, v_saved.updated_rider_count;
end;
$$;

create function public.save_national_federation_race_preparation_with_sprint(
  p_country_code text, p_race_edition_id uuid, p_stage_id uuid, p_roles jsonb, p_strategy jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare v_context record;
begin
  perform public.save_national_federation_race_preparation(
    p_country_code, p_race_edition_id, p_stage_id, p_roles, p_strategy
  );
  select * into strict v_context from private.assert_federation_race_preparation_context(
    p_country_code, p_race_edition_id, p_stage_id, false
  );
  perform private.store_sprint_train_order(
    v_context.registration_id, p_stage_id, p_roles, p_strategy->'sprintTrainOrder'
  );
end;
$$;

-- Reuse the existing paginated row format; one indexed join, no extra request.
create type public.race_preparation_with_sprint_row as (
  race_edition_id uuid, race_registration_id uuid, team_id uuid, stage_id uuid,
  rider_id uuid, rider_first_name text, rider_last_name text,
  mountain integer, hills integer, flat integer, time_trial integer, cobbles integer,
  sprint integer, acceleration integer, downhill integer, endurance integer,
  resistance integer, recovery integer, breakaway integer, prologue integer,
  general_role text, stage_role text, time_trial_effort text, relay_share_pct numeric,
  time_trial_updated_at timestamptz, objective text, collective_posture text,
  breakaway_policy text, chase_policy text, lieutenant_rider_id uuid,
  danger_pacer_rider_id uuid, protector_rider_id uuid, breakaway_rider_id uuid,
  attack_orders jsonb, strategy_updated_at timestamptz, sprint_train_order uuid[]
);
create function public.get_current_team_race_preparation_with_sprint()
returns setof public.race_preparation_with_sprint_row
language sql stable security definer set search_path = '' as $$
  select preparation.*, coalesce(strategy.sprint_train_order, '{}'::uuid[])
  from public.get_current_team_race_preparation() as preparation
  left join public.race_stage_strategies as strategy
    on strategy.race_registration_id = preparation.race_registration_id
   and strategy.stage_id = preparation.stage_id;
$$;
create function public.get_current_national_federation_race_preparation_with_sprint(p_country_code text)
returns setof public.race_preparation_with_sprint_row
language sql stable security definer set search_path = '' as $$
  select preparation.*, coalesce(strategy.sprint_train_order, '{}'::uuid[])
  from public.get_current_national_federation_race_preparation(p_country_code) as preparation
  left join public.race_stage_strategies as strategy
    on strategy.race_registration_id = preparation.race_registration_id
   and strategy.stage_id = preparation.stage_id;
$$;

revoke all on function public.save_current_team_race_preparation_with_sprint(uuid, uuid, jsonb, jsonb) from public, anon;
revoke all on function public.save_national_federation_race_preparation_with_sprint(text, uuid, uuid, jsonb, jsonb) from public, anon;
revoke all on function public.get_current_team_race_preparation_with_sprint() from public, anon;
revoke all on function public.get_current_national_federation_race_preparation_with_sprint(text) from public, anon;
grant execute on function public.save_current_team_race_preparation_with_sprint(uuid, uuid, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.save_national_federation_race_preparation_with_sprint(text, uuid, uuid, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.get_current_team_race_preparation_with_sprint() to authenticated, service_role;
grant execute on function public.get_current_national_federation_race_preparation_with_sprint(text) to authenticated, service_role;
notify pgrst, 'reload schema';
commit;
