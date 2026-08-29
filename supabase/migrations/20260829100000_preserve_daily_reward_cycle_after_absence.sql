create or replace function public.get_current_daily_reward_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_streak_state record;
  v_claimed_today boolean;
  v_consecutive integer := 0;
  v_prospective integer := 1;
  v_importance integer := 1;
  v_offer_count integer := 1;
  v_offers jsonb := '[]'::jsonb;
  v_inventory jsonb := '[]'::jsonb;
  v_claimed_days jsonb := '[]'::jsonb;
  v_riders jsonb := '[]'::jsonb;
  v_races jsonb := '[]'::jsonb;
  v_abilities jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;

  perform public.sync_active_season_day();

  select
    director.id as director_id,
    assignment.team_id,
    team_season.id as team_season_id,
    season.id as season_id,
    season.name as season_name,
    season.game_year,
    coalesce(season.current_day_number, 1)::integer as current_day_number,
    season_day.id as season_day_id
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

  if v_context is null then return null; end if;

  select state.cycle_day
  into v_streak_state
  from public.daily_reward_streak_states as state
  where state.sporting_director_id = v_context.director_id;

  v_claimed_today := exists (
    select 1 from public.daily_reward_claims as claim
    where claim.sporting_director_id = v_context.director_id
      and claim.season_day_id = v_context.season_day_id
  );

  if v_streak_state is not null then
    v_consecutive := greatest(1, v_streak_state.cycle_day);
  end if;

  v_prospective := case
    when v_claimed_today then greatest(1, coalesce(v_streak_state.cycle_day, 1))
    when v_streak_state is not null
      then public.get_next_daily_reward_cycle_day(v_streak_state.cycle_day)
    else 1
  end;
  v_importance := public.get_daily_reward_importance(v_prospective);
  v_offer_count := case when v_importance >= 8 then 3 else 1 end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key', offer.reward_key,
    'name', offer.name,
    'description', offer.description,
    'effectSummary', offer.effect_summary,
    'importance', offer.importance,
    'effectKind', offer.effect_kind,
    'iconKey', offer.icon_key,
    'payload', offer.effect_payload
  ) order by offer.sort_key), '[]'::jsonb)
  into v_offers
  from (
    select catalog.*, md5(catalog.reward_key || v_context.director_id::text || v_context.season_day_id::text) as sort_key
    from public.daily_reward_catalog as catalog
    where catalog.is_active and catalog.importance = v_importance
    order by sort_key
    limit v_offer_count
  ) as offer;

  select coalesce(jsonb_agg(day.day_number order by day.day_number), '[]'::jsonb)
  into v_claimed_days
  from public.daily_reward_claims as claim
  join public.season_days as day on day.id = claim.season_day_id
  where claim.sporting_director_id = v_context.director_id
    and claim.season_id = v_context.season_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', inventory.id,
    'key', catalog.reward_key,
    'name', catalog.name,
    'description', catalog.description,
    'effectSummary', catalog.effect_summary,
    'importance', catalog.importance,
    'effectKind', catalog.effect_kind,
    'iconKey', catalog.icon_key,
    'payload', catalog.effect_payload,
    'acquiredAt', inventory.acquired_at,
    'expiresAfterGameYear', inventory.expires_after_game_year
  ) order by inventory.acquired_at desc), '[]'::jsonb)
  into v_inventory
  from public.daily_reward_inventory as inventory
  join public.daily_reward_catalog as catalog on catalog.reward_key = inventory.reward_key
  where inventory.sporting_director_id = v_context.director_id
    and inventory.status = 'available'
    and inventory.expires_after_game_year >= v_context.game_year;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', rider.id,
    'name', rider.first_name || ' ' || rider.last_name,
    'countryName', country.name
  ) order by rider.last_name, rider.first_name), '[]'::jsonb)
  into v_riders
  from public.rider_contracts as contract
  join public.riders as rider on rider.id = contract.rider_id and rider.status = 'active'
  join public.countries as country on country.id = rider.country_id
  join public.seasons as start_season on start_season.id = contract.start_season_id
  join public.seasons as end_season on end_season.id = contract.end_season_id
  where contract.team_id = v_context.team_id
    and contract.status = 'active'
    and start_season.game_year <= v_context.game_year
    and end_season.game_year >= v_context.game_year;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', race_option.id,
    'name', race_option.display_name,
    'firstDayNumber', race_option.first_day_number
  ) order by race_option.first_day_number, race_option.display_name), '[]'::jsonb)
  into v_races
  from (
    select edition.id, edition.display_name, min(day.day_number)::integer as first_day_number
    from public.race_editions as edition
    join public.race_categories as category on category.id = edition.race_category_id and category.code = 'elite'
    join public.races as race on race.id = edition.race_id and not race.is_grand_tour
    join public.stages as stage on stage.race_edition_id = edition.id
    join public.season_days as day on day.id = stage.season_day_id
    where edition.season_id = v_context.season_id
      and edition.status not in ('completed', 'cancelled')
    group by edition.id, edition.display_name
    having min(day.day_number) > v_context.current_day_number
  ) as race_option;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', ability.code,
    'name', ability.name,
    'effectSummary', ability.effect_description
  ) order by ability.name), '[]'::jsonb)
  into v_abilities
  from public.special_ability_catalog as ability
  where ability.is_active;

  return jsonb_build_object(
    'seasonId', v_context.season_id,
    'seasonName', v_context.season_name,
    'gameYear', v_context.game_year,
    'currentDayNumber', v_context.current_day_number,
    'claimedToday', v_claimed_today,
    'availableToday', not v_claimed_today,
    'consecutiveDays', v_consecutive,
    'prospectiveStreakDay', v_prospective,
    'importance', v_importance,
    'claimedSeasonDays', v_claimed_days,
    'offers', v_offers,
    'inventory', v_inventory,
    'riders', v_riders,
    'eligibleRaces', v_races,
    'abilities', v_abilities
  );
