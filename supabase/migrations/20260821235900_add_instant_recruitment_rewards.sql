begin;

-- Deux récompenses de haut niveau : une promotion junior anticipée (N8) et
-- un recrutement de staff sur mesure (N10).
alter table public.daily_reward_catalog
  drop constraint if exists daily_reward_catalog_effect_allowed;
alter table public.daily_reward_catalog
  add constraint daily_reward_catalog_effect_allowed check (
    effect_kind in (
      'form_boost', 'rider_experience', 'rating_boost',
      'training_multiplier', 'scouting_boost', 'equipment',
      'special_ability', 'naturalization', 'wildcard',
      'instant_youth_promotion', 'custom_staff_recruitment'
    )
  );

insert into public.daily_reward_catalog (
  reward_key,
  name,
  description,
  effect_summary,
  importance,
  effect_kind,
  effect_payload,
  icon_key,
  is_active
)
values
  (
    'instant-youth-contract',
    'Contrat Espoir immédiat',
    'Permet à un junior de 17 ans ou plus de quitter immédiatement l’école pour rejoindre l’équipe première, même en cours de saison.',
    'Promotion professionnelle immédiate d’un junior éligible',
    8,
    'instant_youth_promotion',
    '{}'::jsonb,
    'contract',
    true
  ),
  (
    'custom-staff-mandate',
    'Mandat de recrutement sur mesure',
    'Choisissez le métier et la nationalité. Le profil généré reçoit un niveau de 1 à 5 étoiles à chances égales et un talent compatible aléatoire.',
    '1 staff sur mesure · 20 % de chance pour chaque niveau',
    10,
    'custom_staff_recruitment',
    '{"uniformLevelOdds":true,"signingFeeWaived":true}'::jsonb,
    'staff',
    true
  )
on conflict (reward_key) do update set
  name = excluded.name,
  description = excluded.description,
  effect_summary = excluded.effect_summary,
  importance = excluded.importance,
  effect_kind = excluded.effect_kind,
  effect_payload = excluded.effect_payload,
  icon_key = excluded.icon_key,
  is_active = excluded.is_active;

-- Les mêmes objets peuvent être accordés par les objectifs de carrière. Ils
-- utilisent alors l’inventaire générique, mais les mêmes RPC atomiques.
insert into public.inventory_catalog_items (
  item_key,
  name,
  category,
  rarity,
  description,
  effect_summary,
  effect_payload,
  icon_key,
  is_consumable,
  status
)
values
  (
    'instant-youth-contract',
    'Contrat Espoir immédiat',
    'other',
    'rare',
    'Permet à un junior de 17 ans ou plus de rejoindre immédiatement l’équipe première, même en cours de saison.',
    'Promotion professionnelle immédiate d’un junior éligible',
    '{"effectKind":"instant_youth_promotion","level":8}'::jsonb,
    'contract',
    true,
    'active'
  ),
  (
    'custom-staff-mandate',
    'Mandat de recrutement sur mesure',
    'other',
    'epic',
    'Choisissez le métier et la nationalité. Le profil généré reçoit un niveau de 1 à 5 étoiles à chances égales et un talent compatible aléatoire.',
    '1 staff sur mesure · 20 % de chance pour chaque niveau',
    '{"effectKind":"custom_staff_recruitment","level":10,"uniformLevelOdds":true,"signingFeeWaived":true}'::jsonb,
    'staff',
    true,
    'active'
  )
on conflict (item_key) do update set
  name = excluded.name,
  category = excluded.category,
  rarity = excluded.rarity,
  description = excluded.description,
  effect_summary = excluded.effect_summary,
  effect_payload = excluded.effect_payload,
  icon_key = excluded.icon_key,
  is_consumable = excluded.is_consumable,
  status = excluded.status,
  updated_at = now();

-- Une prime nulle est réservée aux signatures offertes par un objet. Les
-- salaires restent strictement positifs et sont toujours planifiés.
alter table public.staff_contracts
  drop constraint if exists staff_contracts_signing_fee_positive,
  drop constraint if exists staff_contracts_signing_fee_non_negative;
