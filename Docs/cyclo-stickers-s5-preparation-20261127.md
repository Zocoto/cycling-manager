# Cyclo-Stickers : souvenir S5, collection S6

La nouvelle préparation est visible uniquement par le propriétaire déjà autorisé, sur `/jeu/album/preparation-s5`. Elle reste séparée de `/jeu/album?saison=5`, qui ouvre toujours la collection réelle racontant S4. Le serveur refuse les autres comptes, y compris le staff. La page n’est pas indexable.

## Habillage préparé

Couverture et sachet partagent une illustration SVG éditoriale : paysage de montagne, cycliste au maillot Cumbre Coca Rush « néon » (torse crème, panneaux verts, éclairs lime et montagne brune), et trois trophées nommés. La mention « 3 Grands Tours · 3 victoires » rend le triplé demandé explicite. Le maillot sélectionné a été confirmé par la lecture du contrat actif de Cumbre ; aucun asset sponsor n'a été retouché.

Quizz’o Stratège reprend exactement le visage, la casquette et la moustache de l'avatar du chat (`public/images/chat/quizz-o-stratege.svg`), avec une nouvelle pose tenant une carte jaune de questions. Ce dessin reste un habillage éditorial : aucun palmarès de carte ni identité de coureur n'est généré.

Le composant de couverture reçoit cette skin uniquement depuis l’aperçu privé. L’album S4 ne charge pas ses nouveaux assets et conserve son habillage Halloween/Jeux.

## Les 72 emplacements

| Numéros | Contenu prévu | État |
|---|---|---|
| 01–50 | Top 50 UCI individuel S5 | Identités non attribuées |
| 51–55 | Top 5 équipes UCI S5 | Identités non attribuées |
| 56–65 | 10 champions continentaux professionnels, Route/CLM | Titres à renseigner |
| 66–67 | 2 champions du monde professionnels, Route/CLM | Titres à renseigner |
| 68–69 | Cycl’o Quizz et La saison Cumbre | Emplacements éditoriaux, illustrations des cartes à finaliser |
| 70–72 | 3 baroudeurs hors top 50 | Identités non attribuées |

S5 n’est pas une saison des Jeux : aucune place olympique ni souvenir Halloween S4 n’est repris. Quinze feuilles, au plus six cases par feuille, sont accessibles par un sélecteur direct et des boutons précédent/suivant. La vue mobile reste dans la largeur de l’écran.

## Ce qui attend J28

Le plan utilise `sourceSeason: 5` et `collectionSeason: 6`, avec `cardsReady: false` et `publicApproved: false`. Chaque emplacement a `cardId: null`. Ce n’est volontairement pas un `CollectorAlbumSnapshot` : aucun portrait, maillot, note, classement final, carte réelle, inventaire ou gain n’est créé.

À J28, il faudra renseigner les preuves S5, conserver les identités/maillots avant leur renouvellement et adapter le producteur/scellement à une édition S5 sans Jeux. Le pipeline public existant reste spécialisé dans la collection S4/S5 ; cet habillage ne l’active pas et ne le généralise pas. Les anciennes collections, cartes et récompenses restent intactes.

## Vérification

Tests du plan (72 positions uniques et vides, 12 titres internationaux, deux souvenirs, aucune identité), rendu de toutes les feuilles, refus d’accès des joueurs/staff, accès du propriétaire sans RPC d’album et maintien de l’habillage S4. Aucune mutation de production n’est nécessaire.
