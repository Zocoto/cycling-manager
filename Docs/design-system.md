# Peloton UI

Version actuelle : v0.2 — Frozen

## Objectif

Peloton UI définit l’identité visuelle de Cycling Manager.

Cette version est suffisamment stable pour être utilisée dans les premières fonctionnalités du jeu. Elle pourra évoluer plus tard si les usages réels révèlent des besoins nouveaux.

## Philosophie graphique

Cycling Manager doit évoquer le cockpit d’un directeur sportif.

L’interface doit être :

- sobre ;
- lisible ;
- élégante ;
- orientée données ;
- légèrement nostalgique ;
- inspirée des jeux de management cycliste des années 2000 ;
- modernisée pour un usage web actuel.

Les éléments décoratifs doivent rappeler subtilement le cyclisme :

- routes ;
- profils d’étapes ;
- roues et rayons ;
- pelotons vaporeux ;
- maillots ;
- podiums.

Les décorations ne doivent jamais gêner la lecture ou porter une information essentielle.

## Palette principale

- Fond principal : `#102238`
- Fond secondaire : `#18324D`
- Panneau : `#234563`
- Panneau clair : `#2D5675`
- Bordure : `#86A6BC`
- Accent menthe : `#69D5AE`
- Succès : `#55BE86`
- Alerte : `#E5B84B`
- Danger : `#DF6672`
- Texte principal : `#F6F8FA`
- Texte secondaire : `#C5D3DD`

## Boutons

### Bouton principal

- Fond vert menthe
- Texte bleu foncé
- Utilisé pour l’action principale d’un écran
- Un seul bouton principal dominant par zone

### Bouton secondaire

- Fond transparent
- Bordure vert menthe
- Utilisé pour les actions complémentaires

### Bouton de danger

- Bordure et texte rouges
- Réservé aux actions destructrices ou sensibles

### Bouton désactivé

- Contraste faible
- Curseur non interactif
- Aucun effet de survol

## Cartes

Les cartes utilisent :

- un fond bleu secondaire ;
- une bordure bleu acier ;
- un rayon d’environ 12 px ;
- une ligne d’accent vert menthe ;
- une ombre légère ;
- des espacements généreux ;
- des décorations cyclistes très discrètes.

## Tableaux

Les tableaux doivent privilégier :

- une lecture rapide ;
- une hiérarchie claire ;
- des lignes aérées ;
- un survol discret ;
- des couleurs uniquement lorsqu’elles apportent une information.

## Notes des coureurs

Les notes sont comprises entre 0 et 100.

- 0 à 49 : blanc cassé `#F4F7FA`
- 50 à 59 : vert très pâle `#B9E4CE`
- 60 à 69 : vert `#69D5AE`
- 70 à 79 : vert foncé `#2FA373`
- 80 à 89 : orange `#F0A443`
- 90 à 100 : rouge `#EF5B62`

Abréviations prévues :

- MO : Montagne
- VAL : Vallon
- PLA : Plaine
- PAV : Pavé
- CLM : Contre-la-montre
- END : Endurance
- DES : Descente
- REC : Récupération

Le nombre doit être coloré. La cellule entière ne doit pas devenir colorée afin d’éviter un effet visuel trop chargé.

## Typographie

La typographie doit rester simple et sans empattement.

Hiérarchie actuelle :

- H1 : titre principal
- H2 : titre de section
- H3 : sous-section
- Corps : texte courant
- Petit texte : métadonnées et informations secondaires

## Règles de cohérence

- Ne pas ajouter une nouvelle couleur sans raison fonctionnelle.
- Ne pas surcharger les écrans avec des illustrations.
- Réutiliser les composants existants avant d’en créer de nouveaux.
- Les éléments décoratifs doivent rester à faible opacité.
- Les tableaux et les données restent prioritaires.
- Toute évolution majeure donnera lieu à une nouvelle version de Peloton UI.

## Statut

Peloton UI v0.2 est gelée.

Elle devient la référence visuelle des prochaines fonctionnalités jusqu’à ce qu’un besoin réel justifie une version v0.3.