-- ============================================================
-- Regroupe les cadeaux quotidiens dans l'inventaire visible et permet
-- l'utilisation atomique de plusieurs consommables identiques.
-- ============================================================

begin;

-- Les cadeaux matériels rejoignent immédiatement le stock d'équipement.
-- La ligne quotidienne reste conservée comme trace, déjà marquée utilisée.
create or replace function public.store_daily_reward_equipment_in_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward record;
  v_equipment record;
begin
  select
    catalog.effect_kind,
    coalesce(nullif(catalog.effect_payload ->> 'rarity', ''), 'common') as rarity
  into v_reward
  from public.daily_reward_catalog as catalog
  where catalog.reward_key = new.reward_key;

  if v_reward.effect_kind is distinct from 'equipment' then
    return new;
  end if;

  select item.id, item.name
  into v_equipment
  from public.equipment_catalog_items as item
  where item.status = 'active'
    and item.acquisition_channel = 'commercial'
    and item.rarity = v_reward.rarity
  order by md5(item.id::text || new.id::text)
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
    new.team_season_id,
    v_equipment.id,
    1,
    0
  )
  on conflict (team_season_id, equipment_item_id)
  do update set
    quantity = public.team_equipment_inventory.quantity + 1,
    updated_at = now();

  new.status := 'used';
  new.used_at := now();
  new.usage_payload := jsonb_build_object(
    'automatic', true,
    'equipmentItemId', v_equipment.id
  );

  return new;
end;
$$;

drop trigger if exists store_daily_reward_equipment_in_inventory
  on public.daily_reward_inventory;

create trigger store_daily_reward_equipment_in_inventory
before insert on public.daily_reward_inventory
for each row
execute function public.store_daily_reward_equipment_in_inventory();

-- Répare les cadeaux matériels restés dans la réserve après la refonte du
-- cycle de fidélité. L'opération est idempotente grâce au statut disponible.
do $migration$
declare
  v_reward record;
  v_equipment record;
begin
  for v_reward in
    select
      inventory.id,
      inventory.team_season_id,
      coalesce(nullif(catalog.effect_payload ->> 'rarity', ''), 'common') as rarity
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
      and item.acquisition_channel = 'commercial'
      and item.rarity = v_reward.rarity
    order by md5(item.id::text || v_reward.id::text)
    limit 1;

    if v_equipment.id is null then
      raise exception 'Aucun équipement compatible pour le cadeau quotidien %.',
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

-- Le moteur historique reste l'unité de traitement. La boucle se déroule dans
-- une seule transaction : une erreur annule tous les effets et retraits.
create or replace function public.use_current_team_inventory_items(
  p_rider_id uuid,
  p_inventory_item_id uuid,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_result jsonb;
  v_index integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 1000 then
    raise exception 'La quantité demandée est invalide.';
  end if;

  select item.name, item.category, item.effect_summary
  into v_item
  from public.inventory_catalog_items as item
  where item.id = p_inventory_item_id
    and item.status = 'active'
    and item.is_consumable = true;

  if v_item is null then
    raise exception 'Cet objet consommable est indisponible.';
  end if;

  if v_item.category = 'special_ability' and p_quantity > 1 then
    raise exception 'Une capacité spéciale ne peut être attribuée qu’une fois par utilisation.';
  end if;

  for v_index in 1..p_quantity loop
    v_result := public.use_current_team_inventory_item(
      p_rider_id,
      p_inventory_item_id
    );
  end loop;

  return coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
    'itemName', v_item.name,
    'effectSummary',
      case
        when p_quantity > 1
          then v_item.effect_summary || format(' Effet appliqué %s fois.', p_quantity)
        else v_item.effect_summary
      end,
    'quantityApplied', p_quantity
  );
end;
$$;

revoke all
on function public.use_current_team_inventory_items(uuid, uuid, integer)
from public, anon;

grant execute
on function public.use_current_team_inventory_items(uuid, uuid, integer)
to authenticated;

