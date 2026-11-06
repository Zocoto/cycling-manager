# Bilan sponsor de la saison précédente

La page Sponsoring affiche, au-dessus du partenariat actuel, le bilan du sponsor principal de la saison immédiatement précédente. Les indicateurs et les deux dotations sont visibles ; un volet dépliable contient tous les objectifs, leur résultat final et leurs éventuelles réussites partielles.

## Données et calculs

- Lecture des archives `sponsor_annual_objective_history` pour les contrats reconduits, sans utiliser la satisfaction remise à zéro de la nouvelle saison.
- Pour un contrat arrivé à terme ou rompu, lecture de ses compteurs conservés si sa saison d’objectifs correspond à la saison précédente.
- Lecture des objectifs de l’offre historique, avec progression filtrée sur le contrat et la saison historiques. Aucun appel d’évaluation, de préparation d’objectifs ou d’écriture n’est ajouté.
- Une donnée absente reste absente : aucun score zéro, échec ou résultat n’est inventé.
- Les dotations utilisent les mêmes données que la courbe financière existante. La variation réelle est affichée en euros et en pourcentage lorsque les devises sont comparables.
- Pour un même contrat reconduit depuis S3 : base après satisfaction calculée selon le barème existant, puis différence en euros avec la dotation finale. L’ambition, les conditions négociées et les arrondis restent distincts du seul effet de la satisfaction.
- Pour un nouveau contrat, la comparaison reste visible mais son évolution n’est pas présentée comme un bonus de satisfaction.
- Le poids des objectifs est affiché séparément de la satisfaction globale, qui peut également inclure les bonus sportifs, engagements et effets de l’équipe. Les primes ponctuelles ne sont pas assimilées à la dotation annuelle.

## Performances et sécurité

Les cinq lectures de l’historique financier sont réutilisées. Une seule lecture complémentaire, bornée à 50 objectifs et trois secondes, charge le programme historique en entier. Pas de requête par objectif, pas de polling ni de nouveau cache partagé. L’équipe vient de la résolution du joueur authentifié déjà utilisée par le service de sponsoring ; les contrats sont limités à cette équipe.

Une indisponibilité du détail optionnel ne masque ni les montants et la satisfaction archivés, ni le partenariat actuel. La fonction historique existante reste disponible sans lecture complémentaire pour ses autres consommateurs.

Le correctif est exclusivement applicatif : aucune migration, aucun recalcul de dotation et aucun mouvement financier.

## Validation

Tests ciblés des archives et contrats arrivés à terme, du changement de sponsor, des réussites partielles, des données manquantes, des devises et de l’isolation des saisons ; tests du service, des compteurs financiers, du composant et du parcours de sponsoring existant. Vérification du lint et du catalogue français/anglais.

Le 6 novembre, la requête PostgREST exacte a été vérifiée en lecture seule sur une archive S4 réelle : dix objectifs et dix progressions historiques, environ 202 ms. Les lectures sont séquentielles et limitées à cinq secondes. Le cas observé de 320 000 € en S4 et 350 720 € en S5 correspond bien à 98 % de satisfaction finale, soit +9,6 %. Le champ historique `renewal_budget_adjustment_percent` peut contenir une ancienne projection et n’est donc pas utilisé comme variation finale.

Preuves de vérification locale : `C:/Dev/artifacts/sponsor-annual-report-20261106`.
