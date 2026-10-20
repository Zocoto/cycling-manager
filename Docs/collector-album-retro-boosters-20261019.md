# Album rétro, sachets et succès — extension du pilote privé

Ce document complète le pilote initial du 19 octobre. Le périmètre reste strictement limité au compte propriétaire d’Abbaye du Lion, contrôlé par UUID côté serveur. Aucun accès global ni écriture de gameplay.

## Habillage

Couverture évoquant une édition cycliste des années 1980 : impression crème / rouge brique / bleu ardoise, lettrage sportif, légère trame, illustration vectorielle originale de deux cyclistes en montagne. Aucun logo Panini ni illustration raster générée. La saison de collection est affichée en grand, distincte de la saison du classement source.

Affinage du 19 octobre : vignettes à bord crème, numérotation de catalogue, emblème cycliste imprimé, portrait encadré légèrement de biais, cartouche bleu ardoise et notes en rouge brique. Les finitions or / argent / bronze restent reconnaissables par leur filet et leur mention. Chaque carte affiche le drapeau national local du coureur derrière son portrait, à 16 % d’opacité ; noms et notes restent sur des aplats opaques. Pages à trame papier, cadre d’impression et repères de collage. Aucun changement du composant d’avatar partagé, aucune nouvelle police ou bibliothèque distante, aucune requête de base supplémentaire. Les 50 fichiers de drapeau sont contrôlés par test, les codes invalides ne construisent pas d’URL. Le pilote conserve exactement ses accès privés, son état local, ses tirages et ses gains simulés.

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

### Recto / verso, saison source et échanges multiples — 19 octobre

Les cinquante notes S3 initiales ont été revérifiées contre les lignes de la saison terminée : aucune note changée. Leur empreinte est figée par test. L’édition de collection demeure S4 (clé de stockage et sachets conservés), mais couverture, bandeau et sachets précisent explicitement que les champions et les notes sont ceux de S3. Les résultats ne suivent pas les performances S4.

Le dos des cartes présente 296 lignes regroupées issues exclusivement de S3 : toutes les victoires finales, podiums élite / mondial et championnats internationaux, top 10 des Grands Tours / Monuments, étapes gagnées et maillots finaux montagne / points / jeunes des tours élite ou mondiaux. Les maillots intermédiaires ne sont pas des titres. Une carte sans grand résultat dans cette sélection l’indique, sans palmarès inventé. Le titre mondial S3 vérifié de Mathieu Laurent déclenche le liseré arc-en-ciel et le maillot blanc de champion dans le portrait ; le mini-maillot de son équipe reste visible.

L’intérieur de l’album reprend l’illustration et la palette des sachets. Retournement clavier / tactile, liste de résultats défilante bornée visuellement, sans lecture DB par retournement. Aucun nouvel appel de base au chargement de l’album.

Le test des échanges reste **local et privé**, avec trois collectionneurs explicitement fictifs. Recherche par DS ou par carte, seconde liste dépendante, un à trois exemplaires contre une carte, doublons possibles seulement si le stock le permet. Chaque copie collée est protégée, les exemplaires proposés sont réservés, une seule offre active dans ce pilote. Acceptation atomique dans le modèle local, refus, annulation et conservation globale de chaque carte vérifiés ; acceptation répétée sans effet. Le schéma local v3 reprend les versions v1/v2 sans perdre cartes, collages, sachets, succès ni offres. Les nouveaux exemplaires des partenaires fictifs ne sont pas donnés au propriétaire.

Le courrier du destinataire est **un aperçu non envoyé**, pas une intégration de messagerie ou d’e-mail. Aucun vrai DS ne possède d’inventaire partagé tant que le pilote n’est pas ouvert. Pour le marché réel : réservation transactionnelle côté serveur, acceptation conditionnée aux stocks et à l’édition, expiration d’offre et boîte d’envoi idempotente après création validée. Réutiliser la messagerie interne plutôt qu’envoyer des e-mails externes sans préférence du joueur ; limiter les offres actives / notifications et proposer refus ou blocage des sollicitations. Ces raccordements persistants ne sont pas prétendus livrés par le pilote.

Une première extraction REST des résultats a atteint la limite locale de cinq secondes et a été arrêtée ; disponibilité du site et de la base confirmées immédiatement. L’absence de transaction de résultat restante a été vérifiée avant l’extraction SQL ciblée, séquentielle, en lecture seule, avec statement_timeout 5s et lock_timeout 500ms. Aucune fixture, migration ni écriture de gameplay.

L’état v1 de l’aperçu précédent est migré localement vers v2 sans perdre cartes, collage ou échanges. Les reçus d’ouverture sont uniques, bornés aux deux sachets autorisés et à la saison correspondante. Le total de copies doit correspondre aux deux cartes initiales plus deux par sachet ouvert, échanges inclus. Un état corrompu ou gonflé est rejeté.

La collection reste une démonstration locale, non synchronisée entre appareils. La réservation et l’idempotence du vrai marché multijoueur, les versements de succès, les stocks persistants et les drops Gazette requièrent toujours un inventaire transactionnel côté serveur. Ils ne sont pas prétendus livrés par cette extension visuelle.

Les données de course, calendriers, crons, classements et finances des joueurs ne sont pas modifiés.

## Recette

- 192 tests ciblés sur dix fichiers : ancien pilote, migrations locales v1/v2/v3, autorisation serveur, séparation de saison, inventaire existant, profils, avatars, maillots, tirages, doublons, réservations multiples, conservation des copies, refus d’échange entre cartes identiques, palmarès S3 et succès idempotents.
- Tests déterministes des frontières de rareté et de 10 000 tirages stratifiés ; distribution exacte 80 / 17 / 3.
- TypeScript sans émission, lint ciblé et couverture des 17 223 textes français par le catalogue anglais, placeholders compris.
- Recette du composant réel dans le navigateur : couverture ordinateur / 320 / 390 pixels, sachet fermé en 320 pixels, ouverture effective de deux cartes, compteur de l’inventaire cohérent, premier gain simulé puis bouton désactivé.
- Recette complémentaire : recto mondial S3 et verso détaillé, retournement en 320 pixels, recherches par DS puis par carte, listes dépendantes, offre trois-contre-une, courrier simulé, acceptation puis rechargement conservant stocks et collage.
