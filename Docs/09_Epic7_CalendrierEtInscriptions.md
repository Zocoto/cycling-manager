# EPIC 7 — Calendrier et inscriptions aux courses

## Objectif

Installer la première boucle sportive du MVP : consulter la saison, ouvrir une fiche de course, composer son groupe de coureurs et inscrire son équipe lorsque les règles d’éligibilité le permettent.

La simulation et les résultats feront l’objet d’une livraison séparée.

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
- un clic sur une course ouvre sa fiche dans une fenêtre au-dessus du calendrier ;
- la fermeture retrouve le calendrier et ses filtres sans rechargement ;
- l’URL directe `/jeu/courses/[slug]` reste disponible sous la forme d’une page complète ;
- les courses auxquelles l’équipe participe portent un repère et le nombre de coureurs engagés.

## Fiche de course

La première version affiche :

- le nom, le pays, le drapeau, la catégorie et le format ;
- les jours concernés et l’heure de départ ;
- les étapes, distances et profils synthétiques ;
- la distance totale ;
- la date limite d’inscription ;
- la réputation minimale ;
- les futurs classements de la montagne et du sprint ;
- le TOP 3 des éditions terminées, dans une zone compacte et déroulante ;
- l’état d’inscription de l’équipe du joueur.
- tous les coureurs engagés, regroupés par équipe avec un lien vers la fiche publique de l’équipe.

Les profils détaillés par segments seront enrichis avec le moteur de simulation.

## Horloge de jeu

- une journée de jeu correspond à une journée réelle ;
- les départs et simulations sont prévus à 20 h, heure de Paris ;
- les inscriptions ferment à 12 h, soit huit heures avant le premier départ ;
- l’interface ne fait jamais reculer un jour de saison déjà persisté.

## Inscription et composition

L’inscription et la composition sont validées ensemble. Le Directeur Sportif voit tout son effectif, coche les coureurs souhaités puis confirme. Les coureurs déjà engagés sur une course couvrant au moins un même jour restent visibles mais sont grisés, avec un lien vers la course en conflit.

Une demande valide est automatiquement acceptée et immédiatement visible sur la fiche publique. La transaction serveur vérifie :

- l’identité du joueur connecté ;
- le Directeur Sportif et l’équipe qu’il dirige réellement ;
- la participation de cette équipe à la saison de la course ;
- l’état de la course ;
- la date limite ;
- la réputation minimale ;
- la capacité maximale du peloton ;
- la taille de la composition selon la catégorie ;
- l’appartenance de chaque coureur à l’effectif actif ;
- l’absence de chevauchement de jours pour chaque coureur ;
- l’absence d’une composition déjà verrouillée.

| Catégorie | Coureurs minimum | Coureurs maximum |
|---|---:|---:|
| Elite | 8 | 9 |
| Mondial | 6 | 7 |
| Continental | 6 | 7 |
| National | 5 | 6 |

Les courses ordinaires sont limitées à 24 équipes. Les futurs championnats nationaux seront limités à 200 coureurs et ne reprendront pas cette limite par équipe.

### Retrait et réinscription

- la composition validée n’est pas modifiable directement ;
- le Directeur Sportif peut retirer toute son équipe strictement avant H-12 ;
- ce retrait libère immédiatement les coureurs et la place de l’équipe ;
- une nouvelle inscription avec une autre composition est possible dans la foulée, toujours avant H-12 ;
- à partir de H-12, une composition acceptée est définitive ;
- une première inscription reste possible jusqu’à H-8 si l’équipe n’était pas encore engagée.

Les contrôles de capacité, de délais et de chevauchement sont atomiques afin que deux requêtes simultanées ne puissent pas contourner les règles.

### Règles de nationalité

- toutes les équipes peuvent s’inscrire à toutes les courses Nationales ;
- la nationalité de l’équipe, du Directeur Sportif ou du sponsor n’est jamais contrôlée ;
- la nationalité d’un coureur pourra produire un bonus de performance « local de l’étape » dans le futur moteur ;
- les championnats nationaux constituent l’exception : seuls les coureurs du pays du championnat peuvent concourir.
- les championnats continentaux et mondiaux ne proposent pas d’inscription manuelle : leurs participants seront choisis par une future mécanique de sélection des meilleurs coureurs.

## Éléments différés

- valeurs des seuils Continental, Mondial et Elite ;
- fatigue et récupération ;
- génération détaillée des deux championnats de chaque pays ;
- sélections nationales pour les championnats continentaux et mondiaux ;
- simulation et bonus « local de l’étape » ;
- barèmes des classements général, sprint et montagne.
