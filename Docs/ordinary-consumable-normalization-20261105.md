# Audit et normalisation des consommables — 5 novembre 2026

## Périmètre et constats

Audit en lecture seule des 63 références des catalogues général et quotidien, puis des fonctions réellement déployées pour leur utilisation. Les effets ont été comparés avec leurs paramètres : quantité, statistique imposée ou au choix, plafond, cible, durée et restrictions. Les objets Halloween conservent leur identité propre ; leurs ressemblances avec les objets ordinaires sont intentionnelles. Les pièces de matériel et les éditions de boosters restent distinctes.

Quatre familles comportaient plusieurs références ordinaires donnant réellement le même effet :

| Nom retenu | Anciennes références regroupées | Effet |
| --- | --- | --- |
| Perfectionnement technique | Atelier spécialisé, Perfectionnement technique | +1 dans une statistique secondaire au choix |
| Carnet de progression | Dossier de talent classifié, Carnet de progression | +1 étoile de potentiel du coureur, jusqu’à 4 étoiles |
| Talent révélé | Les deux références de niveaux 7 et 9 | Une capacité spéciale au choix |
| Équipement premium | Prototype de compétition, Équipement premium, Prototype ultime | Une pièce commerciale premium ; déjà versée automatiquement au stock de matériel |

Onze autres familles existaient dans les deux circuits d’acquisition : les cinq soins de 2/6/12/24/48 heures, l’Équerre de chantier, le Té d’architecte de précision, le Mandat de recrutement sur mesure, le Contrat Espoir immédiat, la Loupe du recruteur et l’Insigne d’expertise. Elles partagent désormais une seule tuile lorsque plusieurs stocks coexistent.

## Comportement livré

- Une présentation commune par effet réellement identique, pour les stocks actuels et les acquisitions suivantes.
- Utilisation en lot des statistiques et du potentiel à travers les anciennes références. Les capacités et les objets nécessitant une opération individuelle restent utilisables un par un depuis leur pile commune.
- Conservation des clés historiques, de chaque exemplaire, de sa provenance, de son expiration et des traces d’utilisation. Aucun déplacement ni retrait de stock lors de la migration.
- Les cadeaux qui expirent sont présentés et utilisés avant les stocks génériques ; les cadeaux quotidiens d’une même famille sont consommés par expiration croissante.
- Conservation des probabilités d’obtention, des niveaux des recettes et des effets. La pile affiche la présentation commune ; il ne s’agit pas d’un rééquilibrage des récompenses.
- Les demi-étoiles, les étoiles entières, les capacités précises et au choix, les statistiques imposées et au choix, les différentes puissances et les plafonds différents restent séparés.
- Aucun appel de données supplémentaire à l’affichage : regroupement des stocks déjà chargés, avec une table de correspondance en mémoire. Les opérations SQL restent bornées aux stocks du joueur connecté.

La correspondance complète est dans `lib/game/consumable-equivalences.json`. Elle exige une égalité exacte des paramètres audités. Une nouvelle référence ou un effet modifié cesse de fusionner automatiquement, ce qui évite qu’un changement de plafond ou de cible consomme un objet différent. Les correspondances TypeScript et SQL sont vérifiées ensemble dans le test PostgreSQL isolé.

## Vérifications

- 55 tests applicatifs ciblés : regroupements, anciennes références, compteurs, choix de la source, restriction nouvelle, exclusions événementielles, formulaires de statistiques/potentiel, soins et Halloween.
- 96 vérifications PostgreSQL isolées avec les fonctions réelles d’application : utilisation traversant plusieurs références, expiration, propriété, stocks insuffisants, plafonds de potentiel et de statistiques, annulation atomique et conservation de la provenance.
- ESLint ciblé. Le build complet est réalisé sur Vercel pour préserver la mémoire du poste.
- Livraison : `node scripts/deliver-consumable-normalization.mjs --preflight`, puis `--apply-reviewed`, puis `--verify`. Diagnostics séquentiels, en lecture seule et limités à cinq secondes ; la migration ne modifie que les libellés audités et deux fonctions d’utilisation en lot.

