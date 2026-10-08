# Guide utilisateur de Cyclo Stratège

Dernière revue fonctionnelle : 30 septembre 2026.

Ce document décrit le fonctionnement réellement disponible dans l'application.
La version destinée aux joueurs est publiée sur la page `/guide`.

## 1. Démarrer une carrière

Le parcours conseillé est le suivant :

1. compléter le profil du Directeur Sportif ;
2. choisir sa nationalité et son avatar ;
3. créer le nom, le pays et le maillot de l'équipe amateur ;
4. étudier les sept coureurs de l'effectif fondateur ;
5. régler l'entraînement quotidien ;
6. choisir une première course et composer sa startlist ;
7. récupérer les récompenses des objectifs d'introduction.

Le visage d'un coureur reste stable pendant toute sa carrière. Le maillot affiché
sur son avatar est recalculé automatiquement lorsqu'il change d'équipe ou lorsque
son équipe active un sponsor.

## 2. Le bureau du Directeur Sportif

La page `/jeu` est le tableau de bord principal. Elle regroupe :

- le profil du DS, son niveau, son XP et sa réputation ;
- l'identité et la situation financière de l'équipe ;
- les événements récents du peloton ;
- l'effectif mis en avant ;
- les prochaines opérations de course ;
- les raccourcis vers l'inventaire, les objectifs et le maillot ;
- toutes les rubriques de gestion.

Le fil « En direct du peloton » reprend des événements significatifs après les
courses et les évolutions importantes de l'univers. Il ne retranscrit pas chaque
fait de course du live.

## 3. La saison et l'horloge quotidienne

Une saison dure 28 jours. Chaque jour possède deux créneaux :

| Heure | Événement |
| --- | --- |
| Avant 8 h | Réglages de l'entraînement et inscriptions AM |
| 8 h | Séance quotidienne et gel des inscriptions de la course de 14 h |
| 9 h | Ouverture des cinq enchères quotidiennes |
| 12 h | Gel des inscriptions de la course de 18 h |
| 13 h 55 | Gel de l'équipement pour la course de 14 h |
| 14 h | Départ de la course AM |
| 17 h 55 | Gel de l'équipement pour la course de 18 h |
| 18 h | Départ de la course PM et attribution des enchères quotidiennes |

Les étapes d'un tour occupent successivement les demi-journées AM et PM. Un tour
de dix étapes dure donc cinq jours de jeu.

## 4. Les caractéristiques d'un coureur

Chaque coureur possède treize notes :

- montagne ;
- vallons ;
- plaine ;
- contre-la-montre ;
- pavés ;
- sprint ;
- accélération ;
- descente ;
- endurance ;
- résistance ;
- récupération ;
- échappée ;
- prologue.

La moyenne donne une indication globale, mais le profil du parcours, la forme,
l'énergie en course, l'équipement et le rôle tactique restent déterminants.

### Potentiel

Le potentiel va de 0,5 à 4 étoiles. Il plafonne la moyenne possible sur les
treize notes :

| Potentiel | Plafond de moyenne |
| --- | --- |
| 0,5 étoile | 65 |
| 1 étoile | 70 |
| 1,5 étoile | 75 |
| 2 étoiles | 80 |
| 2,5 étoiles | 85 |
| 3 étoiles | 90 |
| 3,5 étoiles | 95 |
| 4 étoiles | 100 |

Les jeunes progressent plus vite. À partir de 32 ans, une pression de déclin
s'applique. L'entraînement peut limiter cette baisse, mais le coureur ne peut
plus dépasser sa note de début de saison.

### Poids, morphologie et surpoids

Le seuil de surpoids dépend du profil naturel et de la taille du coureur, pas de
son rôle en course ni de ses équipements. L'IMC est le poids divisé par la taille
en mètres au carré. Ces seuils sont des règles sportives du jeu, pas des
classifications médicales.

