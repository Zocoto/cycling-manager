begin;
set local application_name = 'cyclostratege-personality-reroll-20261121';
set local lock_timeout = '500ms';
set local statement_timeout = '8s';

-- This ordinary stock item is also the Christmas boutique's Nouveau chapitre.
-- Do not add it to the random daily reward pool as part of the Christmas work.
insert into public.inventory_catalog_items (
  item_key, name, category, rarity, description, effect_summary,
  effect_payload, icon_key, is_consumable, status
) values (
  'personality-reroll', 'Nouveau chapitre', 'other', 'uncommon',
  'Un nouveau départ pour un coureur de votre équipe. Son caractère actuel est remplacé par un autre caractère tiré au hasard.',
  'Remplace le caractère d’un coureur par un autre caractère aléatoire',
  '{"effectKind":"personality_reroll","level":5}'::jsonb,
  'personality', true, 'active'
)
on conflict (item_key) do update set
  name = excluded.name, category = excluded.category, rarity = excluded.rarity,
  description = excluded.description, effect_summary = excluded.effect_summary,
  effect_payload = excluded.effect_payload, icon_key = excluded.icon_key,
  is_consumable = excluded.is_consumable, status = excluded.status, updated_at = now();

create table public.rider_personality_changes (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_catalog_items(id) on delete restrict,
  team_season_id uuid not null references public.team_seasons(id) on delete restrict,
  from_personality_key text not null,
  to_personality_key text not null,
  applied_at timestamptz not null default now(),
  constraint rider_personality_changes_different check (from_personality_key <> to_personality_key)
);
create index rider_personality_changes_rider_idx
  on public.rider_personality_changes(rider_id, applied_at desc);
alter table public.rider_personality_changes enable row level security;
revoke all on table public.rider_personality_changes from public, anon, authenticated;
grant select on table public.rider_personality_changes to service_role;

create function public.redeem_personality_reroll_reward(p_inventory_id uuid, p_rider_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $redeem$
declare
  v_context record;
  v_stock record;
  v_previous text;
  v_next text;
  v_personalities constant jsonb := '{
    "franc_tireur":"Franc-tireur", "opportuniste":"Opportuniste", "calculateur":"Calculateur",
    "solidaire":"Solidaire", "sociable":"Sociable", "ambitieux":"Ambitieux", "colerique":"Colérique",
    "charismatique":"Charismatique", "assidu":"Assidu", "imprevisible":"Imprévisible", "fonceur":"Fonceur",
    "cooperatif":"Coopératif", "metronome":"Régulier", "tenace":"Tenace", "prudent":"Prudent",
    "fidele":"Fidèle", "mentor":"Mentor", "collectif":"Collectif", "globe_trotteur":"Globe-trotteur",
    "meticuleux":"Méticuleux", "perfectionniste":"Perfectionniste", "force_tranquille":"Force tranquille",
    "discret":"Discret", "franc_parleur":"Franc-parleur", "chambreur":"Chambreur"
  }'::jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Vous devez être connecté.';
  end if;
  if p_inventory_id is null or p_rider_id is null then
    raise exception 'Choisissez un coureur et un Nouveau chapitre.';
  end if;

  select assignment.team_id, team_season.id as team_season_id, season.game_year
  into v_context
  from public.sporting_directors as director
  join public.team_manager_assignments as assignment
    on assignment.sporting_director_id = director.id
    and assignment.role = 'general_manager' and assignment.status = 'active'
  join public.seasons as season on season.status = 'active'
  join public.team_seasons as team_season
    on team_season.team_id = assignment.team_id and team_season.season_id = season.id
    and team_season.status in ('planned', 'active')
  where director.auth_user_id = auth.uid() and director.status = 'active'
  limit 1;
  if v_context is null then
    raise exception 'Aucune équipe active ne correspond au Directeur Sportif.';
  end if;

  -- Serialize the stock before the rider, consistently for concurrent uses.
  select inventory.id, inventory.quantity, catalog.id as inventory_item_id
  into v_stock
  from public.team_item_inventory as inventory
  join public.inventory_catalog_items as catalog
    on catalog.id = inventory.inventory_item_id and catalog.status = 'active'
    and catalog.is_consumable and catalog.item_key = 'personality-reroll'
    and catalog.effect_payload ->> 'effectKind' = 'personality_reroll'
  where inventory.team_season_id = v_context.team_season_id
    and inventory.inventory_item_id = p_inventory_id and inventory.quantity > 0
  for update of inventory;
  if not found then
    raise exception 'Votre équipe ne possède plus de Nouveau chapitre.';
  end if;

  perform 1
  from public.rider_contracts as contract
  join public.seasons as start_season on start_season.id = contract.start_season_id
    and start_season.game_year <= v_context.game_year
  join public.seasons as end_season on end_season.id = contract.end_season_id
    and end_season.game_year >= v_context.game_year
  where contract.rider_id = p_rider_id and contract.team_id = v_context.team_id
    and contract.status = 'active'
  for share of contract;
  if not found then
    raise exception 'Sélectionnez un coureur professionnel de votre équipe.';
  end if;

  select rider.personality_key into v_previous
  from public.riders as rider
  where rider.id = p_rider_id and rider.status = 'active'
  for update of rider;
  if not found or not (v_personalities ? v_previous) then
    raise exception 'Le caractère de ce coureur est indisponible.';
  end if;

  -- Exactly one of the other 24 currently supported characters is selected.
  select option.key into v_next
  from jsonb_each_text(v_personalities) as option
  where option.key <> v_previous
  order by random()
  limit 1;

  update public.riders set personality_key = v_next where id = p_rider_id;
  insert into public.rider_personality_changes (
    rider_id, inventory_item_id, team_season_id, from_personality_key, to_personality_key
  ) values (p_rider_id, v_stock.inventory_item_id, v_context.team_season_id, v_previous, v_next);

  if v_stock.quantity = 1 then
    delete from public.team_item_inventory where id = v_stock.id;
  else
    update public.team_item_inventory
    set quantity = quantity - 1, updated_at = now() where id = v_stock.id;
  end if;

  return jsonb_build_object(
    'fromPersonalityKey', v_previous, 'personalityKey', v_next,
    'message', format('Nouveau chapitre : %s → %s.', v_personalities ->> v_previous, v_personalities ->> v_next)
  );
end;
$redeem$;
revoke all on function public.redeem_personality_reroll_reward(uuid, uuid) from public, anon;
grant execute on function public.redeem_personality_reroll_reward(uuid, uuid) to authenticated;

-- Add the current character to the existing target response, without a new
-- request or changing the eligibility of other consumables.
do $targets$
declare
  v_definition text;
  v_anchor constant text := '        ''potentialSteps'', rider.potential_steps,';
begin
  v_definition := replace(pg_get_functiondef('public.get_current_team_item_target_values()'::regprocedure), chr(13), '');
  if strpos(v_definition, '''personalityKey''') > 0
    or length(v_definition) - length(replace(v_definition, v_anchor, '')) <> length(v_anchor) then
    raise exception 'Unexpected item target definition for character consumable.';
  end if;
  execute replace(v_definition, v_anchor, v_anchor || E'\n        ''personalityKey'', rider.personality_key,');
end;
$targets$;

notify pgrst, 'reload schema';
commit;