## Inventaire des effets audités

Le relevé ci-dessous conserve les intitulés antérieurs à la correction pour documenter tous les doublons. `daily_reward` désigne le catalogue quotidien et `item` le catalogue général. Les paramètres reproduisent le catalogue au moment du diagnostic ; les limites effectives supplémentaires sont vérifiées dans les fonctions d’application (potentiel 4 étoiles, statistiques natives 100, Cellule haute performance 80, staff 5 étoiles, protection des blessures de fatigue, etc.).

| Circuit | Référence | Nom avant correction | Effet | Paramètres |
| --- | --- | --- | --- | --- |
| daily_reward | automatic-naturalization | Passeport sportif | naturalization | {} |
| daily_reward | collective-training-150 | Séance stimulée | training_multiplier | {"multiplier":1.5} |
| daily_reward | collective-training-200 | Bloc haute intensité | training_multiplier | {"multiplier":2} |
| daily_reward | collective-training-225 | Cellule performance | training_multiplier | {"multiplier":2.25} |
| daily_reward | commercial-discovery | Découverte matérielle | equipment | {"rarity":"common"} |
| daily_reward | construction-square | Équerre de chantier | construction_time_reduction | {"days":2} |
| daily_reward | custom-staff-mandate | Mandat de recrutement sur mesure | custom_staff_recruitment | {"signingFeeWaived":true,"uniformLevelOdds":true} |
| daily_reward | elite-equipment | Prototype de compétition | equipment | {"rarity":"premium"} |
| daily_reward | energy-ration | Ration énergétique | form_boost | {"amount":5} |
| daily_reward | experience-day | Journée d’expérience | rider_experience | {"amount":1} |
| daily_reward | golden-ticket | Ticket d’or | wildcard | {} |
| daily_reward | high-performance-cell | Cellule haute performance | rating_boost | {"amount":2,"maximumRating":80,"statScope":"primary"} |
| daily_reward | historic-training | Séance historique | training_multiplier | {"multiplier":3} |
| daily_reward | injury-care-anti-inflammatory-protocol | Protocole anti-inflammatoire | injury_care | {"level":5,"recoveryHours":48} |
| daily_reward | injury-care-compressive-dressing | Pansement compressif | injury_care | {"level":1,"recoveryHours":2} |
| daily_reward | injury-care-cryotherapy-pack | Pack de cryothérapie | injury_care | {"level":2,"recoveryHours":6} |
| daily_reward | injury-care-physiotherapy-session | Session de physiothérapie | injury_care | {"level":4,"recoveryHours":24} |
| daily_reward | injury-care-recovery-kit | Trousse de récupération | injury_care | {"level":3,"recoveryHours":12} |
| daily_reward | instant-youth-contract | Contrat Espoir immédiat | instant_youth_promotion | {} |
| daily_reward | large-energy-ration | Grande ration énergétique | form_boost | {"amount":10} |
| daily_reward | performance-equipment | Matériel performance | equipment | {"rarity":"performance"} |
| daily_reward | precision-architect-tee | Té d’architecte de précision | construction_time_reduction | {"days":7} |
| daily_reward | premium-equipment | Équipement premium | equipment | {"rarity":"premium"} |
| daily_reward | primary-breakthrough | Passage de cap | rating_boost | {"amount":1,"statScope":"primary"} |
| daily_reward | scouting-clarity-pass | Loupe du recruteur | scouting_visibility | {"durationHours":24} |
| daily_reward | scouting-week-10 | Œil affûté | scouting_boost | {"durationDays":7,"percentage":10} |
| daily_reward | scouting-week-20 | Réseau prioritaire | scouting_boost | {"durationDays":7,"percentage":20} |
| daily_reward | secondary-specialization | Atelier spécialisé | rating_boost | {"amount":1,"statScope":"secondary"} |
| daily_reward | secondary-technique | Perfectionnement technique | rating_boost | {"amount":1,"statScope":"secondary"} |
| daily_reward | staff-expertise-badge | Insigne d’expertise | staff_level_boost | {} |
| daily_reward | talent-revealed | Talent révélé | special_ability | {} |
| daily_reward | talent-revealed-plus | Talent révélé | special_ability | {} |
| daily_reward | ultimate-prototype | Prototype ultime | equipment | {"rarity":"premium"} |
| item | acceleration-focus | Module explosivité | rating_boost | {"ratingBonus":1,"ratingKey":"acceleration"} |
| item | classified-talent-dossier | Dossier de talent classifié | potential_boost | {"potentialBonus":1} |
| item | construction-square | Équerre de chantier | other | {"days":2,"effectKind":"construction_time_reduction","level":4} |
| item | custom-staff-mandate | Mandat de recrutement sur mesure | other | {"effectKind":"custom_staff_recruitment","level":10,"signingFeeWaived":true,"uniformLevelOdds":true} |
| item | injury-care-anti-inflammatory-protocol | Protocole anti-inflammatoire | injury_care | {"effectKind":"injury_care","level":5,"recoveryHours":48} |
| item | injury-care-compressive-dressing | Pansement compressif | injury_care | {"effectKind":"injury_care","level":1,"recoveryHours":2} |
| item | injury-care-cryotherapy-pack | Pack de cryothérapie | injury_care | {"effectKind":"injury_care","level":2,"recoveryHours":6} |
| item | injury-care-physiotherapy-session | Session de physiothérapie | injury_care | {"effectKind":"injury_care","level":4,"recoveryHours":24} |
| item | injury-care-recovery-kit | Trousse de récupération | injury_care | {"effectKind":"injury_care","level":3,"recoveryHours":12} |
| item | instant-youth-contract | Contrat Espoir immédiat | other | {"effectKind":"instant_youth_promotion","level":8} |
| item | medallion-bottle-carrier | Médaillon Porteur de bidon | special_ability | {"abilityCode":"bottle_carrier"} |
| item | medallion-chase-potato | Médaillon Chasse patate | special_ability | {"abilityCode":"chase_potato"} |
| item | medallion-cyclocrossman | Médaillon Cyclocrossman | special_ability | {"abilityCode":"cyclocrossman"} |
| item | medallion-first-in-class | Médaillon Premier de la classe | special_ability | {"abilityCode":"first_in_class"} |
| item | medallion-flahute | Médaillon Flahute | special_ability | {"abilityCode":"flahute"} |
| item | medallion-giclette | Médaillon Giclette | special_ability | {"abilityCode":"giclette"} |
| item | medallion-iron-health | Médaillon Santé de fer | special_ability | {"abilityCode":"iron_health"} |
| item | medallion-locomotive | Médaillon Locomotive | special_ability | {"abilityCode":"locomotive"} |
| item | medallion-metronome | Médaillon Métronome | special_ability | {"abilityCode":"metronome"} |
| item | medallion-panache | Médaillon Panache | special_ability | {"abilityCode":"panache"} |
| item | medallion-pistard | Médaillon Pistard | special_ability | {"abilityCode":"pistard"} |
| item | medallion-sandwich-man | Médaillon Homme Sandwich | special_ability | {"abilityCode":"sandwich_man"} |
| item | medallion-three-lungs | Médaillon Trois poumons | special_ability | {"abilityCode":"three_lungs"} |
| item | mountain-focus | Module haute montagne | rating_boost | {"ratingBonus":1,"ratingKey":"mountain"} |
| item | potential-notebook | Carnet de progression | potential_boost | {"potentialBonus":1} |
| item | potential-spark | Déclic de potentiel | potential_boost | {"potentialBonus":0.5} |
| item | precision-architect-tee | Té d’architecte de précision | other | {"days":7,"effectKind":"construction_time_reduction","level":7} |
| item | scouting-clarity-pass | Loupe du recruteur | other | {"durationHours":24,"effectKind":"scouting_visibility","level":6} |
| item | sprint-masterclass | Masterclass de sprint | rating_boost | {"ratingBonus":2,"ratingKey":"sprint"} |
| item | staff-expertise-badge | Insigne d’expertise | other | {"effectKind":"staff_level_boost","level":10,"maximumLevel":5} |