| Profil | IMC limite ≈ | Alerte dès, à 1,70 m | À 1,75 m | À 1,80 m |
| --- | ---: | ---: | ---: | ---: |
| Grimpeur | 20,92 | 60,5 kg | 64,1 kg | 67,8 kg |
| Coureur de tour | 21,58 | 62,4 kg | 66,2 kg | 70,0 kg |
| Baroudeur | 22,11 | 63,9 kg | 67,8 kg | 71,7 kg |
| Puncheur | 22,25 | 64,4 kg | 68,2 kg | 72,1 kg |
| Rouleur | 23,10 | 66,8 kg | 70,8 kg | 74,9 kg |
| Pavéman | 23,94 | 69,2 kg | 73,4 kg | 77,6 kg |
| Sprinteur | 24,50 | 70,9 kg | 75,1 kg | 79,4 kg |

Les poids correspondent au premier dixième déclenchant l'alerte. Le bonus
physique acquis au seuil diminue progressivement : il est réduit de moitié à
un point d'IMC au-dessus du seuil, puis disparaît à deux points. Ensuite, le
surpoids entraîne un malus. Un malus déjà existant n'est jamais effacé.

| Terrain | Diminution du bonus | Bonus disparu | Malus par point d'IMC suivant | Malus maximal |
| --- | --- | --- | ---: | ---: |
| Pavés | Dès le seuil du profil | Seuil + 2 | −0,6 point | −3 points |
| Plat / sprint | Dès le seuil du profil | Seuil + 2 | −0,8 point | −4 points |
| CLM | Dès le seuil du profil | Seuil + 2 | −1 point | −4 points |

Exemples à 1,80 m sur le terrain favori, au premier dixième concerné :

| Profil | Bonus réduit dès | Bonus disparu dès | Malus à IMC 30 (97,2 kg) |
| --- | ---: | ---: | ---: |
| Pavéman | 77,6 kg | 84,1 kg | −2,4 points |
| Sprinteur | 79,4 kg | 85,9 kg | −2,8 points |
| Rouleur en CLM | 74,9 kg | 81,4 kg | −4 points |

Les exemples supposent qu'aucun malus de gabarit n'est déjà présent.
Ce sont des équivalents de note de performance en simulation, pas des
pourcentages ni des pertes permanentes de notes. Les pénalités en montagne et
dans les vallons restent inchangées. Aucun résultat passé n'est recalculé.
L'assistant du DS distingue bonus réduit et malus ; la fiche coureur et la
rubrique nutrition indiquent le seuil. L'alerte disparaît après le retour sous
le seuil du profil.

## 5. Forme, énergie et récupération

La **forme** et l'**énergie** sont deux données distinctes.

- La forme est un état durable de 0 à 100 avant et après les courses.
- L'énergie est une réserve individuelle calculée uniquement dans le live.
- Le champ historique de fatigue n'est plus présenté comme une mécanique
  séparée.

Un coureur protégé peut conserver son énergie pour le final. Un coureur en
échappée, qui roule pour son groupe ou qui ne peut pas suivre le rythme dépense
davantage et peut être lâché sans réduire artificiellement l'énergie de ses
compagnons.

### Variations de forme

- Une journée complète sans course, blessure ni stage rend 2 points.
- Une classique coûte 10 points avant protection.
- Une étape de tour coûte entre 5 et 10 points avant protection, selon notamment
  la récupération du coureur.
- Un coureur placé sous le seuil d'entraînement décidé par le DS se repose et
  récupère 2 points.
- Si une perte devait faire passer la forme sous 0, elle reste à 0 et déclenche
  une blessure de fatigue de trois jours.

## 6. L'entraînement

La séance est traitée chaque jour à 8 h. Le DS règle :

- une intensité propre à chaque coureur ;
- un domaine de travail ;
- un entraîneur facultatif ;
- un seuil collectif de forme minimale.

