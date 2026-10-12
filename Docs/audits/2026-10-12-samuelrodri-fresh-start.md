# Reprise exceptionnelle de SamuelRodri — 12 octobre 2026

Opération expressément validée par le propriétaire après attente de l'accord du joueur : libérer les onze coureurs listés, sans indemnité, annuler leurs renouvellements et créditer 150 000 EUR. Aucune modification générale des prix conseillés du marché.

Équipe : TheWolverineCyclingTeam (`c7d4f299-3430-4aaf-a029-ac9b97a07ed2`). Saison 4, J4, équipe-saison `94e82d7f-40d5-40a6-8d49-6455de0bfbb2`.

Coureurs libérés : Absolon Adamová, Zémín Bai, Abdou Ben, Arvid Burkhardt, Damon DuBuque, Mathis Due, Albino Fidélis, Dorin Horvat, Eduard Ivashchenko, Vasyl Romanenko et Tomás Vieira. Les identités et les 22 contrats précis sont verrouillés et validés dans la migration.

## Résultat vérifié en production

- Solde : 84 350 → 234 350 EUR ; une seule transaction d'aide de +150 000 EUR, catégorie `other`, statut `posted`.
- Référence financière idempotente : `owner-approved-fresh-start:samuelrodri:20261012`.
- 11 contrats actuels terminés, 11 renouvellements S5 annulés, 11 coureurs désormais libres.
- Effectif : 35 → 24 ; masse salariale coureurs S4 : 288 500 → 207 000 EUR par saison.
- 44 échéances salariales restantes annulées, total de 81 500 EUR (20 375 EUR par échéance J7/J14/J21/J28). Aucune échéance de ces contrats encore en attente, aucune indemnité de licenciement.
- Les 11 profils et 22 contrats sont conservés. Les triggers normaux de départ déséquipent les coureurs, libèrent leurs réservations et retirent leurs sélections futures. Aucun équipement de l'inventaire n'est vendu ni supprimé ; aucune sélection ciblée encore active sur une course future.
- Aucun autre contrat actif/prévu pour ces coureurs après l'opération ; les engagements tiers et enchères avec offres sont protégés par des gardes avant mutation.

## Livraison et contrôles

Migration `20261012203000_grant_samuelrodri_fresh_start.sql` appliquée et enregistrée seule dans le projet lié. Transaction atomique, attente de verrou limitée à 3 secondes, exécution limitée à 30 secondes ; garde empêchant tout second versement.

Test d'intégration exclusivement sur PGlite local jetable : `scripts/test-samuelrodri-fresh-start-sql.mjs`. Vérifie le succès, l'idempotence, les gardes d'identité/saison/salaires/engagements tiers/enchères/reçu incohérent, la conservation de l'historique payé, des autres coureurs, du matériel, des sélections de courses terminées/en cours et du stage non concerné. Test réussi, ESLint réussi et `git diff --check` propre.

Vérifications Supabase en lecture seule et bornées à 5 secondes : résultat ci-dessus, connectivité saine et présence de la version de migration. Fiche publique authentifiée contrôlée dans le navigateur : l'équipe de SamuelRodri affiche bien « 24 coureurs sous contrat » et les onze coureurs libérés n'apparaissent plus dans l'effectif actuel.

Cette livraison est une intervention de données ; aucune modification applicative ni déploiement frontend requis.
