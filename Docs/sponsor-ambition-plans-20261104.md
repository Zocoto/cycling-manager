# Conservation des objectifs par ambition

Une négociation supprimait les dix objectifs et les recréait à partir du marché
et du contexte sportif courants. Normal → Ambitieux → Normal pouvait donc
changer le coureur à recruter ou les courses demandées.

Chaque offre conserve désormais un instantané privé par niveau (accessible,
équilibré, ambitieux). Au premier départ d'un niveau, les dix objectifs et leurs
liens sont archivés. Revenir à ce niveau restaure les mêmes identifiants, cibles,
exigences, ordre et pondérations. Un nouvel envoi du niveau déjà sélectionné
ne supprime rien. Le premier passage à un niveau inédit utilise le générateur
existant. Les instantanés sont propres à l'offre, donc au sponsor, au DS et à la
saison ; trois au maximum et suppression en cascade avec l'offre.

Le correctif couvre les offres ouvertes et les programmes annuels des contrats
pluriannuels. Un changement du budget annuel selon la satisfaction ne supprime
plus les objectifs proposés. Les règles de budget, d'ambition et de plafonnement
des primes restent en vigueur. L'archivage précède le changement de budget pour
éviter que le palier temporairement inférieur réduise la prime du niveau quitté.
Les primes restaurées restent soumises aux plafonds existants.

Les contrats signés restent protégés par les contrôles actuels. Une progression
déjà présente bloque également l'archivage plutôt que de la supprimer. Un plan
partiel n'est jamais figé comme un plan complet. Un ancien rendu serveur ne peut
pas insérer les objectifs du mauvais niveau après une négociation concurrente.

L'installation n'effectue aucun tirage, changement d'ambition, rattrapage de
contrat ou règlement financier. Aucun nouveau chargement HTTP, changement
d'interface ou traitement quotidien. Les copies sont limitées aux dix lignes
de l'offre négociée et à leurs liens indexés. Les anciennes versions supprimées
avant ce mécanisme ne sont pas reconstituées ; la conservation part des plans
encore présents, puis du premier plan proposé pour les autres niveaux.

Validation isolée :

```text
node scripts/test-sponsor-ambition-plans.mjs <module PGlite> <runtime.json> <dossier de preuves>
```

Le banc utilise les trois fonctions et les six types de lignes lus en production,
dans une base PostgreSQL isolée. Il couvre les allers-retours répétés, les liens et
primes, les contrats annuels, les budgets évolutifs, les gardes d'accès/calendrier/
signature, l'activation du plan sélectionné, les rendus obsolètes et l'annulation
atomique en cas de dérive. 117 contrôles SQL et 59 tests du sponsoring réussis.

Livraison SQL uniquement : définir `SUPABASE_LINKED_WORKDIR=C:/Dev/cycling-manager`,
puis `node scripts/deliver-sponsor-ambition-plans.mjs --inspect|--apply|--verify`.
Le script exige les preuves isolées correspondant au hash exact de la migration
et aux fonctions courantes, enregistre le reçu atomiquement et vérifie le code,
les permissions, la connectivité SQL et l'application publique. Aucun test de
négociation ou changement temporaire de données n'est exécuté en production.

Migration appliquée et reçue le 4 novembre 2026 à 09:40 UTC (10:40 à Paris).
Les trois définitions installées correspondent exactement aux fonctions testées.
Permissions conservées, RLS privée vérifiée, SQL disponible et page publique
HTTP 200. Signature, rollover, évaluation et résumé du tableau de bord inchangés.
Preuves locales : `C:/Dev/artifacts/sponsor-ambition-plans-20261104/`.