alter table public.staff_contracts
  add constraint staff_contracts_signing_fee_non_negative
  check (signing_fee >= 0);

create or replace function public.redeem_instant_youth_promotion_reward(
  p_inventory_id uuid,
  p_academy_rider_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_reward record;
  v_reward_source text := 'daily_reward';
  v_academy public.youth_academy_riders%rowtype;
  v_age integer;
  v_rider_id uuid;
  v_development_team_id uuid;
  v_withdrawn_registration_count integer := 0;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;
  if p_inventory_id is null or p_academy_rider_id is null then
    raise exception 'Sélectionnez un junior et un objet valides.';
  end if;

  perform public.sync_active_season_day();
  perform public.settle_current_team_finances();

  select
    director.id as director_id,
    assignment.team_id,
    season.id as season_id,
    season.game_year,
    coalesce(season.current_day_number, 1)::integer as current_day_number,
    season_day.id as season_day_id,
    team_season.id as team_season_id,
    team_season.currency
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
   and team_season.status in ('planned', 'active')
  join public.season_days as season_day
    on season_day.season_id = season.id
   and season_day.day_number = coalesce(season.current_day_number, 1)
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  perform 1
  from public.team_seasons
  where id = v_context.team_season_id
  for update;

  select inventory.*, catalog.effect_kind, catalog.name as reward_name
  into v_reward
  from public.daily_reward_inventory as inventory
  join public.daily_reward_catalog as catalog
    on catalog.reward_key = inventory.reward_key
   and catalog.is_active
  where inventory.id = p_inventory_id
    and inventory.sporting_director_id = v_context.director_id
  for update of inventory;

  if v_reward is null then
    v_reward_source := 'team_item';
    select
      inventory.id as team_inventory_id,
      inventory.quantity,
      'available'::text as status,
      2147483647::integer as expires_after_game_year,
      catalog.effect_payload ->> 'effectKind' as effect_kind,
      catalog.name as reward_name
    into v_reward
    from public.team_item_inventory as inventory
    join public.inventory_catalog_items as catalog
      on catalog.id = inventory.inventory_item_id
     and catalog.status = 'active'
    where inventory.team_season_id = v_context.team_season_id
      and inventory.inventory_item_id = p_inventory_id
      and inventory.quantity > 0
    for update of inventory;
  end if;

  if v_reward is null
    or v_reward.status <> 'available'
    or v_reward.effect_kind <> 'instant_youth_promotion'
  then
    raise exception 'Ce Contrat Espoir immédiat n’est plus disponible.';
  end if;
  if v_reward.expires_after_game_year < v_context.game_year then
    update public.daily_reward_inventory
    set status = 'expired'
    where id = p_inventory_id;
    raise exception 'Ce cadeau a expiré à la fin de la saison précédente.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('team-roster:' || v_context.team_id::text, 0)
  );

  select academy.*
  into v_academy
  from public.youth_academy_riders as academy
  where academy.id = p_academy_rider_id
    and academy.team_id = v_context.team_id
  for update;

  if v_academy.id is null
    or v_academy.status not in ('active', 'recruited')
  then
    raise exception 'Ce junior ne fait plus partie de votre école de cyclisme.';
  end if;

  v_age := v_context.game_year - v_academy.birth_game_year;
  if v_age < 17 then
    raise exception 'Le Contrat Espoir immédiat est réservé aux juniors de 17 ans ou plus.';
  end if;

  select development_team.id
  into v_development_team_id
  from public.development_teams as development_team
  where development_team.team_id = v_context.team_id
    and development_team.season_id = v_context.season_id
    and development_team.status = 'active'
  limit 1
  for update;

  if v_development_team_id is not null and exists (
    select 1
    from public.development_race_registration_riders as selected
    join public.development_race_registrations as registration
      on registration.id = selected.registration_id
    join public.development_race_editions as edition
      on edition.id = registration.race_edition_id
    where registration.development_team_id = v_development_team_id
      and registration.status = 'registered'
      and selected.academy_rider_id = v_academy.id
      and edition.start_day_number <= v_context.current_day_number
  ) then
    raise exception 'Ce junior dispute actuellement une épreuve de Development Team. Attendez la publication des résultats.';
  end if;

  insert into public.riders (
    country_id,
    first_name,
    last_name,
    status,
    potential_steps
  ) values (
    v_academy.country_id,
    v_academy.first_name,
    v_academy.last_name,
    'active',
    v_academy.potential_steps
  )
  returning id into v_rider_id;

  insert into public.rider_season_ratings (
    rider_id, season_id, age, mountain, hills, flat, time_trial, cobbles,
    sprint, acceleration, downhill, endurance, resistance, recovery,
    breakaway, prologue
  ) values (
    v_rider_id,
    v_context.season_id,
    v_age::smallint,
    least(100, greatest(0, round(34 + v_academy.mountain * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.hills * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.flat * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.time_trial * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.cobbles * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.sprint * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.acceleration * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.downhill * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.endurance * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.resistance * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.recovery * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.breakaway * 8)))::smallint,
    least(100, greatest(0, round(34 + v_academy.prologue * 8)))::smallint
  );

  insert into public.rider_season_summaries (rider_id, season_id)
  values (v_rider_id, v_context.season_id)
  on conflict (rider_id, season_id) do nothing;

  insert into public.rider_condition_states (
    rider_id, season_day_id, form, fatigue, source
  ) values (
    v_rider_id, v_context.season_day_id, 75, 0, 'instant_youth_promotion'
  );

  insert into public.rider_contracts (
    rider_id,
    team_id,
    start_season_id,
    end_season_id,
    salary_per_season,
    currency,
    currency_code,
    status,
    signed_at,
    acquisition_type
  ) values (
    v_rider_id,
    v_context.team_id,
    v_context.season_id,
    v_context.season_id,
    0,
    v_context.currency,
    v_context.currency,
    'active',
    now(),
    'academy'
  );

  update public.youth_academy_riders
  set
    status = 'promoted',
    promotion_game_year = null,
    promoted_rider_id = v_rider_id,
    updated_at = now()
  where id = v_academy.id;

  update public.team_finance_transactions as transaction
  set status = 'cancelled'
  where transaction.status = 'pending'
    and transaction.source_reference like
      'youth-tuition:' || v_academy.id::text || ':%';

  if v_development_team_id is not null then
    delete from public.development_race_registration_riders as selected
    using public.development_race_registrations as registration,
      public.development_race_editions as edition
    where selected.registration_id = registration.id
      and registration.race_edition_id = edition.id
      and registration.development_team_id = v_development_team_id
      and registration.status = 'registered'
      and edition.start_day_number > v_context.current_day_number
      and selected.academy_rider_id = v_academy.id;

    with invalid_registrations as (
      select registration.id
      from public.development_race_registrations as registration
      join public.development_race_editions as edition
        on edition.id = registration.race_edition_id
      where registration.development_team_id = v_development_team_id
        and registration.status = 'registered'
        and edition.start_day_number > v_context.current_day_number
        and (
          select count(*)
          from public.development_race_registration_riders as selected
          where selected.registration_id = registration.id
        ) < edition.selection_minimum
    ),
    withdrawn as (
      update public.development_race_registrations as registration
      set status = 'withdrawn', updated_at = now()
      where registration.id in (
        select invalid_registration.id
        from invalid_registrations as invalid_registration
      )
      returning registration.id
    ),
    cleared_selections as (
      delete from public.development_race_registration_riders as selected
      where selected.registration_id in (
        select withdrawn_registration.id
        from withdrawn as withdrawn_registration
      )
    )
    select count(*)::integer
    into v_withdrawn_registration_count
    from withdrawn;

    delete from public.development_team_roster
    where development_team_id = v_development_team_id
      and academy_rider_id = v_academy.id;
  end if;

  insert into public.youth_development_notifications (
    team_id,
    notification_type,
    title,
    message,
    source_reference
  ) values (
    v_context.team_id,
    'promoted',
    'Promotion immédiate en équipe première',
    v_academy.first_name || ' ' || v_academy.last_name
      || ' rejoint immédiatement l’effectif professionnel grâce au Contrat Espoir.',
    'instant-youth-promotion:' || v_academy.id::text
  )
  on conflict (team_id, source_reference) do nothing;

  if v_reward_source = 'daily_reward' then
    update public.daily_reward_inventory
    set
      status = 'used',
      used_at = now(),
      usage_payload = jsonb_build_object(
        'academyRiderId', v_academy.id,
        'promotedRiderId', v_rider_id
      )
    where id = p_inventory_id;
  elsif v_reward.quantity = 1 then
    delete from public.team_item_inventory
    where id = v_reward.team_inventory_id;
  else
    update public.team_item_inventory
    set quantity = quantity - 1, updated_at = now()
    where id = v_reward.team_inventory_id;
  end if;

  return jsonb_build_object(
    'inventoryId', p_inventory_id,
    'academyRiderId', v_academy.id,
    'riderId', v_rider_id,
    'withdrawnRegistrationCount', v_withdrawn_registration_count,
    'message', concat_ws(' ', v_academy.first_name, v_academy.last_name)
      || ' rejoint immédiatement l’équipe première.'
  );
