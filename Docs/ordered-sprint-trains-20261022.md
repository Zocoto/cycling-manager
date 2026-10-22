# Préparation du sprint final

- Intégrée au plan d’étape existant, pour les équipes et les sélections nationales.
- Tous les poissons pilotes peuvent participer ; aucune limite de trois. L’ordre automatique est proposé, les flèches enregistrent un ordre personnalisé avec le plan habituel.
- Les rôles, missions spéciales, attaques, dépenses d’énergie et doctrines désactivées restent inchangés. Le réglage ne réaffecte jamais un coureur.
- Au final, seuls les helpers du peloton ayant au moins 18 d’énergie restent utilisables. Les préférences périmées, étrangères ou dupliquées sont ignorées, les nouveaux lanceurs complètent automatiquement le train.
- L’adéquation des relais évolue de la puissance sur le plat vers SPR/ACC et la fraîcheur. Elle ajuste la force collective de placement existante de ±3 au maximum ; aucun bonus de note ni coût d’énergie supplémentaire.
- Le calcul automatique fonctionne également sans plan enregistré. Le réglage reste sans effet sur un final sélectif, un contre-la-montre ou un prologue.
- Moteur v49 uniquement pour les prochaines simulations. Les scénarios officiels verrouillés ne sont jamais recalculés.

## Intégrité et coût

Migration additive `20261022200000` : une colonne `uuid[]` à défaut vide et quatre RPC d’extension. Les fonctions existantes de sauvegarde, de lecture, d’autorisation fédérale et de chrono restent strictement intactes. Les sauvegardes appellent d’abord les contrôles existants dans la même transaction ; pas de nouveau contrôle bloquant au moment de simuler.

La lecture conserve sa pagination et une seule requête par page, avec une jointure sur la clé primaire `(race_registration_id, stage_id)`. Pas de tâche planifiée, déclencheur ou requête par coureur ajouté. Le calcul d’ordre est en mémoire, sans nouvel appel aléatoire.

En cas de retour à l’application précédente, la nouvelle colonne et les RPC peuvent rester en place sans changer le fonctionnement historique.

## Vérifications

Tests de classement complet, déterminisme, nombreux lanceurs, fatigue, forfait, changement de rôle, données périmées, missions et attaques simultanées, parcours et chronos, non-rétroactivité officielle, pagination et interface verrouillée.

`scripts/test-sprint-train-sql.mjs` teste les nouvelles extensions dans PGlite isolé. Les RPC canoniques y sont des doubles de contrat ; le reçu de production vérifie séparément que les sept définitions réelles n’ont pas été modifiées. Aucun scénario ni coureur de test n’est créé en production.
