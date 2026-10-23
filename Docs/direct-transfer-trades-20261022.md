# Offres directes : argent et échange de coureurs

## Périmètre

- Depuis la fiche d’un coureur adverse, le DS peut proposer de l’argent seul (minimum historique de 500 €), ou ajouter un seul de ses coureurs avec une soulte de 0 à 100 000 000 €.
- Un échange pur à 0 € est possible, y compris avec une trésorerie négative : il n’y a aucun paiement à effectuer. Une soulte positive doit être intégralement couverte par la trésorerie disponible après les autres réservations.
- Les échanges sont réservés aux équipes gérées par des joueurs. Les offres classiques et leur traitement par messagerie sont conservés.
- Le destinataire examine les deux coureurs et les salaires avant d’accepter ou refuser. L’émetteur peut retirer une offre encore en attente depuis la fiche du coureur ciblé.
- Les deux nouveaux contrats se terminent en fin de saison en cours, comme le transfert direct historique. Chaque coureur conserve la limite d’un changement d’équipe par saison.

## Sécurité et intégrité

- Acceptation transactionnelle : deux contrats, départs, arrivée, paiement éventuel et messages réussissent ensemble. Une erreur ne peut laisser un demi-échange.
- Vérifications au dépôt et à l’acceptation : propriété, contrats futurs, saison active, enchères, limites d’effectif nettes et places réservées aux coureurs formés au club.
- Depuis le correctif du 23 octobre : les courses futures ne bloquent plus l’échange. Dès l’envoi, seul le coureur proposé par l’émetteur est désinscrit ; les engagements du coureur ciblé restent intacts jusqu’au consentement de son DS. À l’acceptation, les futures inscriptions des deux coureurs sont retirées, y compris celles ajoutées depuis l’offre. Refus et retrait de l’offre ne réinscrivent pas le coureur automatiquement.
- Une compétition déjà commencée reste bloquante au dépôt comme à l’acceptation pour les deux coureurs. Cela couvre le tour entre deux étapes, un départ passé même si son statut est en retard, une simulation ou réservation officielle existante, et les sept minutes précédant le départ (pré-calcul à six minutes, marge d’une minute supérieure à la durée bornée du transfert). Les listes déjà figées ne sont jamais modifiées.
- Les stages et reconnaissances programmés ou actifs restent bloquants. Un garde de propriété au moment d’écrire l’engagement protège aussi l’inscription concurrente. Aucun engagement payé n’est annulé automatiquement.
- Les rosters futurs sont marqués `withdrawn`, jamais supprimés. Les sélections nationales déjà synchronisées sont déclinées pour éviter leur réapparition automatique. Les effectifs insuffisants alimentent l’alerte habituelle du bureau et un courrier contenant le lien de correction ; aucune inscription d’un autre coureur ni aucun résultat passé n’est modifié.
- Départ de l’un des deux coureurs : les offres qui l’utilisaient comme cible ou comme contrepartie deviennent caduques. Un retrait libère la réservation de trésorerie et la disponibilité du coureur.
- Les déclencheurs normaux restent actifs pour équipements, entraînement, échéances salariales, jours d’arrivée/départ et naturalisation. Les données historiques sont conservées.
- Les remises de salaire sont appliquées une seule fois aux nouveaux contrats. La Data Room ne peut produire une économie que sur la soulte réellement payée, jamais sur une valeur fictive du coureur échangé.
- Identité et équipes résolues côté serveur ; les identifiants cachés et les salaires envoyés par le client ne constituent pas une autorisation.

## Performance et compatibilité

- Aucun chargement des candidats à l’affichage initial de la fiche ou du bureau des transferts. La liste est demandée uniquement au clic, avec lectures groupées et bornées, sans requête par coureur.
- Une erreur de chargement facultatif des candidats ne bloque pas l’offre en argent seul.
- Index partiels pour les offres en attente, des deux côtés de l’échange.
- Verrous limités aux équipes et coureurs concernés, ordonnés et sans attente prolongée ; aucun nouveau verrou exclusif global du marché. Verrou partagé de saison uniquement pour les échanges.
- Les noyaux de soumission/réponse en argent seul restent inchangés dans le schéma privé ; les empreintes sont contrôlées avant la migration et après installation. Les permissions historiques sont préservées.
- Migration `20261022190000_add_direct_transfer_trade_offers.sql`, transactionnelle et bornée, sans réécriture d’offres ou de contrats historiques. Le script de livraison refuse une dérive du noyau depuis la revue.
- Migration complémentaire `20261023160000_allow_future_races_in_rider_trades.sql` : deux helpers privés, patchs ciblés des trois routines d’échange, verrous locaux `NOWAIT`, aucune nouvelle requête sur les lectures de pages. Livraison par `node scripts/apply-reviewed-trade-future-races.mjs --apply-reviewed-fix` après comparaison des empreintes exactes des routines. Aucun essai ni transfert fictif en production.

## Vérifications reproductibles

- Tests applicatifs : actions authentifiées, bornes, retour aux offres classiques, candidats chargés à la demande, rendu des deux contreparties et retrait.
- `node scripts/test-direct-transfer-trades-sql.mjs` : PostgreSQL/WASM jetable et isolé ; aucune URL ni donnée de production. Tests des vrais noyaux cash et déclencheurs de contrats, erreur injectée au second contrat, permissions, offres caduques, dette, capacités, remises, détachement et naturalisation. EXPLAIN vérifie l’index de contrepartie.
- `lib/game/direct-transfer-trades-migration.test.ts` conserve les invariants de la migration dans Vitest.
- Limite du harnais PGlite : mono-session. Les tests prouvent les transactions et appels périmés mais ne constituent pas un benchmark de contention réelle multi-session ; l’ordre des verrous et les chemins concurrents font aussi l’objet d’une revue de code indépendante.
- Aucun échange fictif ni essai avec rollback n’est exécuté sur la base des joueurs.
