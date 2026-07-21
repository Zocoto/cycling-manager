-- ============================================================
-- Inventaire générique de l'équipe
-- Le matériel conserve son stock spécialisé et est agrégé côté application.
-- ============================================================

begin;

create table public.inventory_catalog_items (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  name text not null,
  category text not null,
  rarity text not null default 'common',
  description text not null default '',
  effect_summary text not null default '',
  effect_payload jsonb not null default '{}'::jsonb,
  icon_key text not null default 'object',
  is_consumable boolean not null default true,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint inventory_catalog_items_key_not_empty
    check (btrim(item_key) <> ''),
  constraint inventory_catalog_items_name_not_empty
    check (btrim(name) <> ''),
  constraint inventory_catalog_items_category_allowed
    check (category in (
      'special_ability',
      'potential_boost',
      'rating_boost',
      'other'
    )),
  constraint inventory_catalog_items_rarity_allowed
    check (rarity in ('common', 'uncommon', 'rare', 'epic')),
  constraint inventory_catalog_items_status_allowed
    check (status in ('active', 'maintenance', 'retired')),
  constraint inventory_catalog_items_effect_object
    check (jsonb_typeof(effect_payload) = 'object')
);

create table public.team_item_inventory (
  id uuid primary key default gen_random_uuid(),
  team_season_id uuid not null
    references public.team_seasons(id)
    on delete cascade,
  inventory_item_id uuid not null
    references public.inventory_catalog_items(id)
    on delete restrict,
  quantity integer not null default 1,
  acquisition_source text,
  acquired_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint team_item_inventory_quantity_positive
    check (quantity > 0),
  constraint team_item_inventory_source_not_empty
    check (acquisition_source is null or btrim(acquisition_source) <> ''),
  constraint team_item_inventory_unique
    unique (team_season_id, inventory_item_id)
);

create index team_item_inventory_team_idx
  on public.team_item_inventory (team_season_id);

insert into public.inventory_catalog_items (
  item_key,
  name,
  category,
  rarity,
  description,
  effect_summary,
  effect_payload,
  icon_key,
  is_consumable
)
values
  (
    'medallion-sandwich-man',
    'Médaillon Homme Sandwich',
    'special_ability',
    'rare',
    'Un médaillon à attribuer à un coureur pour lui transmettre la capacité Homme Sandwich.',
    'Débloque définitivement la capacité Homme Sandwich.',
    '{"abilityCode":"sandwich_man"}'::jsonb,
    'medallion',
    true
  ),
  (
    'medallion-panache',
    'Médaillon Panache',
    'special_ability',
    'epic',
    'Une récompense prestigieuse destinée aux coureurs les plus audacieux.',
    'Débloque définitivement la capacité Panache.',
    '{"abilityCode":"panache"}'::jsonb,
    'medallion',
    true
  ),
  (
    'potential-notebook',
    'Carnet de progression',
    'potential_boost',
    'epic',
    'Un programme individuel qui ouvre une nouvelle marge de progression.',
    '+1 potentiel au coureur sélectionné.',
    '{"potentialBonus":1}'::jsonb,
    'potential',
    true
  ),
  (
    'acceleration-focus',
    'Module explosivité',
    'rating_boost',
    'uncommon',
    'Une séance ciblée pour améliorer la capacité à changer de rythme.',
    '+1 ACC au coureur sélectionné.',
    '{"ratingKey":"acceleration","ratingBonus":1}'::jsonb,
    'rating',
    true
  ),
  (
    'mountain-focus',
    'Module haute montagne',
    'rating_boost',
    'rare',
    'Un bloc d’entraînement spécifique destiné aux grimpeurs.',
    '+1 MON au coureur sélectionné.',
    '{"ratingKey":"mountain","ratingBonus":1}'::jsonb,
    'rating',
    true
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
  status = 'active',
  updated_at = now();

alter table public.inventory_catalog_items enable row level security;
alter table public.team_item_inventory enable row level security;

grant select on table public.inventory_catalog_items to service_role;
grant all privileges on table public.team_item_inventory to service_role;

comment on table public.inventory_catalog_items is
  'Référentiel des objets génériques accordant capacités, potentiel ou statistiques.';
comment on table public.team_item_inventory is
  'Stock générique d’objets possédé par une équipe pour une saison.';

notify pgrst, 'reload schema';

commit;
