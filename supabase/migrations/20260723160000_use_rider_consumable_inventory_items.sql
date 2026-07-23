-- ============================================================
-- Objets consommables attribuables aux coureurs.
-- Capacités, potentiel et statistiques deviennent permanents.
-- ============================================================

begin;

create table public.rider_consumable_item_applications (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null
    references public.riders(id)
    on delete cascade,
  inventory_item_id uuid not null
    references public.inventory_catalog_items(id)
    on delete restrict,
  team_season_id uuid not null
    references public.team_seasons(id)
    on delete restrict,
  category text not null,
  item_name text not null,
  effect_summary text not null,
  ability_code text,
  potential_bonus smallint,
  rating_key text,
  rating_bonus smallint,
  applied_at timestamptz not null default now(),

  constraint rider_consumable_item_applications_category_allowed
    check (category in ('special_ability', 'potential_boost', 'rating_boost')),
  constraint rider_consumable_item_applications_name_not_empty
    check (btrim(item_name) <> ''),
  constraint rider_consumable_item_applications_effect_not_empty
    check (btrim(effect_summary) <> ''),
  constraint rider_consumable_item_applications_rating_key_allowed
    check (
      rating_key is null
      or rating_key in (
        'mountain', 'hills', 'flat', 'time_trial', 'cobbles',
        'sprint', 'acceleration', 'downhill', 'endurance',
        'resistance', 'recovery', 'breakaway', 'prologue'
      )
    ),
  constraint rider_consumable_item_applications_effect_consistent
    check (
      (
        category = 'special_ability'
        and ability_code is not null
        and potential_bonus is null
        and rating_key is null
        and rating_bonus is null
      )
      or (
        category = 'potential_boost'
        and ability_code is null
        and potential_bonus is not null
        and potential_bonus > 0
        and rating_key is null
        and rating_bonus is null
      )
      or (
        category = 'rating_boost'
        and ability_code is null
        and potential_bonus is null
        and rating_key is not null
        and rating_bonus is not null
        and rating_bonus > 0
      )
    )
);

create index rider_consumable_item_applications_rider_idx
  on public.rider_consumable_item_applications (rider_id, applied_at desc);

create index rider_consumable_item_applications_team_season_idx
  on public.rider_consumable_item_applications (team_season_id, applied_at desc);

