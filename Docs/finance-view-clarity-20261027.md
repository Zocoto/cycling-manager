# Lecture des finances : encaissé et à venir

La vue Trésorerie distingue les montants déjà comptabilisés des opérations encore attendues. Les anciens libellés « Gains prévus » et « Charges prévues » additionnaient les deux statuts et pouvaient laisser croire qu'une prime de tour déjà reçue restait à payer.

- Le solde disponible est le solde courant fourni par le service financier existant.
- Les métriques « Encore à recevoir » et « Encore à payer » ne comprennent que les écritures `pending`.
- L'historique contient uniquement les écritures `posted`. Les écritures annulées ne figurent dans aucune section ni aucun total.
- Le statut fait foi, même si le jour d'une écriture en attente est passé.
- Le bilan complet et les analyses couvrent toute la saison : comptabilisé + à venir. L'allocation de départ reste distincte des recettes.

## Primes de course

Les courses d'un jour et les tours apparaissent dans le même registre. Plusieurs primes officielles d'une même édition et d'un même statut sont regroupées, avec chaque écriture consultable dans un détail natif. Le regroupement inclut les primes d'étape, général, CLM par équipes et combativité. Les références inconnues restent visibles individuellement.

Les règles de règlement ne changent pas : les primes de tour sont attribuées après homologation de toutes les étapes. Une fois versées, elles restent dans l'historique et sont déjà incluses dans le solde disponible.

## Directeur financier

Les charges restent brutes. Les revenus quotidiens, bonus et crédits d'économie du DF restent des recettes séparées. Les annotations sur les sources conservent le pourcentage, la base et l'impact ; elles n'ajoutent aucune écriture ni aucun montant aux totaux.

## Vérification et performance

Aucune modification SQL ou des règles de règlement. Aucun appel réseau ni JavaScript client ajouté. Les sections et groupes utilisent des éléments `details` natifs ; les analyses réutilisent les écritures déjà chargées.

Les tests couvrent la séparation des statuts, l'exclusion des annulations, les arriérés, le regroupement de toutes les primes officielles, les crédits DF séparés et le passage d'une recette de `pending` à `posted` sans changement du total de saison ni de la projection. Sur un état cohérent, ce passage augmente le solde et diminue les recettes à recevoir du même montant.

La fenêtre existante de lectures successives du solde et du registre n'est pas modifiée : une opération concurrente peut produire un écart transitoire entre deux instantanés. Cette livraison porte sur la présentation des opérations existantes.
