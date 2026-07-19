# EPIC 7 — Calendrier et inscriptions aux courses

## Objectif

Installer la première boucle sportive du MVP : consulter la saison, ouvrir une fiche de course et inscrire son équipe lorsque les règles d’éligibilité le permettent.

La sélection des coureurs et la simulation feront l’objet des US suivantes.

## Calendrier de saison

Une saison dure 28 jours consécutifs. Le calendrier principal est présenté sous la forme d’une grille de 7 jours sur 4 semaines.

Sur mobile, la même information est affichée sous la forme d’une liste verticale afin de conserver des intitulés et des actions lisibles.

### Temps forts fixes

- J1 : ouverture de la saison, sans course ;
- J8 : championnats nationaux contre-la-montre, deux jours avant le Grand Tour français ;
- J9 : championnats nationaux sur route, la veille du Grand Tour français ;
- J21 : renouvellement des sponsors ;
- J22 : championnats continentaux ;
- J26 : championnats du monde.

Ces temps forts restent visibles quel que soit le filtre appliqué au calendrier.

Les championnats nationaux sont affichés sous la forme de deux événements agrégés. Chaque pays organisera ultérieurement son épreuve individuelle. Seuls les coureurs possédant la nationalité du championnat concerné pourront y participer.

Cette restriction est propre aux championnats nationaux. La nationalité d’un Directeur Sportif, d’une équipe ou d’un sponsor ne limite jamais l’inscription aux autres courses.

## Catégories

| Catégorie | Couleur | Accès initial |
|---|---|---|
| Elite | Bleu roi | Palier de réputation à définir |
| Mondial | Rouge brique | Palier de réputation à définir |
| Continental | Vert | Palier de réputation à définir |
| National | Jaune | Ouvert à partir de 0 point |

Les libellés restent affichés en complément des couleurs pour garantir l’accessibilité.

## Catalogue initial

Le premier lot comporte 60 épreuves :

- 12 Elite : 3 Grands Tours de 6 étapes et 9 courses d’un jour ;
- 15 Mondial : 5 tours et 10 classiques ;
- 16 Continental : 5 tours et 11 classiques ;
- 17 National : 5 tours et 12 classiques.

Le catalogue cible sera enrichi sans modifier l’architecture du calendrier.

### Courses Elite

Grands Tours :

- J2 à J7 : Corsa delle Regioni, Italie ;
- J10 à J15 : Boucle des Provinces, France ;
- J16 à J21 : Ruta de las Sierras, Espagne.

Courses d’un jour :

- L’Enfer des Dunes ;
- Les Pavés de Zélande ;
- La Couronne des Ardennes ;
- La Classique des Lacs ;
- La Traversée des Flandres ;
- Le Mur de Catalogne ;
- La Cime du Tyrol ;
- Le Chrono des Fjords ;
- Le Grand Prix du Littoral.

## Affichage du calendrier

- aucun filtre sélectionné signifie que toutes les catégories sont affichées ;
- plusieurs catégories peuvent être combinées ;
- une course par étapes traverse visuellement plusieurs jours ;
- son bandeau est découpé proprement lorsqu’il change de semaine ;
- les semaines trop chargées peuvent être développées ;
- le jour courant, les jours passés et les jours futurs sont différenciés ;
- un clic sur une course ouvre `/jeu/courses/[slug]`.

## Fiche de course

La première version affiche :

- le nom, le pays, le drapeau, la catégorie et le format ;
- les jours concernés et l’heure de départ ;
- les étapes, distances et profils synthétiques ;
- la distance totale ;
- la date limite d’inscription ;
- la réputation minimale ;
- les futurs classements de la montagne et du sprint ;
- le palmarès des éditions terminées ;
- l’état d’inscription de l’équipe du joueur.

Les profils détaillés par segments seront enrichis avec le moteur de simulation.

## Horloge de jeu

- une journée de jeu correspond à une journée réelle ;
- les départs et simulations sont prévus à 20 h, heure de Paris ;
- les inscriptions ferment à 12 h, soit huit heures avant le premier départ ;
- l’interface ne fait jamais reculer un jour de saison déjà persisté.

## Inscription

L’inscription est séparée de la sélection des coureurs.

Pour le MVP, une demande valide est automatiquement acceptée. La fonction serveur vérifie :

- l’identité du joueur connecté ;
- le Directeur Sportif et l’équipe qu’il dirige réellement ;
- la participation de cette équipe à la saison de la course ;
- l’état de la course ;
- la date limite ;
- la réputation minimale ;
- la capacité maximale du peloton ;
- l’absence d’une inscription existante.

La fonction est idempotente : une seconde demande pour une équipe déjà inscrite retourne l’inscription existante.

### Règles de nationalité

- toutes les équipes peuvent s’inscrire à toutes les courses Nationales ;
- la nationalité de l’équipe, du Directeur Sportif ou du sponsor n’est jamais contrôlée ;
- la nationalité d’un coureur pourra produire un bonus de performance « local de l’étape » dans le futur moteur ;
- les championnats nationaux constituent l’exception : seuls les coureurs du pays du championnat peuvent concourir.

## Éléments différés

- valeurs des seuils Continental, Mondial et Elite ;
- sélection et remplacement des coureurs ;
- disponibilité d’un coureur sur les courses qui se chevauchent ;
- fatigue et récupération ;
- génération détaillée des deux championnats de chaque pays ;
- sélections nationales pour les championnats continentaux et mondiaux ;
- simulation et bonus « local de l’étape » ;
- barèmes des classements général, sprint et montagne.
