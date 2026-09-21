begin;

-- Les contrats signés contiennent déjà une copie immuable de leur dotation.
-- Ce catalogue ne sert donc qu'aux prochaines signatures. Une empreinte des
-- contrats existants protège explicitement cette non-rétroactivité.
create temporary table federation_equipment_contract_snapshot on commit drop as
select
  contract.id,
  md5(row_to_json(contract)::text) as contract_hash,
  (
    select md5(coalesce(string_agg(
      concat_ws('|', item.slot_type, item.equipment_name,
        item.effect_summary, item.effect_payload::text,
        item.display_order::text),
      ';' order by item.slot_type
    ), ''))
    from public.national_federation_equipment_contract_items as item
    where item.contract_id = contract.id
  ) as items_hash
from public.national_federation_equipment_contracts as contract;

insert into public.national_federation_equipment_offers (
  offer_key, supplier_key, name, description, season_price, display_order,
  status
) values
  ('dacatlon-collectif-national', 'dacatlon-velo', 'Collectif 900',
    'Une dotation accessible, rassurante et réellement polyvalente pour équiper une jeune sélection sans angle mort.', 480000, 10, 'active'),
  ('axiom-union-national', 'axiom-allroad', 'Union National',
    'Un socle tout-terrain qui privilégie la cohérence collective plutôt qu’une seule caractéristique dominante.', 580000, 20, 'active'),
  ('korv-nordic-national', 'korv-safety-lab', 'Nordic Guard',
    'La sécurité et la maîtrise sous pression, avec un ensemble stable sur les reliefs, les pavés et les longues distances.', 680000, 30, 'active'),
  ('montclair-maison-national', 'montclair-performance', 'Maison Tricolore',
    'Une signature textile complète, à l’aise dans les bosses mais suffisamment équilibrée pour accompagner toute la sélection.', 780000, 40, 'active'),
  ('meridian-horizon-national', 'meridian-endurance', 'Horizon Endurance',
    'La régularité sur les courses longues, soutenue par des apports utiles sur chaque grande famille de terrain.', 880000, 50, 'active'),
  ('aerion-equilibre-national', 'aerion-forge', 'Aero Balance',
    'Une base aérodynamique nuancée par du contrôle, de la fraîcheur et de la polyvalence pour ne pas dépendre des seuls chronos.', 980000, 60, 'active'),
  ('sylva-canopy-national', 'sylva-dynamics', 'Canopy Offensive',
    'Une offre vive pour provoquer la course, sans sacrifier les qualités nécessaires lorsque le terrain ou le scénario change.', 1080000, 70, 'active'),
  ('andes-cordillera-national', 'andes-endurance', 'Cordillera Nacional',
    'Une identité d’altitude complétée par de l’endurance, du pilotage et plusieurs solutions pour les parcours moins montagneux.', 1180000, 80, 'active'),
  ('novaspoke-momentum-national', 'novaspoke-engineering', 'Momentum National',
    'Des roues de précision au cœur d’un package complet, rapide mais compétitif aussi sur les reliefs et les secteurs cassants.', 1280000, 90, 'active'),
  ('kernwerk-granit-national', 'kernwerk-cycling', 'Granit Intégral',
    'Une assise robuste pour les classiques difficiles, enrichie de rendement et de polyvalence pour les autres championnats.', 1380000, 100, 'active'),
  ('velocita-squadra-national', 'velocita-corse', 'Squadra Totale',
    'Une dotation italienne offensive : rapide dans les finales, mais construite pour rester crédible sur tous les terrains.', 1480000, 110, 'active'),
  ('brava-fulgor-national', 'brava-sprintworks', 'Fulgor Omnium',
    'Une plateforme nerveuse qui conserve son identité de vitesse tout en apportant de vraies réponses hors des sprints.', 1580000, 120, 'active'),
  ('kaze-hayate-national', 'kaze-dynamics', 'Hayate Sélection',
    'Le rendement et les relances japonaises associés à une dotation complète pour les parcours internationaux variés.', 1680000, 130, 'active'),
  ('echelon-grand-tour-national', 'echelon-cycles', 'Grand Tour Nation',
    'Huit pièces cohérentes pour construire une sélection de classement général sans abandonner les classiques ni les chronos.', 1780000, 140, 'active'),
  ('altura-summit-national', 'altura-forge', 'Summit Complet',
    'Une offre premium orientée vers les reliefs, mais désormais assez profonde pour améliorer toute la sélection.', 1880000, 150, 'active'),
  ('vektor-vector-national', 'vektor-aerolab', 'Vector Apex',
    'L’expertise aérodynamique Vektor intégrée à huit pièces couvrant aussi les bosses, les pavés et la récupération.', 1980000, 160, 'active'),
  ('radian-apex-national', 'radian-raceworks', 'Apex Sélection',
    'La dotation la plus complète du marché : protection premium, profondeur technique et bénéfices sur toutes les caractéristiques.', 2120000, 170, 'active')
