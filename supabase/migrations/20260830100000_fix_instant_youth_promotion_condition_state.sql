-- Corrige la promotion immédiate d'un junior quand le trigger de création du
-- coureur a déjà initialisé son état de forme pour la journée courante.
-- La fonction reste atomique et l'objet n'est consommé qu'après la promotion.

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
$$;

