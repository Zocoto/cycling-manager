begin;

-- Le niveau reste une règle interne de tirage et ne doit pas imposer une étape
-- supplémentaire pour les cadeaux matériels. Ils rejoignent immédiatement
-- l'inventaire général de l'équipe lors de l'ouverture du cadeau.
create or replace function public.claim_current_daily_reward(p_reward_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_context record;
  v_last_claim record;
  v_reward record;
  v_equipment record;
  v_streak integer;
  v_importance integer;
  v_offer_count integer;
  v_claim_id uuid := gen_random_uuid();
  v_inventory_id uuid := gen_random_uuid();
  v_message text;
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
  join public.seasons as season
    on season.status = 'active'
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

  select claim.streak_day, day.day_number
  into v_last_claim
  from public.daily_reward_claims as claim
  join public.season_days as day on day.id = claim.season_day_id
  where claim.sporting_director_id = v_context.director_id
    and claim.season_id = v_context.season_id
  order by day.day_number desc
  limit 1;

  v_streak := case
    when v_last_claim.day_number = v_context.current_day_number - 1
      then least(28, v_last_claim.streak_day + 1)
    else 1
  end;
  v_importance := public.get_daily_reward_importance(v_streak);
  v_offer_count := case when v_importance >= 8 then 3 else 1 end;

  select offer.reward_key, offer.name, offer.effect_kind, offer.effect_payload
  into v_reward
  from (
    select
      catalog.reward_key,
      catalog.name,
      catalog.effect_kind,
      catalog.effect_payload,
      md5(
        catalog.reward_key ||
        v_context.director_id::text ||
        v_context.season_day_id::text
      ) as sort_key
    from public.daily_reward_catalog as catalog
    where catalog.is_active
      and catalog.importance = v_importance
    order by sort_key
    limit v_offer_count
  ) as offer
  where offer.reward_key = p_reward_key;

  if not found then
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

  if v_reward.effect_kind = 'equipment' then
    select item.id, item.name
    into v_equipment
    from public.equipment_catalog_items as item
    where item.status = 'active'
      and item.rarity = coalesce(
        nullif(v_reward.effect_payload ->> 'rarity', ''),
        'common'
      )
    order by md5(item.id::text || v_inventory_id::text)
    limit 1;

    if v_equipment.id is null then
      raise exception 'Aucun équipement compatible n’est disponible dans le catalogue.';
    end if;

    insert into public.team_equipment_inventory (
      team_season_id,
      equipment_item_id,
      quantity,
      last_purchase_price
    ) values (
      v_context.team_season_id,
      v_equipment.id,
      1,
      0
    )
    on conflict (team_season_id, equipment_item_id)
    do update set
      quantity = public.team_equipment_inventory.quantity + 1,
      updated_at = now();

    insert into public.daily_reward_inventory (
      id,
      sporting_director_id,
      team_season_id,
      source_claim_id,
      reward_key,
      status,
      expires_after_game_year,
      used_at,
      usage_payload
    ) values (
      v_inventory_id,
      v_context.director_id,
      v_context.team_season_id,
      v_claim_id,
      p_reward_key,
      'used',
      v_context.game_year + 1,
      now(),
      jsonb_build_object(
        'automatic', true,
        'equipmentItemId', v_equipment.id
      )
    );

    v_message := v_equipment.name || ' a rejoint l’inventaire de l’équipe.';
  else
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

    v_message := 'Cadeau ouvert ! Il a rejoint votre réserve.';
  end if;

  return jsonb_build_object(
    'claimId', v_claim_id,
    'inventoryId', v_inventory_id,
    'streakDay', v_streak,
    'importance', v_importance,
    'message', v_message
  );
end;
$function$;

-- Les anciens cadeaux matériels encore en attente sont rangés au même endroit
-- afin que l'interface et le stock restent cohérents dès le déploiement.
do $migration$
declare
  v_reward record;
  v_equipment record;
begin
  for v_reward in
    select
      inventory.id,
      inventory.team_season_id,
      coalesce(
        nullif(catalog.effect_payload ->> 'rarity', ''),
        'common'
      ) as rarity
    from public.daily_reward_inventory as inventory
    join public.daily_reward_catalog as catalog
      on catalog.reward_key = inventory.reward_key
     and catalog.effect_kind = 'equipment'
    where inventory.status = 'available'
    order by inventory.acquired_at, inventory.id
    for update of inventory
  loop
    select item.id, item.name
    into v_equipment
    from public.equipment_catalog_items as item
    where item.status = 'active'
      and item.rarity = v_reward.rarity
    order by md5(item.id::text || v_reward.id::text)
    limit 1;

    if v_equipment.id is null then
      raise exception
        'Aucun équipement compatible pour le cadeau quotidien %.',
        v_reward.id;
    end if;

    insert into public.team_equipment_inventory (
      team_season_id,
      equipment_item_id,
      quantity,
      last_purchase_price
    ) values (
      v_reward.team_season_id,
      v_equipment.id,
      1,
      0
    )
    on conflict (team_season_id, equipment_item_id)
    do update set
      quantity = public.team_equipment_inventory.quantity + 1,
      updated_at = now();

    update public.daily_reward_inventory
    set
      status = 'used',
      used_at = now(),
      usage_payload = jsonb_build_object(
        'automatic', true,
        'equipmentItemId', v_equipment.id,
        'migrated', true
      )
    where id = v_reward.id;
  end loop;
end;
$migration$;

revoke all
on function public.claim_current_daily_reward(text)
from public, anon;

grant execute
on function public.claim_current_daily_reward(text)
to authenticated;

notify pgrst, 'reload schema';

commit;
