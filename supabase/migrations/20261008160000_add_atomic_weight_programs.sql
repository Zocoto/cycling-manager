begin;
set local lock_timeout = '2s';
set local statement_timeout = '20s';

alter table public.rider_weight_events drop constraint rider_weight_events_source_allowed;
alter table public.rider_weight_events add constraint rider_weight_events_source_allowed
  check (source in ('supplement', 'weight_cut', 'weight_gain'));

-- One transaction for the floating validation bar. Reuse the proven, set-based
-- supplement batch (prices, capacity, risk and exact retries), then apply the
-- bounded optional weight programmes. No global health settlement or scan.
create or replace function public.apply_current_team_nutrition_plan(
  p_interventions jsonb, p_weight_programs jsonb
)
returns jsonb language plpgsql security definer set search_path = ''
set lock_timeout = '2500ms' set statement_timeout = '12s' as $$
declare
  v_context record;
  v_entry jsonb;
  v_rider public.riders%rowtype;
  v_rider_id uuid;
  v_delta numeric;
  v_form numeric;
  v_fatigue integer;
  v_cost numeric;
  v_after numeric;
  v_existing public.rider_weight_events%rowtype;
  v_event_id uuid;
  v_supplement_ids uuid[] := array[]::uuid[];
  v_program_ids uuid[] := array[]::uuid[];
begin
  if auth.uid() is null then raise exception 'Authentification requise.'; end if;
  if p_interventions is null or jsonb_typeof(p_interventions) <> 'array'
    or p_weight_programs is null or jsonb_typeof(p_weight_programs) <> 'array' then
    raise exception 'La sélection nutritionnelle est invalide.';
  end if;
  if jsonb_array_length(p_interventions) > 35 or jsonb_array_length(p_weight_programs) > 35
    or jsonb_array_length(p_interventions) + jsonb_array_length(p_weight_programs) = 0 then
    raise exception 'Sélectionnez au maximum 35 coureurs par type de programme.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_weight_programs) e(value)
    where jsonb_typeof(value) is distinct from 'object'
      or coalesce(value ->> 'riderId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or jsonb_typeof(value -> 'weightDeltaKg') is distinct from 'number') then
    raise exception 'Un programme de poids est invalide.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_weight_programs) e(value)
    where abs((value ->> 'weightDeltaKg')::numeric) not in (0.2, 0.4, 0.6, 0.8, 1)) then
    raise exception 'Choisissez un ajustement de poids de 0,2 à 1 kg.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_weight_programs) e(value)
    group by (value ->> 'riderId')::uuid having count(*) > 1) then
    raise exception 'Un seul programme de poids est possible par coureur.';
  end if;

  perform public.sync_active_season_day();
  -- Keep the existing finance-before-team-lock order. Its locks are retained
  -- by this outer transaction, including on an exact retry.
  if jsonb_array_length(p_interventions) > 0 then
    v_supplement_ids := public.apply_current_team_nutrition_interventions(p_interventions);
  end if;
  select assignment.team_id, team_season.id as team_season_id,
    season.id as season_id, season.game_year, season.current_day_number,
    day.id as season_day_id, day.calendar_date
  into v_context
  from public.sporting_directors director
  join public.team_manager_assignments assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons season on season.status = 'active'
  join public.team_seasons team_season
    on team_season.team_id = assignment.team_id and team_season.season_id = season.id
  join public.season_days day
    on day.season_id = season.id and day.day_number = season.current_day_number
  where director.auth_user_id = auth.uid() and director.status = 'active' limit 1;
  if v_context.team_id is null then
    raise exception 'Aucune équipe active n’est associée à ce compte.';
  end if;
  perform 1 from public.team_seasons where id = v_context.team_season_id for update;
  if jsonb_array_length(p_weight_programs) > 0 and not exists (
    select 1 from public.staff_contracts contract
    join public.staff_members member on member.id = contract.staff_member_id
    where contract.team_id = v_context.team_id and contract.status = 'active'
      and member.role = 'nutritionist'
  ) then raise exception 'Un nutritionniste actif est requis pour ajuster le poids.'; end if;

  for v_entry in select value from jsonb_array_elements(p_weight_programs) e(value)
    order by value ->> 'riderId'
  loop
    v_rider_id := (v_entry ->> 'riderId')::uuid;
    v_delta := (v_entry ->> 'weightDeltaKg')::numeric;
    if not exists (select 1 from public.rider_contracts
      where rider_id = v_rider_id and team_id = v_context.team_id and status = 'active') then
      raise exception 'Un coureur sélectionné ne fait pas partie de votre effectif actif.';
    end if;
    select * into v_rider from public.riders where id = v_rider_id for update;
    select * into v_existing from public.rider_weight_events
      where rider_id = v_rider_id and season_day_id = v_context.season_day_id
        and source in ('weight_cut', 'weight_gain') limit 1;
    if v_existing.id is not null and v_existing.weight_delta_kg = v_delta then
      v_program_ids := array_append(v_program_ids, v_existing.id);
      continue;
    end if;
    -- Use calendar dates, not game_year * 28: off-season days overlap the next
    -- season's index. Both directions and previous-team programmes count.
    if exists (select 1 from public.rider_weight_events event
      left join public.season_days event_day on event_day.id = event.season_day_id
      where event.rider_id = v_rider_id and event.source in ('weight_cut', 'weight_gain')
        and coalesce(event_day.calendar_date, (event.applied_at at time zone 'Europe/Paris')::date)
          > v_context.calendar_date - 5) then
      raise exception 'Affûtage et athlétisation partagent un délai de cinq jours.';
    end if;
    if v_rider.height_cm is null or v_rider.weight_kg is null then
      raise exception 'Le physique de ce coureur n’est pas encore disponible.';
    end if;
    v_after := round(v_rider.weight_kg + v_delta, 1);
    if v_delta < 0 and v_after < greatest(45, round(18 * power(v_rider.height_cm / 100.0, 2), 1)) then
      raise exception 'Ce programme ferait descendre le coureur sous son poids de sécurité.';
    elsif v_after > 120 then
      raise exception 'Ce programme dépasserait le poids maximal autorisé.';
    end if;
    select state.form, state.fatigue into v_form, v_fatigue
    from public.rider_condition_states state
    join public.season_days state_day on state_day.id = state.season_day_id
    where state.rider_id = v_rider_id and state_day.season_id = v_context.season_id
      and state_day.day_number <= v_context.current_day_number
    order by state_day.day_number desc, state.updated_at desc limit 1;
    insert into public.rider_condition_states(rider_id, season_day_id, form, fatigue, source)
      values(v_rider_id, v_context.season_day_id, coalesce(v_form, 75), coalesce(v_fatigue, 0), 'nutrition')
      on conflict (rider_id, season_day_id) do nothing;
    select form into v_form from public.rider_condition_states
      where rider_id = v_rider_id and season_day_id = v_context.season_day_id for update;
    v_cost := abs(v_delta) * 20;
    if v_form < v_cost then raise exception 'La forme du coureur est insuffisante pour ce programme.'; end if;
    update public.riders set weight_kg = v_after where id = v_rider_id;
    update public.rider_condition_states set form = form - v_cost, source = 'nutrition', updated_at = now()
      where rider_id = v_rider_id and season_day_id = v_context.season_day_id;
    insert into public.rider_weight_events(
      rider_id, team_id, season_id, season_day_id, game_day_index, source,
      weight_before_kg, weight_delta_kg, weight_after_kg, form_cost, source_reference
    ) values (
      v_rider_id, v_context.team_id, v_context.season_id, v_context.season_day_id,
      v_context.game_year * 28 + v_context.current_day_number - 1,
      case when v_delta > 0 then 'weight_gain' else 'weight_cut' end,
      v_rider.weight_kg, v_delta, v_after, v_cost,
      'weight-program:' || v_rider_id::text || ':' || v_context.season_day_id::text
    ) returning id into v_event_id;
    v_program_ids := array_append(v_program_ids, v_event_id);
  end loop;
  return jsonb_build_object('nutritionIds', v_supplement_ids, 'weightProgramIds', v_program_ids);
