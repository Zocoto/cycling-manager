-- ============================================================
-- CYCLING MANAGER
-- Rééquilibrage du matériel et extension à 64 références.
-- ============================================================

begin;

-- Les références ci-dessous avaient soit un effet strictement dupliqué à un
-- prix différent, soit un palier premium trop proche du modèle précédent.
update public.equipment_catalog_items as item
set
  price = balanced.price,
  rarity = balanced.rarity,
  effect_summary = balanced.effect_summary,
  effect_payload = balanced.effect_payload,
  updated_at = now()
from (
  values
    ('aerion-prism-clearline', 900, 'common', '+1 DES et +1 RES.', '{"ratingBonuses":{"downhill":1,"resistance":1}}'::jsonb),
    ('korv-isklar-lens', 1700, 'performance', '+2 DES.', '{"ratingBonuses":{"downhill":2}}'::jsonb),
    ('aerion-prism-horizon', 2700, 'performance', '+1 DES, +1 ACC et +1 PLA.', '{"ratingBonuses":{"downhill":1,"acceleration":1,"flat":1}}'::jsonb),
    ('aerion-prism-aeroshade', 5200, 'premium', '+2 PLA, +2 CLM et +1 ACC.', '{"ratingBonuses":{"flat":2,"timeTrial":2,"acceleration":1}}'::jsonb),
    ('montclair-alpine-lace', 2800, 'performance', '+2 MON.', '{"ratingBonuses":{"mountain":2}}'::jsonb),
    ('montclair-ardenne-pulse', 5200, 'performance', '+2 VAL et +1 ACC.', '{"ratingBonuses":{"hills":2,"acceleration":1}}'::jsonb),
    ('velocita-lampo-45-front', 9800, 'performance', '+2 PLA, +1 VAL et +1 ACC.', '{"ratingBonuses":{"flat":2,"hills":1,"acceleration":1}}'::jsonb),
    ('novaspoke-aero-50', 11800, 'performance', '+3 PLA et +2 CLM.', '{"ratingBonuses":{"flat":3,"timeTrial":2}}'::jsonb),
    ('novaspoke-pave-35', 15800, 'premium', '+3 PAV et +2 RES.', '{"ratingBonuses":{"cobbles":3,"resistance":2}}'::jsonb),
    ('velocita-furia-60-rear', 12800, 'premium', '+3 SPR et +2 PLA.', '{"ratingBonuses":{"sprint":3,"flat":2}}'::jsonb),
    ('novaspoke-climb-feather', 15000, 'premium', '+3 MON et +2 VAL.', '{"ratingBonuses":{"mountain":3,"hills":2}}'::jsonb)
) as balanced(catalog_key, price, rarity, effect_summary, effect_payload)
where item.catalog_key = balanced.catalog_key;

