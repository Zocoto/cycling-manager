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
- Courses non terminées et stages/reconnaissances programmés ou actifs empêchent l’échange ; aucun engagement payé ni course n’est supprimé pour le forcer. Un garde de propriété au moment d’écrire l’engagement protège aussi l’inscription concurrente.
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

## Vérifications reproductibles

- Tests applicatifs : actions authentifiées, bornes, retour aux offres classiques, candidats chargés à la demande, rendu des deux contreparties et retrait.
- `node scripts/test-direct-transfer-trades-sql.mjs` : PostgreSQL/WASM jetable et isolé ; aucune URL ni donnée de production. Tests des vrais noyaux cash et déclencheurs de contrats, erreur injectée au second contrat, permissions, offres caduques, dette, capacités, remises, détachement et naturalisation. EXPLAIN vérifie l’index de contrepartie.
- `lib/game/direct-transfer-trades-migration.test.ts` conserve les invariants de la migration dans Vitest.
- Limite du harnais PGlite : mono-session. Les tests prouvent les transactions et appels périmés mais ne constituent pas un benchmark de contention réelle multi-session ; l’ordre des verrous et les chemins concurrents font aussi l’objet d’une revue de code indépendante.
- Aucun échange fictif ni essai avec rollback n’est exécuté sur la base des joueurs.
