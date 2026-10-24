# Nombre de DS lors du choix initial du pays

Les listes de nationalité du DS et de pays d’affiliation de l’équipe amateur affichent un badge « 12 DS » à côté de chaque pays. Le badge reste visible sur le pays sélectionné avant validation. Les champs déjà verrouillés conservent leur présentation habituelle.

Le chiffre désigne les DS joueurs de cette nationalité (`sporting_directors.country_id`), indépendamment du pays de leur sponsor ou de leur équipe. Les comptes désactivés, les identités sans utilisateur et les bots sont exclus. Les pays jouables sans joueur affichent explicitement zéro. Le choix du pays et les règles de fondation sont inchangés.

La fonction SQL `get_onboarding_country_director_counts()` agrège tous les pays en un seul appel et ne retourne aucune identité. Seul `service_role` peut l’exécuter. Le serveur partage ce résultat pendant 60 secondes ; il ne le charge que lorsqu’un choix initial reste possible. Aucun chargement supplémentaire à l’ouverture du menu ou à chaque frappe. En cas d’indisponibilité, les badges disparaissent et le formulaire reste utilisable, sans faux zéro.

La migration additive `20261024120000_add_onboarding_country_director_counts.sql` ne modifie aucune donnée de jeu. Son installateur vérifie le projet lié, l’empreinte du fichier, l’absence de collision, les privilèges et les fonctions de création de carrière existantes. Les délais d’attente et d’exécution sont bornés.

Vérification : 18 tests applicatifs ciblés, 7 contrôles SQL sur PostgreSQL isolé (y compris plus de 1 000 joueurs et les droits d’accès), ESLint, catalogue de traduction et contrôle visuel PC/mobile. La page `/apercus/nationalites` utilise uniquement des nombres fictifs et renvoie 404 en production.

Commandes de recette :

```powershell
node node_modules/vitest/vitest.mjs run components/game/country-select.test.tsx services/onboarding-country-counts.test.ts lib/tutorial/onboarding-profile-focus.test.ts lib/game/onboarding-audit-fixes.test.ts
node scripts/test-onboarding-country-counts-sql.mjs C:/Dev/.tmp-chat-translation-sql-20261005/node_modules/@electric-sql/pglite/dist/index.js
node scripts/build-i18n-catalog.mjs --check
```
