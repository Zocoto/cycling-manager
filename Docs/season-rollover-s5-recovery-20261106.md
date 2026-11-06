# Bascule S4 → S5 : contrôle Nations Cup après les Jeux

## Cause et chronologie confirmée

Le 9 octobre, les contrôles de bascule ont imposé que les affectations de
Nations Cup proviennent de la saison immédiatement précédente. Le 12 octobre,
`20261012160000_global_olympic_quotas_and_callups.sql` a changé le générateur :
les divisions héritent désormais de la dernière saison antérieure non
quadriennale (`game_year % 4 <> 0`). Les contrôles n’ont pas suivi cette règle.

S4 était une saison des Jeux. Les affectations S5 issues de la Nations Cup S3
étaient donc correctes, mais le contrôle attendait S4 et rejetait les 174 nations.
Le retrait de la Nations Cup junior est distinct de ce circuit professionnel.

Les diagnostics transmis le 6 novembre confirment :

- S4 active, S5 planifiée, aucun reçu de bascule S4 → S5.
- Échecs du cron à 00:00, 00:10 et 00:20 UTC, après environ deux minutes :
  `invalidNationsCupAssignments = 174`, les quatorze autres contrôles à zéro.
- Une exécution indiquée réussie à 00:30 UTC ne prouve pas à elle seule la
  bascule : la reprise manuelle était encore active et le moteur peut renvoyer
  `pending / already_running` sans reçu.

La transaction atomique a empêché une bascule partielle. Le cron PostgreSQL
`daily-season-rollover` doit réessayer toutes les dix minutes ; le secours
Vercel de 23:05 UTC correspond à 00:05 Paris en novembre.

## Correction et preuves

`20261106010000_fix_post_olympic_nations_cup_integrity.sql` aligne seulement
trois comparateurs sur la règle existante du générateur :

- `get_season_rollover_integrity(uuid, uuid)` ;
- `get_season_rollover_health()` ;
- `repair_nations_cup_opening_budgets(uuid)`.

Les affectations provisoires `initial` restent rejetées. Les autres contrôles,
les divisions, résultats, comptes, écritures financières et reçus ne sont pas
réécrits. La migration n’exécute aucune bascule ni réparation de budgets.

Le test local `scripts/test-post-olympic-nations-cup-integrity-sql.mjs` réussit
24 nouvelles assertions et la régression historique des budgets. Une seconde
exécution indépendante confirme ces résultats. Il reproduit les 174 faux
échecs, accepte S5 → S3, rejette S5 → S4 et les affectations provisoires, puis
vérifie S6, S7, S8 et S9, les droits, OID, configurations et relances sans effet.
La comparaison des définitions capturées conserve les quinze clés d’intégrité.

SHA-256 de la migration, après normalisation LF :
`f4c48bb5c6e3e9b2bb3619c08f3f862bc2516d4695000214b27ad56015bf85e1`.
Le script `scripts/deliver-post-olympic-rollover-integrity.mjs` installe et
vérifie ces seules fonctions et le reçu de migration ; il ne règle aucun jeu.

## Rattrapage par les traitements existants

Procéder en série, après vérification de la santé de la base et de l’absence
d’un autre règlement en cours. Après un timeout, vérifier la fin de la
transaction avant toute relance.

1. Installer la migration revue, vérifier son reçu et les empreintes, puis
   réutiliser `settle_due_season_rollovers()` sans forçage. Le cron utilise un
   budget de cinq minutes et un délai de verrou de cinq secondes. Ne pas
   modifier directement les statuts des saisons.
2. Confirmer S4 clôturée, S5 active en J1, le reçu S4 → S5, les quinze contrôles
   à zéro et `get_season_rollover_health().healthy = true`. Un HTTP 200 ou un
   statut de cron réussi ne suffit pas.
3. Draft : le trigger du reçu réserve le vivier dans la transaction. Le cron
   existant `process_season_draft()` passe chaque minute et ouvre la préparation
   dès 08 h Paris. Après 14 h, une ouverture retardée donne au premier tour
   manuel dix minutes à partir du traitement, sans échéance rétrodatée.
4. Album : réutiliser la maintenance `staff-academy` existante aux minutes
   04/19/34/49 UTC. La publication exige S4 clôturée et S5 active, utilise un
   bail de 120 secondes et valide la série finale et son empreinte. La fenêtre
   de reprise s’étend du 6 novembre au 3 décembre Paris. Vérifier le catalogue
   public final ; ne pas publier l’aperçu provisoire.
5. Calendrier : la bascule appelle déjà `ensure_due_professional_nations_cup()`.
   Contrôler les cinq disciplines professionnelles S5 et leurs affectations,
   sans recréer les résultats S4 ni réactiver la Coupe junior retirée.
6. Si 08 h est dépassé, contrôler puis reprendre séparément les maintenances
   existantes d’entraînement, de santé et de staff. Vérifier aussi les contrats
   sponsors activés et les échéances J1 ; utiliser les règlements existants,
   sans crédit ni séance compensatoire inventés.

## État production

- Migration installée et reçu vérifié à 00:27 UTC ; les trois définitions ont
  exactement les empreintes prévues, sans modification des OID, droits ou
  configurations. Le générateur et le règlement sont inchangés.
- Reprise idempotente lancée à 00:28:34 UTC, terminée à 00:30:29 UTC :
  126 équipes reportées, 2 399 fiches de coureurs copiées, 142 juniors promus,
  139 juniors libérés. Reçu durable S4 → S5 présent, S4 clôturée et S5 active J1.
- Les quinze contrôles d’intégrité valent zéro et la santé est verte.
- Draft : 100 coureurs réservés, ouverture à 08 h Paris, choix à 14 h Paris ;
  statut planifié attendu à cette heure, aucune échéance manuelle active.
- Nations Cup : les cinq disciplines ont chacune huit manches, sans édition
  manquante ni annulée.
- Album publié automatiquement par la maintenance existante à 00:34:36 UTC,
  dès sa première tentative : 72 cartes, `enabled` et `publicApproved` à vrai.
- Ventes du fan-club J1 reprises à 00:37 UTC par le règlement existant :
  13 équipes, 13 journées, 955 articles, zéro équipe en échec. Aucun crédit
  manuel ni doublon ; aucun retour d'hébergement S4 encore en attente.
- À 00:32 UTC, authentification et page de connexion répondent HTTP 200
  (244 et 221 ms). Les entraînements de 08 h ne sont pas encore échus.

Preuves locales : `C:/Dev/artifacts/rollover-recovery-20261106/`, notamment
`migration-verification.json`, `real-rollover-recovery-result.json`,
`final-verification.json`, `integrity-verification.json` et `app-health.json`.

## Prévention ciblée

Conserver un test de chaîne S3 → S4 → S5 et S7 → S8 → S9 couvrant ensemble le
générateur, l’intégrité et la santé. Lors d’un changement de calendrier sportif,
revoir les contrôles et outils de réparation qui supposent une saison source.
Utiliser le contrôle de santé et les journaux existants pour signaler une saison
échue sans reçu ; distinguer explicitement un retour `pending` d’un règlement
effectif. Aucun nouveau service payant n’est nécessaire.
