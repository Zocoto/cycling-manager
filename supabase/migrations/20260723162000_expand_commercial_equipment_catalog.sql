-- ============================================================
-- CYCLING MANAGER
-- Sept équipementiers, quarante références et visuels dédiés.
-- ============================================================

begin;

create table if not exists public.equipment_suppliers (
  supplier_key text primary key,
  name text not null,
  positioning text not null,
  logo_path text not null,
  primary_color text not null,
  secondary_color text not null,
  accent_color text not null,
  display_order integer not null default 100,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_suppliers_status_allowed
    check (status in ('active', 'retired')),
  constraint equipment_suppliers_primary_color_format
    check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint equipment_suppliers_secondary_color_format
    check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint equipment_suppliers_accent_color_format
    check (accent_color ~ '^#[0-9A-Fa-f]{6}$')
);

insert into public.equipment_suppliers (
  supplier_key,
  name,
  positioning,
  logo_path,
  primary_color,
  secondary_color,
  accent_color,
  display_order,
  status
)
values
  (
    'dacatlon-velo',
    'Dacatlon Velo',
    'Le cyclisme accessible : une gamme fiable et lisible dans toutes les familles de matériel.',
    '/images/equipment/brands/dacatlon-velo-logo.webp',
    '#1259D5',
    '#FFD420',
    '#102A56',
    10,
    'active'
  ),
  (
    'aerion-forge',
    'Aerion Forge',
    'Un laboratoire aérodynamique premium dédié à la protection et à la vitesse.',
    '/images/equipment/brands/aerion-forge-logo.webp',
    '#24272B',
    '#C7A55A',
    '#F2F4F5',
    20,
    'active'
  ),
  (
    'montclair-performance',
    'Montclair Performance',
    'Une maison textile à l’élégance française, entre héritage et compétition.',
    '/images/equipment/brands/montclair-performance-logo.webp',
    '#641D2D',
    '#F1E4CB',
    '#B46E42',
    30,
    'active'
  ),
  (
    'novaspoke-engineering',
    'NovaSpoke Engineering',
    'Des roues et composants conçus comme des instruments de précision.',
    '/images/equipment/brands/novaspoke-engineering-logo.webp',
    '#154EC1',
    '#22C9F3',
    '#27364A',
    40,
    'active'
  ),
  (
    'echelon-cycles',
    'Échelon Cycles',
    'Des cadres sobres et durables pour grimper, rouler vite ou viser les grands tours.',
    '/images/equipment/brands/echelon-cycles-logo.webp',
    '#164B3B',
    '#B56E3E',
    '#F3EBDD',
    50,
    'active'
  ),
  (
    'korv-safety-lab',
    'KORV Safety Lab',
    'La sécurité scandinave, fonctionnelle, visible et sans compromis.',
    '/images/equipment/brands/korv-safety-lab-logo.webp',
    '#2C3036',
    '#FF5B55',
    '#E8EDF1',
    60,
    'active'
  ),
  (
    'velocita-corse',
    'Velocita Corse',
    'Une identité de course italienne, expressive et tournée vers l’attaque.',
    '/images/equipment/brands/velocita-corse-logo.webp',
    '#D52924',
    '#F3E5CB',
    '#2A1714',
    70,
    'active'
  )
on conflict (supplier_key) do update set
  name = excluded.name,
  positioning = excluded.positioning,
  logo_path = excluded.logo_path,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  accent_color = excluded.accent_color,
  display_order = excluded.display_order,
  status = excluded.status,
  updated_at = now();

-- Chaque référence historique reçoit désormais sa propre photo produit.
update public.equipment_catalog_items
set
  image_path = '/images/equipment/products/' || catalog_key || '.webp',
  updated_at = now()
where catalog_key in (
  'aerion-stratos-s1',
  'aerion-stratos-pro',
  'aerion-vortex-tt',
  'aerion-prism-clearline',
  'aerion-prism-horizon',
  'aerion-prism-aeroshade',
  'montclair-grip-one',
  'montclair-echappee-signature',
  'montclair-podium-atelier',
  'montclair-endurance-core',
  'montclair-panache-race',
  'montclair-victoire-atelier',
  'montclair-alpine-lace',
  'montclair-ardenne-pulse',
  'montclair-chronos-blade',
  'novaspoke-vent-28',
  'novaspoke-aero-50',
  'novaspoke-pave-35',
  'novaspoke-sprint-65',
  'novaspoke-disc-vector',
  'novaspoke-climb-feather',
  'echelon-altitude-rs',
  'echelon-vitesse-aero',
  'echelon-grand-tour-one'
);

