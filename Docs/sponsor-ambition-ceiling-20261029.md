# Ambition sponsor au-dessus du plafond catalogue

Arbitrage validé le 29 octobre 2026 : le plafond catalogue borne l’offre initiale,
pas la majoration obtenue en échange d’objectifs ambitieux. Le plafond effectif
vaut le maximum du plafond catalogue, de la base réelle et du palier ambitieux
(base × 1,10 arrondie à 10 000 €). Accessible et équilibré gardent leur barème.

Cas Terroirs Unis : base estimée 451 810 €, catalogue 420 000 € ; accessible
410 000 €, équilibré 451 810 €, ambitieux 500 000 €. La satisfaction évoluant
jusqu’à la clôture, ces montants restent des estimations pour la saison suivante.

La correction est commune à l’aperçu, à la négociation d’une nouvelle offre,
aux programmes annuels d’un contrat continu, au renouvellement à échéance et
au changement de saison. Les plafonds enregistrés auparavant ne peuvent pas
écraser une nouvelle hausse de satisfaction ou d’ambition. Les investissements
de réputation à la signature restent des suppléments du contrat et sont conservés
lors du recalcul des contrats futurs déjà signés.

La migration ne recalcule que les offres ouvertes/acceptées de la prochaine
saison planifiée et leurs contrats principaux encore planifiés. Elle conserve
les difficultés et objectifs choisis. Aucun changement des contrats actifs,
des budgets historiques, de la trésorerie ou des transactions déjà postées.
Les mécanismes existants de plafonnement des primes d’objectifs sont conservés.
Aucun nouvel appel HTTP, parcours des résultats de course ni tâche planifiée.

Validation isolée :
`node scripts/test-sponsor-ambition-ceiling.mjs <module PGlite>`.
Le banc exerce les fonctions réelles, y compris le bloc sponsor du rollover,
les gardes de propriété/calendrier et les privilèges. Une copie en lecture seule
des six définitions de production peut être utilisée depuis le dossier ignoré
`artifacts/sponsor-ambition-ceiling-20261029/` pour vérifier l’absence de dérive.

Livraison : `node scripts/deliver-sponsor-ambition-ceiling.mjs --apply-reviewed`.
Le script n’exécute que la migration revue avec délais bornés, enregistre son
reçu atomiquement, vérifie les offres futures et la santé de Supabase. Il ne
déclenche ni négociation, ni clôture de saison, ni règlement financier.