end;
$$;

create or replace function public.redeem_custom_staff_recruitment_reward(
  p_auth_user_id uuid,
  p_inventory_id uuid,
  p_country_id uuid,
  p_first_name text,
  p_last_name text,
  p_role text,
  p_level integer,
  p_trainer_specialty text default null,
  p_architect_specialty text default null,
  p_talent_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_context record;
  v_reward record;
  v_reward_source text := 'daily_reward';
  v_country record;
  v_talent record;
  v_staff_count integer;
  v_staff_capacity integer;
  v_salary numeric(12, 2);
  v_due_installments integer;
  v_due_salary numeric(12, 2);
  v_projected_budget numeric(14, 2);
  v_staff_member_id uuid;
  v_contract_id uuid;
  v_role_label text;
begin
  if p_auth_user_id is null or p_inventory_id is null then
    raise exception 'La demande de recrutement est invalide.';
  end if;

  select
    director.id as director_id,
    director.experience_points,
    assignment.team_id,
    season.id as season_id,
    season.game_year,
    coalesce(season.current_day_number, 1)::integer as current_day_number,
    team_season.id as team_season_id,
    team_season.cash_balance,
    team_season.currency
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
   and team_season.status in ('planned', 'active')
  where director.auth_user_id = p_auth_user_id
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  perform 1
  from public.team_seasons
  where id = v_context.team_season_id
  for update;

  select inventory.*, catalog.effect_kind
  into v_reward
  from public.daily_reward_inventory as inventory
  join public.daily_reward_catalog as catalog
    on catalog.reward_key = inventory.reward_key
   and catalog.is_active
  where inventory.id = p_inventory_id
    and inventory.sporting_director_id = v_context.director_id
  for update of inventory;

  if v_reward is null then
    v_reward_source := 'team_item';
    select
      inventory.id as team_inventory_id,
      inventory.quantity,
      'available'::text as status,
      2147483647::integer as expires_after_game_year,
      catalog.effect_payload ->> 'effectKind' as effect_kind
    into v_reward
    from public.team_item_inventory as inventory
    join public.inventory_catalog_items as catalog
      on catalog.id = inventory.inventory_item_id
     and catalog.status = 'active'
    where inventory.team_season_id = v_context.team_season_id
      and inventory.inventory_item_id = p_inventory_id
      and inventory.quantity > 0
    for update of inventory;
  end if;

  if v_reward is null
    or v_reward.status <> 'available'
    or v_reward.effect_kind <> 'custom_staff_recruitment'
  then
    raise exception 'Ce Mandat de recrutement n’est plus disponible.';
  end if;
  if v_reward.expires_after_game_year < v_context.game_year then
    update public.daily_reward_inventory
    set status = 'expired'
    where id = p_inventory_id;
    raise exception 'Ce cadeau a expiré à la fin de la saison précédente.';
  end if;

  if p_role not in (
    'trainer', 'scout', 'doctor', 'mechanic', 'community_manager',
    'nutritionist', 'physiotherapist', 'race_preparer', 'architect',
    'research_engineer'
  ) then
    raise exception 'Le métier de staff sélectionné est invalide.';
  end if;
  if p_level not between 1 and 5 then
    raise exception 'Le niveau généré est invalide.';
  end if;
  if nullif(btrim(p_first_name), '') is null
    or nullif(btrim(p_last_name), '') is null
    or char_length(btrim(p_first_name)) > 80
    or char_length(btrim(p_last_name)) > 80
  then
    raise exception 'L’identité générée est invalide.';
  end if;

  if (p_role = 'trainer' and p_trainer_specialty not in (
    'mountain', 'hills', 'flat', 'sprint', 'time_trial', 'cobbles', 'endurance'
  )) or (p_role <> 'trainer' and p_trainer_specialty is not null) then
    raise exception 'La spécialité d’entraîneur générée est invalide.';
  end if;
  if (p_role = 'architect' and p_architect_specialty not in (
    'economist', 'foreman', 'balanced'
  )) or (p_role <> 'architect' and p_architect_specialty is not null) then
    raise exception 'La spécialité d’architecte générée est invalide.';
  end if;

  select country.id, country.name
  into v_country
  from public.countries as country
  where country.id = p_country_id
    and country.is_active;
  if v_country is null then
    raise exception 'La nationalité sélectionnée est invalide.';
  end if;

  select talent.code, talent.display_name, talent.minimum_level
  into v_talent
  from public.staff_talent_catalog as talent
  where talent.code = p_talent_code
    and talent.role = p_role
    and talent.is_active;
  if v_talent is null or p_level < v_talent.minimum_level then
    raise exception 'Le talent généré n’est pas compatible avec ce profil.';
  end if;
  if p_role = 'trainer'
    and p_talent_code = 'trainer_' || p_trainer_specialty
  then
    raise exception 'Le talent généré doit compléter la spécialité principale de l’entraîneur.';
  end if;

  if p_role = 'research_engineer' and not exists (
    select 1
    from public.team_infrastructures
    where team_id = v_context.team_id
      and infrastructure_code = 'research_lab'
      and level >= 1
  ) then
    raise exception 'Construisez le Laboratoire R&D avant de recruter un ingénieur R&D.';
  end if;

  select count(*)::integer
  into v_staff_count
  from public.staff_contracts
  where team_id = v_context.team_id
    and status = 'active';

  v_staff_capacity := public.get_staff_capacity_for_director_level(
    public.calculate_staff_director_level(v_context.experience_points)
  );
  if v_staff_count >= v_staff_capacity then
    raise exception 'Votre niveau de Directeur Sportif limite actuellement le staff à % membre(s).',
      v_staff_capacity;
  end if;

  if p_role = 'nutritionist' and (
    select count(*)
    from public.staff_contracts as contract
    join public.staff_members as member
      on member.id = contract.staff_member_id
     and member.role = 'nutritionist'
    where contract.team_id = v_context.team_id
      and contract.status = 'active'
  ) >= 3 then
    raise exception 'Une équipe ne peut employer que 3 nutritionnistes actifs.';
  end if;

  v_salary := public.calculate_staff_salary(p_role, p_level);
  v_due_installments := least(
    4,
    greatest(0, floor(v_context.current_day_number / 7.0)::integer)
  );
  v_due_salary := case
    when v_due_installments < 4
      then round(v_salary / 4, 2) * v_due_installments
    else v_salary
  end;
  v_projected_budget := public.get_projected_transfer_budget(
    v_context.team_season_id
  );

  if v_context.cash_balance < v_due_salary then
    raise exception 'La trésorerie actuelle ne couvre pas les échéances salariales déjà dues.';
  end if;
  if v_projected_budget < v_salary then
    raise exception 'Le budget projeté ne couvre pas le salaire de la saison.';
  end if;

  insert into public.staff_members (
    country_id,
    first_name,
    last_name,
    role,
    level,
    trainer_specialty,
    architect_specialty
  ) values (
    p_country_id,
    btrim(p_first_name),
    btrim(p_last_name),
    p_role,
    p_level,
    p_trainer_specialty,
    p_architect_specialty
  )
  returning id into v_staff_member_id;

  insert into public.staff_member_talents (
    staff_member_id,
    slot_number,
    talent_code,
    unlocked_by
  ) values (
    v_staff_member_id,
    1,
    p_talent_code,
    'generation'
  );

  insert into public.staff_contracts (
    staff_member_id,
    team_id,
    start_season_id,
    salary_per_season,
    currency_code,
    signing_fee,
    status
  ) values (
    v_staff_member_id,
    v_context.team_id,
    v_context.season_id,
    v_salary,
    v_context.currency,
    0,
    'active'
  )
  returning id into v_contract_id;

  update public.team_finance_transactions as transaction
  set status = 'posted', posted_at = now()
  where transaction.team_season_id = v_context.team_season_id
    and transaction.status = 'pending'
    and transaction.day_number <= v_context.current_day_number
    and transaction.source_reference like
      'staff-contract:' || v_contract_id::text || ':'
      || v_context.season_id::text || ':%';

  update public.team_seasons
  set cash_balance = cash_balance - v_due_salary
  where id = v_context.team_season_id;

  if v_reward_source = 'daily_reward' then
    update public.daily_reward_inventory
    set
      status = 'used',
      used_at = now(),
      usage_payload = jsonb_build_object(
        'staffMemberId', v_staff_member_id,
        'staffContractId', v_contract_id,
        'countryId', p_country_id,
        'role', p_role,
        'level', p_level,
        'talentCode', p_talent_code
      )
    where id = p_inventory_id;
  elsif v_reward.quantity = 1 then
    delete from public.team_item_inventory
    where id = v_reward.team_inventory_id;
  else
    update public.team_item_inventory
    set quantity = quantity - 1, updated_at = now()
    where id = v_reward.team_inventory_id;
  end if;

  v_role_label := case p_role
    when 'trainer' then 'Entraîneur'
    when 'scout' then 'Scout'
    when 'doctor' then 'Médecin'
    when 'mechanic' then 'Mécanicien'
    when 'community_manager' then 'Community manager'
    when 'nutritionist' then 'Nutritionniste'
    when 'physiotherapist' then 'Kiné'
    when 'race_preparer' then 'Préparateur de parcours'
    when 'architect' then 'Architecte'
    else 'Ingénieur R&D'
  end;

  return jsonb_build_object(
    'inventoryId', p_inventory_id,
    'staffMemberId', v_staff_member_id,
    'staffContractId', v_contract_id,
    'level', p_level,
    'talentCode', p_talent_code,
    'message', concat_ws(' ', btrim(p_first_name), btrim(p_last_name))
      || ' rejoint votre staff : ' || v_role_label || ' '
      || p_level::text || '★, ' || v_country.name || ' · '
      || v_talent.display_name || '.'
  );
end;
$$;

-- Deux métriques de composition complètent les objectifs historiques du
-- staff. Elles restent calculées sur les contrats actifs de l'équipe actuelle.
alter function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
  rename to calculate_game_objective_progress_pre_recruitment_rewards;

create or replace function public.calculate_game_objective_progress(
  p_metric_key text,
  p_director_id uuid,
  p_current_team_id uuid,
  p_experience_points numeric
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_value integer;
begin
  case p_metric_key
    when 'active_staff_team_nationality' then
      select count(*)::integer
      into v_value
      from public.staff_contracts as contract
      join public.staff_members as member
        on member.id = contract.staff_member_id
      join public.seasons as season
        on season.status = 'active'
      join public.team_seasons as team_season
        on team_season.team_id = contract.team_id
       and team_season.season_id = season.id
       and team_season.status in ('planned', 'active')
      where contract.team_id = p_current_team_id
        and contract.status = 'active'
        and member.country_id = team_season.registration_country_id;

    when 'active_staff_distinct_roles' then
      select count(distinct member.role)::integer
      into v_value
      from public.staff_contracts as contract
      join public.staff_members as member
        on member.id = contract.staff_member_id
      where contract.team_id = p_current_team_id
        and contract.status = 'active';

    else
      return public.calculate_game_objective_progress_pre_recruitment_rewards(
        p_metric_key,
        p_director_id,
        p_current_team_id,
        p_experience_points
      );
  end case;

  return greatest(coalesce(v_value, 0), 0);
end;
$$;

-- Les deux objets rares bouclent avec des accomplissements de carrière :
-- investir durablement dans les jeunes débloque un recrutement de staff, et
-- bâtir un staff cohérent avec le pays du sponsor ouvre une promotion junior.
insert into public.game_objective_definitions (
  objective_key,
  objective_type,
  objective_group,
  title,
  description,
  metric_key,
  target_value,
  reward_cash,
  reward_experience,
  reward_reputation,
  reward_inventory_item_key,
  reward_equipment_catalog_key,
  reward_random_special_ability,
  display_order,
  is_active
)
values
  (
    'staff_team_nationality_3', 'secondary', 'staff',
    'Un staff aux couleurs du sponsor',
    'Réunir trois membres actifs du staff ayant la nationalité de l’équipe, définie par son sponsor.',
    'active_staff_team_nationality', 3,
    3000, 15, 0, null, null, false, 420, true
  ),
  (
    'staff_team_nationality_6', 'secondary', 'staff',
    'L’école nationale',
    'Réunir six membres actifs du staff ayant la nationalité de l’équipe. Récompense : un Contrat Espoir immédiat.',
    'active_staff_team_nationality', 6,
    12000, 50, 1, 'instant-youth-contract', null, false, 430, true
  ),
  (
    'staff_all_roles', 'secondary', 'staff',
    'L’organigramme idéal',
    'Réunir simultanément les dix métiers de staff. Récompense : un Mandat de recrutement sur mesure.',
    'active_staff_distinct_roles', 10,
    40000, 140, 5, 'custom-staff-mandate', null, false, 440, true
  ),
  (
    'youth_signing_10', 'secondary', 'youth',
    'La décennie des pépites',
    'Accueillir dix juniors au centre de formation. Récompense : un Contrat Espoir immédiat.',
    'youth_academy_signings', 10,
    30000, 110, 4, 'instant-youth-contract', null, false, 1460, true
  ),
  (
    'youth_promotion_10', 'secondary', 'youth',
    'Une filière qui compte',
    'Promouvoir dix juniors dans l’effectif professionnel. Récompense : un Mandat de recrutement sur mesure.',
    'youth_promotions', 10,
    65000, 200, 7, 'custom-staff-mandate', null, false, 1470, true
  )
on conflict (objective_key) do update set
  objective_type = excluded.objective_type,
  objective_group = excluded.objective_group,
  title = excluded.title,
  description = excluded.description,
  metric_key = excluded.metric_key,
  target_value = excluded.target_value,
  reward_cash = excluded.reward_cash,
  reward_experience = excluded.reward_experience,
  reward_reputation = excluded.reward_reputation,
  reward_inventory_item_key = excluded.reward_inventory_item_key,
  reward_equipment_catalog_key = excluded.reward_equipment_catalog_key,
  reward_random_special_ability = excluded.reward_random_special_ability,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  updated_at = now();

revoke all
on function public.redeem_instant_youth_promotion_reward(uuid, uuid)
from public, anon;
grant execute
on function public.redeem_instant_youth_promotion_reward(uuid, uuid)
to authenticated, service_role;

revoke all
on function public.redeem_custom_staff_recruitment_reward(
  uuid, uuid, uuid, text, text, text, integer, text, text, text
)
from public, anon, authenticated;
grant execute
on function public.redeem_custom_staff_recruitment_reward(
  uuid, uuid, uuid, text, text, text, integer, text, text, text
)
to service_role;

revoke all
on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
from public, anon, authenticated;
grant execute
on function public.calculate_game_objective_progress(text, uuid, uuid, numeric)
to service_role;

comment on function public.redeem_instant_youth_promotion_reward(uuid, uuid) is
  'Consomme atomiquement un bonus N8 pour promouvoir immédiatement un junior éligible, avec nettoyage de sa Development Team.';

comment on function public.redeem_custom_staff_recruitment_reward(
  uuid, uuid, uuid, text, text, text, integer, text, text, text
) is
  'RPC service_role atomique : signe gratuitement un staff généré côté serveur tout en conservant salaire, capacité et prérequis.';

notify pgrst, 'reload schema';

commit;
