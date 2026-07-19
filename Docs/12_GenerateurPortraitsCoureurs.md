# Générateur de portraits des coureurs

## Objectif

Chaque coureur possède un portrait original, stable et reproductible dès sa création, quel que soit le canal utilisé : génération de carrière, recrutement, marché des transferts, import ou futur outil d'administration.

Le rendu suit une direction sobre inspirée du principe du « cadavre exquis » : plusieurs zones du visage sont combinées sans produire de collage grotesque ni de rupture visible.

## Identité permanente

L'identité du visage repose sur deux données enregistrées dans `riders` :

- `avatar_profile_key` : profil géographique associé au pays du coureur ;
- `avatar_seed` : graine globale unique attribuée par PostgreSQL.

La migration `20260719221500_create_unique_rider_avatars.sql` :

- attribue une nouvelle graine unique aux coureurs existants ;
- complète leur profil géographique ;
- rend les deux champs obligatoires ;
- ajoute une contrainte d'unicité sur la graine ;
- crée un trigger exécuté avant toute insertion dans `riders` ;
- empêche ensuite la modification de l'identité visuelle.

La garantie ne dépend donc pas de l'interface ou d'un service TypeScript particulier.

## Variété

Le générateur combine notamment :

- largeur et hauteur du visage ;
- front, pommettes, mâchoire et menton ;
- position, taille, inclinaison et asymétrie des yeux ;
- sourcils ;
- longueur, largeur et famille du nez ;
- largeur, courbe et volume de la bouche ;
- oreilles et cou ;
- coiffure, couleur des cheveux et pilosité ;
- couleur des yeux ;
- taches de rousseur, marques légères et effets d'âge.

La décomposition de la graine utilise assez de paramètres géométriques pour différencier chaque valeur 64 bits. Un test vérifie également que 10 000 graines successives produisent 10 000 géométries distinctes.

## Prise en compte géographique

Les 22 profils régionaux déjà associés aux pays sont pris en charge. Ils influencent des palettes et des distributions larges de traits, avec un recouvrement volontaire entre les zones.

Principes retenus :

- aucune caricature nationale ;
- aucun visage type unique par pays ;
- plusieurs teints et familles de traits dans chaque profil ;
- variations géométriques individuelles indépendantes de la zone ;
- profil de secours mixte pour une ancienne donnée incomplète côté interface.

La base refuse toutefois la création d'un nouveau coureur si son pays ne possède réellement aucun profil visuel.

## Maillot contextuel

Le maillot n'appartient pas à l'identité permanente du visage. Il est calculé lors de l'affichage :

1. couleurs et style du sponsor principal actif ;
2. sinon couleurs et motif de l'équipe amateur ;
3. sinon maillot gris pour un coureur libre.

Un transfert ou un nouveau contrat de sponsoring change donc le buste du portrait sans modifier le visage du coureur.

## Emplacements intégrés

La première livraison affiche les portraits :

- dans la page Effectif ;
- dans la sélection des coureurs lors d'une inscription à une course ;
- dans le récapitulatif d'une composition déjà validée.

Le composant `RiderAvatar` est réutilisable par les futures fiches coureurs, le marché des transferts, les résultats et les classements.

## Choix technique

Le portrait est généré en SVG à partir de la graine :

- aucun appel à une IA en production ;
- aucun fichier image individuel à stocker ;
- même rendu sur toutes les pages ;
- chargement immédiat ;
- affichage net dans les petites et grandes tailles.
