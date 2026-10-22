begin;
set local lock_timeout = '1s';
set local statement_timeout = '8s';
set local application_name = 'cyclostratege-terrain-preparation-20261022';

-- Additive catalog extension only: no rider, booking, finance or race rows change.
-- Patch current definitions rather than replaying obsolete finance/race guards.
create or replace function pg_temp.patch_terrain_function(p_signature text, p_old text, p_new text, p_count integer default 1)
returns void language plpgsql as $$
declare v_definition text; v_count integer;
begin
  v_definition := replace(pg_get_functiondef(p_signature::regprocedure), chr(13), '');
  if position(p_new in v_definition) > 0 then return; end if;
  v_count := (length(v_definition) - length(replace(v_definition, p_old, ''))) / length(p_old);
  if v_count <> p_count then raise exception 'Unexpected terrain preparation patch target: % (% / %)', p_signature, v_count, p_count; end if;
  execute replace(v_definition, p_old, p_new);
end;
$$;

-- Each new check is a strict superset of the old validated expression. NOT VALID
-- avoids a table scan/long write lock while still checking every future write.
create or replace function pg_temp.extend_terrain_check(p_table text, p_name text, p_extension text)
returns void language plpgsql as $$
declare v_expression text;
begin
  select pg_get_expr(conbin, conrelid) into strict v_expression
  from pg_catalog.pg_constraint where conrelid = ('public.' || p_table)::regclass and conname = p_name and contype = 'c';
  if position('cobbles_' in v_expression) > 0 then return; end if;
  execute format('alter table public.%I drop constraint %I', p_table, p_name);
  execute format('alter table public.%I add constraint %I check ((%s) or (%s)) not valid', p_table, p_name, v_expression, p_extension);
end;
$$;
select pg_temp.extend_terrain_check('team_infrastructures', 'team_infrastructures_code_allowed',
  $$infrastructure_code in ('cobbles_center', 'hills_circuit', 'mountain_base')$$);
select pg_temp.extend_terrain_check('infrastructure_projects', 'infrastructure_projects_code_allowed',
  $$infrastructure_code in ('cobbles_center', 'hills_circuit', 'mountain_base')$$);
select pg_temp.extend_terrain_check('rider_form_camps', 'rider_form_camps_type_allowed',
  $$camp_type in ('cobbles_preparation', 'hills_preparation', 'mountain_preparation')$$);
select pg_temp.extend_terrain_check('rider_form_camps', 'rider_form_camps_gain_allowed',
  $$camp_type in ('cobbles_preparation', 'hills_preparation', 'mountain_preparation') and form_gain_per_day = 0$$);
select pg_temp.extend_terrain_check('rider_performance_preparations', 'rider_performance_preparations_preparation_type_check',
  $$preparation_type in ('cobbles_center', 'hills_circuit', 'mountain_base')$$);
select pg_temp.extend_terrain_check('rider_performance_preparations', 'rider_performance_preparations_rating_bonus_check',
  $$preparation_type in ('cobbles_center', 'hills_circuit', 'mountain_base') and rating_bonus between 1 and 3.85$$);

select pg_temp.patch_terrain_function('public.get_team_infrastructure_base_cost(text,integer)',
  $$when 'wind_tunnel' then$$,
  $$when 'cobbles_center' then v_costs := array[150000, 375000, 750000, 1300000, 2000000];
    when 'hills_circuit' then v_costs := array[450000, 950000, 1650000, 2650000, 4000000];
    when 'mountain_base' then v_costs := array[500000, 1050000, 1850000, 2950000, 4400000];
    when 'wind_tunnel' then$$);
select pg_temp.patch_terrain_function('public.get_team_infrastructure_base_duration_days(text,integer)',
  $$when 'wind_tunnel' then$$,
  $$when 'cobbles_center' then v_durations := array[7, 11, 16, 22, 28];
    when 'hills_circuit' then v_durations := array[9, 14, 20, 27, 35];
    when 'mountain_base' then v_durations := array[9, 14, 20, 27, 35];
    when 'wind_tunnel' then$$);
