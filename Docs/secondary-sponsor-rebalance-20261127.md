# Sponsors secondaires — règles au 27 novembre 2026

## Enveloppe financière

Le cumul des primes d’une offre ordinaire est plafonné à 30 % du budget annuel du sponsor principal couvrant la saison du contrat. Ce plafond concerne l’offre entière et inclut ses éventuels objectifs de contingent. Le prestige et la difficulté pondèrent les primes individuelles ; ils ne permettent jamais de dépasser l’enveloppe. Aucun régime exceptionnel ne s’active automatiquement.

Exemple : principal à 2 000 000 € → maximum de primes secondaires 600 000 €. Pour La Cumbre, le budget primaire S6 constaté est de 1 706 100 €, donc son plafond est 511 830 €.

Les primes sous le plafond restent inchangées. Au-dessus, elles sont réduites proportionnellement en centimes, avec un centime réservé par objectif puis répartition des restes par ordre d’objectif. Le total ne dépasse jamais le plafond, même avec des arrondis. Les objectifs, courses, pays, IDs et états sont conservés.

La pénalité des nouvelles offres est nulle sous 100 000 € par objectif ; au-delà, elle vaut cinq points par tranche de 100 000 €, plafonnée à 25. Une correction d’offre déjà publiée ne peut pas augmenter son malus. Les bonus supplémentaires du directeur financier conservent leur fonctionnement distinct des primes contractuelles.

Sans principal couvrant la saison cible, la page demande de le choisir avant de proposer le secondaire. Le budget d’un contrat qui expire avant cette saison ne sert jamais de référence. L’alerte de signature du bureau du DS respecte aussi ce prérequis.

## Nationalités, sport et graphismes

La sélection reprend le pays d’enregistrement actuel, le pays du DS, les leaders, la majorité de l’effectif et les contacts des écoles internationales. Chaque partenaire est affiché avec son vrai pays. L’identité principale et secondaire apparaît sur la fiche équipe et dans le sponsoring.

Les courses correspondent à la division projetée par le même service que les objectifs du principal. Une projection Élite permet Élite/Mondial ; une projection Mondial vise le Mondial. Une nationale ne sert de recours que dans le pays du sponsor et avec une limite d’une par offre.

Un objectif chiffré de nationalité peut remplacer une course si le partenaire secondaire est d’un autre pays que le principal de la saison visée. Il concerne au maximum 10 % des pros actuels, arrondi à l’entier inférieur, et trois coureurs. Les juniors ne comptent pas. Le paiement intervient dès le contingent atteint pendant la saison active ; les mêmes références financières empêchent les doublons. Une course annulée n’occasionne aucun malus.

Les logos restent sélectionnables en noir, blanc ou couleurs d’origine, également sur un contrat actif. Le choix est conservé sur le maillot.

## Livraison et sûreté

La migration initiale est `20261127130000_rebalance_secondary_sponsor_objectives.sql`. La correction financière est `20261127160000_cap_secondary_sponsor_rewards_to_primary_budget.sql` ; elle précède son interface compatible avec les snapshots de budget. Les RPC gardent les validations d’identité, d’authentification et de quota. Le plafond est aussi imposé côté base à la création et à la signature, puis réévalué si le budget primaire change.

La réparation financière touche uniquement les offres V2 ouvertes et contrats V2 prévus de saisons futures, sans reroll ni remboursement forcé. Tout objectif déjà démarré ou payé empêche une correction automatique. Les contrats actifs et anciennes offres V1 sont préservés. Le diagnostic préalable de production a trouvé trois offres V2 ouvertes, zéro contrat V2 signé et zéro objectif démarré ou payé.

Les tests SQL sont exécutés dans PostgreSQL isolé, jamais sur les joueurs réels. Les diagnostics de production sont en lecture seule, séquentiels et bornés à cinq secondes. L’alerte assistant garde zéro lecture avant J21 et une sortie précoce pour réputation insuffisante, saison cible absente ou contrat secondaire existant ; le cas éligible utilise au plus quatre petites lectures avec un budget partagé de 1,5 seconde, sans générer d’offre ni charger le calendrier.
