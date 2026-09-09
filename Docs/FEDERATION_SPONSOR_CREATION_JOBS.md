# Jobs de création de sponsors fédéraux

Le Bureau d’organisation fédéral de niveau 5 permet au président de lancer une
prospection par saison. Chaque demande crée un job persistant dans
`national_federation_sponsor_creation_jobs`.

## Workflow du chat de création

1. Lister les demandes à traiter :
   `npm run sponsors:jobs -- list`
2. Réserver la plus ancienne demande :
   `npm run sponsors:jobs -- claim`
   Un identifiant précis peut être ajouté après `claim`.
3. Créer le sponsor pour le pays retourné, avec son logo, ses trois maillots et
   ses métadonnées dans `data/sponsors`.
4. Valider puis synchroniser le catalogue :
   `npm run sponsors:validate:strict`
   puis `npm run sponsors:sync`.
5. Publier le résultat dans le job :
   `npm run sponsors:jobs -- complete <job-id> <catalog-key>`.

En cas d’interruption après la réservation, le même job peut être repris avec
`claim <job-id>`. En cas d’échec réel, utiliser
`npm run sponsors:jobs -- fail <job-id> <motif>` : le job repasse dans la liste
à reprendre et n’ouvre jamais un second quota pour la saison.

`npm run sponsors:jobs -- list --all` inclut les sponsors déjà publiés.
