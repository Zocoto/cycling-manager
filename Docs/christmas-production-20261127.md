# Noël du Peloton — mise en production 2026

## Dates et activation

- Ouverture : **1er décembre 2026, 00:00 Europe/Paris** (30 novembre, 23:00 UTC).
- Clôture jeu, Avent et boutique : **1er janvier 2027, 00:00 Europe/Paris** (31 décembre, 23:00 UTC).
- L’édition \`christmas-2026\` est activée en base à l’avance. L’horloge du serveur ouvre les actions ; aucun PC, script local, redéploiement de minuit ou automation Codex ne déclenche l’événement.
- Le thème, le menu et la tuile du bureau s’affichent pendant décembre 2026. Le header existant est conservé.
- Le pilote privé reste distinct. La page publique authentifiée est \`/jeu/noel\`, avec une page d’attente avant l’ouverture.

## Contenu raccordé

- Minijeu aérien validé, même physique/contrôles/obstacles sur PC et téléphone. Le serveur rejoue les commandes et calcule le score ; aucun montant envoyé par le navigateur ne choisit une récompense.
- Une tournée gratuite récompensée par jour parisien ; entraînements sans gains ensuite. Le Second tour ajoute une tournée payante intégrale. Les consommables de vol sont consommés au départ et ne sont pas rendus après abandon.
- 24 fenêtres de l’Avent, rattrapables jusqu’au 31 décembre ; 34 objets au catalogue, 20 cosmétiques et neuf paliers collectifs.
- Consommables ordinaires, boosters de l’album S4 et équipements livrés dans les inventaires natifs. Cosmétiques disponibles dans l’éditeur d’avatar et conservés après décembre.
- Le Carnet de l’éclaireur réserve une mission native pour deux étapes du même tour ; les coûts, le staff et les indisponibilités habituels sont conservés. Aucune requête supplémentaire dans le chargement du calendrier de simulation.
- Tirages/exchanges de cartes protégés par les verrous natifs ; les cartes collées/réservées sont conservées.

## Intégrité et clôture

- Migrations : \`20261127190000\` et \`20261127191000\`, appliquées atomiquement avec leur historique.
- Pas de compte de test, fixture, simulation ni cadeau de test en production. GET reste en lecture seule.
- Clés de transaction et sources de cadeaux uniques : une réponse perdue peut être retentée sans double débit/crédit.
- Validation des parties réservée atomiquement, 20 tentatives/session et deux secondes entre tentatives ; lecture propriétaire et durée réelle avant replay.
- Classement figé après la grâce de cinq minutes des dernières tournées. Lots identiques pour les ex æquo.
- Cron protégé \`/api/cron/christmas\`, toutes les quinze minutes en janvier. Il attribue les cadeaux par lots de 50 et devient un no-op après règlement complet.
- Une attribution impossible est isolée par participant, sans cadeau partiel ; les autres continuent et la ligne en échec est retentée après une heure. Le retour cron comporte \`failed\` et \`retryAfterSeconds\`.
- Reprise administrative exceptionnelle : rappeler le même endpoint avec l’authentification cron serveur existante. Ne jamais rejouer une action joueur pour tester.

## Vérifications avant publication

- 157 assertions SQL isolées : horloge, permissions, idempotence, inventaires natifs, avatars Halloween/Noël, cartes, reconnaissance et reprise de clôture.
- Tests ciblés UI, thème, navigation, avatars, catalogue, replay/API et traductions ; TypeScript et lint ciblé.
- Navigateur local sans accès aux mutations de production : six vues à 390 px, aucun débordement/erreur JS ; vraie tournée avec 2 040 points, neuf cadeaux et 16 lumières identiques au replay serveur.
- Le bundle inclut explicitement les sources du moteur et tous les assets ; les iframes sont autorisées uniquement en même origine.
- Deux anomalies de tests historiques ont été identifiées hors périmètre : ancien libellé anglais « Cobblestones » contre « Cobbles », et référence à un ancien composant header absent.

Les artefacts de contrôle et empreintes des migrations sont conservés localement dans \`C:/Dev/christmas-launch-20261127\`.
