# Réduction du volume des caches partagés — 2 novembre 2026

## Constat financier

Le relevé Vercel de l'équipe, du 3 octobre au 2 novembre 2026, expose
1 516 752 unités de lecture et 1 586 640 unités d'écriture du Legacy Data Cache.
Aux tarifs de Paris (0,48 $ / million de lectures et 4,80 $ / million
d'écritures), cela représenterait 8,34391296 $ HT sur 30 jours après migration,
à activité et comportement constants. Les écritures représentent 91,3 % de
ce montant. La migration annoncée par courriel est prévue le 29 janvier 2027.

## Changement

Les 14 caches partagés existants, répartis dans 12 services, passent par
`lib/performance/compact-data-cache.ts`. Cette couche conserve le cache Next.js
et ses règles : arguments, identité du chargeur, durée, tags, isolation de
requête, invalidation et revalidation en arrière-plan.

Les contenus JSON dépassant une unité de 8 Kio sont compressés en gzip/base64
uniquement si le JSON réellement stocké occupe moins d'unités. Les petites
valeurs et les données peu compressibles restent intactes. Le résultat est
décompressé avant d'être remis au service appelant. La compression et la
décompression sont asynchrones ; la taille décompressée est bornée à 8 Mio.
Les contenus plus grands conservent leur comportement antérieur.

Les caches concernés sont les classements, les géométries de course, les
maillots nationaux, les actualités et les projections publiques déjà partagées.
Les lectures privées et les contrôles d'autorisation gardent leurs chemins
existants. Aucun TTL n'est allongé ; aucun cache mémoire inter-requêtes n'est
ajouté. Pas de nouvelle requête Supabase, de dépendance ni de migration SQL.

L'espace de clés est versionné pour séparer le stockage compact des anciennes
valeurs. Les anciens tags continuent de fonctionner ; aucune purge globale
n'est nécessaire. Le prochain trafic remplit les nouvelles clés normalement.
La migration anticipée et les réglages de facturation Vercel ne sont pas modifiés.

## Vérification

157 tests ciblés passent, dont un stockage isolé utilisant le véritable
`unstable_cache` du Next.js installé. Les contrôles couvrent le round-trip des
données, les petites valeurs, les contenus peu compressibles, la séparation des
clés et arguments, les erreurs de chargement, les tags, l'expiration et la
revalidation d'une requête App Router à l'autre. Les tests métier des services
et des actions de publication/version/équipe sont conservés. ESLint ciblé et
la compilation de production complètent ces vérifications.

Mesures locales sur des fixtures, via le cache Next.js réel, sans réseau ni
données de joueurs :

| Fixture | Unités avant | Unités après | Réduction |
| --- | ---: | ---: | ---: |
| Classement de 1 232 coureurs | 62 | 15 | 75,8 % |
| Géométrie de 500 tronçons | 16 | 3 | 81,3 % |
| 50 actualités | 11 | 1 | 90,9 % |
| Chaîne de version | 1 | 1 | 0 % |

Sur cette exécution locale sans transfert réseau, la lecture médiane du plus
gros échantillon passe de 2,41 à 6,52 ms ; les deux autres de 0,55 à 1,65 ms et
de 0,35 à 1,09 ms. Ce léger travail CPU remplace un volume réseau et stocké bien
plus important. Les petits contenus restent à environ 0,01 ms. Chaque cache
ne charge son origine qu'une fois pendant dix lectures successives.

Ces chiffres prouvent la réduction du stockage sur les échantillons, pas une
baisse identique de la facture globale. Le gain réel doit être évalué sur les
unités de lecture/écriture d'une période comparable après déploiement. Le trafic,
la répartition des tailles et les changements de comportement à la migration
empêchent de garantir un surcoût nul.
