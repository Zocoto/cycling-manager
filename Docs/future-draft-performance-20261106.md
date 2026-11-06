# Sélection du vivier : priorité aux performances dès la draft S6

La draft S5 conserve sa formule historique, son vivier, ses rangs et ses
préférences. La nouvelle règle est conditionnée au numéro de saison de
l'édition : elle s'applique aux réservations S6 et suivantes, sans intervention
à la prochaine bascule et indépendamment de la date d'installation.

## Classement

Le score devient 90 % de la meilleure note parmi MON, VAL, CLM, PAV et SPR,
plus 10 % de la moyenne des douze notes hors PLA. La plaine est exclue de
l'ensemble du calcul ; BAR reste une note secondaire dans cette moyenne.
Les notes utilisées sont les notes natives de la saison de la draft.

L'âge et le potentiel ne modifient plus ce score. À score égal, le potentiel
départage les coureurs, puis leur identifiant assure un ordre stable. Les
deux anciens départages par âge sont neutralisés à partir de S6.

Un spécialiste de 38 ans avec 75 dans une primaire, 50 ailleurs et un potentiel
faible obtient 72,708. Un jeune de 19 ans avec 70 dans cette primaire, 60
ailleurs et quatre étoiles obtient 69,083. La jeunesse et le potentiel ne
supplantent ainsi plus la performance actuelle du spécialiste.

## Mise en œuvre et intégrité

Le helper historique est conservé. Un nouveau helper reçoit le numéro de
saison et délègue strictement à l'ancien calcul jusqu'à S5 incluse. La
réservation change uniquement son appel de score et ses deux départages
par âge ; sa définition antérieure est contrôlée par empreinte avant édition.
Même une extension éventuelle du vivier S5 utilise donc l'ancien calcul.

Aucune édition, préférence, réservation, inscription, récompense ou contrat
n'est modifié à l'installation. Les gardes, verrous, participants, horaires,
traitements de bascule et crons sont conservés. Le calcul reste local à la
requête de constitution du vivier ; aucune requête de consultation
supplémentaire n'est ajoutée. L'interface affiche la règle correspondant à
la saison de l'édition, avec traduction anglaise.

## Validation et livraison

- 45 contrôles PostgreSQL isolés : calcul S5 strictement identique, conservation
  des données et préférences, extension S5, vraie réservation S6, invariance
  selon l'âge et PLA, potentiel au départage, poids des cinq primaires,
  protection des réservations, droits et vivier figé après entraînement.
- 20 tests d'interface et helpers, TypeScript, ESLint et catalogue anglais
  vérifiés.
- Migration `20261106153017_prioritize_performance_in_future_drafts.sql` :
  SHA256 LF `bd97f0f031be191da4823c9ea2777264f5345db919f60d0dcb08d905a20f5e77`.
- Reçu confirmé le 6 novembre à 11 h 58 Paris. Les 100 identifiants, rangs et
  scores S5 ont la même empreinte avant et après installation. Les fonctions
  historiques, gardes, crons et droits existants sont inchangés.

Livraison : `scripts/deliver-future-draft-performance.mjs` avec `--inspect`,
`--apply` ou `--verify`. Preuves locales :
`C:/Dev/artifacts/future-draft-performance-20261106/verification.json`.
Aucun fixture ni worker de draft n'a été exécuté en production.