end;
$$;
revoke all on function public.apply_current_team_nutrition_plan(jsonb, jsonb) from public, anon;
grant execute on function public.apply_current_team_nutrition_plan(jsonb, jsonb) to authenticated, service_role;

-- Keep existing bookmarked/older clients safe, with the same cooldown and retry
-- protection as the new interface. Baseline weights and finance are untouched.
create or replace function public.apply_current_team_weight_cut(p_rider_id uuid, p_weight_loss_kg numeric)
returns uuid language plpgsql security definer set search_path = ''
set lock_timeout = '2500ms' set statement_timeout = '12s' as $$
declare v_result jsonb;
begin
  if p_weight_loss_kg is null or p_weight_loss_kg not in (0.2, 0.4, 0.6, 0.8, 1) then
    raise exception 'Choisissez une perte de poids comprise entre 0,2 et 1 kg.';
  end if;
  v_result := public.apply_current_team_nutrition_plan('[]',
    jsonb_build_array(jsonb_build_object('riderId', p_rider_id, 'weightDeltaKg', -p_weight_loss_kg)));
  return (v_result -> 'weightProgramIds' ->> 0)::uuid;
end;
$$;
revoke all on function public.apply_current_team_weight_cut(uuid, numeric) from public, anon;
grant execute on function public.apply_current_team_weight_cut(uuid, numeric) to authenticated, service_role;
notify pgrst, 'reload schema';
commit;
