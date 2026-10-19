# Album rétro, sachets et succès — extension du pilote privé

Ce document complète le pilote initial du 19 octobre. Le périmètre reste strictement limité au compte propriétaire d’Abbaye du Lion, contrôlé par UUID côté serveur. Aucun accès global ni écriture de gameplay.

## Habillage

Couverture évoquant une édition cycliste des années 1980 : impression crème / rouge brique / bleu ardoise, lettrage sportif, légère trame, illustration vectorielle originale de deux cyclistes en montagne. Aucun logo Panini ni illustration raster générée. La saison de collection est affichée en grand, distincte de la saison du classement source.

L’édition disponible est S4, issue du top 50 final S3. Chaque saison doit conserver son propre instantané, sa clé de collection, ses sachets et ses récompenses uniques. L’URL accepte `saison=4` ; toute saison non disponible est refusée, jamais remplacée silencieusement par S4. Aucun album historique fictif ni catalogue S5 inventé. L’automatisation des instantanés des saisons suivantes reste à raccorder au système persistant lors de son développement.

## Sachets

Deux sachets d’essai supplémentaires, gratuits et réinitialisables, contenant chacun exactement deux cartes. Les deux tirages sont indépendants ; un doublon peut apparaître dans un même sachet. Les sachets gardent leur saison après ouverture.

| Finition | Chance par tirage | Cartes dans S4 | Chance par carte précise |
| --- | ---: | ---: | ---: |
| Bronze | 80 % | 30 | 2,6667 % |
| Argent | 17 % | 15 | 1,1333 % |
| Or | 3 % | 5 | 0,6 % |

Le tirage de démonstration utilise `crypto.getRandomValues`, sans roulette ni attente imposée. Dans un inventaire réel, le serveur devra être seul à tirer et attribuer les cartes, dans une transaction idempotente consommant le sachet. Le stockage du navigateur ne doit jamais débloquer de prime réelle.

Une entrée privée dans l’inventaire affiche le nombre de sachets fermés et rejoint l’onglet d’ouverture de l’album. Elle n’entre pas dans les catégories, totaux, disponibilités ou actions des objets de gameplay. Aucune requête d’album supplémentaire dans l’inventaire, aucune donnée top 50 chargée depuis cette entrée. La Gazette reste l’unique source future de distribution ; aucun drop, achat, gain par succès ou cadeau quotidien ajouté.

La cadence de distribution n’est pas encore activée. Elle devra être calibrée avec le volume de doublons et les possibilités de finir un album malgré la rareté : une poignée de sachets de deux cartes ne permet pas mécaniquement à tous les joueurs de réunir cinquante cartes en une saison. Les anciennes éditions et sachets ne devront pas expirer arbitrairement.

## Dix-neuf succès et trophée

Les barèmes suivants sont visibles et testables **dans le pilote uniquement**, sans crédit de budget, d’XP ou de réputation, ni insertion dans les objectifs ou la galerie publique.

| Collection | Nom | Argent | XP | Réputation |
| --- | --- | ---: | ---: | ---: |
| 1 carte collée | La première vignette | 2 500 € | 100 | 0 |
| 5 cartes | Le début de la passion | 10 000 € | 150 | 0 |
| 10 cartes | Les pages prennent vie | 20 000 € | 200 | 5 |
| 20 cartes | Un beau peloton | 40 000 € | 300 | 10 |
| 30 cartes | Collectionneur du dimanche | 60 000 € | 400 | 15 |
| 40 cartes | La dernière ligne droite | 90 000 € | 600 | 20 |
| 50 cartes | Mémoire du peloton | 250 000 € | 1 000 | 100 |
| Chaque chapitre complet, 7 chapitres | Chapitre complet · profil | 15 000 € | 100 | 5 |
| Toutes les bronze | Le charme du bronze | 25 000 € | 200 | 5 |
| Toutes les argent | Les reflets d’argent | 40 000 € | 200 | 10 |
| Toutes les or | Le club des légendes | 60 000 € | 200 | 15 |
| Une carte de chaque finition collée | Toutes les couleurs du vélo | 5 000 € | 50 | 5 |
| Premier échange terminé | À la récré | 5 000 € | 50 | 0 |

Total théorique d’une édition complétée avec tous les succès : 712 500 €, 4 150 XP et 220 réputation. La prime finale est additive, pas un remplacement des gains précédents. Le trophée **Mémoire du peloton — Saison N** est une coupe cycliste numérotée par édition.

La complétude porte sur les cartes distinctes collées, pas le nombre de copies. Une carte collée peut coexister avec un doublon échangeable ; la copie collée est protégée lors du transfert du doublon. Une prime d’essai se teste au plus une fois par édition. Le premier échange reste comptabilisé lorsque l’historique borné à dix entrées se renouvelle.

## Conservation et sécurité

L’état v1 de l’aperçu précédent est migré localement vers v2 sans perdre cartes, collage ou échanges. Les reçus d’ouverture sont uniques, bornés aux deux sachets autorisés et à la saison correspondante. Le total de copies doit correspondre aux deux cartes initiales plus deux par sachet ouvert, échanges inclus. Un état corrompu ou gonflé est rejeté.

La collection reste une démonstration locale, non synchronisée entre appareils. La réservation et l’idempotence du vrai marché multijoueur, les versements de succès, les stocks persistants et les drops Gazette requièrent toujours un inventaire transactionnel côté serveur. Ils ne sont pas prétendus livrés par cette extension visuelle.

Les données de course, calendriers, crons, classements et finances des joueurs ne sont pas modifiés.

## Recette

- 72 tests ciblés sur huit fichiers : ancien pilote, migration locale, autorisation serveur, séparation de saison, inventaire existant, profils, avatars, maillots, tirages, doublons, réservations, conservation des copies et succès idempotents.
- Tests déterministes des frontières de rareté et de 10 000 tirages stratifiés ; distribution exacte 80 / 17 / 3.
- TypeScript sans émission, lint ciblé et couverture des 17 222 textes français par le catalogue anglais, placeholders compris.
- Recette du composant réel dans le navigateur : couverture ordinateur / 320 / 390 pixels, sachet fermé en 320 pixels, ouverture effective de deux cartes, compteur de l’inventaire cohérent, premier gain simulé puis bouton désactivé.
