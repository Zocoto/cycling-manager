# Dotations des sponsors secondaires — 28 novembre 2026

Les 30 % du budget principal servent de repère de population. Chaque négociation
présente trois enveloppes différentes, stables au rechargement, calculées à partir
du budget principal, de la signature du partenaire et de ses objectifs.

Les trois profils de financement ont des bases de 14 %, 27 % et 40 %, auxquelles
s’ajoutent une variation propre au sponsor et la difficulté de la proposition.
La plupart des enveloppes se situent ainsi autour de 14–48 %. Dans environ 15 %
des négociations, une des trois offres peut être exceptionnellement modeste
(7–12 %) ou généreuse (56–74 %), soit environ 5 % de l’ensemble des offres.
Ces bandes décrivent la formule et ne représentent pas des montants contractuels
fixes. Les petits budgets et la limite historique de 5 M€ par objectif sont gérés
aux centimes sans égaliser les trois enveloppes.

Le profil prudent demande un classement moins strict ; le profil ambitieux
demande un classement plus élevé. Catégorie, rang demandé, course d’un jour,
classement de tour, Grand Tour et monument pondèrent la difficulté et la prime
de chaque objectif. Le nombre d’objectifs contribue également à l’enveloppe.
Les règles du contingent de nationalité, les conditions d’accès aux courses et
le calcul du risque de réputation restent respectés.

## Persistance et contrats

La génération passe en V4. Le plan de sélection des marques et courses conserve
son seed V3, séparé du calcul de financement. Les offres non signées de l’ancienne
génération sont renouvelées à l’ouverture de la page, puis conservées. Les contrats
déjà signés, leurs objectifs et leurs primes restent inchangés.

La migration retire la réduction à 30 % des chemins de génération et de signature,
ainsi que le trigger qui réduisait les primes à chaque changement du budget
principal. `principal_budget_per_season` reste la référence lors de l’établissement
du devis ; en V4, `maximum_reward_budget` contient la somme exacte des primes
promises. Un changement ultérieur du budget ne modifie plus ces primes.

La signature d’une ancienne proposition exige son actualisation. Les vérifications
de propriété, de disponibilité des marques, de couverture du sponsor principal,
les verrous et les droits d’accès sont conservés. SQL exige trois montants totaux
distincts après arrondi de chaque prime au centime. Le règlement et ses reçus
idempotents sont inchangés.

## Vérifications

Les tests couvrent la distribution sur 1 000 seeds, la stabilité et la corrélation
à la difficulté, les trois enveloppes, les arrondis et limites numériques, le
renouvellement des anciennes offres et l’affichage de leur pourcentage effectif.
Le harnais `scripts/test-secondary-sponsor-varied-rewards-sql.mjs` valide la chaîne
SQL historique puis la migration, les autorisations, la signature, le paiement
intégral au-delà de 30 % et l’absence de modification des contrats signés.

La migration est uniquement structurelle ; aucun test de jeu ni devis fictif
n’est créé en production. Les reçus d’installation et de déploiement sont vérifiés
séparément avant d’annoncer la livraison.
