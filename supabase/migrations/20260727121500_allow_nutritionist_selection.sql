begin;

drop function if exists public.apply_current_team_nutrition_intervention(
  uuid,
  text
);

create function public.apply_current_team_nutrition_intervention(
  p_rider_id uuid,
  p_nutritionist_contract_id uuid,
  p_intervention_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_nutritionist record;
  v_intervention_id uuid := gen_random_uuid();
  v_minimum_level integer;
  v_base_gain integer;
  v_level_bonus integer;
  v_actual_gain integer;
  v_base_price numeric(12, 2);
  v_price numeric(12, 2);
  v_form_before integer;
  v_form_after integer;
  v_fatigue integer;
  v_used_capacity integer;
begin
  if p_rider_id is null then
    raise exception 'Le coureur est obligatoire.';
  end if;

  if p_nutritionist_contract_id is null then
    raise exception 'Le nutritionniste est obligatoire.';
  end if;

  if p_intervention_code = 'recovery_snack' then
    v_minimum_level := 1;
    v_base_gain := 3;
    v_base_price := 1500;
  elsif p_intervention_code = 'tailored_plan' then
    v_minimum_level := 3;
    v_base_gain := 5;
    v_base_price := 3500;
  elsif p_intervention_code = 'elite_recharge' then
    v_minimum_level := 5;
    v_base_gain := 7;
    v_base_price := 6500;
  else
    raise exception 'Cette intervention nutritionnelle est invalide.';
  end if;

  perform public.settle_current_team_finances();
  perform public.settle_current_health_and_form();

  select
    assignment.team_id,
    team_season.id as team_season_id,
    team_season.cash_balance,
    team_season.currency,
    season.id as season_id,
    season.current_day_number,
    day.id as season_day_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  join public.season_days as day
    on day.season_id = season.id
   and day.day_number = coalesce(season.current_day_number, 1)
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

  perform 1
  from public.team_seasons
  where id = v_context.team_season_id
  for update;

  if exists (
    select 1
    from public.rider_nutrition_interventions as intervention
    where intervention.rider_id = p_rider_id
      and intervention.season_day_id = v_context.season_day_id
  ) then
    raise exception 'Ce coureur a déjà bénéficié d’une intervention nutritionnelle aujourd’hui.';
  end if;

  select
    contract.id,
    member.level,
    member.first_name,
    member.last_name
  into v_nutritionist
  from public.staff_contracts as contract
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'nutritionist'
  where contract.id = p_nutritionist_contract_id
    and contract.team_id = v_context.team_id
    and contract.status = 'active'
  for update of contract;

  if v_nutritionist is null then
    raise exception 'Le nutritionniste sélectionné ne fait pas partie de votre staff actif.';
  end if;

  if v_nutritionist.level < v_minimum_level then
    raise exception 'Le nutritionniste sélectionné ne possède pas le niveau requis pour ce complément.';
  end if;

  select count(*)
  into v_used_capacity
  from public.rider_nutrition_interventions as used
  where used.nutritionist_contract_id = v_nutritionist.id
    and used.season_day_id = v_context.season_day_id;

  if v_used_capacity >= public.get_nutritionist_daily_capacity(
    v_nutritionist.level
  ) then
    raise exception 'Le nutritionniste sélectionné a déjà utilisé toute sa capacité aujourd’hui.';
  end if;

  select state.form, state.fatigue
  into v_form_before, v_fatigue
  from public.rider_condition_states as state
  join public.season_days as state_day on state_day.id = state.season_day_id
  where state.rider_id = p_rider_id
    and state_day.season_id = v_context.season_id
    and state_day.day_number <= v_context.current_day_number
  order by state_day.day_number desc, state.updated_at desc
  limit 1;

  v_form_before := coalesce(v_form_before, 75);
  v_fatigue := coalesce(v_fatigue, 0);
  if v_form_before >= 100 then
    raise exception 'La forme de ce coureur est déjà au maximum.';
  end if;

  v_level_bonus := floor((v_nutritionist.level - 1) / 2.0)::integer;
  v_actual_gain := least(
    100 - v_form_before,
    v_base_gain + v_level_bonus
  );
  v_form_after := v_form_before + v_actual_gain;
  v_price := round(
    v_base_price * (100 - v_nutritionist.level * 5) / 100.0,
    2
  );

  if v_context.cash_balance < v_price then
    raise exception 'La trésorerie de l’équipe est insuffisante pour cette intervention.';
  end if;

  insert into public.rider_nutrition_interventions (
    id,
    rider_id,
    team_season_id,
    season_day_id,
    nutritionist_contract_id,
    intervention_code,
    nutritionist_level,
    base_form_gain,
    level_form_bonus,
    actual_form_gain,
    base_price,
    price_paid,
    form_before,
    form_after
  ) values (
    v_intervention_id,
    p_rider_id,
    v_context.team_season_id,
    v_context.season_day_id,
    v_nutritionist.id,
    p_intervention_code,
    v_nutritionist.level,
    v_base_gain,
    v_level_bonus,
    v_actual_gain,
    v_base_price,
    v_price,
    v_form_before,
    v_form_after
  );

  insert into public.rider_condition_states (
    rider_id,
    season_day_id,
    form,
    fatigue,
    source
  ) values (
    p_rider_id,
    v_context.season_day_id,
    v_form_after,
    v_fatigue,
    'nutrition'
  )
  on conflict (rider_id, season_day_id)
  do update set
    form = least(
      100,
      public.rider_condition_states.form + v_actual_gain
    ),
    fatigue = public.rider_condition_states.fatigue,
    source = 'nutrition',
    updated_at = now();

  update public.team_seasons
  set cash_balance = cash_balance - v_price
  where id = v_context.team_season_id;

  insert into public.team_finance_transactions (
    team_season_id,
    season_day_id,
    day_number,
    amount,
    category,
    status,
    description,
    source_reference,
    posted_at
  ) values (
    v_context.team_season_id,
    v_context.season_day_id,
    v_context.current_day_number,
    -v_price,
    'medical_care',
    'posted',
    case p_intervention_code
      when 'recovery_snack' then 'Collation de récupération'
      when 'tailored_plan' then 'Plan nutritionnel personnalisé'
      else 'Recharge haute performance'
    end || ' · ' || v_nutritionist.first_name || ' ' || v_nutritionist.last_name,
    'nutrition-intervention:' || v_intervention_id::text,
    now()
  );

  return v_intervention_id;
end;
$$;

revoke all on function public.apply_current_team_nutrition_intervention(
  uuid,
  uuid,
  text
) from public, anon;

grant execute on function public.apply_current_team_nutrition_intervention(
  uuid,
  uuid,
  text
) to authenticated;

comment on function public.apply_current_team_nutrition_intervention(
  uuid,
  uuid,
  text
) is
  'Applique une intervention avec le nutritionniste explicitement choisi, contrôle son appartenance, son niveau et sa capacité, puis débite atomiquement l’équipe.';

notify pgrst, 'reload schema';

commit;