on conflict (offer_key) do update set
  supplier_key = excluded.supplier_key,
  name = excluded.name,
  description = excluded.description,
  season_price = excluded.season_price,
  display_order = excluded.display_order,
  status = excluded.status,
  updated_at = now();

delete from public.national_federation_equipment_offer_items
where offer_key in (
  'dacatlon-collectif-national', 'axiom-union-national',
  'korv-nordic-national', 'montclair-maison-national',
  'meridian-horizon-national', 'aerion-equilibre-national',
  'sylva-canopy-national', 'andes-cordillera-national',
  'novaspoke-momentum-national', 'kernwerk-granit-national',
  'velocita-squadra-national', 'brava-fulgor-national',
  'kaze-hayate-national', 'echelon-grand-tour-national',
  'altura-summit-national', 'vektor-vector-national',
  'radian-apex-national'
);

insert into public.national_federation_equipment_offer_items (
  offer_key, slot_type, equipment_name, effect_summary, effect_payload,
  display_order
) values
  -- 480 k€ · 4 pièces · 9 points
  ('dacatlon-collectif-national', 'frame', 'Route 900 Fédération', '+1 PLA, +1 END et +1 RES.', '{"ratingBonuses":{"flat":1,"endurance":1,"resistance":1}}', 10),
  ('dacatlon-collectif-national', 'front_wheel', 'Alloy 900 avant', '+1 MON, +1 VAL et +1 DES.', '{"ratingBonuses":{"mountain":1,"hills":1,"downhill":1}}', 20),
  ('dacatlon-collectif-national', 'rear_wheel', 'Drive 900 arrière', '+1 SPR et +1 ACC.', '{"ratingBonuses":{"sprint":1,"acceleration":1}}', 30),
  ('dacatlon-collectif-national', 'helmet', 'Airflow 900 Team', '+1 REC et −3 % de risque de blessure.', '{"ratingBonuses":{"recovery":1},"injuryRiskReductionPct":3}', 40),

  -- 580 k€ · 4 pièces · 11 points
  ('axiom-union-national', 'frame', 'Union Allroad National', '+1 PLA, +1 END et +1 RES.', '{"ratingBonuses":{"flat":1,"endurance":1,"resistance":1}}', 10),
  ('axiom-union-national', 'front_wheel', 'Union 42 avant', '+1 MON, +1 VAL, +1 DES et +1 PAV.', '{"ratingBonuses":{"mountain":1,"hills":1,"downhill":1,"cobbles":1}}', 20),
  ('axiom-union-national', 'rear_wheel', 'Union 45 arrière', '+1 SPR, +1 ACC et +1 BAR.', '{"ratingBonuses":{"sprint":1,"acceleration":1,"breakaway":1}}', 30),
  ('axiom-union-national', 'gloves', 'Union Control', '+1 REC.', '{"ratingBonuses":{"recovery":1}}', 40),

  -- 680 k€ · 5 pièces · 12 points
  ('korv-nordic-national', 'helmet', 'Nordic Guard Pro', '+1 DES, +1 RES et −7 % de risque de blessure.', '{"ratingBonuses":{"downhill":1,"resistance":1},"injuryRiskReductionPct":7}', 10),
  ('korv-nordic-national', 'frame', 'Nordic Stable RS', '+2 END, +1 RES et +1 REC.', '{"ratingBonuses":{"endurance":2,"resistance":1,"recovery":1}}', 20),
  ('korv-nordic-national', 'front_wheel', 'Nordic Track avant', '+1 PAV, +1 PLA et +1 DES.', '{"ratingBonuses":{"cobbles":1,"flat":1,"downhill":1}}', 30),
  ('korv-nordic-national', 'rear_wheel', 'Nordic Route arrière', '+1 MON et +1 VAL.', '{"ratingBonuses":{"mountain":1,"hills":1}}', 40),
  ('korv-nordic-national', 'gloves', 'Nordic Secure Grip', '+1 ACC.', '{"ratingBonuses":{"acceleration":1}}', 50),

  -- 780 k€ · 5 pièces · 14 points
  ('montclair-maison-national', 'frame', 'Maison Sélection', '+2 VAL, +1 MON et +1 END.', '{"ratingBonuses":{"hills":2,"mountain":1,"endurance":1}}', 10),
  ('montclair-maison-national', 'shoes', 'Élan National', '+1 ACC, +1 SPR et +1 VAL.', '{"ratingBonuses":{"acceleration":1,"sprint":1,"hills":1}}', 20),
  ('montclair-maison-national', 'bib_shorts', 'Grande Distance', '+1 END, +1 REC et +1 RES.', '{"ratingBonuses":{"endurance":1,"recovery":1,"resistance":1}}', 30),
  ('montclair-maison-national', 'gloves', 'Panache Grip', '+1 BAR et +1 PAV.', '{"ratingBonuses":{"breakaway":1,"cobbles":1}}', 40),
  ('montclair-maison-national', 'glasses', 'Horizon Tricolore', '+1 DES et +1 PLA.', '{"ratingBonuses":{"downhill":1,"flat":1}}', 50),

  -- 880 k€ · 5 pièces · 16 points
  ('meridian-horizon-national', 'frame', 'Horizon Ultra National', '+2 END, +2 REC et +1 RES.', '{"ratingBonuses":{"endurance":2,"recovery":2,"resistance":1}}', 10),
  ('meridian-horizon-national', 'front_wheel', 'Horizon 45 avant', '+1 PLA, +1 DES et +1 VAL.', '{"ratingBonuses":{"flat":1,"downhill":1,"hills":1}}', 20),
  ('meridian-horizon-national', 'rear_wheel', 'Horizon 48 arrière', '+1 MON, +1 PAV et +1 ACC.', '{"ratingBonuses":{"mountain":1,"cobbles":1,"acceleration":1}}', 30),
  ('meridian-horizon-national', 'bib_shorts', 'Horizon Long Range', '+1 END et +1 REC.', '{"ratingBonuses":{"endurance":1,"recovery":1}}', 40),
  ('meridian-horizon-national', 'helmet', 'Horizon Multi', '+1 SPR, +1 BAR et +1 CLM.', '{"ratingBonuses":{"sprint":1,"breakaway":1,"timeTrial":1}}', 50),

  -- 980 k€ · 5 pièces · 18 points
  ('aerion-equilibre-national', 'frame', 'Aero Balance R1', '+2 PLA, +2 CLM et +1 PRL.', '{"ratingBonuses":{"flat":2,"timeTrial":2,"prologue":1}}', 10),
  ('aerion-equilibre-national', 'front_wheel', 'Aero Balance 48 avant', '+1 DES, +1 VAL et +1 PAV.', '{"ratingBonuses":{"downhill":1,"hills":1,"cobbles":1}}', 20),
  ('aerion-equilibre-national', 'rear_wheel', 'Aero Balance 55 arrière', '+1 SPR, +2 ACC et +1 END.', '{"ratingBonuses":{"sprint":1,"acceleration":2,"endurance":1}}', 30),
  ('aerion-equilibre-national', 'helmet', 'Stratos Nation', '+1 CLM, +1 REC et −6 % de risque de blessure.', '{"ratingBonuses":{"timeTrial":1,"recovery":1},"injuryRiskReductionPct":6}', 40),
  ('aerion-equilibre-national', 'glasses', 'Prism Sélection', '+1 PLA, +1 BAR, +1 RES et +1 MON.', '{"ratingBonuses":{"flat":1,"breakaway":1,"resistance":1,"mountain":1}}', 50),

  -- 1,08 M€ · 6 pièces · 20 points
  ('sylva-canopy-national', 'frame', 'Canopy Attack National', '+3 VAL, +1 ACC et +1 BAR.', '{"ratingBonuses":{"hills":3,"acceleration":1,"breakaway":1}}', 10),
  ('sylva-canopy-national', 'front_wheel', 'Canopy 40 avant', '+1 DES, +1 PLA et +1 PAV.', '{"ratingBonuses":{"downhill":1,"flat":1,"cobbles":1}}', 20),
  ('sylva-canopy-national', 'rear_wheel', 'Canopy 44 arrière', '+1 VAL, +1 ACC et +1 SPR.', '{"ratingBonuses":{"hills":1,"acceleration":1,"sprint":1}}', 30),
  ('sylva-canopy-national', 'shoes', 'Canopy Rise', '+1 MON et +1 END.', '{"ratingBonuses":{"mountain":1,"endurance":1}}', 40),
  ('sylva-canopy-national', 'glasses', 'Canopy Vision', '+1 BAR, +1 REC et +1 RES.', '{"ratingBonuses":{"breakaway":1,"recovery":1,"resistance":1}}', 50),
  ('sylva-canopy-national', 'bib_shorts', 'Canopy Tempo', '+1 END, +1 CLM, +1 PRL et +1 PAV.', '{"ratingBonuses":{"endurance":1,"timeTrial":1,"prologue":1,"cobbles":1}}', 60),

  -- 1,18 M€ · 6 pièces · 22 points
  ('andes-cordillera-national', 'frame', 'Cordillera RS National', '+3 MON, +1 END et +1 REC.', '{"ratingBonuses":{"mountain":3,"endurance":1,"recovery":1}}', 10),
  ('andes-cordillera-national', 'front_wheel', 'Cumbre 32 avant', '+2 DES, +1 VAL et +1 PAV.', '{"ratingBonuses":{"downhill":2,"hills":1,"cobbles":1}}', 20),
  ('andes-cordillera-national', 'rear_wheel', 'Altura 35 arrière', '+1 MON, +1 ACC et +1 PLA.', '{"ratingBonuses":{"mountain":1,"acceleration":1,"flat":1}}', 30),
  ('andes-cordillera-national', 'shoes', 'Cumbre Carbon Nation', '+1 VAL et +1 END.', '{"ratingBonuses":{"hills":1,"endurance":1}}', 40),
  ('andes-cordillera-national', 'bib_shorts', 'Fondo Selección', '+1 REC et +2 RES.', '{"ratingBonuses":{"recovery":1,"resistance":2}}', 50),
  ('andes-cordillera-national', 'helmet', 'Condor Polyvalent', '+1 CLM, +1 SPR, +1 BAR, +1 PRL et +1 DES.', '{"ratingBonuses":{"timeTrial":1,"sprint":1,"breakaway":1,"prologue":1,"downhill":1}}', 60),

  -- 1,28 M€ · 6 pièces · 24 points
  ('novaspoke-momentum-national', 'frame', 'Momentum Platform', '+2 PLA, +1 END et +1 RES.', '{"ratingBonuses":{"flat":2,"endurance":1,"resistance":1}}', 10),
  ('novaspoke-momentum-national', 'front_wheel', 'Momentum 45 avant', '+2 CLM, +1 DES et +1 VAL.', '{"ratingBonuses":{"timeTrial":2,"downhill":1,"hills":1}}', 20),
  ('novaspoke-momentum-national', 'rear_wheel', 'Momentum 55 arrière', '+2 SPR, +1 ACC et +1 PLA.', '{"ratingBonuses":{"sprint":2,"acceleration":1,"flat":1}}', 30),
  ('novaspoke-momentum-national', 'helmet', 'Momentum Light', '+1 MON et +1 REC.', '{"ratingBonuses":{"mountain":1,"recovery":1}}', 40),
  ('novaspoke-momentum-national', 'glasses', 'Momentum Sector', '+2 PAV, +1 BAR et +1 DES.', '{"ratingBonuses":{"cobbles":2,"breakaway":1,"downhill":1}}', 50),
  ('novaspoke-momentum-national', 'shoes', 'Momentum Drive', '+1 MON, +1 VAL, +1 END, +1 ACC, +1 CLM et +1 RES.', '{"ratingBonuses":{"mountain":1,"hills":1,"endurance":1,"acceleration":1,"timeTrial":1,"resistance":1}}', 60),

  -- 1,38 M€ · 6 pièces · 26 points
  ('kernwerk-granit-national', 'frame', 'Granit CX National', '+3 PAV, +2 RES et +1 END.', '{"ratingBonuses":{"cobbles":3,"resistance":2,"endurance":1}}', 10),
  ('kernwerk-granit-national', 'front_wheel', 'Granit 37 avant', '+1 PAV, +1 PLA, +1 DES et +1 VAL.', '{"ratingBonuses":{"cobbles":1,"flat":1,"downhill":1,"hills":1}}', 20),
  ('kernwerk-granit-national', 'rear_wheel', 'Granit 39 arrière', '+1 PAV, +1 ACC et +1 SPR.', '{"ratingBonuses":{"cobbles":1,"acceleration":1,"sprint":1}}', 30),
  ('kernwerk-granit-national', 'gloves', 'Granit Control', '+1 RES et +1 BAR.', '{"ratingBonuses":{"resistance":1,"breakaway":1}}', 40),
  ('kernwerk-granit-national', 'bib_shorts', 'Granit Distance', '+1 END, +1 REC et +1 MON.', '{"ratingBonuses":{"endurance":1,"recovery":1,"mountain":1}}', 50),
  ('kernwerk-granit-national', 'helmet', 'Granit Omnium', '+2 CLM, +1 PRL, +1 PLA, +1 DES, +1 VAL, +1 MON et +1 SPR.', '{"ratingBonuses":{"timeTrial":2,"prologue":1,"flat":1,"downhill":1,"hills":1,"mountain":1,"sprint":1}}', 60),

  -- 1,48 M€ · 7 pièces · 28 points
  ('velocita-squadra-national', 'frame', 'Squadra Corsa', '+2 SPR, +2 ACC et +1 PLA.', '{"ratingBonuses":{"sprint":2,"acceleration":2,"flat":1}}', 10),
  ('velocita-squadra-national', 'front_wheel', 'Lampo Squadra avant', '+1 VAL, +1 DES et +1 PAV.', '{"ratingBonuses":{"hills":1,"downhill":1,"cobbles":1}}', 20),
  ('velocita-squadra-national', 'rear_wheel', 'Furia Squadra arrière', '+2 SPR, +1 PLA et +1 CLM.', '{"ratingBonuses":{"sprint":2,"flat":1,"timeTrial":1}}', 30),
  ('velocita-squadra-national', 'shoes', 'Scatto Squadra', '+1 ACC et +1 MON.', '{"ratingBonuses":{"acceleration":1,"mountain":1}}', 40),
  ('velocita-squadra-national', 'gloves', 'Attacco Grip', '+2 BAR et +1 RES.', '{"ratingBonuses":{"breakaway":2,"resistance":1}}', 50),
  ('velocita-squadra-national', 'bib_shorts', 'Fondo Squadra', '+2 END et +1 REC.', '{"ratingBonuses":{"endurance":2,"recovery":1}}', 60),
  ('velocita-squadra-national', 'helmet', 'Veloce Omnium', '+2 PRL, +1 CLM, +1 VAL, +1 PAV, +1 DES, +1 MON et +1 END.', '{"ratingBonuses":{"prologue":2,"timeTrial":1,"hills":1,"cobbles":1,"downhill":1,"mountain":1,"endurance":1}}', 70),

  -- 1,58 M€ · 7 pièces · 30 points
  ('brava-fulgor-national', 'frame', 'Fulgor RS National', '+3 SPR, +2 ACC et +1 PLA.', '{"ratingBonuses":{"sprint":3,"acceleration":2,"flat":1}}', 10),
  ('brava-fulgor-national', 'front_wheel', 'Fulgor 58 avant', '+2 PLA, +1 DES et +1 VAL.', '{"ratingBonuses":{"flat":2,"downhill":1,"hills":1}}', 20),
  ('brava-fulgor-national', 'rear_wheel', 'Fulgor 68 arrière', '+2 SPR, +2 ACC et +1 CLM.', '{"ratingBonuses":{"sprint":2,"acceleration":2,"timeTrial":1}}', 30),
  ('brava-fulgor-national', 'shoes', 'Fulgor Launch', '+1 MON, +1 VAL et +1 ACC.', '{"ratingBonuses":{"mountain":1,"hills":1,"acceleration":1}}', 40),
  ('brava-fulgor-national', 'gloves', 'Fulgor Attack', '+1 BAR, +1 PAV et +1 RES.', '{"ratingBonuses":{"breakaway":1,"cobbles":1,"resistance":1}}', 50),
  ('brava-fulgor-national', 'bib_shorts', 'Fulgor Endurance', '+2 END et +1 REC.', '{"ratingBonuses":{"endurance":2,"recovery":1}}', 60),
  ('brava-fulgor-national', 'helmet', 'Fulgor Complete', '+2 CLM, +1 PRL, +1 DES, +1 MON et +1 PAV.', '{"ratingBonuses":{"timeTrial":2,"prologue":1,"downhill":1,"mountain":1,"cobbles":1}}', 70),

  -- 1,68 M€ · 7 pièces · 32 points
  ('kaze-hayate-national', 'frame', 'Kōsoku Nation', '+3 PLA, +2 ACC et +1 CLM.', '{"ratingBonuses":{"flat":3,"acceleration":2,"timeTrial":1}}', 10),
  ('kaze-hayate-national', 'front_wheel', 'Hayate 58 avant', '+2 CLM, +1 DES, +1 VAL et +1 PAV.', '{"ratingBonuses":{"timeTrial":2,"downhill":1,"hills":1,"cobbles":1}}', 20),
  ('kaze-hayate-national', 'rear_wheel', 'Kaminari 70 arrière', '+2 SPR, +2 ACC et +1 PLA.', '{"ratingBonuses":{"sprint":2,"acceleration":2,"flat":1}}', 30),
  ('kaze-hayate-national', 'shoes', 'Raijin Nation', '+1 MON, +1 VAL et +1 END.', '{"ratingBonuses":{"mountain":1,"hills":1,"endurance":1}}', 40),
  ('kaze-hayate-national', 'gloves', 'Attack Grip Nation', '+2 BAR et +1 RES.', '{"ratingBonuses":{"breakaway":2,"resistance":1}}', 50),
  ('kaze-hayate-national', 'bib_shorts', 'Ren National', '+2 END et +2 REC.', '{"ratingBonuses":{"endurance":2,"recovery":2}}', 60),
  ('kaze-hayate-national', 'helmet', 'Fujin Complete', '+2 PRL, +1 CLM, +1 DES, +1 PAV et +1 SPR.', '{"ratingBonuses":{"prologue":2,"timeTrial":1,"downhill":1,"cobbles":1,"sprint":1}}', 70),

  -- 1,78 M€ · 8 pièces · 34 points
  ('echelon-grand-tour-national', 'frame', 'Grand Tour Nation', '+2 MON, +2 PLA, +1 END et +1 RES.', '{"ratingBonuses":{"mountain":2,"flat":2,"endurance":1,"resistance":1}}', 10),
  ('echelon-grand-tour-national', 'front_wheel', 'Grand Tour 40 avant', '+2 DES, +1 VAL et +1 PAV.', '{"ratingBonuses":{"downhill":2,"hills":1,"cobbles":1}}', 20),
  ('echelon-grand-tour-national', 'rear_wheel', 'Grand Tour 45 arrière', '+1 SPR, +1 ACC, +1 CLM et +1 PLA.', '{"ratingBonuses":{"sprint":1,"acceleration":1,"timeTrial":1,"flat":1}}', 30),
  ('echelon-grand-tour-national', 'shoes', 'Grand Tour Carbon', '+1 MON, +1 VAL et +1 ACC.', '{"ratingBonuses":{"mountain":1,"hills":1,"acceleration":1}}', 40),
  ('echelon-grand-tour-national', 'gloves', 'Grand Tour Grip', '+1 PAV, +1 BAR et +1 RES.', '{"ratingBonuses":{"cobbles":1,"breakaway":1,"resistance":1}}', 50),
  ('echelon-grand-tour-national', 'bib_shorts', 'Grand Tour Endurance', '+2 END et +2 REC.', '{"ratingBonuses":{"endurance":2,"recovery":2}}', 60),
  ('echelon-grand-tour-national', 'helmet', 'Grand Tour Aero', '+2 CLM, +1 PRL et +1 DES.', '{"ratingBonuses":{"timeTrial":2,"prologue":1,"downhill":1}}', 70),
  ('echelon-grand-tour-national', 'glasses', 'Grand Tour Vision', '+1 MON, +1 VAL, +1 PLA, +1 SPR, +1 PAV et +1 BAR.', '{"ratingBonuses":{"mountain":1,"hills":1,"flat":1,"sprint":1,"cobbles":1,"breakaway":1}}', 80),

  -- 1,88 M€ · 8 pièces · 37 points
  ('altura-summit-national', 'frame', 'Summit SL National', '+3 MON, +2 END et +1 REC.', '{"ratingBonuses":{"mountain":3,"endurance":2,"recovery":1}}', 10),
  ('altura-summit-national', 'front_wheel', 'Summit 28 avant', '+2 DES, +2 VAL et +1 PAV.', '{"ratingBonuses":{"downhill":2,"hills":2,"cobbles":1}}', 20),
  ('altura-summit-national', 'rear_wheel', 'Summit 31 arrière', '+2 MON, +1 ACC et +1 PLA.', '{"ratingBonuses":{"mountain":2,"acceleration":1,"flat":1}}', 30),
  ('altura-summit-national', 'shoes', 'Summit Climb', '+1 VAL, +1 MON et +1 ACC.', '{"ratingBonuses":{"hills":1,"mountain":1,"acceleration":1}}', 40),
  ('altura-summit-national', 'gloves', 'Summit Control', '+1 BAR, +2 RES et +1 PAV.', '{"ratingBonuses":{"breakaway":1,"resistance":2,"cobbles":1}}', 50),
  ('altura-summit-national', 'bib_shorts', 'Summit Stage', '+2 END, +2 REC et +1 RES.', '{"ratingBonuses":{"endurance":2,"recovery":2,"resistance":1}}', 60),
  ('altura-summit-national', 'helmet', 'Summit Aero', '+2 CLM, +1 PRL et +1 DES.', '{"ratingBonuses":{"timeTrial":2,"prologue":1,"downhill":1}}', 70),
  ('altura-summit-national', 'glasses', 'Summit Vision', '+2 PLA, +1 SPR, +1 CLM, +1 VAL et +1 BAR.', '{"ratingBonuses":{"flat":2,"sprint":1,"timeTrial":1,"hills":1,"breakaway":1}}', 80),

  -- 1,98 M€ · 8 pièces · 40 points
  ('vektor-vector-national', 'frame', 'Vector TT-X National', '+3 CLM, +2 PLA et +1 PRL.', '{"ratingBonuses":{"timeTrial":3,"flat":2,"prologue":1}}', 10),
  ('vektor-vector-national', 'front_wheel', 'Vector 64 avant', '+2 CLM, +2 DES et +1 VAL.', '{"ratingBonuses":{"timeTrial":2,"downhill":2,"hills":1}}', 20),
  ('vektor-vector-national', 'rear_wheel', 'Vector Disc arrière', '+3 CLM, +1 PLA et +1 END.', '{"ratingBonuses":{"timeTrial":3,"flat":1,"endurance":1}}', 30),
  ('vektor-vector-national', 'helmet', 'Vector Aero Helmet', '+2 CLM et +1 PRL sur les chronos, −6 % de risque de blessure.', '{"timeTrialRatingBonuses":{"timeTrial":2,"prologue":1},"injuryRiskReductionPct":6}', 40),
  ('vektor-vector-national', 'glasses', 'Vector Horizon', '+2 PLA, +1 ACC et +1 DES.', '{"ratingBonuses":{"flat":2,"acceleration":1,"downhill":1}}', 50),
  ('vektor-vector-national', 'shoes', 'Vector Power', '+2 SPR, +2 ACC et +1 MON.', '{"ratingBonuses":{"sprint":2,"acceleration":2,"mountain":1}}', 60),
  ('vektor-vector-national', 'bib_shorts', 'Vector Stage', '+2 END, +2 REC et +1 RES.', '{"ratingBonuses":{"endurance":2,"recovery":2,"resistance":1}}', 70),
  ('vektor-vector-national', 'gloves', 'Vector Allroad', '+2 PAV, +1 VAL, +1 BAR, +1 MON, +1 RES et +1 SPR.', '{"ratingBonuses":{"cobbles":2,"hills":1,"breakaway":1,"mountain":1,"resistance":1,"sprint":1}}', 80),

  -- 2,12 M€ · 8 pièces · 44 points
  ('radian-apex-national', 'frame', 'Apex R8 National', '+2 MON, +2 VAL, +2 PLA, +1 END et +1 RES.', '{"ratingBonuses":{"mountain":2,"hills":2,"flat":2,"endurance":1,"resistance":1}}', 10),
  ('radian-apex-national', 'front_wheel', 'Apex Vector avant', '+2 DES, +2 PAV et +1 CLM.', '{"ratingBonuses":{"downhill":2,"cobbles":2,"timeTrial":1}}', 20),
  ('radian-apex-national', 'rear_wheel', 'Apex Torque arrière', '+2 SPR, +2 ACC, +1 CLM et +1 PLA.', '{"ratingBonuses":{"sprint":2,"acceleration":2,"timeTrial":1,"flat":1}}', 30),
  ('radian-apex-national', 'helmet', 'Sentinel National', '+1 MON, +1 REC et −10 % de risque de blessure.', '{"ratingBonuses":{"mountain":1,"recovery":1},"injuryRiskReductionPct":10}', 40),
  ('radian-apex-national', 'glasses', 'Sector National', '+1 VAL, +1 DES, +1 PAV et +1 BAR.', '{"ratingBonuses":{"hills":1,"downhill":1,"cobbles":1,"breakaway":1}}', 50),
  ('radian-apex-national', 'shoes', 'Apex Carbon', '+1 MON, +1 SPR et +1 ACC.', '{"ratingBonuses":{"mountain":1,"sprint":1,"acceleration":1}}', 60),
  ('radian-apex-national', 'bib_shorts', 'Grand Tour National', '+2 END, +2 REC et +2 RES.', '{"ratingBonuses":{"endurance":2,"recovery":2,"resistance":2}}', 70),
  ('radian-apex-national', 'gloves', 'Leader Complete', '+1 MON, +1 VAL, +1 PLA, +1 SPR, +1 CLM, +1 PRL, +1 PAV, +1 BAR, +1 DES et +1 ACC.', '{"ratingBonuses":{"mountain":1,"hills":1,"flat":1,"sprint":1,"timeTrial":1,"prologue":1,"cobbles":1,"breakaway":1,"downhill":1,"acceleration":1}}', 80);

