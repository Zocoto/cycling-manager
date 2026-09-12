# Objectifs sponsors annuels — correction du 11 septembre 2026

## Diagnostic

Huit contrats principaux pluriannuels restaient liés à leur offre et leurs objectifs S2 après le passage en S3. La création des programmes annuels dépendait d’une visite du DS sur la page sponsor. Le changement de saison n’activait que les offres déjà préparées.

Le « Top 8 sur Championnat de Danemark - Route » de Lima Maki pointait vers l’édition S2 terminée le 21 août ; l’édition S3 du 18 septembre était encore planifiée. Aucun objectif S3 n’était alors en échec. Le problème concernait 80 objectifs anciens, dont 11 échecs sur des CN.

Deux fonctions internes de l’évaluation utilisaient également `start_season_id` au lieu de la saison annuelle du contrat. Enfin, le résumé du Bureau cumulait toutes les saisons du même contrat.

## Correctif

- Préparation automatique de dix objectifs lors du changement de saison, avant l’activation et le calcul du budget annuel : priorité au programme négocié existant, sinon reconduction des exigences sur de nouveaux identifiants et les éditions de la nouvelle saison.
- Les anciens emplacements fictifs « engagement neutralisé / zéro victoire » deviennent des objectifs sur des courses standard accessibles au DS, hors Elite et régionales, sans doublonner les courses déjà demandées. Le programme totalise 100 points.
- Rattrapage des contrats de la saison active uniquement, sans modification des budgets, trésoreries, réputations, durée juridique ou maillots.
- Conservation intégrale des objectifs/progressions historiques et archivage des anciens compteurs annuels avant remise à zéro.
- Évaluation de tous les types sur la saison annuelle, contrôle de la saison des éditions et isolation des pénalités entre saisons.
- Résumé du Bureau limité à la saison annuelle du contrat.

## Vérifications avant livraison

- Sept scénarios PostgreSQL isolés dans `scripts/verify-annual-sponsor-rollover.mjs` : rattrapage, anciens identifiants d’éditions, neutralisations, objectifs fictifs, S3 → S4 sans visite, négociations/objectif manquant, contrats expirés et permissions. Les fonctions d’évaluation et le bloc sponsor du changement de saison viennent des migrations réelles ; les autres mécaniques du changement de saison sont exclues de ce banc de test.
- Vingt tests Vitest ciblés réussis.
- Test sur les données réelles dans une transaction entièrement annulée : 8 contrats rattrapés, 80 objectifs S3 actifs, 80 objectifs et 65 progressions historiques inchangés. Comparaison exacte des champs juridiques/budgétaires des contrats, des équipes et de la réputation des DS ; relance sans effet.
- Sauvegardes privées locales des fonctions SQL et des lignes concernées avant intervention.

Migration dédiée : `20260911160000_ensure_annual_sponsor_objective_rollover.sql`. Les correctifs de convocations et de tirage des pays hôtes présents dans le répertoire de travail restent hors de cette livraison.