select pg_temp.patch_terrain_function('public.start_current_team_infrastructure_project(text,uuid,uuid)',
  $$'wind_tunnel',$$, $$'wind_tunnel', 'cobbles_center', 'hills_circuit', 'mountain_base',$$);
select pg_temp.patch_terrain_function('public.start_current_team_infrastructure_project(text,uuid,uuid)',
  $$when 'wind_tunnel' then$$,
  $$when 'cobbles_center' then
      v_base_cost := 150000;
      v_base_duration := public.get_team_infrastructure_base_duration_days(p_infrastructure_code, v_target_level);
      v_description := 'Centre des classiques';
    when 'hills_circuit' then
      v_base_cost := 450000;
      v_base_duration := public.get_team_infrastructure_base_duration_days(p_infrastructure_code, v_target_level);
      v_description := 'Circuit de côtes';
    when 'mountain_base' then
      v_base_cost := 500000;
      v_base_duration := public.get_team_infrastructure_base_duration_days(p_infrastructure_code, v_target_level);
      v_description := 'Base montagne';
    when 'wind_tunnel' then$$);
select pg_temp.patch_terrain_function('public.settle_due_infrastructure_projects()',
  $$'wind_tunnel',$$, $$'wind_tunnel', 'cobbles_center', 'hills_circuit', 'mountain_base',$$);
select pg_temp.patch_terrain_function('public.calculate_game_objective_progress_pre_recruitment_rewards(text,uuid,uuid,numeric)',
  $$'wind_tunnel',$$, $$'wind_tunnel', 'cobbles_center', 'hills_circuit', 'mountain_base',$$, 2);

do $$
declare v_signature text;
begin
  foreach v_signature in array array[
    'public.settle_due_infrastructure_projects()',
    'public.get_current_management_reward_targets()',
    'public.redeem_construction_time_reward(uuid,uuid)'
  ] loop
    perform pg_temp.patch_terrain_function(v_signature,
      $old$when 'wind_tunnel' then 'Soufflerie'$old$,
      $new$when 'cobbles_center' then 'Centre des classiques'
      when 'hills_circuit' then 'Circuit de côtes'
      when 'mountain_base' then 'Base montagne'
      when 'wind_tunnel' then 'Soufflerie'$new$);
  end loop;
end;
$$;
select pg_temp.patch_terrain_function('public.is_valid_team_infrastructure_specialization(text,text)',
  $$when 'wind_tunnel' then$$,
  $$when 'cobbles_center' then p_specialization_code in ('cobbles_precision', 'cobbles_durability', 'cobbles_group')
    when 'hills_circuit' then p_specialization_code in ('hills_precision', 'hills_durability', 'hills_group')
    when 'mountain_base' then p_specialization_code in ('mountain_precision', 'mountain_durability', 'mountain_group')
    when 'wind_tunnel' then$$);

-- Existing track/tunnel orientations and policies are deliberately unchanged.
-- Orientation, level and architect effects are snapshotted on new bookings only.
create or replace function public.get_terrain_performance_preparation_policy(p_team_id uuid, p_preparation_type text, p_level integer)
returns table (rating_bonus numeric, bonus_days integer, capacity integer)
language plpgsql stable set search_path = '' as $$
declare v_bonus numeric; v_days integer; v_capacity integer; v_code text; v_prefix text; v_power numeric;
begin
  select policy.rating_bonus, policy.bonus_days, policy.capacity into v_bonus, v_days, v_capacity
  from public.get_performance_preparation_policy(p_level) as policy;
  if not found then return; end if;
  v_prefix := case p_preparation_type when 'cobbles_center' then 'cobbles' when 'hills_circuit' then 'hills' when 'mountain_base' then 'mountain' end;
  if v_prefix is not null and p_level >= 3 then
    v_code := public.get_team_infrastructure_specialization(p_team_id, p_preparation_type);
    v_power := case p_level when 3 then 0.6 when 4 then 0.8 else 1 end;
    if v_code = v_prefix || '_precision' then v_bonus := v_bonus + 0.5 * v_power;
    elsif v_code = v_prefix || '_durability' then v_days := v_days + floor(2 * v_power)::integer;
    elsif v_code = v_prefix || '_group' then v_capacity := v_capacity + 1;
    end if;
  end if;
  return query select v_bonus, v_days, v_capacity;
