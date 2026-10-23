# Bilans des championnats continentaux professionnels — 23 octobre 2026

## Incident et correction

Fra Troisset / Kaffa Origins n'avait reçu aucun des quatre bilans CC CLM
correspondant à ses six participants. Aucun courrier n'était archivé ou supprimé.
Les cinq CC CLM terminés utilisaient des inscriptions nationales sans
`race_registrations.team_season_id`, exclues par le producteur historique.

Migration ciblée : `20261023150000_fix_federation_result_mail_recipients.sql`.
Elle ne remplace que quatre fragments vérifiés de
`public.publish_director_race_result_messages(uuid)` :

- destinataire des inscriptions de club résolu comme auparavant vers leur GM actif ;
- ajout des CC/CM **professionnels**, via inscription, lien de sélection, membre
  confirmé et propriétaire DS/équipe figé lors de la convocation ;
- équipe-saison prise dans la saison de la course, sans contrat courant ni
  routage vers le président de fédération ;
- agrégation par destinataire et équipe-saison avant insertion, y compris
  plusieurs nationalités ou une édition mixant inscriptions club/fédération.

Conservés : clé `race-result:edition:team-season`, règles de pertinence des
courses de club, droits du service, filtre DS actif, déclenchement à la fin de
course, suppression durable et états lu/archivé/date d'envoi lors d'une reprise.
Pas de nouvelle table, d'index, de tâche récurrente ou de requête au chargement
des pages. Pas d'extension du moteur junior, Nations Cup ou JO dans ce correctif.

## Vérifications

- 20 tests Vitest : migration ciblée, boîte mail et suppressions durables.
- 78 assertions PostgreSQL/PGlite en mémoire uniquement : vraie ancienne
  fonction, migration, triggers de complétion et suppression, cas club/fédération
  mixte, reprise, transferts, autres saisons, propriétaires absents/inactifs,
  membres non confirmés et non-participants. Contenu et états des mails de club
  comparés intégralement avant/après ; état sportif et financier inchangé.
- ESLint et `git diff --check` réussis.
- Mesures indicatives sur petites fixtures PGlite chaudes : médiane club
  1,25 → 1,38 ms ; CC corrigé 1,92 ms. Ce ne sont pas des mesures de production.

## Livraison et rattrapage de production

Précontrôle et contrôle final en lecture seule, requêtes sérialisées et bornées.
Migration appliquée avec attente de verrou limitée à 1 s et instruction à 5 s,
puis enregistrée dans l'historique Supabase. Aucune migration étrangère appliquée.
Empreintes du corps normalisé :

- avant : `53946e3afaabbdba8b95877ab6925265` ;
- après : `9ddb707cebed9cabf946ff66a70b81c7`.

Rattrapage réel par le producteur corrigé, une édition par transaction, sans
relancer simulations, classements, récompenses ou traitement de saison :

| CC CLM | Bilans attendus et créés |
| --- | ---: |
| Afrique | 13 |
| Amérique | 16 |
| Asie | 12 |
| Europe | 15 |
| Océanie | 6 |
| Total | 62 |

Contrôle final le 23 octobre à 16 h 53 (Europe/Paris) : 0 bilan manquant,
les quatre courriers de Fra Troisset présents, non lus et non archivés.
Empreintes et nombres des **143 résultats officiels** strictement identiques.
Propriétaire, ACL, `security definer`, `search_path` et deux triggers de protection
inchangés. Base joignable, aucune connexion de migration/rattrapage restante.
Contrôle HTTP : `/connexion` répond 200 ; `/jeu/messagerie` conserve la
redirection d'authentification 307 pour un visiteur non connecté.

Le correctif est exécuté côté base ; aucune modification de l'interface ou
redéploiement applicatif n'est nécessaire à son activation.
