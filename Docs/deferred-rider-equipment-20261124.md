# Matériel permanent différé — 24 novembre 2026

Le DS peut enregistrer un remplacement ou un retrait pendant une épreuve. Le montage permanent porté reste intact jusqu’à la fin réelle de l’édition entière, y compris les étapes suivantes d’un tour. Les surcharges de préparation par étape et leurs règles de gel ne changent pas.

## Règles

- Une ligne existante de `rider_equipment_pending_assignments` réserve le prochain choix par coureur et emplacement. `equipment_item_id = NULL` signifie un retrait différé.
- `blocking_race_edition_ids` mémorise les éditions bloquantes. Le premier départ à H−5, une édition en cours ou une simulation officielle déjà figée déclenchent le report. Les sélections internationales sans `team_season_id` de club sont également couvertes.
- `effective_at` est une estimation, pas une autorisation de modifier une course encore ouverte. Un report ou un retard d’homologation conserve l’ancien montage. Une fin réelle anticipée libère le changement même si l’estimation est future.
- Une nouvelle demande remplace le choix en attente. Choisir le matériel actuellement porté annule le changement. Si l’emplacement était vide, choisir le vide annule son équipement futur.
- Le matériel actuel et le remplacement restent réservés. Une pièce portée en course ne devient pas disponible pour un autre coureur ou une revente anticipée. Les échanges de pièces déjà occupées restent soumis au stock réellement libre.
- Les dotations partenaires valides, dont le supplément de réputation, restent admissibles. Les demandes devenues invalides ou appartenant à un coureur transféré ne sont pas appliquées.

## Application

Les RPC publiques et leurs types de retour sont conservés. Le bulk décore chaque coureur demandé une seule fois et garde les contrôles d’authentification, d’appartenance, de compatibilité et de stock existants.

Le règlement utilise la file existante : ouverture de l’atelier, maintenance toutes les quinze minutes et callback ciblé sur la clôture `completed`/`cancelled` d’une édition. Le callback utilise l’index GIN des éditions bloquantes et les verrous d’équipe avec `SKIP LOCKED`. Un échec de règlement matériel est journalisé sans annuler l’homologation sportive ; la maintenance peut reprendre la file. Une nouvelle course figée entre-temps empêche une application tardive au milieu de cette nouvelle épreuve.

Aucun nouvel appel permanent du calendrier ni nouveau cron n’est ajouté. L’interface réutilise le chargement des choix en attente et affiche le montage actuel séparément du futur choix.

## Livraison et vérification

Déployer d’abord l’interface compatible avec les retraits NULL, puis appliquer la migration `20261124143000_defer_permanent_equipment_until_race_completion.sql`. La migration est bornée à cinq secondes et à 500 ms d’attente de verrou ; ses transformations de fonctions vérifient leurs ancres et normalisent les fins de ligne Windows.

Les tests SQL sont isolés dans PGlite, avec les définitions des fonctions exportées en lecture seule. Aucune fixture de joueur n’est exécutée contre Supabase. Le script accepte le chemin du module PGlite puis celui du dossier des définitions :

```powershell
node scripts/test-deferred-rider-equipment-sql.mjs <pglite-index.js> <definitions-locales>
```

Les contrôles couvrent les tours entre étapes, les fins réelles et retardées, les retraits et annulations, les réservations, les lots atomiques, les compétitions internationales, les dotations partenaires, les droits et les préparations inchangées. L’interface a également été contrôlée sur des fenêtres de 390 et 1440 pixels avec des données locales fictives.