insert into public.equipment_catalog_items (
  catalog_key,
  name,
  slot_type,
  status,
  supplier_key,
  supplier_name,
  description,
  price,
  rarity,
  image_path,
  effect_summary,
  effect_payload
)
select * from (
  values
    (
      'dacatlon-airflow-100',
      'Airflow 100',
      'helmet',
      'active',
      'dacatlon-velo',
      'Dacatlon Velo',
      'Un casque ventilé, visible et rassurant pour débuter la compétition.',
      450,
      'common',
      '/images/equipment/products/dacatlon-airflow-100.webp',
      'Réduit de 3 % le risque de blessure avec abandon après une chute.',
      '{"injuryRiskReductionPct":3}'::jsonb
    ),
    (
      'dacatlon-vision-road-100',
      'Vision Road 100',
      'glasses',
      'active',
      'dacatlon-velo',
      'Dacatlon Velo',
      'Un écran enveloppant simple pour mieux lire la route et les trajectoires.',
      250,
      'common',
      '/images/equipment/products/dacatlon-vision-road-100.webp',
      '+1 DES.',
      '{"ratingBonuses":{"downhill":1}}'::jsonb
    ),
    (
      'dacatlon-grip-100',
      'Grip 100',
      'gloves',
      'active',
      'dacatlon-velo',
      'Dacatlon Velo',
      'Des gants confortables et visibles pour les premières offensives.',
      300,
      'common',
      '/images/equipment/products/dacatlon-grip-100.webp',
      '+0,02 réputation en échappée et lors d’une victoire.',
      '{"breakawayReputationBonus":0.02,"victoryReputationBonus":0.02}'::jsonb
    ),
    (
      'dacatlon-endurance-100',
      'Endurance 100',
      'bib_shorts',
      'active',
      'dacatlon-velo',
      'Dacatlon Velo',
      'Un cuissard tolérant pensé pour accumuler les kilomètres.',
      550,
      'common',
      '/images/equipment/products/dacatlon-endurance-100.webp',
      '+1 RES.',
      '{"ratingBonuses":{"resistance":1}}'::jsonb
    ),
    (
      'dacatlon-climb-100',
      'Climb 100',
      'shoes',
      'active',
      'dacatlon-velo',
      'Dacatlon Velo',
      'Une chaussure robuste dont la souplesse aide dans les bosses.',
      700,
      'common',
      '/images/equipment/products/dacatlon-climb-100.webp',
      '+1 VAL.',
      '{"ratingBonuses":{"hills":1}}'::jsonb
    ),
    (
      'dacatlon-alloy-35-front',
      'Alloy 35 Front',
      'front_wheel',
      'active',
      'dacatlon-velo',
      'Dacatlon Velo',
      'Une roue avant aluminium stable pour les parcours roulants.',
      1800,
      'common',
      '/images/equipment/products/dacatlon-alloy-35-front.webp',
      '+1 PLA.',
      '{"ratingBonuses":{"flat":1}}'::jsonb
    ),
    (
      'dacatlon-drive-35-rear',
      'Drive 35 Rear',
      'rear_wheel',
      'active',
      'dacatlon-velo',
      'Dacatlon Velo',
      'Une roue arrière fiable qui facilite les changements de rythme.',
      2200,
      'common',
      '/images/equipment/products/dacatlon-drive-35-rear.webp',
      '+1 ACC.',
      '{"ratingBonuses":{"acceleration":1}}'::jsonb
    ),
    (
      'dacatlon-route-one-alloy',
      'Route One Alloy',
      'frame',
      'active',
      'dacatlon-velo',
      'Dacatlon Velo',
      'Un cadre aluminium polyvalent qui rend la performance accessible.',
      4800,
      'common',
      '/images/equipment/products/dacatlon-route-one-alloy.webp',
      '+1 END et +1 PLA.',
      '{"ratingBonuses":{"endurance":1,"flat":1}}'::jsonb
    ),
    (
      'korv-halo-s',
      'Halo S',
      'helmet',
      'active',
      'korv-safety-lab',
      'KORV Safety Lab',
      'Une coque nordique enveloppante avec renfort arrière haute visibilité.',
      3200,
      'performance',
      '/images/equipment/products/korv-halo-s.webp',
      'Réduit de 10 % le risque de blessure avec abandon après une chute.',
      '{"injuryRiskReductionPct":10}'::jsonb
    ),
    (
      'korv-isklar-lens',
      'Isklar Lens',
      'glasses',
      'active',
      'korv-safety-lab',
      'KORV Safety Lab',
      'Un écran photochromique clair pour garder des repères dans les descentes.',
      1700,
      'performance',
      '/images/equipment/products/korv-isklar-lens.webp',
      '+1 DES et +1 ACC.',
      '{"ratingBonuses":{"downhill":1,"acceleration":1}}'::jsonb
    ),
    (
      'korv-vinter-grip',
      'Vinter Grip',
      'gloves',
      'active',
      'korv-safety-lab',
      'KORV Safety Lab',
      'Des gants protecteurs très identifiables lors des journées difficiles.',
      1200,
      'performance',
      '/images/equipment/products/korv-vinter-grip.webp',
      '+0,08 réputation en échappée et lors d’une victoire.',
      '{"breakawayReputationBonus":0.08,"victoryReputationBonus":0.08}'::jsonb
    ),
    (
      'korv-base-layer',
      'Base Layer',
      'bib_shorts',
      'active',
      'korv-safety-lab',
      'KORV Safety Lab',
      'Un cuissard compressif qui stabilise le coureur dans la durée.',
      1800,
      'performance',
      '/images/equipment/products/korv-base-layer.webp',
      '+1 RES et +1 REC.',
      '{"ratingBonuses":{"resistance":1,"recovery":1}}'::jsonb
    ),
    (
      'velocita-scatto',
      'Scatto',
      'shoes',
      'active',
      'velocita-corse',
      'Velocita Corse',
      'Une chaussure italienne nerveuse conçue pour jaillir dans les sprints.',
      4400,
      'performance',
      '/images/equipment/products/velocita-scatto.webp',
      '+1 SPR et +1 ACC.',
      '{"ratingBonuses":{"sprint":1,"acceleration":1}}'::jsonb
    ),
    (
      'velocita-lampo-45-front',
      'Lampo 45 Front',
      'front_wheel',
      'active',
      'velocita-corse',
      'Velocita Corse',
      'Une roue avant carbone vive, rapide et encore maniable dans les bosses.',
      9800,
      'performance',
      '/images/equipment/products/velocita-lampo-45-front.webp',
      '+2 PLA et +1 VAL.',
      '{"ratingBonuses":{"flat":2,"hills":1}}'::jsonb
    ),
    (
      'velocita-furia-60-rear',
      'Furia 60 Rear',
      'rear_wheel',
      'active',
      'velocita-corse',
      'Velocita Corse',
      'Une roue arrière profonde qui transforme la puissance en vitesse finale.',
      12800,
      'premium',
      '/images/equipment/products/velocita-furia-60-rear.webp',
      '+2 SPR et +1 PLA.',
      '{"ratingBonuses":{"sprint":2,"flat":1}}'::jsonb
    ),
    (
      'velocita-telaio-rosso-rs',
      'Telaio Rosso RS',
      'frame',
      'active',
      'velocita-corse',
      'Velocita Corse',
      'Un cadre de course sculpté pour attaquer, relancer et plonger dans les descentes.',
      19000,
      'premium',
      '/images/equipment/products/velocita-telaio-rosso-rs.webp',
      '+2 VAL, +2 ACC et +1 DES.',
      '{"ratingBonuses":{"hills":2,"acceleration":2,"downhill":1}}'::jsonb
    )
) as catalog(
  catalog_key,
  name,
  slot_type,
  status,
  supplier_key,
  supplier_name,
  description,
  price,
  rarity,
  image_path,
  effect_summary,
  effect_payload
)
on conflict (catalog_key) do update set
  name = excluded.name,
  slot_type = excluded.slot_type,
  status = excluded.status,
  supplier_key = excluded.supplier_key,
  supplier_name = excluded.supplier_name,
  description = excluded.description,
  price = excluded.price,
  rarity = excluded.rarity,
  image_path = excluded.image_path,
  effect_summary = excluded.effect_summary,
  effect_payload = excluded.effect_payload,
  updated_at = now();

alter table public.equipment_suppliers enable row level security;

grant select on table public.equipment_suppliers to service_role;

notify pgrst, 'reload schema';

commit;