Les domaines sont : grimpeur, puncheur, courses par étapes, classiques du Nord,
rouleur, baroudeur et sprinteur.

### Intensité et forme

- 50 % est neutre pour la forme.
- Au-dessus de 50 %, la séance consomme de la forme.
- En dessous de 50 %, elle peut rendre jusqu'à 2 points.
- Sous le seuil collectif, la séance est remplacée par un repos à +2.

Un entraîneur n'apporte son bonus qu'au coureur auquel il est affecté :

- +4 % d'efficacité par niveau sur les notes de sa spécialité ;
- +10 % sur toute la séance si l'entraîneur et le coureur partagent la même
  nationalité.

Une blessure, un stage de forme ou une reconnaissance empêche la séance. Une
reconnaissance empêche également la récupération de repos pendant ses deux jours.

## 7. Le centre de soin

Le centre de soin permet :

- de consulter un diagnostic et la date exacte de reprise ;
- d'affecter les kinés ;
- de choisir un protocole médical ;
- d'utiliser les interventions d'un nutritionniste ;
- de réserver un stage de forme.

Le diagnostic détermine la durée de convalescence et le risque d'abandon. Les
atteintes vont des abrasions superficielles aux fractures graves ou à la
commotion. Un casque peut réduire le risque de blessure dans la limite indiquée
par l'équipement.

Le kiné ne protège que les coureurs qui lui sont affectés. Plusieurs kinés
affectés au même coureur cumulent leurs niveaux, dans la limite des protections
appliquées par chaque règle.

Les stages durent de un à trois jours :

- classique : +10 forme par jour, 2 000 € par jour ;
- premium : +20 forme par jour, 6 000 € par jour.

Les niveaux cumulés des médecins augmentent l'efficacité d'un stage de 5 % par
niveau, avec un plafond de +50 %.

La blessure de fatigue ne peut pas être raccourcie par un protocole.

## 8. Le calendrier et les inscriptions

Le calendrier affiche les 28 jours en colonnes AM et PM. Les filtres distinguent
les catégories Élite, Mondiale, Continentale et Nationale.

La fiche d'une course présente :

- le profil tronçonné ;
- la distance et le type d'étape ;
- les GPM et sprints intermédiaires ;
- les critères de réputation ;
- la taille de la sélection ;
- la startlist officielle ;
- l'état de l'inscription.

La startlist ne contient que les équipes et coureurs réellement inscrits. Une
course sans engagé n'est pas simulée, à l'exception du Critérium de Namur utilisé
comme démonstration.

## 9. La reconnaissance d'une course

Une reconnaissance se programme depuis l'entraînement :

- elle dure deux jours ;
- elle doit finir avant la course ;
- elle peut concerner une classique ou une étape précise ;
- elle donne temporairement +2 sur les treize notes pour la cible ;
- un préparateur de course améliore ce bonus jusqu'à +2,5 au niveau 5.

Le prix dépend de la catégorie et du format :

| Catégorie | Classique | Étape |
| --- | ---: | ---: |
| Élite | 20 000 € | 15 000 € |
| Mondiale | 12 000 € | 9 000 € |
| Continentale | 7 000 € | 5 000 € |
| Nationale | 4 000 € | 3 000 € |

## 10. Le live et les résultats

Les lives se trouvent dans une fenêtre dédiée depuis `/jeu/resultats`. Une course
de 150 km dure généralement autour de 25 minutes et peut être accélérée.

Le moteur représente :

- les attaques et contre-attaques ;
- plusieurs groupes d'échappés et de chasse ;
- le peloton et les coureurs lâchés ;
- les incidents, chutes, crevaisons et abandons ;
- la pluie, le vent et les bordures ;
- les secteurs pavés ;
- les GPM et sprints intermédiaires ;
- le final et le franchissement de la ligne.

L'énergie est propre à chaque coureur. Un coureur très attardé ne peut pas
récupérer artificiellement quinze minutes sur un peloton qui roule.

