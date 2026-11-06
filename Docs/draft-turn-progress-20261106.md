# Progression visible de la draft

La page Draft affiche le numéro du choix en cours et le nombre de DS encore en attente avant le tour du joueur. Le compteur ne comprend pas les équipes qui ont déjà recruté ou passé leur tour. Avant le démarrage et entre deux traitements sans choix actif, le prochain numéro est présenté comme un prochain choix, pas comme un tour déjà ouvert.

Les six derniers choix résolus apparaissent directement sous le suivi du tour : numéro, équipe, coureur recruté ou raison du tour passé. Le lien « Voir tous les choix » ouvre l’historique complet et y conduit. Tous les recrutements conservent le nom enregistré ; le nom du vivier sert de repli si nécessaire.

Après le recrutement ou le passage du joueur, le compteur d’attente disparaît. Il n’est pas inventé si la liste des participants est incomplète. Les textes existent en français et en anglais.

Présentation exclusivement calculée à partir de `get_season_draft_view`, sans nouveau champ, requête, cache ni migration. La fréquence de rafraîchissement existante reste inchangée. Les calculs sont mémorisés par version de la vue, pas refaits à chaque seconde du compte à rebours. Aucun ordre, délai, choix automatique ou préférence n’est modifié.

Tests ciblés : compteurs en préparation et pendant la draft, participants déjà résolus, tour personnel terminé, liste incomplète, intervalle entre traitements, noms conservés et noms du vivier, ordre des derniers choix et affichage du panneau. Les tests existants de validation, d’édition des préférences et de confirmation sont conservés.
