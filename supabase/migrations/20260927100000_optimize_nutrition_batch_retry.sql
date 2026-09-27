begin;

-- La validation groupée ne doit pas appeler jusqu'à 35 fois la fonction
-- unitaire. Outre les lectures et verrous répétés, une réponse HTTP perdue
-- laissait le DS sans moyen sûr de confirmer que le lot avait été appliqué.
-- Cette version valide et écrit tout le lot ensemblistement, sous un unique
-- verrou d'équipe, et accepte sans nouveau débit la répétition exacte du lot.
create or replace function public.apply_current_team_nutrition_interventions(
  p_interventions jsonb
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
set lock_timeout = '2500ms'
set statement_timeout = '12s'
as $$
declare
  v_context record;
  v_requested_count integer;
  v_valid_count integer;
  v_existing_count integer;
  v_matching_count integer;
  v_cash_balance numeric(14, 2);
  v_total_price numeric(14, 2);
  v_applied_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;

  if p_interventions is null
    or jsonb_typeof(p_interventions) <> 'array'
    or jsonb_array_length(p_interventions) < 1
    or jsonb_array_length(p_interventions) > 35
  then
    raise exception 'Sélectionnez entre 1 et 35 compléments à appliquer.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_interventions) as entry(value)
    where jsonb_typeof(entry.value) is distinct from 'object'
      or coalesce(entry.value ->> 'riderId', '')
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(entry.value ->> 'nutritionistContractId', '')
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(entry.value ->> 'interventionCode', '') not in (
        'recovery_snack',
        'tailored_plan',
        'elite_recharge'
      )
  ) then
    raise exception 'Une intervention nutritionnelle est invalide.';
  end if;

  v_requested_count := jsonb_array_length(p_interventions);

  if exists (
    select 1
    from jsonb_array_elements(p_interventions) as entry(value)
    group by entry.value ->> 'riderId'
    having count(*) > 1
  ) then
    raise exception 'Un coureur ne peut recevoir qu’un complément par jour.';
  end if;

  -- Les finances sont soldées une seule fois. La forme quotidienne est réglée
  -- par le job dédié : une validation interactive ne prend plus le verrou
  -- global de santé de tous les joueurs.
  perform public.sync_active_season_day();
  perform public.settle_current_team_finances();

  select
    assignment.team_id,
    team_season.id as team_season_id,
    season.id as season_id,
    season.current_day_number::integer as current_day_number,
    day.id as season_day_id
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id
   and team_season.season_id = season.id
  join public.season_days as day
    on day.season_id = season.id
   and day.day_number = coalesce(season.current_day_number, 1)
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context.team_id is null then
    raise exception 'Aucune équipe active n’est associée à ce compte.';
  end if;

  -- Ce verrou sérialise uniquement les validations de cette équipe. Il garantit
  -- que capacité, trésorerie et répétition du lot sont contrôlées ensemble.
  select team_season.cash_balance
  into v_cash_balance
  from public.team_seasons as team_season
  where team_season.id = v_context.team_season_id
  for update;

  with requested as (
    select
      (entry.value ->> 'riderId')::uuid as rider_id,
      (entry.value ->> 'nutritionistContractId')::uuid
        as nutritionist_contract_id,
      entry.value ->> 'interventionCode' as intervention_code,
      entry.position
    from jsonb_array_elements(p_interventions) with ordinality
      as entry(value, position)
  )
  select
    count(intervention.id)::integer,
    count(intervention.id) filter (
      where intervention.nutritionist_contract_id = requested.nutritionist_contract_id
        and intervention.intervention_code = requested.intervention_code
    )::integer
  into v_existing_count, v_matching_count
  from requested
  left join public.rider_nutrition_interventions as intervention
    on intervention.rider_id = requested.rider_id
   and intervention.season_day_id = v_context.season_day_id
   and intervention.team_season_id = v_context.team_season_id;

  -- Une répétition strictement identique est une confirmation, jamais une
  -- seconde intervention ni un second débit.
  if v_existing_count = v_requested_count
    and v_matching_count = v_requested_count
  then
    with requested as (
      select
        (entry.value ->> 'riderId')::uuid as rider_id,
        entry.position
      from jsonb_array_elements(p_interventions) with ordinality
        as entry(value, position)
    )
    select array_agg(intervention.id order by requested.position)
    into v_applied_ids
    from requested
    join public.rider_nutrition_interventions as intervention
      on intervention.rider_id = requested.rider_id
     and intervention.season_day_id = v_context.season_day_id
     and intervention.team_season_id = v_context.team_season_id;

    return v_applied_ids;
  elsif v_existing_count > 0 then
    raise exception 'Au moins un coureur a déjà bénéficié d’une intervention nutritionnelle aujourd’hui.';
  end if;

  with requested as (
    select distinct (entry.value ->> 'riderId')::uuid as rider_id
    from jsonb_array_elements(p_interventions) as entry(value)
  )
  select count(requested.rider_id)::integer
  into v_valid_count
  from requested
  where exists (
    select 1
    from public.rider_contracts as rider_contract
    where rider_contract.team_id = v_context.team_id
      and rider_contract.rider_id = requested.rider_id
      and rider_contract.status = 'active'
  );

  if v_valid_count <> v_requested_count then
    raise exception 'Au moins un coureur ne fait pas partie de votre effectif actif.';
  end if;

  with requested as (
    select
      (entry.value ->> 'nutritionistContractId')::uuid
        as nutritionist_contract_id
    from jsonb_array_elements(p_interventions) as entry(value)
  )
  select count(*)::integer
  into v_valid_count
  from requested
  join public.staff_contracts as contract
    on contract.id = requested.nutritionist_contract_id
   and contract.team_id = v_context.team_id
   and contract.status = 'active'
  join public.staff_members as member
    on member.id = contract.staff_member_id
   and member.role = 'nutritionist';

  if v_valid_count <> v_requested_count then
    raise exception 'Au moins un nutritionniste sélectionné ne fait pas partie de votre staff actif.';
  end if;

  perform 1
  from public.staff_contracts as contract
  where contract.id in (
    select distinct (entry.value ->> 'nutritionistContractId')::uuid
    from jsonb_array_elements(p_interventions) as entry(value)
  )
  order by contract.id
  for update;

  if exists (
    select 1
    from jsonb_array_elements(p_interventions) as entry(value)
    join public.staff_contracts as contract
      on contract.id = (entry.value ->> 'nutritionistContractId')::uuid
    join public.staff_members as member
      on member.id = contract.staff_member_id
    where member.level < case entry.value ->> 'interventionCode'
      when 'recovery_snack' then 1
      when 'tailored_plan' then 3
      else 5
    end
  ) then
    raise exception 'Au moins un nutritionniste ne possède pas le niveau requis pour le complément choisi.';
  end if;

  if exists (
    with requested_usage as (
      select
        (entry.value ->> 'nutritionistContractId')::uuid
          as nutritionist_contract_id,
        count(*)::integer as requested_count
      from jsonb_array_elements(p_interventions) as entry(value)
      group by (entry.value ->> 'nutritionistContractId')::uuid
    )
    select 1
    from requested_usage
    join public.staff_contracts as contract
      on contract.id = requested_usage.nutritionist_contract_id
    join public.staff_members as member
      on member.id = contract.staff_member_id
    where requested_usage.requested_count + (
      select count(*)
      from public.rider_nutrition_interventions as used
      where used.nutritionist_contract_id = requested_usage.nutritionist_contract_id
        and used.season_day_id = v_context.season_day_id
    ) > (
      public.get_nutritionist_daily_capacity(member.level)
      + public.get_staff_contract_talent_flat_bonus(
          contract.id,
          'nutrition_supplement_capacity',
          2
        )
    )
  ) then
    raise exception 'Au moins un nutritionniste a déjà utilisé toute sa capacité aujourd’hui.';
  end if;

  if exists (
    with requested as (
      select (entry.value ->> 'riderId')::uuid as rider_id
      from jsonb_array_elements(p_interventions) as entry(value)
    )
    select 1
    from requested
    left join lateral (
      select condition.form
      from public.rider_condition_states as condition
      join public.season_days as condition_day
        on condition_day.id = condition.season_day_id
      where condition.rider_id = requested.rider_id
        and condition_day.season_id = v_context.season_id
        and condition_day.day_number <= v_context.current_day_number
      order by condition_day.day_number desc, condition.updated_at desc
      limit 1
    ) as latest on true
    where coalesce(latest.form, 75) >= 100
  ) then
    raise exception 'La forme d’au moins un coureur est déjà au maximum.';
  end if;

  with requested as (
    select
      (entry.value ->> 'nutritionistContractId')::uuid
        as nutritionist_contract_id,
      entry.value ->> 'interventionCode' as intervention_code
    from jsonb_array_elements(p_interventions) as entry(value)
  )
  select coalesce(sum(round(public.get_nutritionist_intervention_price(
    contract.id,
    case requested.intervention_code
      when 'recovery_snack' then 500
      when 'tailored_plan' then 1200
      else 2500
    end,
    member.level
  ), 2)), 0)
  into v_total_price
  from requested
  join public.staff_contracts as contract
    on contract.id = requested.nutritionist_contract_id
  join public.staff_members as member
    on member.id = contract.staff_member_id;

  if v_cash_balance < v_total_price then
    raise exception 'La trésorerie de l’équipe est insuffisante pour ces interventions.';
  end if;

  with requested as (
    select
      (entry.value ->> 'riderId')::uuid as rider_id,
      (entry.value ->> 'nutritionistContractId')::uuid
        as nutritionist_contract_id,
      entry.value ->> 'interventionCode' as intervention_code
    from jsonb_array_elements(p_interventions) as entry(value)
  ), enriched as (
    select
      requested.*,
      member.level as nutritionist_level,
      case requested.intervention_code
        when 'recovery_snack' then 3
        when 'tailored_plan' then 5
        else 7
      end as base_form_gain,
      case requested.intervention_code
        when 'recovery_snack' then 500
        when 'tailored_plan' then 1200
        else 2500
      end::numeric as base_price,
      floor((member.level - 1) / 2.0)::integer as level_form_bonus,
      public.get_staff_contract_talent_flat_bonus(
        contract.id,
        'nutrition_supplement_effectiveness',
        1
      ) as talent_form_bonus,
      coalesce(latest.form, 75)::numeric as form_before
    from requested
    join public.staff_contracts as contract
      on contract.id = requested.nutritionist_contract_id
    join public.staff_members as member
      on member.id = contract.staff_member_id
    left join lateral (
      select condition.form
      from public.rider_condition_states as condition
      join public.season_days as condition_day
        on condition_day.id = condition.season_day_id
      where condition.rider_id = requested.rider_id
        and condition_day.season_id = v_context.season_id
        and condition_day.day_number <= v_context.current_day_number
      order by condition_day.day_number desc, condition.updated_at desc
      limit 1
    ) as latest on true
  ), prepared as (
    select
      enriched.*,
      least(
        100 - enriched.form_before,
        enriched.base_form_gain
          + enriched.level_form_bonus
          + enriched.talent_form_bonus
      )::numeric as actual_form_gain,
      round(public.get_nutritionist_intervention_price(
        enriched.nutritionist_contract_id,
        enriched.base_price,
        enriched.nutritionist_level
      ), 2) as price_paid
    from enriched
  )
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
  )
  select
    gen_random_uuid(),
    prepared.rider_id,
    v_context.team_season_id,
    v_context.season_day_id,
    prepared.nutritionist_contract_id,
    prepared.intervention_code,
    prepared.nutritionist_level,
    prepared.base_form_gain,
    prepared.level_form_bonus,
    prepared.actual_form_gain,
    prepared.base_price,
    prepared.price_paid,
    prepared.form_before,
    prepared.form_before + prepared.actual_form_gain
  from prepared;

  -- L'état journalier est mis à la valeur calculée depuis le dernier état connu.
  -- Le verrou d'équipe empêche deux lots nutritionnels concurrents de l'écraser.
  with requested as (
    select (entry.value ->> 'riderId')::uuid as rider_id
    from jsonb_array_elements(p_interventions) as entry(value)
  )
  insert into public.rider_condition_states (
    rider_id,
    season_day_id,
    form,
    fatigue,
    source
  )
  select
    intervention.rider_id,
    v_context.season_day_id,
    intervention.form_after,
    coalesce(latest.fatigue, 0),
    'nutrition'
  from requested
  join public.rider_nutrition_interventions as intervention
    on intervention.rider_id = requested.rider_id
   and intervention.season_day_id = v_context.season_day_id
   and intervention.team_season_id = v_context.team_season_id
  left join lateral (
    select condition.fatigue
    from public.rider_condition_states as condition
    join public.season_days as condition_day
      on condition_day.id = condition.season_day_id
    where condition.rider_id = requested.rider_id
      and condition_day.season_id = v_context.season_id
      and condition_day.day_number <= v_context.current_day_number
    order by condition_day.day_number desc, condition.updated_at desc
    limit 1
  ) as latest on true
  on conflict (rider_id, season_day_id)
  do update set
    form = excluded.form,
    fatigue = public.rider_condition_states.fatigue,
    source = 'nutrition',
    updated_at = now();

  update public.team_seasons as team_season
  set cash_balance = team_season.cash_balance - v_total_price
  where team_season.id = v_context.team_season_id;

  with requested as (
    select (entry.value ->> 'riderId')::uuid as rider_id
    from jsonb_array_elements(p_interventions) as entry(value)
  )
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
  )
  select
    v_context.team_season_id,
    v_context.season_day_id,
    v_context.current_day_number,
    -intervention.price_paid,
    'medical_care',
    'posted',
    case intervention.intervention_code
      when 'recovery_snack' then 'Collation de récupération'
      when 'tailored_plan' then 'Plan nutritionnel personnalisé'
      else 'Recharge haute performance'
    end || ' · ' || member.first_name || ' ' || member.last_name,
    'nutrition-intervention:' || intervention.id::text,
    now()
  from requested
  join public.rider_nutrition_interventions as intervention
    on intervention.rider_id = requested.rider_id
   and intervention.season_day_id = v_context.season_day_id
   and intervention.team_season_id = v_context.team_season_id
  join public.staff_contracts as contract
    on contract.id = intervention.nutritionist_contract_id
  join public.staff_members as member
    on member.id = contract.staff_member_id;

  with requested as (
    select
      (entry.value ->> 'riderId')::uuid as rider_id,
      entry.position
    from jsonb_array_elements(p_interventions) with ordinality
      as entry(value, position)
  )
  select array_agg(intervention.id order by requested.position)
  into v_applied_ids
  from requested
  join public.rider_nutrition_interventions as intervention
    on intervention.rider_id = requested.rider_id
   and intervention.season_day_id = v_context.season_day_id
   and intervention.team_season_id = v_context.team_season_id;

  return v_applied_ids;
end;
$$;

revoke all on function public.apply_current_team_nutrition_interventions(jsonb)
from public, anon;

grant execute on function public.apply_current_team_nutrition_interventions(jsonb)
to authenticated, service_role;

comment on function public.apply_current_team_nutrition_interventions(jsonb) is
  'Applique atomiquement un lot nutritionnel en une écriture groupée et confirme sans nouveau débit une répétition strictement identique.';

notify pgrst, 'reload schema';

commit;
