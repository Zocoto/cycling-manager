# Parrainage et boosters — règle S5

À partir de S5, chaque nouveau filleul qualifié donne **deux boosters au parrain**, en plus de tous les objets, primes de carrière, trophées et accessoires existants. Le filleul doit confirmer son inscription, selon la règle actuelle. Un parrainage en attente qui se qualifie en S5 est concerné ; une qualification déjà acquise en S4 n’est pas recalculée au changement de saison.

## Stock serveur

`public.cyclo_sticker_boosters` contient une ligne par paquet, avec un identifiant stable, le parrain propriétaire, le parrainage source et un numéro d’exemplaire 1 ou 2. L’unicité de cette source rend l’attribution idempotente, y compris en cas de nouvelle tentative. Les deux lignes sont insérées dans la transaction de qualification ; les RPC et paliers existants ne sont pas remplacés.

La saison de collection est celle de la qualification, bornée aux minuits de Paris ; la saison des cartes est la précédente : collection S5 / cartes S4, puis collection S6 / cartes S5. Les paquets non ouverts ne sont ni renommés ni convertis lors d’un changement de saison. Le début réel de la saison est pris en compte même si son cron d’activation est légèrement retardé. Une saison annulée ou une qualification future ne donne rien.

Les joueurs peuvent lire uniquement leur stock grâce à la RLS. Ils ne peuvent créer, modifier, ouvrir ou supprimer les paquets directement. Aucun nouveau chargement de stock n’est ajouté au header, au bureau, à l’inventaire ou à la page de parrainage.

## Raccordement à l’ouverture publique de l’album

Le stock réel est préparé indépendamment du pilote privé, qui reste local au navigateur. Le futur inventaire public doit lire ces lignes avec leur propriétaire et leur édition ; une ouverture serveur doit verrouiller le paquet, créer ses deux cartes une seule fois et renseigner `opened_at` dans la même transaction. Aucun paquet local de démonstration ne doit être importé et le compteur de filleuls ne doit jamais être utilisé pour recréer le stock.

Cette livraison **n’ouvre pas l’album au public** et ne prétend pas livrer les tirages ou les échanges persistants : les conditions de lancement existantes restent en vigueur. La Gazette reste la source prévue initialement, complétée explicitement par le parrainage ; aucune vente de boosters n’est ajoutée.

## Vérifications

Exécuter `scripts/test-referral-sticker-boosters.mjs` avec le chemin absolu d’un module PGlite local. Les fixtures s’exécutent dans PostgreSQL/WASM isolé, sans accès réseau : bornes de saison, attente et confirmation, rejouabilité, édition des paquets, changement de saison, confidentialité et conservation des cinq paliers réels existants.

La migration de production ne fait aucun rattrapage et ne modifie ni les fonctions de qualification existantes ni `private.sync_referral_rewards`. Son installation en S4 crée uniquement le stock vide et arme le déclencheur pour S5.