create or replace function public.use_current_team_inventory_item(
  p_rider_id uuid,
  p_inventory_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context record;
  v_item record;
  v_inventory record;
  v_application_id uuid := gen_random_uuid();
  v_ability_code text;
  v_potential_bonus integer;
  v_rating_key text;
  v_rating_bonus integer;
  v_applied_bonus integer;
  v_current_value integer;
begin
  if p_rider_id is null or p_inventory_item_id is null then
    raise exception 'Le coureur et l''objet sont obligatoires.';
  end if;

  select
    team_season.id as team_season_id,
    team_season.team_id,
    season.id as season_id
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
  where director.auth_user_id = auth.uid()
    and director.status = 'active'
  limit 1;

  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  if not exists (
    select 1
    from public.rider_contracts as contract
    where contract.rider_id = p_rider_id
      and contract.team_id = v_context.team_id
      and contract.status = 'active'
  ) then
    raise exception 'Vous ne pouvez attribuer un objet qu''à un coureur de votre équipe.';
  end if;

  select
    item.id,
    item.name,
    item.category,
    item.effect_summary,
    item.effect_payload
  into v_item
  from public.inventory_catalog_items as item
  where item.id = p_inventory_item_id
    and item.status = 'active'
    and item.is_consumable = true
  for share;

  if v_item is null then
    raise exception 'Cet objet consommable est indisponible.';
  end if;

  if v_item.category not in (
    'special_ability',
    'potential_boost',
    'rating_boost'
  ) then
    raise exception 'Cet objet ne peut pas être attribué à un coureur.';
  end if;

  select inventory.id, inventory.quantity
  into v_inventory
  from public.team_item_inventory as inventory
  where inventory.team_season_id = v_context.team_season_id
    and inventory.inventory_item_id = v_item.id
  for update;

  if v_inventory is null or v_inventory.quantity < 1 then
    raise exception 'Votre équipe ne possède plus cet objet.';
  end if;

  if v_item.category = 'special_ability' then
    v_ability_code := nullif(btrim(v_item.effect_payload ->> 'abilityCode'), '');

    if v_ability_code is null or not exists (
      select 1
      from public.special_ability_catalog as ability
      where ability.code = v_ability_code
        and ability.is_active = true
    ) then
      raise exception 'La capacité portée par cet objet est invalide.';
    end if;

    insert into public.rider_special_abilities (
      rider_id,
      ability_code,
      source_type,
      source_reference
    )
    values (
      p_rider_id,
      v_ability_code,
      'inventory_item',
      'inventory-consumption:' || v_application_id::text
    )
    on conflict (rider_id, ability_code) do nothing;

    if not found then
      raise exception 'Ce coureur possède déjà cette capacité spéciale.';
    end if;
  elsif v_item.category = 'potential_boost' then
    v_potential_bonus := (v_item.effect_payload ->> 'potentialBonus')::integer;

    if coalesce(v_potential_bonus, 0) <= 0 then
      raise exception 'Le bonus de potentiel porté par cet objet est invalide.';
    end if;

    select rider.potential_steps
    into v_current_value
    from public.riders as rider
    where rider.id = p_rider_id
    for update;

    if coalesce(v_current_value, 8) >= 8 then
      raise exception 'Ce coureur possède déjà le potentiel maximal.';
    end if;

    if v_current_value + v_potential_bonus > 8 then
      raise exception 'Le potentiel de ce coureur est trop élevé pour appliquer entièrement cet objet.';
    end if;

    v_applied_bonus := v_potential_bonus;

    update public.riders
    set potential_steps = potential_steps + v_applied_bonus
    where id = p_rider_id;
  elsif v_item.category = 'rating_boost' then
    v_rating_key := nullif(btrim(v_item.effect_payload ->> 'ratingKey'), '');
    v_rating_bonus := (v_item.effect_payload ->> 'ratingBonus')::integer;

    if v_rating_key is null
      or v_rating_key not in (
        'mountain', 'hills', 'flat', 'time_trial', 'cobbles',
        'sprint', 'acceleration', 'downhill', 'endurance',
        'resistance', 'recovery', 'breakaway', 'prologue'
      )
      or coalesce(v_rating_bonus, 0) <= 0 then
      raise exception 'Le bonus de statistique porté par cet objet est invalide.';
    end if;

    select case v_rating_key
      when 'mountain' then rating.mountain
      when 'hills' then rating.hills
      when 'flat' then rating.flat
      when 'time_trial' then rating.time_trial
      when 'cobbles' then rating.cobbles
      when 'sprint' then rating.sprint
      when 'acceleration' then rating.acceleration
      when 'downhill' then rating.downhill
      when 'endurance' then rating.endurance
      when 'resistance' then rating.resistance
      when 'recovery' then rating.recovery
      when 'breakaway' then rating.breakaway
      when 'prologue' then rating.prologue
    end
    into v_current_value
    from public.rider_season_ratings as rating
    where rating.rider_id = p_rider_id
      and rating.season_id = v_context.season_id
    for update;

    if v_current_value is null then
      raise exception 'Les statistiques actuelles de ce coureur sont introuvables.';
    end if;

    if v_current_value >= 100 then
      raise exception 'Cette statistique est déjà au maximum pour ce coureur.';
    end if;

    if v_current_value + v_rating_bonus > 100 then
      raise exception 'Cette statistique est trop élevée pour appliquer entièrement ce module.';
    end if;

    v_applied_bonus := v_rating_bonus;

    execute format(
      'update public.rider_season_ratings as rating
       set %1$I = least(100, rating.%1$I + $1),
           updated_at = now()
       where rating.rider_id = $2
         and exists (
           select 1
           from public.seasons as season
           where season.id = rating.season_id
             and season.status in (''active'', ''planned'')
         )',
      v_rating_key
    )
    using v_applied_bonus, p_rider_id;
  end if;

  insert into public.rider_consumable_item_applications (
    id,
    rider_id,
    inventory_item_id,
    team_season_id,
    category,
    item_name,
    effect_summary,
    ability_code,
    potential_bonus,
    rating_key,
    rating_bonus
  )
  values (
    v_application_id,
    p_rider_id,
    v_item.id,
    v_context.team_season_id,
    v_item.category,
    v_item.name,
    v_item.effect_summary,
    v_ability_code,
    case
      when v_item.category = 'potential_boost' then v_applied_bonus
      else null
    end,
    v_rating_key,
    case
      when v_item.category = 'rating_boost' then v_applied_bonus
      else null
    end
  );

  if v_inventory.quantity = 1 then
    delete from public.team_item_inventory
    where id = v_inventory.id;
  else
    update public.team_item_inventory
    set
      quantity = quantity - 1,
      updated_at = now()
    where id = v_inventory.id;
  end if;

  return jsonb_build_object(
    'applicationId', v_application_id,
    'category', v_item.category,
    'itemName', v_item.name,
    'effectSummary', v_item.effect_summary,
    'abilityCode', v_ability_code,
    'potentialBonus',
      case when v_item.category = 'potential_boost' then v_applied_bonus else null end,
    'ratingKey', v_rating_key,
    'ratingBonus',
      case when v_item.category = 'rating_boost' then v_applied_bonus else null end
  );
exception
  when invalid_text_representation then
    raise exception 'Les données d''effet de cet objet sont invalides.';
end;
$$;

alter table public.rider_consumable_item_applications enable row level security;

grant select, insert, update, delete
  on table public.rider_consumable_item_applications
  to service_role;

revoke all
  on function public.use_current_team_inventory_item(uuid, uuid)
  from public, anon;

grant execute
  on function public.use_current_team_inventory_item(uuid, uuid)
  to authenticated;

comment on table public.rider_consumable_item_applications is
  'Historique permanent des objets consommés au bénéfice d''un coureur.';

comment on function public.use_current_team_inventory_item(uuid, uuid) is
  'Consomme atomiquement un objet de l''équipe et applique son effet permanent au coureur choisi.';

notify pgrst, 'reload schema';

commit;
