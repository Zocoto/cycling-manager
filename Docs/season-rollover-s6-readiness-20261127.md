# Précontrôle de la bascule S5 → S6 — 27 novembre 2026

La configuration et les données contrôlées ne présentent pas de blocage de
bascule identifié. Il s’agit d’un précontrôle en lecture seule, pas d’un reçu
de bascule future : S5 doit finir, ses courses doivent être réglées, puis les
contrôles atomiques seront rejoués sur les données définitives.

## Horloge et déclenchement

- S5 est active en J22, du 6 novembre au 3 décembre inclus. S6 est planifiée du
  vendredi 4 au 31 décembre 2026 ; ses 28 journées existent.
- Le cron PostgreSQL `daily-season-rollover` est actif toutes les dix minutes.
  Il appelle `settle_due_season_rollovers()` avec un délai SQL de cinq minutes
  et un délai de verrou de cinq secondes. Ses dernières exécutions réussissent.
- Le contrôle de date utilise `Europe/Paris` et interdit la clôture anticipée.
  Le secours Vercel `/api/cron/game-maintenance` reste programmé à 23:05 UTC,
  soit 00:05 Paris en décembre.
- `get_season_rollover_health()` est vert : une saison active, aucune saison
  échue non basculée, aucun reçu manquant, cron attendu présent, aucune division
  Nations Cup provisoire dans la saison active.

## Traitements réellement présents en production

Les définitions PostgreSQL capturées confirment la chaîne suivante :

1. Verrou global non bloquant et contrôle du reçu idempotent ; une relance ne
   vieillit ni ne crédite une seconde fois les coureurs et équipes.
2. Refus d'une bascule tant qu'une course source n'est ni terminée ni annulée.
   Gel du classement UCI, règlement des factures J28 et des équipements, puis
   clôture des objectifs sponsors et des finances avant le report des divisions.
3. Clôture/activation des contrats selon leurs saisons, report du solde des
   équipes, des sponsors éligibles et des entraînements. Les statuts d'effectif
   persistants et les objets disponibles conservent leurs protections dédiées.
4. Copie des notes des professionnels avec un an supplémentaire, bornée à 120
   ans ; les retraités et suspendus sont exclus de cette copie. Les décimales
   d'entraînement sont reportées avant J1 et la règle de récupération de trêve
   est appliquée.
5. Promotions des juniors programmés, selon les places disponibles, et départs
   des juniors arrivés à échéance. Leur âge découle de l'année de naissance.
   Les profils saisonniers et l'état physique d'ouverture sont créés.
6. Préparation des comptes fédéraux et des divisions Nations Cup. Le choix de
   la dernière saison non olympique est présent dans le générateur et dans les
   contrôles, contrairement au défaut corrigé lors de S4 → S5. Le report du
   solde fédéral positif à partir de S6 est installé.
7. Quinze contrôles d'intégrité avant l'écriture du reçu durable. Toute erreur
   annule ensemble les changements de la transaction.

Le trigger de réservation de draft est actif sur l'insertion de ce reçu. Le
worker de draft tourne chaque minute ; préparation à 08:00 Paris et premiers
choix à 14:00 Paris, avec les règles existantes de rattrapage et de tour de dix
minutes. Aucune draft ni bascule n'a été déclenchée par cet audit.

Les trois protections ciblées sont également présentes et actives : report du
solde fédéral (`credit_federation_season_carryover`), conservation des objets
possédés (`zzz_preserve_owned_inventory_reward_lifetime`) et héritage du statut
d'effectif lors d'un renouvellement (`inherit_team_squad_status_on_renewal`).

## Calendrier S6

Le précontrôle de production compte 887 éditions professionnelles et 1 159
étapes : 487 éditions ordinaires, 174 CN route, 174 CN CLM, dix CC, deux CM et
40 éditions de Nations Cup. Aucun jour mal daté, départ hors de sa journée,
édition sans étape ou étape sans segment n'a été relevé. Aucune note S6 n'est
encore créée : le vieillissement est donc attendu à la bascule.

La génération conserve les réparations de parcours, les règles horaires et
les rotations de profils. Les trois rotations GT S6 sont déjà matérialisées,
avec douze étapes chacune : Boucle des Provinces `prologue`, Corsa delle
Regioni `mountain`, Ruta de las Sierras `team_time_trial`. Une saison précréée
n'a donc pas empêché l'installation des rotations.

Le calendrier Development contient déjà 24 éditions et 28 étapes, comprenant
les courses ouvertes, les CC et les CM. Le nombre inférieur aux 372 éditions
S5 correspond aux CN juniors, qui sont préparés avec les nations représentées
et les traitements dédiés ; la création d'une Dev Team appelle explicitement
`ensure_development_race_calendar` après sa composition. Ce nombre anticipé
ne doit pas être confondu avec un calendrier professionnel incomplet ou une
disparition des CM juniors. La matérialisation des CN et les inscriptions
restent à contrôler sur le calendrier actif après la bascule.

## Vérification isolée et preuves

Les tests suivants passent dans PGlite local, sans client distant, sans
identifiants et sans écriture de jeu en production :

- `scripts/verify-season-rollover-reliability.mjs` : compilation du patch réel,
  factures et relance idempotentes, classement figé, isolation des gardes,
  horloge de reprise, santé, contrôles d'âge/profil et conservation des tactiques
  lors d'une promotion junior. Seul l'import du runtime local a été adapté dans
  un wrapper temporaire.
- `scripts/test-post-olympic-nations-cup-integrity-sql.mjs` : 24 assertions,
  régression historique des budgets, sources S6/S7/S8/S9 et refus des divisions
  provisoires.

Captures locales : `C:/Dev/artifacts/s6-readiness-20261127/`, fichiers
`functions.json`, `state.json`, `preflight.json`, `calendar-functions.json` et
`last-triggers.json`.
Elles décrivent l'état observé le 27 novembre ; aucun résultat S5 futur n'est
inventé. Aucun correctif du moteur de bascule n'a été nécessaire à ce stade.

Après le 3 décembre, la preuve finale attendue reste le reçu S5 → S6, S5
clôturée/S6 active J1, les quinze compteurs à zéro et la santé verte. Un simple
HTTP 200 ou un cron indiqué réussi ne remplace pas ce reçu.
