# Suppression du compte Directeur Sportif

## Objectif

La page `/jeu/directeur-sportif` comporte une zone dangereuse permettant au joueur de supprimer définitivement sa carrière et son compte de connexion.

La suppression requiert l’ouverture d’une fenêtre de confirmation puis la saisie exacte du mot-clé `SUPPRIMER`.

## Données supprimées

- le profil du Directeur Sportif ;
- son équipe amateur et ses saisons ;
- les affectations du manager ;
- les contrats des coureurs avec cette équipe ;
- les contrats, offres et objectifs de sponsoring propres à cette carrière ;
- les inscriptions et compositions de l’équipe sur les courses sans résultat ;
- le compte Supabase Auth, ce qui permet de réutiliser ultérieurement l’adresse e-mail ;
- le pseudonyme public redevient disponible après la suppression du profil.

## Données conservées

- les coureurs et leurs caractéristiques saisonnières ;
- les coureurs sans autre contrat actif passent au statut `free_agent` ;
- les sponsors restent dans leur référentiel et redeviennent disponibles dès la suppression de leur contrat avec l’équipe ;
- les pays, saisons, courses et autres référentiels permanents.

## Intégrité sportive

La suppression métier s’exécute dans une transaction unique. Si une étape échoue, aucun changement partiel n’est conservé.

Une carrière possédant déjà des résultats de course ou d’étape ne peut pas être effacée, car cela altérerait les palmarès publics. Lorsque les résultats et l’historique sportif seront actifs, ces carrières utiliseront une future mécanique de retraite ou d’archivage.

## Sécurité

- l’identité du compte est toujours dérivée de la session vérifiée côté serveur ;
- aucun identifiant de Directeur Sportif ou d’équipe n’est accepté depuis le navigateur ;
- l’appel métier est réservé au rôle `authenticated` ;
- la suppression du compte Auth utilise uniquement la clé secrète côté serveur ;
- l’opération métier est réessayable si la fermeture du compte Auth échoue après la transaction.
