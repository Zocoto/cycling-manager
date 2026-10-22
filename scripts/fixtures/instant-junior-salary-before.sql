-- Production function definitions captured read-only, 2026-10-22. No player data.
-- Only salary/promotion logic is replayed inside a disposable PGlite database.

CREATE OR REPLACE FUNCTION public.redeem_instant_youth_promotion_reward(p_inventory_id uuid, p_academy_rider_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      and edition.status = 'planned'
      and edition.start_day_number <= v_context.current_day_number
      and (
        (
          edition.race_format = 'stage_race'
          and edition.end_day_number > v_context.current_day_number
        )
        or not exists (
          select 1
          from public.development_race_results as result
          where result.race_edition_id = edition.id
            and result.academy_rider_id = v_academy.id
            and result.result_scope = 'general'
        )
      )
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
  )
  on conflict (rider_id, season_day_id) do nothing;

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
$function$;

CREATE OR REPLACE FUNCTION public.renew_current_team_rider_until(p_rider_id uuid, p_target_end_game_year integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_context record;
  v_active public.rider_contracts%rowtype;
  v_existing public.rider_contracts%rowtype;
  v_active_end_year integer;
  v_existing_end_year integer;
  v_start_year integer;
  v_start_season_id uuid;
  v_next_season public.seasons%rowtype;
  v_target_season_id uuid;
  v_base_salary numeric;
  v_new_salary numeric;
  v_contract_id uuid;
begin
  if p_rider_id is null or p_target_end_game_year is null then
    raise exception 'La prolongation demandée est invalide.';
  end if;

  select assignment.team_id, season.id as season_id, season.game_year
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
    raise exception 'Aucune équipe active ne correspond au DS.';
  end if;

  -- Serialize two requests for the same rider, including an upgrade of a
  -- one-season renewal already signed by this team.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('rider-renewal:' || p_rider_id::text, 0)
  );

  select contract.*
  into v_active
  from public.rider_contracts as contract
  where contract.rider_id = p_rider_id
    and contract.team_id = v_context.team_id
    and contract.status = 'active'
  for update;

  if v_active is null then
    raise exception 'Ce coureur n’appartient pas à votre équipe.';
  end if;

  select season.game_year into v_active_end_year
  from public.seasons as season
  where season.id = v_active.end_season_id;

  if (v_active_end_year not between v_context.game_year
    and v_context.game_year + 1)
    or p_target_end_game_year <= v_active_end_year
    or p_target_end_game_year > v_context.game_year + 2
  then
    raise exception 'Cette échéance dépasse la limite de deux saisons à venir.';
  end if;

  v_start_year := v_active_end_year + 1;

  select season.* into v_next_season
  from public.seasons as season
  where season.game_year = v_context.game_year + 1
    and exists (
      select 1 from public.season_days as final_day
      where final_day.season_id = season.id
        and final_day.day_number = 28
    );

  if v_next_season.id is null then
    perform public.ensure_transfer_next_season(v_context.season_id);
    select season.* into v_next_season
    from public.seasons as season
    where season.game_year = v_context.game_year + 1;
  end if;

  if v_next_season.id is null then
    raise exception 'La saison suivante n’a pas pu être préparée.';
  end if;

  if p_target_end_game_year = v_next_season.game_year then
    v_target_season_id := v_next_season.id;
  else
    -- Only the season identity is needed for a contract signed two years
    -- ahead. Its calendar is provisioned normally when it becomes S+1.
    insert into public.seasons (
      game_year, name, starts_on, ends_on, status, current_day_number
    ) values (
      v_context.game_year + 2,
      'Saison ' || (v_context.game_year + 2),
      v_next_season.ends_on + 1,
      v_next_season.ends_on + 28,
      'planned',
      1
    ) on conflict (game_year) do nothing;

    select season.id into v_target_season_id
    from public.seasons as season
    where season.game_year = v_context.game_year + 2
      and season.status = 'planned';
  end if;

  if v_target_season_id is null then
    raise exception 'La saison cible n’a pas pu être préparée.';
  end if;

  select contract.* into v_existing
  from public.rider_contracts as contract
  join public.seasons as start_season
    on start_season.id = contract.start_season_id
  where contract.rider_id = p_rider_id
    and contract.team_id = v_context.team_id
    and contract.status = 'planned'
    and contract.acquisition_type = 'renewal'
    and start_season.game_year = v_start_year
  order by contract.signed_at desc nulls last, contract.id
  limit 1
  for update of contract;

  if v_existing.id is not null then
    select season.game_year into v_existing_end_year
    from public.seasons as season
    where season.id = v_existing.end_season_id;

    if v_active_end_year <> v_context.game_year
      or v_existing_end_year <> v_context.game_year + 1
      or p_target_end_game_year <> v_context.game_year + 2
    then
      raise exception 'Le contrat de ce coureur est déjà prolongé.';
    end if;
  end if;

  if exists (
    select 1
    from public.rider_contracts as future
    join public.seasons as start_season
      on start_season.id = future.start_season_id
    join public.seasons as end_season
      on end_season.id = future.end_season_id
    where future.rider_id = p_rider_id
      and future.id <> v_active.id
      and (v_existing.id is null or future.id <> v_existing.id)
      and future.status in ('planned', 'active')
      and start_season.game_year <= p_target_end_game_year
      and end_season.game_year >= v_start_year
  ) then
    raise exception 'Un autre contrat couvre déjà cette période.';
  end if;

  v_base_salary := case
    when v_existing.id is not null then coalesce(
      v_existing.homegrown_salary_before_discount,
      v_existing.roster_management_salary_before_discount,
      v_existing.salary_per_season
    )
    else public.calculate_rider_season_salary(
      p_rider_id, v_next_season.id
    )
  end;

  -- Securing both S+1 and S+2 costs 25% more per season, including when a
  -- previously signed S+1 renewal is upgraded to S+2.
  v_new_salary := case
    when v_active_end_year = v_context.game_year
      and p_target_end_game_year = v_context.game_year + 2
      then round(v_base_salary * (1 + public.rider_two_season_salary_adjustment((select age from public.rider_season_ratings where rider_id=p_rider_id and season_id=v_context.season_id))::numeric / 100), 2)
    else v_base_salary
  end;

  if v_existing.id is not null then
    update public.rider_contracts as contract
    set end_season_id = v_target_season_id,
      salary_per_season = v_new_salary,
      signed_at = now()
    where contract.id = v_existing.id
    returning contract.id into v_contract_id;
  else
    select season.id into v_start_season_id
    from public.seasons as season
    where season.game_year = v_start_year;

    if v_start_season_id is null then
      raise exception 'La saison de début du contrat est introuvable.';
    end if;

    insert into public.rider_contracts (
      rider_id, team_id, start_season_id, end_season_id,
      salary_per_season, currency, currency_code, status,
      signed_at, acquisition_type
    ) values (
      p_rider_id, v_context.team_id, v_start_season_id, v_target_season_id,
      v_new_salary, v_active.currency, v_active.currency_code, 'planned',
      now(), 'renewal'
    )
    on conflict (rider_id, team_id, start_season_id)
    do update set
      end_season_id = excluded.end_season_id,
      salary_per_season = excluded.salary_per_season,
      currency = excluded.currency,
      currency_code = excluded.currency_code,
      status = 'planned',
      signed_at = excluded.signed_at,
      acquisition_type = 'renewal',
      left_season_id = null,
      left_day_number = null
    where rider_contracts.status = 'cancelled'
    returning id into v_contract_id;
  end if;

  if v_contract_id is null then
    raise exception 'Un autre contrat existe déjà pour cette saison.';
  end if;

  return v_contract_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.renew_current_team_rider(p_rider_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_context record;
  v_contract public.rider_contracts%rowtype;
  v_end_year integer;
  v_next_season_id uuid;
  v_salary numeric;
  v_contract_id uuid;
begin
  select assignment.team_id, season.id as season_id, season.game_year
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
   and assignment.role = 'general_manager'
   and assignment.status = 'active'
  join public.seasons as season
    on season.status = 'active'
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au DS.';
  end if;

  select contract.*
  into v_contract
  from public.rider_contracts as contract
  where contract.rider_id = p_rider_id
    and contract.team_id = v_context.team_id
    and contract.status = 'active'
  for update;

  if v_contract is null then
    raise exception 'Ce coureur n’appartient pas à votre équipe.';
  end if;

  select season.game_year
  into v_end_year
  from public.seasons as season
  where season.id = v_contract.end_season_id;

  if v_end_year is null then
    raise exception 'L’échéance du contrat est introuvable.';
  end if;

  if v_end_year > v_context.game_year then
    raise exception 'Ce coureur est déjà sous contrat pour la saison suivante.';
  end if;

  select next_season.id
  into v_next_season_id
  from public.seasons as next_season
  where next_season.game_year = v_context.game_year + 1
    and exists (
      select 1
      from public.season_days as final_day
      where final_day.season_id = next_season.id
        and final_day.day_number = 28
    )
  limit 1;

  if v_next_season_id is null then
    v_next_season_id := public.ensure_transfer_next_season(
      v_context.season_id
    );
  end if;

  if exists (
    select 1
    from public.rider_contracts as successor
    where successor.rider_id = p_rider_id
      and successor.start_season_id = v_next_season_id
      and successor.status in ('planned', 'active')
  ) then
    raise exception 'Le contrat de ce coureur est déjà renouvelé.';
  end if;

  v_salary := public.calculate_rider_season_salary(
    p_rider_id,
    v_next_season_id
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
  )
  values (
    p_rider_id,
    v_context.team_id,
    v_next_season_id,
    v_next_season_id,
    v_salary,
    v_contract.currency,
    v_contract.currency_code,
    'planned',
    now(),
    'renewal'
  )
  on conflict (rider_id, team_id, start_season_id)
  do update set
    end_season_id = excluded.end_season_id,
    salary_per_season = excluded.salary_per_season,
    currency = excluded.currency,
    currency_code = excluded.currency_code,
    status = 'planned',
    signed_at = excluded.signed_at,
    acquisition_type = 'renewal',
    left_season_id = null,
    left_day_number = null
  where rider_contracts.status = 'cancelled'
  returning id into v_contract_id;

  if v_contract_id is null then
    raise exception 'Un autre contrat existe déjà pour cette saison.';
  end if;

  return v_contract_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.apply_homegrown_salary_discount_to_contract()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_is_homegrown_at_team boolean := false;
begin
  if new.salary_per_season <= 0 then
    return new;
  end if;

  if not exists (
    select 1
    from public.seasons as season
    where season.game_year >= 3
      and (season.id = new.start_season_id or season.status = 'active')
  ) then
    return new;
  end if;

  select exists (
    select 1
    from public.rider_special_abilities as ability
    join public.youth_academy_riders as academy
      on academy.promoted_rider_id = ability.rider_id
     and academy.team_id = new.team_id
     and academy.status = 'promoted'
    where ability.rider_id = new.rider_id
      and ability.ability_code = 'homegrown'
  )
  into v_is_homegrown_at_team;

  if v_is_homegrown_at_team then
    if tg_op = 'INSERT' then
      new.homegrown_salary_before_discount := new.salary_per_season;
      new.salary_per_season := round(new.salary_per_season / 2, 2);
    elsif old.homegrown_salary_before_discount is null then
      new.homegrown_salary_before_discount := new.salary_per_season;
      new.salary_per_season := round(new.salary_per_season / 2, 2);
    elsif new.salary_per_season is distinct from old.salary_per_season then
      new.homegrown_salary_before_discount := new.salary_per_season;
      new.salary_per_season := round(new.salary_per_season / 2, 2);
    else
      new.homegrown_salary_before_discount := old.homegrown_salary_before_discount;
    end if;
  elsif tg_op = 'UPDATE'
    and old.homegrown_salary_before_discount is not null
    and (
      new.team_id is distinct from old.team_id
      or new.rider_id is distinct from old.rider_id
      or new.start_season_id is distinct from old.start_season_id
    )
  then
    new.salary_per_season := old.homegrown_salary_before_discount;
    new.homegrown_salary_before_discount := null;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_rider_salary_installments(p_contract_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_contract record;
  v_team_season record;
  v_amount numeric(14, 2);
begin
  select contract.*
  into v_contract
  from public.rider_contracts as contract
  where contract.id = p_contract_id;

  if v_contract is null or v_contract.status <> 'active' then
    update public.team_finance_transactions
    set status = 'cancelled'
    where source_reference like 'rider-salary:' || p_contract_id::text || ':%'
      and status = 'pending';
    return;
  end if;

  for v_team_season in
    select team_season.*
    from public.team_seasons as team_season
    join public.seasons as season on season.id = team_season.season_id
    join public.seasons as start_season on start_season.id = v_contract.start_season_id
    join public.seasons as end_season on end_season.id = v_contract.end_season_id
    where team_season.team_id = v_contract.team_id
      and season.game_year between start_season.game_year and end_season.game_year
  loop
    v_amount := coalesce(v_contract.salary_per_season, 0);

    if v_amount <= 0 then
      continue;
    end if;

    for v_installment in 1..4 loop
      insert into public.team_finance_transactions (
        team_season_id,
        season_day_id,
        day_number,
        amount,
        category,
        status,
        description,
        source_reference
      )
      select
        v_team_season.id,
        day.id,
        v_installment * 7,
        case
          when v_installment < 4 then -round(v_amount / 4, 2)
          else -(v_amount - round(v_amount / 4, 2) * 3)
        end,
        'rider_salary',
        'pending',
        'Salaire de ' || rider.first_name || ' ' || rider.last_name
          || ' · échéance ' || v_installment || '/4',
        'rider-salary:' || p_contract_id::text || ':'
          || v_team_season.season_id::text || ':' || v_installment
      from public.riders as rider
      join public.season_days as day
        on day.season_id = v_team_season.season_id
        and day.day_number = v_installment * 7
      where rider.id = v_contract.rider_id
      on conflict (team_season_id, source_reference)
      do update set
        amount = excluded.amount,
        description = excluded.description,
        season_day_id = excluded.season_day_id,
        status = case
          when team_finance_transactions.status = 'posted'
            then team_finance_transactions.status
          else 'pending'
        end;
    end loop;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_rider_season_salary_quotes(p_rider_ids uuid[], p_season_id uuid)
 RETURNS TABLE(rider_id uuid, salary_per_season numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 with target as (select game_year from public.seasons where id=p_season_id),
 population as (
 select rt.rider_id,coalesce(sm.points,0) as points,
 percent_rank() over(order by coalesce(sm.points,0))::numeric as percentile
 from public.rider_season_ratings rt join public.seasons s on s.id=rt.season_id
 cross join target left join public.rider_season_summaries sm on sm.rider_id=rt.rider_id and sm.season_id=rt.season_id
 where s.game_year=target.game_year-1
 ), requested as (select distinct unnest(coalesce(p_rider_ids,array[]::uuid[])) as id)
 select requested.id,round(greatest(6000,least(400000,
 public.calculate_rider_salary_base(public.calculate_rider_salary_profile_score(coalesce(rating.data,'{}'::jsonb)))
 *public.rider_salary_result_multiplier(population.percentile,population.points)))/500)*500
 from requested cross join target
 left join lateral (select to_jsonb(rt) as data from public.rider_season_ratings rt
 join public.seasons s on s.id=rt.season_id where rt.rider_id=requested.id and s.game_year<=target.game_year
 order by s.game_year desc limit 1) rating on true
 left join population on population.rider_id=requested.id;
 $function$;

CREATE OR REPLACE FUNCTION public.calculate_rider_season_salary(p_rider_id uuid, p_season_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select salary_per_season from public.calculate_rider_season_salary_quotes(array[p_rider_id],p_season_id); $function$;

CREATE OR REPLACE FUNCTION public.apply_data_room_salary_discount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_power numeric;
begin
  if new.salary_per_season <= 0 then return new; end if;
  v_power := public.get_team_specialization_power(
    new.team_id,
    'recruitment_data_room',
    'deal_room'
  );
  if v_power > 0 then
    new.salary_per_season := round(
      new.salary_per_season * (1 - 0.03 * v_power),
      2
    );
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_finance_contract_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_table_name = 'team_sponsor_contracts' then
    perform public.sync_sponsor_installments(new.id);
  elsif tg_table_name = 'rider_contracts' then
    perform public.sync_rider_salary_installments(new.id);
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_rider_contract_joined_day()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_start_season public.seasons%rowtype;
begin
  if new.joined_day_number is not null then
    return new;
  end if;

  select season.*
  into v_start_season
  from public.seasons as season
  where season.id = new.start_season_id;

  new.joined_day_number := case
    when v_start_season.status = 'active' and new.status = 'active'
      then coalesce(v_start_season.current_day_number, 1)
    else 1
  end;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.apply_roster_management_renewal_discount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_gross_salary numeric;
  v_discount numeric;
begin
  if new.acquisition_type <> 'renewal' or new.status <> 'planned' then
    new.roster_management_salary_before_discount := null;
    new.roster_management_discount_percent := 0;
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.salary_per_season is not distinct from old.salary_per_season
    and old.roster_management_salary_before_discount is not null
  then
    return new;
  end if;

  v_gross_salary := new.salary_per_season;
  v_discount := public.get_roster_management_renewal_discount(new.team_id);
  new.roster_management_salary_before_discount := v_gross_salary;
  new.roster_management_discount_percent := v_discount;
  new.salary_per_season := round(v_gross_salary * (1 - v_discount / 100), 2);
  return new;
end;
$function$;

CREATE TRIGGER apply_data_room_salary_discount_trigger BEFORE INSERT ON public.rider_contracts FOR EACH ROW EXECUTE FUNCTION apply_data_room_salary_discount();
CREATE TRIGGER apply_homegrown_salary_discount_before_contract_write BEFORE INSERT OR UPDATE OF rider_id, team_id, start_season_id, salary_per_season ON public.rider_contracts FOR EACH ROW EXECUTE FUNCTION apply_homegrown_salary_discount_to_contract();
CREATE TRIGGER rider_contract_finance_sync AFTER INSERT OR UPDATE OF status, salary_per_season ON public.rider_contracts FOR EACH ROW EXECUTE FUNCTION handle_finance_contract_change();
CREATE TRIGGER set_rider_contract_joined_day BEFORE INSERT ON public.rider_contracts FOR EACH ROW EXECUTE FUNCTION set_rider_contract_joined_day();
CREATE TRIGGER zz_apply_roster_management_renewal_discount BEFORE INSERT OR UPDATE OF salary_per_season, status, acquisition_type, team_id ON public.rider_contracts FOR EACH ROW EXECUTE FUNCTION apply_roster_management_renewal_discount();