end;
$$;
revoke all on function public.get_terrain_performance_preparation_policy(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.get_terrain_performance_preparation_policy(uuid,text,integer) to service_role;

select pg_temp.patch_terrain_function('public.start_current_team_rider_performance_preparation(uuid,text)',
  $$else
      raise exception 'Construisez d’abord la Soufflerie.';$$,
  $$elsif p_preparation_type = 'wind_tunnel' then
      raise exception 'Construisez d’abord la Soufflerie.';
    else
      raise exception 'Construisez d’abord le bâtiment de préparation correspondant.';$$);
select pg_temp.patch_terrain_function('public.start_current_team_rider_performance_preparation(uuid,text)',
  $$p_preparation_type not in ('indoor_track', 'wind_tunnel')$$,
  $$p_preparation_type not in ('indoor_track', 'wind_tunnel', 'cobbles_center', 'hills_circuit', 'mountain_base')$$);
select pg_temp.patch_terrain_function('public.start_current_team_rider_performance_preparation(uuid,text)',
  $$public.get_performance_preparation_policy(v_level)$$,
  $$public.get_terrain_performance_preparation_policy(v_context.team_id, p_preparation_type, v_level)$$);
select pg_temp.patch_terrain_function('public.start_current_team_rider_performance_preparation(uuid,text)',
  $$v_bonus := least(3.3, greatest(1, round($$,
  $$v_bonus := least(case when p_preparation_type in ('cobbles_center', 'hills_circuit', 'mountain_base') then 3.85 else 3.3 end, greatest(1, round($$);
select pg_temp.patch_terrain_function('public.start_current_team_rider_performance_preparation(uuid,text)',
  $$case when p_preparation_type = 'indoor_track'
      then 'indoor_preparation' else 'wind_tunnel_preparation' end$$,
  $$case p_preparation_type
      when 'indoor_track' then 'indoor_preparation'
      when 'wind_tunnel' then 'wind_tunnel_preparation'
      when 'cobbles_center' then 'cobbles_preparation'
      when 'hills_circuit' then 'hills_preparation'
      when 'mountain_base' then 'mountain_preparation' end$$);

-- International priority keeps the existing generic camp cancellation path and
-- trigger; these labels merely stop the new camps being called classic camps.
select pg_temp.patch_terrain_function('public.get_current_team_race_roster_options_before_reconnaissance(uuid)',
  $$when 'wind_tunnel_preparation' then$$,
  $$when 'cobbles_preparation' then 'Préparation · Centre des classiques'
        when 'hills_preparation' then 'Préparation · Circuit de côtes'
        when 'mountain_preparation' then 'Préparation · Base montagne'
        when 'wind_tunnel_preparation' then$$);
select pg_temp.patch_terrain_function('public.get_rider_international_selection_conflicting_camp_names(uuid,uuid)',
  $$when 'wind_tunnel_preparation' then$$,
  $$when 'cobbles_preparation' then format('Préparation · Centre des classiques · J%s–J%s', camp.start_day_number, camp.end_day_number)
        when 'hills_preparation' then format('Préparation · Circuit de côtes · J%s–J%s', camp.start_day_number, camp.end_day_number)
        when 'mountain_preparation' then format('Préparation · Base montagne · J%s–J%s', camp.start_day_number, camp.end_day_number)
        when 'wind_tunnel_preparation' then$$);
do $$
declare v_signature text;
begin
  foreach v_signature in array array[
    'public.prioritize_federation_championship_rider(uuid,uuid)',
    'public.prioritize_international_championship_rider_before_wildcards(uuid,uuid)'
  ] loop
    perform pg_temp.patch_terrain_function(v_signature,
      $old$when 'wind_tunnel_preparation' then$old$,
      $new$when 'cobbles_preparation' then 'Remboursement convocation · préparation pavés'
            when 'hills_preparation' then 'Remboursement convocation · préparation vallons'
            when 'mountain_preparation' then 'Remboursement convocation · préparation montagne'
            when 'wind_tunnel_preparation' then$new$);
  end loop;
end;
$$;
commit;