end;
$$;

create or replace function public.claim_current_daily_reward(p_reward_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_streak_state record;
  v_current_game_day_index integer;
  v_streak integer;
  v_importance integer;
  v_offer_count integer;
  v_claim_id uuid := gen_random_uuid();
  v_inventory_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;
  perform public.sync_active_season_day();

  select
    director.id as director_id,
    assignment.team_id,
    team_season.id as team_season_id,
    season.id as season_id,
    season.game_year,
    coalesce(season.current_day_number, 1)::integer as current_day_number,
    season_day.id as season_day_id
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

  perform pg_advisory_xact_lock(
    hashtextextended('daily-reward:' || v_context.director_id::text, 0)
  );

  if exists (
    select 1
    from public.daily_reward_claims
    where sporting_director_id = v_context.director_id
      and season_day_id = v_context.season_day_id
  ) then
    raise exception 'Le cadeau du jour a déjà été récupéré.';
  end if;

  v_current_game_day_index :=
    (v_context.game_year * 28 + v_context.current_day_number)::integer;

  select state.cycle_day, state.last_claimed_game_day_index
  into v_streak_state
  from public.daily_reward_streak_states as state
  where state.sporting_director_id = v_context.director_id
  for update;

  v_streak := case
    when v_streak_state is not null
      then public.get_next_daily_reward_cycle_day(v_streak_state.cycle_day)
    else 1
  end;
  v_importance := public.get_daily_reward_importance(v_streak);
  v_offer_count := case when v_importance >= 8 then 3 else 1 end;

  if not exists (
    select 1
    from (
      select catalog.reward_key
      from public.daily_reward_catalog as catalog
      where catalog.is_active and catalog.importance = v_importance
      order by md5(
        catalog.reward_key || v_context.director_id::text || v_context.season_day_id::text
      )
      limit v_offer_count
    ) as offer
    where offer.reward_key = p_reward_key
  ) then
    raise exception 'Ce cadeau ne fait pas partie des offres du jour.';
  end if;

  insert into public.daily_reward_claims (
    id,
    sporting_director_id,
    team_season_id,
    season_id,
    season_day_id,
    streak_day,
    importance,
    reward_key
  ) values (
    v_claim_id,
    v_context.director_id,
    v_context.team_season_id,
    v_context.season_id,
    v_context.season_day_id,
    v_streak,
    v_importance,
    p_reward_key
  );

  insert into public.daily_reward_inventory (
    id,
    sporting_director_id,
    team_season_id,
    source_claim_id,
    reward_key,
    expires_after_game_year
  ) values (
    v_inventory_id,
    v_context.director_id,
    v_context.team_season_id,
    v_claim_id,
    p_reward_key,
    v_context.game_year + 1
  );

  insert into public.daily_reward_streak_states (
    sporting_director_id,
    cycle_day,
    last_claimed_game_day_index,
    last_claim_id,
    updated_at
  ) values (
    v_context.director_id,
    v_streak,
    v_current_game_day_index,
    v_claim_id,
    now()
  )
  on conflict (sporting_director_id) do update set
    cycle_day = excluded.cycle_day,
    last_claimed_game_day_index = excluded.last_claimed_game_day_index,
    last_claim_id = excluded.last_claim_id,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'claimId', v_claim_id,
    'inventoryId', v_inventory_id,
    'streakDay', v_streak,
    'importance', v_importance
  );
end;
$$;

revoke all on function public.get_current_daily_reward_overview() from public, anon;
revoke all on function public.claim_current_daily_reward(text) from public, anon;
grant execute on function public.get_current_daily_reward_overview() to authenticated, service_role;
grant execute on function public.claim_current_daily_reward(text) to authenticated, service_role;

comment on function public.get_current_daily_reward_overview() is
  'État du cycle de cadeaux quotidiens, conservé même après une ou plusieurs journées d’absence.';
comment on function public.claim_current_daily_reward(text) is
  'Récupère le prochain cadeau du cycle sans remettre la progression à zéro après une absence.';

notify pgrst, 'reload schema';
