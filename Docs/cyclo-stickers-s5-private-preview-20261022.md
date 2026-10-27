# Album de Cyclo-Stickers — préparation S5, aperçu privé

## Périmètre de cette livraison

L’édition publique racontera **S4**, avec le top 50 UCI et les notes natives figés après la clôture de S4, et sera proposée pendant **S5**. Aucun classement encore actif n’est utilisé comme résultat définitif.

La nouvelle maquette est disponible sur `/jeu/album?saison=4`, exclusivement pour l’UUID Zocoto déjà autorisé. `/jeu/album?saison=3` conserve l’ancien catalogue et son ancien état. L’aperçu S4 utilise les cinquante cartes S3 sans changer leurs notes, leurs palmarès ni leurs maillots. Sa clé locale distincte est `cs:private-collector:cyclo-stickers-s4-preview-s3-v1:<compte>`. Les autres joueurs restent refusés, même avec le lien direct.

Couverture et sachets : cinq couleurs des Jeux conservées en liseré, souvenir nocturne de l’Équipier sans tête, papier imprimé et saison S4 explicite. L’illustration réutilise le personnage officiel du jeu, sans nouvelle image raster. Les données d’essai S3 sont annoncées séparément. Aucun texte de finition graphique n’est apposé sur la carte des Jeux.

## Les 69 vignettes

- 01–50 : top 50 UCI individuel final.
- 51–55 : cinq premières équipes du classement UCI final, maillot de la saison source.
- 56–65 : champions continentaux pros, Route et CLM pour chacun des cinq continents.
- 66–67 : champions du monde pros, Route et CLM.
- 68 : champion des Jeux sur route, avec son maillot distinctif et un traitement de reflet dédié.
- 69 : L’Équipier sans tête, souvenir de l’événement Halloween S4. Aucune statistique de faux coureur ni titre sportif ne lui est attribué.

Les 19 vignettes d’introduction sont **à collectionner**, pas une décoration pré-collée. Elles occupent les quatre premières feuilles reliées de l’album, accessibles à l’ouverture de la couverture puis par feuilletage dans les deux sens. Aucun onglet séparé ne contient l’introduction. L’ancien lien `onglet=introduction` ouvre maintenant ces pages dans le livre. Les seuls espaces externes conservés sont Boosters, Échanges et Vitrine & succès. Elles participent aux sachets, échanges et à la complétion finale ; les chapitres de profils restent réservés aux 50 coureurs. Les identités des vignettes spéciales sont distinctes : un même coureur peut avoir sa vignette UCI et celle de son titre.

Pour cette maquette seulement, les 19 exemplaires d’introduction sont fournis au testeur, en plus des deux anciennes cartes et deux sachets. Ce n’est pas une dotation publique prévue. Les cinq équipes et les deux titres mondiaux S3 ont été lus une fois, séquentiellement, avec timeout 4 s. Les titres continentaux S3 non présents dans cette source et l’absence de Jeux en S3 sont représentés par des **spécimens nommés comme tels** ; aucun vrai coureur n’est présenté comme titulaire d’un titre non vérifié.

## Collection et sécurité

Le modèle local valide les identifiants contre les 69 entrées, conserve chaque exemplaire dans les échanges, protège la copie collée et vérifie les reçus des sachets. Les sauvegardes de l’ancien pilote restent isolées et inchangées. Le trophée final exige 69 vignettes distinctes collées ; les cinquante coureurs seuls ne suffisent pas. Le gain final simulé reste 250 000 €, 1 000 XP et 100 réputation ; aucune prime réelle n’est attribuée.

Barème **d’essai uniquement**, par vignette : bronze 80 %, argent 16,9 %, or 3 %, Jeux 0,1 %. Avec 30 bronze, 30 argent et 7 or, les deux vignettes spéciales (Jeux et Équipier sans tête) se partagent les 0,1 %, soit 0,05 % chacune, plus rares que chaque carte or précise. Deux tirages indépendants ; doublons possibles. La distribution publique n’est pas armée.

## Header et performances

Le raccourci est présent immédiatement après Gazette dans tous les headers du jeu pour le compte Zocoto uniquement. Le provider partagé réutilise le cycle de session local Supabase (`INITIAL_SESSION`, connexion et déconnexion), avec le même contrôle d’UUID que la route ; aucun nouveau lookup d’utilisateur, RPC, polling ou chargement de catalogue dans le header. Les autres comptes ne voient pas ce raccourci, même s’ils ont un rôle staff ou le même nom affiché. Le contrôle serveur de la page reste impératif et inchangé. L’icône est une vignette rectangulaire avec bordure, portrait casqué simplifié et lignes de légende. Sur les très petits écrans, le logo seul remplace son libellé pour conserver la place des commandes. Aucun raccourci existant n’est retiré.

