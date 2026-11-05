# Draft : réservation dès la bascule de minuit

Le vivier était auparavant constitué à l'ouverture de la préparation, à J1
08 h. Les agents libres pouvaient donc être recrutés entre la libération de
leurs contrats à minuit et cette ouverture.

Le correctif distingue la réservation du vivier de l'ouverture aux joueurs.
Un trigger `AFTER INSERT` sur `season_rollover_settlements` réserve les coureurs
dans la transaction même du changement de saison, après les libérations,
activations des contrats prévus, transitions des juniors et copies des notes.
La nouvelle saison et ses réservations deviennent visibles ensemble.

Une protection temporaire empêche aussi les nouvelles acquisitions d'agents
libres et nouvelles mises aux enchères dès la date de bascule à minuit Paris,
tant que la réservation n'est pas prête. Elle couvre une saison cible encore
planifiée : un retard du rollover ne crée pas de créneau de recrutement. Les
contrats existants, leurs activations et les promotions internes sont préservés.
Après réservation, les coureurs hors vivier restent recrutables normalement.

Les coureurs du vivier ne sont pas remplacés ou reclassés à 08 h. Les participants
restent déterminés à 08 h ; leurs choix commencent à 14 h. Les notes affichées et
les devis salariaux sont rafraîchis à l'ouverture, avec un seul devis en lot.
Le vivier comporte au moins 100 places, dans la limite des agents disponibles,
et peut être étendu par ajout si plus de 100 équipes participent.

Le verrou central couvre les signatures des joueurs et bots, les enchères et
les changements d'identifiant de coureur dans un contrat. Les fonctions de
réservation ne sont pas exécutables par les rôles clients. Le calendrier des
crons et les fonctions du rollover n'ont pas été réécrits.

Les règles de fin de draft sont conservées : les non-choisis sont libérés à la
clôture ; les coureurs draftés restent protégés contre la revente pendant la
saison. Une suspension de la récurrence n'abandonne pas une draft déjà réservée.

## Validation et livraison

- 38 assertions PostgreSQL dédiées et 63 assertions historiques après application
  du correctif, dans PGlite isolé : 101 réussites, aucune écriture de jeu en production.
- Sept tests TypeScript/IHM réussis ; ESLint et catalogue anglais vérifiés.
- Migration `20261105210000_reserve_season_draft_from_midnight.sql`, SHA-256
  `8942d23a335592f6364c8b1a5d767e8bc5162843d6d5f56178c7db39d2b951e9`.
- Application contrôlée le 5 novembre 2026 ; fonctions existantes comparées à
  leurs empreintes avant remplacement, reçu de migration vérifié, fonctions du
  rollover inchangées, permissions, triggers, crons et accès HTTP vérifiés.
- L'édition S5 du 6 novembre reste planifiée : aucun vivier ni participant n'a
  été artificiellement créé avant sa date. Ouverture à 08 h et sélections à
  14 h Paris confirmées en production.

Livraison reproductible : `scripts/deliver-draft-midnight-protection.mjs` avec
`--inspect`, `--apply` ou `--verify`. Requêtes bornées sous `supabase/diagnostics/`.
Preuves locales dans `C:/Dev/artifacts/draft-midnight-20261105/`, notamment
`delivery-verification.json`. La livraison n'appelle aucun worker ni règlement
de saison pour tester le correctif en production.

## Fenêtre de choix portée à dix minutes

La migration `20261105220000_draft_ten_minute_turns.sql` passe le réglage,
son défaut, sa contrainte et le vrai délai du moteur à 600 secondes. Les
notifications indiquent dix minutes. Seuls quatre fragments des fonctions
existantes sont remplacés ; les horaires, réservations, participants,
éditions, échéances déjà enregistrées et droits sont conservés.

Une liste automatique validée recrute toujours son premier coureur disponible
et compatible, puis enchaîne avec l'équipe suivante. Si les choix 1 à 3 sont
pris, le choix 4 est examiné ensuite. La fenêtre de dix minutes concerne le
choix manuel et les cas où aucun choix automatique ne peut être réalisé.
Pour garder la main à son tour, le DS désactive puis valide l'automatique
avant l'arrivée de son tour. Un recrutement confirmé reste définitif.

L'IHM présente vingt fiches par page, avec recherche et tris. La liste privée
grandit à chaque ajout, jusqu'à l'ensemble du vivier ; les flèches permettent
de réordonner ses priorités. Une confirmation ouverte devient non validable
si le délai expire, si le tour change ou si le coureur est déjà recruté.

Validation : 58 assertions PostgreSQL isolées et 13 tests d'IHM/helpers
réussis ; TypeScript, ESLint et catalogue anglais vérifiés. La migration a été
appliquée sans exécuter de draft en production. Le reçu et les empreintes
des fonctions confirment uniquement les remplacements prévus, avec
`pick_seconds = 600` et une édition S5 toujours planifiée aux mêmes heures.
Livraison : `scripts/deliver-draft-ten-minute-turns.mjs` ; preuves dans
`C:/Dev/artifacts/draft-ten-minutes-20261105/verification.json`.
