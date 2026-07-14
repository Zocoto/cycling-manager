# Base de données

## Objectif

La base de données de Cycling Manager est hébergée sur Supabase et repose sur PostgreSQL.

Le modèle est conçu pour conserver l’historique du jeu au fil des saisons :

- changements de sponsors ;
- changements de division ;
- contrats des coureurs ;
- évolution de l’âge et des statistiques ;
- éditions successives des courses ;
- résultats sportifs ;
- progression des objectifs sponsor.

Les évolutions du schéma sont enregistrées sous forme de migrations SQL dans :

```text
supabase/migrations/