Aucune lecture de classement ni requête d’album dans le header. Les snapshots ne sont chargés que sur la route autorisée. Aucun polling, aucune modification des crons, des courses ou de la bascule saisonnière, aucune migration de production pour ce changement.

## Conditions impératives avant l’ouverture publique S5

Le pilote existant est encore une démonstration locale. Ne pas déverrouiller sa route ou son header global sur le seul numéro de saison. La page privée présente ces points à valider :

1. À la clôture de S4, extraire en lecture seule les résultats officiels, notes natives, contrats/maillots S4 et titres gagnés en S4, sans utiliser l’identité d’un nouveau sponsor S5. Respecter l’ordre officiel UCI en cas d’égalité. Inclure les champions hors top 50.
2. Vérifier les 69 entrées et tous les titres ; aucun spécimen. Fournir un export revu `{sourceSeasonStatus:"completed",snapshot:{...}}` avec source S4, collection S5, présentation S4 et lancement S5.
3. Sceller hors ligne avec `npx tsx scripts/seal-cyclo-stickers-s4.ts <export-revu.json> <nouveau-snapshot.json>`. Le script refuse une saison active, des emplacements incomplets/dupliqués et tout spécimen, génère une empreinte SHA-256 et refuse d’écraser un fichier existant. Il ne se connecte à aucune base. Ce script valide et scelle l’export ; ce n’est pas encore un extracteur automatique.
4. Raccorder collage, tirages serveur idempotents, réservation/acceptation atomique des échanges, courrier interne et succès réellement payés une seule fois. Les stocks réels de boosters de connexion (`cyclo_stickers_boosters`) et de parrainage (`cyclo_sticker_boosters`) sont préparés par les livraisons du 27 octobre. La vue commune `cyclo_stickers_booster_inventory` les présente ensemble, sans copier les paquets, avec propriétaire, origine et édition ; la future ouverture serveur doit consommer la bonne ligne d’origine atomiquement. L’inventaire des cartes et les autres transitions restent à raccorder. Aucun état navigateur ne doit faire autorité.
5. Valider la cadence Gazette et les possibilités de terminer 69 vignettes malgré les doublons et la rareté. Le propriétaire a ajouté explicitement deux sources dès S5 : [un booster par semaine de connexion consécutive](weekly-login-boosters-20261027.md) et [deux boosters au parrain par nouveau filleul validé](referral-sticker-boosters-s5-20261027.md), en plus des récompenses de parrainage existantes. Ne pas recréer ces paquets depuis un compteur ni les importer dans l’aperçu local. Pas d’achat ni d’autre source implicite. Conserver les anciennes éditions et les sachets non ouverts.
6. Après recette, activer le contrôle serveur de disponibilité (S5 ou ultérieure, snapshot final S4, inventaire persistant prêt, validation publique) et propager ce résultat au header via son chargement partagé existant. Ne pas ajouter de requête par icône. Le garde-fou `canLaunchCycloStickers` refuse par défaut toute ouverture sans validation explicite. La route de cette livraison reste volontairement privée.

L’ouverture publique de S5 est donc **préparée graphiquement mais non armée**. Aucun déclenchement automatique ou livraison multijoueur persistante n’est prétendu par cette maquette.

## Recette locale

Rendu interactif réel de l’album, avec les composants du header et des adaptateurs de session hors ligne. Collage de la vignette des Jeux confirmé et repris après rechargement. Comparaison du header avec/sans icône : 87,33 px de hauteur dans les deux cas à 320 et 390 px ; 80,67 px dans les deux cas à 1024 px. Aucune largeur de page supérieure au viewport. Les dépendances de compte et déconnexion sont neutralisées dans cette recette locale uniquement, pas dans le code livré. Aucun compte de test ni action de joueur en production.

## Révision du livre et recette du format commun

Toutes les cartes, coureurs comme équipes et souvenirs, partagent un format CSS fixe de 196 × 324 px, y compris au dos et dans les aperçus de boosters ou d’échanges. Les emplacements vides ont le même format ; les grilles passent à une colonne sur petit écran sans réduire ou étirer les cartes. Les rotations de cartes sur la table sont neutralisées pour conserver des dimensions visuelles identiques. La migration locale ajoute uniquement le nouveau souvenir au catalogue de test lorsqu’il manque, après vérification de la conservation des autres exemplaires ; collages, échanges et sachets ouverts de l’aperçu précédent sont préservés.

Les tests parcourent les 69 entrées une seule fois dans chaque sens, sur une et deux pages, et vérifient la transition souvenirs/coureurs et la reprise de l’ancien essai. Le périmètre de production reste privé à Zocoto et aucun changement de base n’est nécessaire.
