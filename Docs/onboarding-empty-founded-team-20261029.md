# Parcours découverte : équipe fondée sans coureur actif

## Cas constaté

Lecture seule du compte Mr0 : profil complet, équipe active « Les Gb’s », identité fondatrice enregistrée le 23 juillet, saison d'équipe actuelle active, sept contrats historiques mais aucun contrat actif. Le parcours était enregistré à `team-foundation` (étape 7).

La page masquait correctement le formulaire d'une équipe déjà configurée. Le contrôle du didacticiel, lui, assimilait `équipe créée` à `équipe avec au moins un coureur actif`. Il demandait donc une fondation impossible à recommencer et refusait l'étape suivante.

## Correction

- La présence d'un effectif conserve le chemin de lecture existant. Dans le seul cas où le résumé ne prouve pas la création, une lecture jointe de l'affectation active du DS et de l'identité fondatrice vérifie si l'équipe est déjà fondée.
- Le contrôle est serveur, limité au DS authentifié et à une affectation active de manager général. Une identité technique non configurée, une équipe inactive ou une erreur de lecture ne permettent pas de passer.
- Aucun test ni mutation de jeu en production, aucun nouveau coureur créé, aucun changement de contrat, de trésorerie ou de récompense. Les données du parcours ne sont pas réécrites manuellement.
- Au rechargement, la reprise existante saute l'action de fondation déjà accomplie ; le bouton Suivant peut également atteindre la présentation de l'effectif.
- Le texte explique les champs et le bouton de fondation. Un effectif vide donne accès au marché des coureurs libres plutôt que de laisser penser à un échec de récupération.
- La validation du profil, la création des sept premiers coureurs pour une nouvelle carrière et la sélection obligatoire de cinq coureurs du Critérium sont conservées.

Validation : tests du cas fondé/vide, des nouvelles carrières, des droits, des erreurs et de l'absence de lecture supplémentaire pour un effectif normal ; tests existants du catalogue, des prérequis, de l'interface du parcours et des traductions.