-- Les lignes quotidiennes restent unitaires pour préserver leur historique et
-- leur expiration, mais plusieurs lignes d'une même récompense sont utilisées
-- ensemble lorsque l'effet est cumulable sur un coureur.
create or replace function public.redeem_current_daily_rewards(
  p_inventory_id uuid,
  p_quantity integer,
  p_rider_id uuid default null,
  p_rating_key text default null,
  p_ability_code text default null,
  p_race_edition_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward record;
  v_inventory_ids uuid[];
  v_inventory_id uuid;
  v_result jsonb;
  v_current_game_year integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 1000 then
    raise exception 'La quantité demandée est invalide.';
  end if;

  select season.game_year
  into v_current_game_year
  from public.seasons as season
  where season.status = 'active'
  limit 1;

  select
    inventory.sporting_director_id,
    inventory.reward_key,
    catalog.name,
    catalog.effect_kind
  into v_reward
  from public.daily_reward_inventory as inventory
  join public.sporting_directors as director
    on director.id = inventory.sporting_director_id
   and director.auth_user_id = auth.uid()
   and director.status = 'active'
  join public.daily_reward_catalog as catalog
    on catalog.reward_key = inventory.reward_key
   and catalog.is_active
  where inventory.id = p_inventory_id
    and inventory.status = 'available'
    and inventory.expires_after_game_year >= v_current_game_year;

  if v_reward is null then
    raise exception 'Ce cadeau n’est plus disponible.';
  end if;

  if v_reward.effect_kind not in (
    'form_boost',
    'rider_experience',
    'rating_boost'
  ) and p_quantity > 1 then
    raise exception 'Ce type de cadeau doit être utilisé un exemplaire à la fois.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'daily-reward-use:' || v_reward.sporting_director_id::text || ':' || v_reward.reward_key,
      0
    )
  );

  select array_agg(candidate.id order by candidate.expires_after_game_year, candidate.acquired_at, candidate.id)
  into v_inventory_ids
  from (
    select
      inventory.id,
      inventory.expires_after_game_year,
      inventory.acquired_at
    from public.daily_reward_inventory as inventory
    where inventory.sporting_director_id = v_reward.sporting_director_id
      and inventory.reward_key = v_reward.reward_key
      and inventory.status = 'available'
      and inventory.expires_after_game_year >= v_current_game_year
    order by inventory.expires_after_game_year, inventory.acquired_at, inventory.id
    limit p_quantity
  ) as candidate;

  if coalesce(cardinality(v_inventory_ids), 0) < p_quantity then
    raise exception 'Le contingent disponible est insuffisant pour cette attribution.';
  end if;

  foreach v_inventory_id in array v_inventory_ids loop
    v_result := public.redeem_current_daily_reward(
      v_inventory_id,
      p_rider_id,
      p_rating_key,
      p_ability_code,
      p_race_edition_id
    );
  end loop;

  if p_quantity = 1 then
    return v_result;
  end if;

  return jsonb_build_object(
    'inventoryId', p_inventory_id,
    'quantityApplied', p_quantity,
    'message', format(
      '%s × %s utilisés : l’effet cumulé a été appliqué.',
      p_quantity,
      v_reward.name
    )
  );
end;
$$;

revoke all
on function public.redeem_current_daily_rewards(uuid, integer, uuid, text, text, uuid)
from public, anon;

grant execute
on function public.redeem_current_daily_rewards(uuid, integer, uuid, text, text, uuid)
to authenticated;

comment on function public.use_current_team_inventory_items(uuid, uuid, integer) is
  'Consomme atomiquement plusieurs objets identiques et cumule leur effet sur un coureur.';

comment on function public.redeem_current_daily_rewards(uuid, integer, uuid, text, text, uuid) is
  'Utilise en lot les lignes disponibles d’une même récompense quotidienne sans perdre leur historique individuel.';

notify pgrst, 'reload schema';

commit;
