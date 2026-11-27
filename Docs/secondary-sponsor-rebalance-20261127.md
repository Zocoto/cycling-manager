# Sponsors secondaires — rééquilibrage du 27 novembre 2026

Les contrats signés conservent leurs objectifs et montants. Les nouvelles règles remplacent les offres ouvertes non acceptées, de façon atomique et seulement lors de leur prochaine consultation. Aucun recalcul de calendrier n’est ajouté à l’affichage des offres déjà enregistrées.

## Affinités et niveau sportif

La sélection reprend le pays d’enregistrement actuel, le pays du DS, les leaders, la majorité de l’effectif et les contacts des écoles internationales. Le pays fondateur ne détermine plus à lui seul les trois offres. Chaque partenaire conserve son vrai pays dans l’affichage.

La division projetée pour la saison du contrat est chargée par le même service que les objectifs du sponsor principal. Une équipe projetée en Élite reçoit des objectifs Élite/Mondial ; une équipe projetée en Mondial vise le Mondial. Les autres équipes éligibles peuvent viser le Continental et le Mondial. L’Élite n’est proposée qu’aux équipes dont la projection le permet. Une nationale ne complète un portefeuille qu’en dernier recours, dans le pays du sponsor et avec une limite d’une par offre.

## Gains et risque

La base par objectif est de 35 000 € en national, 65 000 € en continental, 110 000 € en mondial et 160 000 € en élite. Elle est modulée par le prestige du partenaire, le classement demandé et la réputation sportive. La réputation sportive respecte un plancher de 10 000 pour une projection Élite et 5 000 pour une projection Mondial ; elle ne modifie jamais les conditions réelles d’inscription aux courses.

À partir de 200 000 € par objectif, le risque annoncé est de 5 points de réputation par tranche de 50 000 €, avec un plafond de 100 points. Aucun malus n’est ajouté aux contrats précédemment signés. L’annulation d’une épreuve n’entraîne aucun malus.

## Contingent et identité

Un objectif chiffré de nationalité peut remplacer une course si le sponsor secondaire est d’un autre pays que le sponsor principal de la saison visée. Il concerne au maximum 10 % de l’effectif professionnel actuel, arrondi à l’entier inférieur, et trois coureurs. Sous dix pros, aucun contingent n’est demandé. Les juniors ne comptent pas dans ce contingent.

Le paiement est effectué dès que le nombre demandé est atteint pendant la saison active du contrat, avec la même référence financière unique que les objectifs sportifs. Les transferts et naturalisations réévaluent uniquement les équipes concernées. La fin de saison clôture les objectifs restants ; les règlements et leurs pénalités sont idempotents.

L’identité principale et secondaire est visible sur la page équipe et dans le sponsoring. Le logo peut être enregistré en noir, blanc ou couleurs d’origine, également pendant un contrat actif. La nationalité secondaire enrichit l’identité de l’équipe sans déplacer son affiliation principale.

## Livraison

Appliquer `20261127130000_rebalance_secondary_sponsor_objectives.sql` avant l’interface : colonnes nouvelles, RPC de génération réservée au service, RPC de lecture du contexte et édition du logo compatible avec l’ancienne signature. Diagnostics et vérifications de production limités à cinq secondes en lecture seule ; tests métier et SQL exécutés hors production.

Validation : 74 tests Vitest ciblés (métier, service, identité et interface) et 47 assertions SQL isolées. Contrôles navigateur à 390 et 1440 px en français et en anglais, sans débordement ni erreur JavaScript ; pays et contingents localisés ; sélections noir/blanc vérifiées. Les définitions des quatre fonctions historiques ont été comparées en lecture seule à la production avant leur remplacement.

## Alerte de négociation

Le bureau du DS doit signaler l’ouverture d’un sponsor secondaire avec un accès direct à `/jeu/sponsoring?onglet=secondaire`. Le contrôle s’appuie sur le résumé déjà authentifié : aucune lecture supplémentaire avant J21, puis vérification bornée de la réputation, de la prochaine saison et de l’absence de contrat secondaire pour cette équipe/saison. Le contrôle ne crée ni offre ni objectif et ne charge aucun calendrier. La présence d’un contrat masque l’alerte.

## Constat de production

Après migration, les trois offres ouvertes S6 de La Cumbre ont été renouvelées par le générateur applicatif. Les partenaires sont colombien, français et kirghiz selon les affinités réelles de l’équipe. Les plafonds de gains sont de 2 120 000 € pour le partenaire colombien et 1 865 000 € pour les autres ; ils correspondent à des objectifs Élite avec un risque explicite de 45 points de réputation par objectif sportif. L’offre colombienne ne contient aucun objectif de contingent puisque le principal est lui aussi colombien. Les deux autres demandent trois pros de leur pays. La lecture de contrôle confirme le plafond de 10 %, les catégories de courses et les trois offres en version 2 ; le contrat S5 signé conserve ses conditions.

L’alerte complémentaire et l’assistant existant sont validés par 166 tests ciblés. La vérification applicative en lecture seule confirme une opportunité de signature S6 pour La Cumbre. Toutes les lectures supplémentaires de cette alerte partagent un budget de 1,5 seconde et sont effectuées au plus une fois dans le rendu complet de l’assistant ; son rendu initial conserve son fonctionnement.