insert into public.equipment_suppliers (
  supplier_key, name, positioning, logo_path, primary_color,
  secondary_color, accent_color, display_order, status
)
values
  (
    'andes-endurance',
    'Andes Endurance',
    'Une maison colombienne tournée vers l’altitude, la maîtrise en descente et les longues journées.',
    '/images/equipment/brands/andes-endurance-logo.svg',
    '#173B35', '#D9A441', '#F4E9CF', 80, 'active'
  ),
  (
    'kaze-dynamics',
    'Kaze Dynamics',
    'L’aérodynamisme japonais au service des relances, du sprint et des parcours rapides.',
    '/images/equipment/brands/kaze-dynamics-logo.svg',
    '#101D33', '#23B7C9', '#F05A47', 90, 'active'
  ),
  (
    'radian-raceworks',
    'Radian Raceworks',
    'Une gamme de compétition sans compromis, conçue pour les leaders et les objectifs majeurs.',
    '/images/equipment/brands/radian-raceworks-logo.svg',
    '#301A46', '#A96BD6', '#F2D36B', 100, 'active'
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

insert into public.equipment_catalog_items (
  catalog_key, name, slot_type, status, supplier_key, supplier_name,
  description, price, rarity, image_path, effect_summary, effect_payload
)
select * from (values
  ('andes-condor-guard', 'Condor Guard', 'helmet', 'active', 'andes-endurance', 'Andes Endurance', 'Un casque enveloppant pensé pour garder confiance dans les descentes de haute altitude.', 2400, 'performance', '/images/equipment/products/aerion-stratos-s1.webp', 'Réduit de 5 % le risque de blessure après une chute et +1 DES.', '{"injuryRiskReductionPct":5,"ratingBonuses":{"downhill":1}}'::jsonb),
  ('andes-vista-alta', 'Vista Alta', 'glasses', 'active', 'andes-endurance', 'Andes Endurance', 'Un écran contrasté qui préserve les repères et la lucidité lors des longues étapes.', 2200, 'performance', '/images/equipment/products/aerion-prism-clearline.webp', '+1 DES, +1 END et +1 REC.', '{"ratingBonuses":{"downhill":1,"endurance":1,"recovery":1}}'::jsonb),
  ('andes-guante-escapada', 'Guante Escapada', 'gloves', 'active', 'andes-endurance', 'Andes Endurance', 'Des gants distinctifs pour les baroudeurs qui passent la journée devant.', 700, 'common', '/images/equipment/products/montclair-grip-one.webp', '+0,06 réputation en échappée et +0,04 lors d’une victoire.', '{"breakawayReputationBonus":0.06,"victoryReputationBonus":0.04}'::jsonb),
  ('andes-fondo-pro', 'Fondo Pro', 'bib_shorts', 'active', 'andes-endurance', 'Andes Endurance', 'Une assise souple conçue pour mieux enchaîner les journées de montagne.', 1700, 'performance', '/images/equipment/products/montclair-endurance-core.webp', '+1 END et +1 REC.', '{"ratingBonuses":{"endurance":1,"recovery":1}}'::jsonb),
  ('andes-cumbre-carbon', 'Cumbre Carbon', 'shoes', 'active', 'andes-endurance', 'Andes Endurance', 'Une semelle légère et progressive pour grimper sans perdre de précision en descente.', 2500, 'performance', '/images/equipment/products/montclair-alpine-lace.webp', '+1 MON et +1 DES.', '{"ratingBonuses":{"mountain":1,"downhill":1}}'::jsonb),
  ('andes-cumbre-32-front', 'Cumbre 32 Front', 'front_wheel', 'active', 'andes-endurance', 'Andes Endurance', 'Une roue avant basse et docile pour les cols techniques.', 4800, 'performance', '/images/equipment/products/novaspoke-vent-28.webp', '+1 MON et +1 DES.', '{"ratingBonuses":{"mountain":1,"downhill":1}}'::jsonb),
  ('andes-altura-35-rear', 'Altura 35 Rear', 'rear_wheel', 'active', 'andes-endurance', 'Andes Endurance', 'Une roue arrière légère qui aide à répéter les ascensions.', 5200, 'performance', '/images/equipment/products/novaspoke-climb-feather.webp', '+1 MON et +1 REC.', '{"ratingBonuses":{"mountain":1,"recovery":1}}'::jsonb),
  ('andes-cordillera-rs', 'Cordillera RS', 'frame', 'active', 'andes-endurance', 'Andes Endurance', 'Un cadre d’endurance verticale pour les courses par étapes accidentées.', 16500, 'performance', '/images/equipment/products/echelon-altitude-rs.webp', '+2 MON, +2 END et +1 REC.', '{"ratingBonuses":{"mountain":2,"endurance":2,"recovery":1}}'::jsonb),

  ('kaze-fujin-aero', 'Fujin Aero', 'helmet', 'active', 'kaze-dynamics', 'Kaze Dynamics', 'Une coque courte et canalisée qui protège sans brider les relances.', 4200, 'performance', '/images/equipment/products/aerion-vortex-tt.webp', 'Réduit de 7 % le risque de blessure après une chute, +1 PLA et +1 ACC.', '{"injuryRiskReductionPct":7,"ratingBonuses":{"flat":1,"acceleration":1}}'::jsonb),
  ('kaze-shiden-lens', 'Shiden Lens', 'glasses', 'active', 'kaze-dynamics', 'Kaze Dynamics', 'Un écran panoramique optimisé pour lire les ouvertures à haute vitesse.', 3600, 'performance', '/images/equipment/products/aerion-prism-aeroshade.webp', '+2 ACC et +2 PLA.', '{"ratingBonuses":{"acceleration":2,"flat":2}}'::jsonb),
  ('kaze-attack-grip', 'Attack Grip', 'gloves', 'active', 'kaze-dynamics', 'Kaze Dynamics', 'Une finition spectaculaire destinée aux attaquants et aux finisseurs.', 2600, 'performance', '/images/equipment/products/montclair-echappee-signature.webp', '+0,12 réputation en échappée et +0,14 lors d’une victoire.', '{"breakawayReputationBonus":0.12,"victoryReputationBonus":0.14}'::jsonb),
  ('kaze-ren-compression', 'Ren Compression', 'bib_shorts', 'active', 'kaze-dynamics', 'Kaze Dynamics', 'Une compression ciblée pour résister aux changements de rythme répétés.', 2900, 'performance', '/images/equipment/products/montclair-panache-race.webp', '+1 END, +1 REC et +1 RES.', '{"ratingBonuses":{"endurance":1,"recovery":1,"resistance":1}}'::jsonb),
  ('kaze-raijin-sprint', 'Raijin Sprint', 'shoes', 'active', 'kaze-dynamics', 'Kaze Dynamics', 'Une chaussure rigide qui transforme instantanément l’appui en accélération.', 5600, 'performance', '/images/equipment/products/velocita-scatto.webp', '+2 ACC et +1 SPR.', '{"ratingBonuses":{"acceleration":2,"sprint":1}}'::jsonb),
  ('kaze-hayate-58-front', 'Hayate 58 Front', 'front_wheel', 'active', 'kaze-dynamics', 'Kaze Dynamics', 'Un profil haut et stable pour maintenir la vitesse puis relancer.', 9200, 'performance', '/images/equipment/products/velocita-lampo-45-front.webp', '+2 PLA, +1 ACC et +1 CLM.', '{"ratingBonuses":{"flat":2,"acceleration":1,"timeTrial":1}}'::jsonb),
  ('kaze-kaminari-70-rear', 'Kaminari 70 Rear', 'rear_wheel', 'active', 'kaze-dynamics', 'Kaze Dynamics', 'Une roue arrière profonde et explosive pour les arrivées rapides.', 14000, 'premium', '/images/equipment/products/velocita-furia-60-rear.webp', '+2 SPR, +2 ACC et +1 PLA.', '{"ratingBonuses":{"sprint":2,"acceleration":2,"flat":1}}'::jsonb),
  ('kaze-kosoku-rx', 'Kōsoku RX', 'frame', 'active', 'kaze-dynamics', 'Kaze Dynamics', 'Une plateforme aéro nerveuse pour imposer un rythme élevé et sprinter.', 28500, 'premium', '/images/equipment/products/echelon-vitesse-aero.webp', '+3 PLA, +2 ACC et +2 SPR.', '{"ratingBonuses":{"flat":3,"acceleration":2,"sprint":2}}'::jsonb),

  ('radian-sentinel-x', 'Sentinel X', 'helmet', 'active', 'radian-raceworks', 'Radian Raceworks', 'Une protection premium développée pour les leaders les plus exposés.', 6000, 'premium', '/images/equipment/products/aerion-stratos-pro.webp', 'Réduit de 15 % le risque de blessure avec abandon après une chute.', '{"injuryRiskReductionPct":15}'::jsonb),
  ('radian-sector-lens', 'Sector Lens', 'glasses', 'active', 'radian-raceworks', 'Radian Raceworks', 'Une optique de course précise pour les descentes et les secteurs cassants.', 4200, 'premium', '/images/equipment/products/aerion-prism-horizon.webp', '+2 DES, +1 PAV et +1 RES.', '{"ratingBonuses":{"downhill":2,"cobbles":1,"resistance":1}}'::jsonb),
  ('radian-leader-grip', 'Leader Grip', 'gloves', 'active', 'radian-raceworks', 'Radian Raceworks', 'Le modèle signature réservé aux coureurs qui jouent les premiers rôles.', 5200, 'premium', '/images/equipment/products/montclair-podium-atelier.webp', '+0,18 réputation en échappée et +0,24 lors d’une victoire.', '{"breakawayReputationBonus":0.18,"victoryReputationBonus":0.24}'::jsonb),
  ('radian-grand-tour-bib', 'Grand Tour Bib', 'bib_shorts', 'active', 'radian-raceworks', 'Radian Raceworks', 'Une pièce haut de gamme pour conserver fraîcheur et résistance sur trois semaines.', 5900, 'premium', '/images/equipment/products/montclair-victoire-atelier.webp', '+2 END, +2 REC et +1 RES.', '{"ratingBonuses":{"endurance":2,"recovery":2,"resistance":1}}'::jsonb),
  ('radian-summit-carbon', 'Summit Carbon', 'shoes', 'active', 'radian-raceworks', 'Radian Raceworks', 'Une semelle ultra-rigide destinée aux purs grimpeurs et puncheurs.', 8200, 'premium', '/images/equipment/products/montclair-chronos-blade.webp', '+3 MON et +1 VAL.', '{"ratingBonuses":{"mountain":3,"hills":1}}'::jsonb),
  ('radian-vector-45-front', 'Vector 45 Front', 'front_wheel', 'active', 'radian-raceworks', 'Radian Raceworks', 'Une roue avant premium qui reste rapide, stable et solide sous pression.', 13500, 'premium', '/images/equipment/products/novaspoke-pave-35.webp', '+2 PLA, +2 DES et +1 RES.', '{"ratingBonuses":{"flat":2,"downhill":2,"resistance":1}}'::jsonb),
  ('radian-torque-lite-rear', 'Torque Lite Rear', 'rear_wheel', 'active', 'radian-raceworks', 'Radian Raceworks', 'Une roue arrière légère et réactive pour attaquer sur les reliefs sélectifs.', 16500, 'premium', '/images/equipment/products/novaspoke-disc-vector.webp', '+3 MON, +1 VAL, +1 ACC et +1 DES.', '{"ratingBonuses":{"mountain":3,"hills":1,"acceleration":1,"downhill":1}}'::jsonb),
  ('radian-apex-r8', 'Apex R8', 'frame', 'active', 'radian-raceworks', 'Radian Raceworks', 'Un châssis d’exception pour dominer les reliefs et les descentes décisives.', 33000, 'premium', '/images/equipment/products/echelon-grand-tour-one.webp', '+3 MON, +2 VAL, +2 DES et +1 RES.', '{"ratingBonuses":{"mountain":3,"hills":2,"downhill":2,"resistance":1}}'::jsonb)
) as catalog(
  catalog_key, name, slot_type, status, supplier_key, supplier_name,
  description, price, rarity, image_path, effect_summary, effect_payload
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

-- Deux références actives d’une même catégorie ne doivent plus proposer
-- exactement le même gain sous deux prix ou deux habillages différents.
create unique index if not exists equipment_catalog_active_effect_unique_idx
  on public.equipment_catalog_items (slot_type, md5(effect_payload::text))
  where status = 'active';

commit;