### Classements

Une classique possède son classement final. Un tour présente :

- le classement de l'étape ;
- le général après chaque étape ;
- le classement de la montagne ;
- le classement par points ;
- le meilleur jeune de moins de 25 ans ;
- le classement par équipes.

Les écarts sont calculés depuis le vainqueur. Lors d'un sprint massif, les
membres d'un même groupe reçoivent le même temps, affiché « MT ». Hors sprint
massif, une seconde de séparation suffit à créer un écart officiel.

Lorsqu'un groupe en rejoint un autre, les deux ensembles fusionnent réellement.
En montagne, les coureurs faibles peuvent former un grupetto pour économiser
leurs forces et tenter de finir dans les délais, sans garantie de pouvoir le
suivre jusqu'au bout.

La page de résultat propose un journal repliable qui résume les principales
échappées, jonctions, attaques, reprises, incidents et la victoire.

Un abandon reste en fin de résultat avec la mention « Abandon ». Sur un tour, le
coureur ne prend plus les départs suivants.

Les primes des tops d'étape sont comptabilisées au fil du tour, mais versées au
jour de sa dernière étape.

## 11. Récompenses de course

Les résultats peuvent rapporter :

- de l'argent ;
- de l'expérience au DS ;
- de la réputation ;
- des points UCI.

Le montant dépend de la catégorie, du format et du rang. Les victoires de GPM,
les sprints intermédiaires et les classements secondaires apportent des gains
supplémentaires.

Les championnats nationaux donnent argent, expérience et réputation, mais aucun
point UCI.

## 12. Le staff

Le marché propose chaque jour 25 candidats de niveau 1 à 5. Le recrutement coûte
une prime immédiate et ajoute un salaire saisonnier.

La capacité du staff dépend du niveau du DS :

| Niveau DS | Membres maximum |
| ---: | ---: |
| 1 | 1 |
| 2 | 2 |
| 3 | 3 |
| 4 | 5 |
| 5 | 7 |
| 6 | 10 |
| 7 | 13 |
| 8 | 17 |
| 9 | 21 |
| 10 | 25 |

Les effets globaux compatibles cumulent les niveaux des membres actifs. Les
entraîneurs et les kinés constituent l'exception d'affectation : ils n'agissent
que sur les coureurs qui leur sont confiés.

Rôles actifs : entraîneur, scout, médecin, mécanicien, community manager,
nutritionniste, kiné, préparateur de course et architecte.

## 13. Les transferts

Le bureau des transferts possède trois onglets.

### Enchères quotidiennes

- cinq coureurs chaque jour ;
- ouverture à 9 h, clôture à 18 h ;
- niveau moyen généré plafonné à 65 ;
- surenchère minimale de 500 € ou 2 % ;
- un coureur sans offre rejoint les agents libres.

### Enchères des DS

- prix d'appel libre ;
- vente ouverte pendant 24 heures ;
- le plus offrant remporte le coureur ;
- un coureur recruté pendant la saison ne peut pas être revendu avant la saison
  suivante.

### Agents libres

- aucun frais de transfert ;
- salaire obligatoire ;
- contrat couvrant la saison actuelle et la suivante ;
- filtres par nom, âge, nationalité et caractéristique.

## 14. Matériel et inventaire

Les emplacements d'équipement sont :

- casque ;
- gants ;
- cuissard ;
- lunettes ;
- chaussures ;
- roue avant ;
- roue arrière ;
- cadre.

Les bonus sportifs compatibles se cumulent. Ils peuvent modifier les notes,
améliorer les chronos, réduire le risque de blessure ou augmenter les gains de
réputation en échappée et en victoire.

Un exemplaire ne peut équiper qu'un seul coureur. L'équipement peut être modifié
jusqu'à cinq minutes avant le départ.

