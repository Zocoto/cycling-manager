# Succès modéré de l’ingénieur R&D

Validé le 29 octobre 2026 : compétence de base commune à tous les ingénieurs,
indépendante des trois emplacements de talents. Chances parmi les recherches
réussies : niveaux 1/2/3/4/5 = 5/10/15/20/25 %.

Le gain total est de deux points : une chance sur deux de +2 sur une statistique
primaire du secteur ; sinon +1 sur cette statistique et +1 sur une autre
statistique primaire ou secondaire du même secteur. En recherche libre, les
treize statistiques restent disponibles. Le gain est réduit si nécessaire pour
respecter le plafond global de +10, bonus contextuels CLM compris.

Le +3 exceptionnel conserve sa probabilité absolue par recherche. Son intervalle
est distinct de celui du succès modéré : les deux résultats ne se cumulent pas.
Le taux de réussite et les revers/protections ne changent pas. Pour les nouveaux
projets, ce barème remplace l’ancien tirage +2 réservé aux laboratoires N6+.
Le niveau et les chances sont figés dans le profil de l’ingénieur au lancement.

La migration ne réécrit aucun projet, équipement ou inventaire. Les projets
déjà lancés gardent leur ancien tirage, identifié par l’absence du nouveau champ
`moderateSuccessChancePercentage` dans `engineer_snapshot`. Aucune nouvelle
requête applicative, tâche planifiée, table ou index : le profil et les résultats
utilisent les appels existants. Le calcul ajouté à un règlement est constant.

Validation : `node scripts/verify-equipment-rnd-migration.mjs <pglite-module>`.
Le banc isolé couvre le moteur complet, les probabilités, les répartitions, les
plafonds, les instantanés, la neutralisation des revers, l’idempotence et les
droits d’accès. Il peut aussi reconstruire les deux définitions de production
auditées, sauvegardées dans `artifacts/rnd-moderate-success-20261029/` (ignoré).

Livraison : `node scripts/deliver-rnd-moderate-success.mjs --apply-reviewed`.
Seule la migration `20261029110000_add_engineer_moderate_success.sql` est appliquée
avec délais bornés ; aucun lancement ni règlement de recherche en production.
