# Primes des Jeux quadriennaux

À partir des prochains Jeux, route et CLM ont chacun le même barème financier :

| Rang individuel | Prime au club du coureur |
| --- | ---: |
| 1 | 500 000 € |
| 2 | 300 000 € |
| 3 | 200 000 € |
| 4–5 | 100 000 € |
| 6–10 | 50 000 € |
| 11–20 | 20 000 € |
| 21–40 | 10 000 € |
| Autres classés | 4 000 € |

La fédération représentée par le vainqueur reçoit séparément 500 000 € par épreuve. Un même pays peut donc gagner 1 M€ en remportant la route et le CLM. Aucun versement aux non-partants, abandons, hors-délais ou disqualifiés. Le gain au club est individuel : deux coureurs classés du même club rapportent chacun la prime de leur place. Un agent libre sans club ne génère pas de versement à un club, mais peut rapporter la prime à sa fédération.

Cette livraison porte sur les primes financières demandées. Elle ne crée pas de nouveaux barèmes XP/UCI/réputation, d’objets ou de médailles. Le maillot distinctif et les titres existants restent gérés par leur circuit indépendant.

## Versement et intégration

- Le circuit normal persiste tous les résultats et termine les étapes avant d’appeler une seule RPC dédiée, avant de clôturer l’édition.
- Si aucun coureur n’est classé, aucun appel de primes n’est fait et la clôture normale continue.
- La RPC vérifie le registre officiel des Jeux, la saison multiple de quatre, la fin des étapes, un vainqueur unique et la présence des classements finaux correspondant aux résultats d’étape.
- Les inscriptions nationales n’ont pas de `team_season_id` de club. Le bénéficiaire est donc retrouvé via `national_federation_selection_members.owner_team_id`, dans la saison de l’épreuve. La fédération bénéficiaire vient de la liste de sélection liée à l’inscription, et non du pays du club ou de la nationalité actuelle du coureur.
- Le barème UI et le barème SQL sont comparés sur les rangs 1 à 300, ainsi que les rangs absents et invalides.
- Les crédits clubs utilisent `reward_events` et des recettes `race_prize` déjà comptabilisées dans le registre financier. La fédération reçoit une transaction `quadrennial_prize` et un crédit immédiat de son solde.
- La dotation annuelle `opening_balance`, la base de solidarité et le calcul des budgets de la saison suivante ne sont pas modifiés. Aucune prime à programmer ni à remettre en paiement au changement de saison.
- Tous les crédits d’une épreuve et le reçu de règlement sont atomiques. Verrou par édition, reçu unique par édition et références comptables uniques empêchent les doublons. Un compte club/fédération manquant fait échouer la transaction entière ; le circuit habituel peut réessayer sans doublon.
- Comme les autres versements définitifs du jeu, une modification administrative d’un classement déjà payé ne redistribue pas automatiquement les fonds. Le reçu conserve le résultat payé pour audit.
- Pas de requête supplémentaire dans les consultations habituelles, pas de nouveau déclencheur global. Une seule RPC supplémentaire pour chacune des deux épreuves des Jeux ; délais de verrouillage et d’exécution bornés.
- Aucun rattrapage demandé : les Jeux S4 n’ont pas encore eu lieu et n’ont aucun résultat final lors du diagnostic.

## Vérifications

`node scripts/test-quadrennial-games-cash-sql.mjs <chemin du module PGlite>` exécute les contrôles financiers réels sur une base PostgreSQL isolée, sans réseau. Il couvre notamment les relances, route/CLM indépendants, clubs partagés, agents libres, pays représenté, nouvelle saison, classements incomplets ou ambigus, annulation, comptes manquants et droits d’exécution.

Les tests Vitest couvrent l’affichage, les deux disciplines, tous les paliers, les rangs invalides et la conservation du barème des autres compétitions. Les contrôles de compilation, TypeScript, lint et traductions complètent ces vérifications.