L'inventaire contient également les objets de capacité spéciale, de potentiel et
de statistique. Les consommables doivent être attribués à un coureur.

Le Laboratoire R&D permet à chaque ingénieur disponible de piloter une recherche
gratuite sur une pièce libre. Un prototype peut être retravaillé plusieurs fois
et conserve son nom. La durée est recalculée à partir de la somme actuelle de ses
bonus et malus : 2 jours par point jusqu'à +6, puis 4 jours par point, jusqu'au
plafond de +10. Un revers raccourcit la recherche suivante ; une amélioration
l'allonge. Les talents réduisent le délai, avec un minimum d'un jour. L'assistant
du DS signale les ingénieurs libres lorsqu'une pièce peut être recherchée.

## 15. Capacités spéciales

Les capacités actuellement définies sont :

- Flahute : économie d'énergie dans les parties exigeantes ;
- Panache : propension à attaquer et contre-attaquer ;
- Porteur de bidon : économie d'énergie des équipiers du même groupe ;
- Locomotive : économie d'énergie lorsqu'il travaille ;
- Giclette : attaque décisive dans un final non massif ;
- Chasse patate : sortie solitaire vers une échappée ;
- Homme Sandwich : +0,5 réputation après une échappée ou une victoire.

## 16. Sponsoring

Le marché se débloque à 30 points de réputation. Les propositions tiennent compte
du pays de l'équipe, mais aussi des nationalités et du niveau de ses coureurs.

La signature fixe :

- le budget ;
- la durée du contrat ;
- le sponsor principal ;
- le choix du maillot ;
- des objectifs.

Entre J21 et J28, le DS prépare le partenariat de la saison suivante. Une rupture
anticipée retire le sponsor, conserve le budget déjà reçu, échoue les objectifs
encore ouverts et coûte 25 points de réputation.

À partir de la saison 4, environ une offre sur trois peut inclure un objectif
principal : sa réussite verse une prime immédiate, tandis que son échec retire
la réputation chiffrée avant signature. Les objectifs de course sont alignés sur
le prestige du sponsor.

À 1 500 points de réputation, l'équipe peut signer un sponsor secondaire. Il
propose trois à cinq objectifs rémunérés immédiatement, compose le nom de
l'équipe avec le sponsor principal et permet de placer son logo sur le maillot.

Le partenariat équipementier dure deux saisons. À 1 250 points, le DS peut
dépenser 200 points de réputation pour obtenir un quatrième équipement exclusif
pendant la durée du contrat.

## 17. Finances

La page Finances distingue :

- le solde réel ;
- le solde projeté ;
- les recettes ;
- les dépenses ;
- les opérations postées, en attente ou annulées.

Les opérations les plus récentes sont affichées en premier. Les achats, primes de
signature, salaires, constructions et transferts doivent être anticipés avant de
s'engager sur une nouvelle dépense.

## 18. Objectifs de carrière

Les objectifs primaires accompagnent l'introduction. Les objectifs secondaires
récompensent notamment :

- les paliers de victoires ;
- la taille de l'effectif ;
- les achats de matériel ;
- la taille du staff ;
- les niveaux du DS ;
- les maillots distinctifs ;
- les participations par catégorie ;
- les wildcards ;
- les échappées ;
- le premier sponsor.

Un objectif ne peut être rempli et réclamé qu'une fois. Une fois terminé, sa
récompense doit être récupérée manuellement. Les gains peuvent contenir argent,
XP, réputation, matériel, bonus de potentiel, bonus de statistique ou capacité
spéciale.

## 19. XP, réputation, UCI et divisions

### XP et niveau du DS

Le DS commence au niveau 1. Il faut 100 XP pour atteindre le niveau suivant, puis
50 XP supplémentaires à chaque nouveau palier :

- niveau 1 vers 2 : 100 XP ;
- niveau 2 vers 3 : 150 XP ;
- niveau 3 vers 4 : 200 XP.