-- Contrôles de qualité : la montée en prix doit toujours apporter davantage
-- de puissance, le nombre de pièces ne peut pas régresser et aucune offre ne
-- peut concentrer plus de 30 % de ses points sur une seule caractéristique.
do $$
declare
  v_invalid record;
begin
  with offer_metrics as (
    select
      offer.offer_key,
      offer.season_price,
      count(item.id)::integer as item_count,
      coalesce(sum(effect.rating_total), 0)::numeric as rating_total,
      (
        select count(distinct stat.key)
        from public.national_federation_equipment_offer_items as covered_item
        cross join lateral (
          select key from jsonb_each(coalesce(covered_item.effect_payload -> 'ratingBonuses', '{}'::jsonb))
          union all
          select key from jsonb_each(coalesce(covered_item.effect_payload -> 'timeTrialRatingBonuses', '{}'::jsonb))
        ) as stat
        where covered_item.offer_key = offer.offer_key
      )::integer as covered_stats,
      (
        select max(stat_total)
        from (
          select stat.key, sum((stat.value #>> '{}')::numeric) as stat_total
          from public.national_federation_equipment_offer_items as focus_item
          cross join lateral (
            select key, value from jsonb_each(coalesce(focus_item.effect_payload -> 'ratingBonuses', '{}'::jsonb))
            union all
            select key, value from jsonb_each(coalesce(focus_item.effect_payload -> 'timeTrialRatingBonuses', '{}'::jsonb))
          ) as stat
          where focus_item.offer_key = offer.offer_key
          group by stat.key
        ) as per_stat
      )::numeric as maximum_stat_total
    from public.national_federation_equipment_offers as offer
    join public.national_federation_equipment_offer_items as item
      on item.offer_key = offer.offer_key
    cross join lateral (
      select coalesce(sum((entry.value #>> '{}')::numeric), 0) as rating_total
      from (
        select value from jsonb_each(coalesce(item.effect_payload -> 'ratingBonuses', '{}'::jsonb))
        union all
        select value from jsonb_each(coalesce(item.effect_payload -> 'timeTrialRatingBonuses', '{}'::jsonb))
      ) as entry
    ) as effect
    where offer.status = 'active'
    group by offer.offer_key, offer.season_price
  ), ranked as (
    select metrics.*,
      lag(item_count) over (order by season_price) as previous_item_count,
      lag(rating_total) over (order by season_price) as previous_rating_total
    from offer_metrics as metrics
  )
  select * into v_invalid
  from ranked
  where item_count < coalesce(previous_item_count, item_count)
    or rating_total <= coalesce(previous_rating_total, 0)
    or covered_stats < 8
    or maximum_stat_total / nullif(rating_total, 0) > .30
  order by season_price
  limit 1;

  if found then
    raise exception 'Offre fédérale déséquilibrée : %', row_to_json(v_invalid);
  end if;
end;
$$;

do $$
declare
  v_changed record;
begin
  with current_snapshot as (
    select
      contract.id,
      md5(row_to_json(contract)::text) as contract_hash,
      (
        select md5(coalesce(string_agg(
          concat_ws('|', item.slot_type, item.equipment_name,
            item.effect_summary, item.effect_payload::text,
            item.display_order::text),
          ';' order by item.slot_type
        ), ''))
        from public.national_federation_equipment_contract_items as item
        where item.contract_id = contract.id
      ) as items_hash
    from public.national_federation_equipment_contracts as contract
  )
  select before.id, before.contract_hash, current.contract_hash,
    before.items_hash, current.items_hash
  into v_changed
  from federation_equipment_contract_snapshot as before
  left join current_snapshot as current on current.id = before.id
  where current.id is null
    or current.contract_hash <> before.contract_hash
    or current.items_hash <> before.items_hash
  limit 1;

  if found then
    raise exception 'Le contrat fédéral signé % a été modifié.', v_changed.id;
  end if;
end;
$$;

commit;
