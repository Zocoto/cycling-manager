# Programme international — 15 octobre 2026

## CC / Dodo Blue Finance

Diagnostic de production en lecture seule : saison 4, J7. Pour Maurice comme
pour la France, les créneaux CC professionnels ont un calendrier valide,
`can_prepare=true`, `qualification_status=pending`, `is_open=false`.
Les qualifications sont figées à J8 : il ne faut pas contourner cette règle.
Les brouillons de Maurice sont présents. Le bouton explique désormais
« Qualifications à J8 · brouillon conservé ». Les CC juniors sont ouverts.
Aucune décision de DS ni qualification n’a été inventée ou acceptée à sa place.

## Jeux quadriennaux

Bandeau dédié fond nuit / or, cinq couleurs et rubans, sur la page des Jeux.
Accès permanent sur le bureau pendant les saisons quadriennales, chargé en
streaming sans bloquer les données essentielles du bureau. Présentation
renforcée dans le panneau de sélection fédérale. Aucun changement du moteur,
des quotas ou des règles d’engagement.

## Retrait de la Nations Cup junior

Migration additive `20261015160000` :

- suppression de la génération de la course et des étapes futures ;
- créneau indisponible côté SQL et interface, API de sauvegarde/publication fermée ;
- neutralisation de la génération automatique et de la synchronisation de cette sélection ;
- annulation des éditions non disputées, inscriptions retirées, convocations déclinées ;
- archivage des notifications actionnables correspondantes ;
- retrait des candidatures d’accueil et garde-fous contre de nouvelles candidatures ;
- retrait des références actives dans les calendriers, annuaires, sélections et pages juniors.

Les éditions et résultats déjà disputés (S3) sont conservés. Les anciennes
valeurs de type restent reconnues pour lire les archives. Aucune candidature
ni attribution d’accueil n’existait pour cette épreuve lors du diagnostic :
aucun débit d’accueil à rembourser. La migration s’arrête si une attribution
payante apparaît entretemps. Avant-images conservées dans une table audit
non accessible aux joueurs. Pas de suppression de coureurs ni de résultats.

## Vérifications

`scripts/test-local-junior-cup-retirement.mjs` exécute la migration réelle dans
PGlite isolé (20 contrôles), à partir des définitions capturées en lecture seule
par `scripts/audit-international-events-20261015.mjs`.
Il teste l’historique, les retraits, les notifications, la génération suivante,
les dix CC juniors maintenus et le refus des nouvelles candidatures d’accueil.
Le script d’application compare les définitions testées à celles déployées,
applique uniquement cette migration, vérifie la santé et enregistre sa version.