Le niveau augmente notamment la capacité de staff. Les infrastructures sont
débloquées au niveau 10.

### Réputation

Le plafond de 1 000 points disparaît à partir de la saison 4. Les rangs sont :
Amateur (0), Prometteur (30), Reconnu (75), Établi (200), Référence (400),
Élite (750), Icône (1 000), Institution (1 250) et Légende (1 500).

La réputation peut être temporairement engagée pour renforcer une conférence de
presse ou une candidature à une wildcard. Elle peut aussi être dépensée
définitivement pour améliorer un contrat sponsor ou obtenir l'équipement
exclusif du partenaire. Le solde disponible exclut les points déjà engagés.

En fin de saison, la part supérieure à 300 points subit un maintien de 3 %, 5 %
ou 7 % selon le niveau atteint, plafonné à 75 points. Les victoires World et
Élite réduisent cette retenue de 5 points chacune, jusqu'à 50 points.

### UCI et divisions

Les points UCI mettent à jour les classements de la saison, mais la division ne
change pas immédiatement. Le classement final détermine la division de la saison
suivante :

| Division | Rang final | Bonus de réputation sur la saison |
| --- | --- | ---: |
| Élite | 1 à 20 | +15 |
| World | 21 à 50 | +8 |
| Continentale | 51 à 100 | +4 |
| Nationale | 101 à 200 | +1 |

Toutes les équipes voient les courses Élite dans leur calendrier. Les équipes
Élite y inscrivent directement huit à neuf coureurs. Les équipes de toute autre
division peuvent demander une Wild Card en proposant huit à neuf coureurs, dont
l'agenda reste bloqué jusqu'à l'arbitrage à J-1. La décision tient compte de la
nationalité de l'équipe, de celle du sponsor principal, de la réputation et du
meilleur coureur aligné par rapport au profil de la course.

## 20. Infrastructures et formation

Les infrastructures se débloquent au niveau 10. Un seul chantier peut être actif
à la fois. Les réductions d'architecte sont figées au lancement.

La Data Room possède trois niveaux et affine les rapports de scouting du marché.
Les centres internationaux améliorent la détection locale et contribuent à une
chance mondiale de bonus d'une étoile complète, avec un maximum de quatre
étoiles.

Le centre de formation permet :

- d'envoyer un scout de un à sept jours ;
- de découvrir de un à quatre jeunes ;
- de signer un jeune avec une prime et des frais de scolarité ;
- de choisir une priorité d'entraînement quotidienne ;
- de recruter le jeune pour son passage professionnel.

L'équipe de développement se compose entre J1 et J7, puis son effectif est
verrouillé à J8. Ses courses sont simulées sans live ; les podiums font
progresser les juniors selon leur profil et leur historique est conservé lors du
passage professionnel.

## 21. Sélections nationales et internationales

Les sélections continentales et mondiales sont figées 24 heures avant le départ.
Les vingt meilleures nations appellent leurs huit meilleurs coureurs valides.

Le DS peut accepter ou refuser. Sans réponse, la participation est confirmée
automatiquement. En cas de refus ou de blessure, le réserviste suivant de la
nation est appelé.

## 22. Pages et confidentialité

Les fiches des DS, équipes, nations et coureurs sont publiques dans l'univers du
jeu. Les éléments privés restent réservés au DS de l'équipe :

- informations contractuelles ;
- gestion de l'équipement ;
- planning saisonnier individuel ;
- décisions médicales et financières.

## 23. Mécaniques détaillées dans le guide public

La page `/guide` est la référence exhaustive destinée aux joueurs. Elle contient
en plus les barèmes S4 complets, les domaines d'entraînement note par note, le
poids et le moral, les rôles et chronos par équipes, les courses locales, les
sponsors principal et secondaire, tous les usages de la réputation, le
catalogue des infrastructures et leurs spécialisations d'équipe et fédérales.

