# CM/CC professionnels — quotas à partir de la saison 5

Validation propriétaire le 26 octobre 2026. Aucune modification des qualifications,
inscriptions, confirmations ou résultats de la saison 4 ; juniors, Nations Cup
et Jeux quadriennaux conservent leurs règles.

Le classement de qualification et sa formule restent inchangés : points de la
saison + 25 % des points précédents, figés à J8. CM : 60 nations. CC : toutes
les nations ayant un coureur éligible avec des notes pour la saison.

| Rang | CM route | CC route |
| --- | ---: | ---: |
| 1–5 | 8 | 8 |
| 6–10 | 8 | 6 |
| 11–20 | 4 | 5 |
| 21–30 | 4 | 4 |
| 31–40 | 2 | 3 |
| 41–60 | 2 | 2 |
| 61+ | 0 | 2 |

CLM : 2 places jusqu'au rang 20, puis 1 (jusqu'au rang 60 aux CM).
Pas de redistribution des places inutilisées. La validation du DS reste obligatoire.

## Chaîne et non-régression

- Le résolveur de quota existant dessert brouillons, publication, sélection
  automatique, remplacements et startlists. Les confirmations concurrentes sont
  sérialisées par le verrou parental existant, puis contrôlées contre le quota.
- RPC de lecture versionné uniquement à partir de S5 : même nombre de requêtes
  sur la page. Affichage du quota, du rang, et avertissement si un brouillon J1–J7
  doit être réduit après le gel J8. Aucune suppression automatique de coureurs.
- Les capacités des futures éditions sont calculées à leur création/mise à jour.
  Les limites individuelles s'appliquent à route et CLM séparément.
- Aucun changement du moteur de simulation, des délais, récompenses, autorisations
  présidentielles, protections de calendrier ou de l'éligibilité médicale.
- Aucun nouveau cron, aucun traitement à lancer manuellement chaque saison.

## Vérifications isolées

`node scripts/test-local-global-olympics.mjs <pglite>/dist/index.js --s5-quotas`
exécute les vraies fonctions PostgreSQL : JQ, qualification, présélection,
consentement du DS, startlist, remplacement, bornes des quotas et protection S4.
Ajouter `--japan-exception` pour couvrir aussi l'exception de transition S4.
Ces fixtures ne doivent jamais être exécutées sur Supabase.

Livraison : `scripts/deliver-s5-championship-quotas.mjs`, précontrôle en lecture
seule, migration exacte bornée (verrous 3 s / requêtes 15 s), puis vérification
des empreintes S4 et des fonctions conservées avant déploiement de l'application.
