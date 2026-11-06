# Échappées et respect des rôles du DS

Le sélecteur commun aux classiques et aux étapes permettait une tentative par
équipier éligible, avec jusqu’à 68 % de probabilité individuelle. Plusieurs
équipiers rendaient la présence de l’équipe presque certaine. Un repli pouvait
aussi forcer un départ ; les missions de soutien et les poissons pilotes
n’étaient pas exclus. Enfin, l’objectif général de victoire d’étape pouvait
transformer automatiquement un équipier en attaquant désigné.

La nouvelle sélection autorise un seul équipier candidat à une initiative
spontanée par équipe et par étape. Son tirage est partagé par l’échappée initiale,
les attaques tardives et les contre-attaques : ces fenêtres ne créent pas de
nouvelles chances indépendantes. La base de 2,5 % augmente avec BAR, la course
favorite, la nationalité du pays hôte et Panache, jusqu’à 20 % au maximum. Forme,
posture prudente, objectifs sprint/général et présence d’un favori modèrent ce
choix. La nationalité utilise les codes du coureur et du pays hôte ; le statut
local d’un coureur étranger ne constitue pas une nationalité.

Lieutenants, protecteurs, régulateurs de danger et poissons pilotes n’attaquent
plus spontanément. Les désignations et attaques explicitement demandées par le
DS restent exécutables. Les électrons libres et objectifs montagne conservent
leur fonctionnement. Une victoire d’étape ne transforme plus implicitement un
équipier ou un poisson pilote en échappé, et l’inférence respecte « éviter ».
Le repli ne force jamais une initiative spontanée refusée.

Campagne locale appariée sur 512 graines du même générateur que le moteur,
12 équipes et mêmes coureurs ; présence dans la vague initiale ou tardive :

| Équipiers de l’équipe observée | Avant | Après |
| --- | ---: | ---: |
| 1 | 89,26 % | 3,13 % |
| 5 | 100 % | 2,73 % |
| 7 | 100 % | 3,13 % |

Sur ce scénario, BAR 95 donne 6,84 %, une course favorite 6,05 % et la nationalité
du pays hôte 5,08 %. L’ordre explicite de chercher l’échappée reste à 100 % et
« éviter » à 0 %. Ces mesures décrivent la fixture et non un taux garanti pour
tous les pelotons.

Le moteur officiel passe à `2026.11-breakaway-role-balance-v56` pour les futurs
scénarios. Les simulations verrouillées et résultats passés sont conservés.
Aucune migration SQL, requête supplémentaire ni nouvelle tâche périodique.
Le travail supplémentaire du sélecteur est linéaire en nombre de coureurs.

Tests dédiés : 15 assertions de probabilités et 18 tests de sélection/résultats,
dont six exécutions complètes live/résultats seuls. Les régressions couvrent
préparation, rôles, trains de sprint, classements, profils et non-rétroactivité.
La fixture du coût d’énergie utilise maintenant un attaquant explicitement
désigné et une fraîcheur de départ égale, sans dépendre d’un tirage de rôles.
