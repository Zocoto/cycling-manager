# Entraînement et potentiel des coureurs

## Périmètre livré

- Rubrique `Entraînements` accessible depuis le bureau du jeu.
- Une séance quotidienne à 8 h, heure de Paris, réglée de façon idempotente.
- Intensité individuelle de 0 à 100 %, domaine de travail et entraîneur assigné.
- Seuil collectif de forme sous lequel un coureur ne s’entraîne pas.
- Rapport quotidien privé : forme, progression fractionnaire et notes entières modifiées.
- Potentiel permanent visible dans l’effectif et sur la fiche du coureur.
- Fatigue neutralisée : seule la forme représente pour l’instant l’état physique.

## Potentiel

Le potentiel possède huit paliers, de 0,5 à 4 étoiles. Il plafonne la moyenne des treize caractéristiques du coureur et améliore l’efficacité de sa progression.

| Potentiel | Plafond de moyenne |
|---:|---:|
| 0,5 étoile | 65 |
| 1 étoile | 70 |
| 1,5 étoile | 75 |
| 2 étoiles | 80 |
| 2,5 étoiles | 85 |
| 3 étoiles | 90 |
| 3,5 étoiles | 95 |
| 4 étoiles | 100 |

Distribution initiale :

- coureurs amateurs : 70 % à 0,5 étoile et 30 % à 1 étoile ;
- coureurs générés pour les enchères quotidiennes : 45 % à 0,5, 40 % à 1 et 15 % à 1,5 étoile.

## Forme et disponibilité

La séance est réalisée même si le coureur est engagé sur une course le même jour. Elle est ignorée en cas de blessure, de stage de forme ou de forme strictement inférieure au seuil choisi par le Directeur Sportif.

Impact de l’intensité sur la forme :

| Intensité | Forme |
|---:|---:|
| 0 % | +2 |
| 25 % | +1 |
| 50 % | 0 |
| 60 % | −5 |
| 70 % | −10 |
| 80 % | −15 |
| 90 % | −20 |
| 100 % | −25 |

Les valeurs intermédiaires sont interpolées. Un kiné affecté au coureur réduit une perte de forme de 1 point par niveau, avec un malus minimal de 1 point lorsqu’une perte existe.

## Progression

Les gains sont accumulés en millipoints afin qu’aucune fraction quotidienne ne soit perdue. La formule combine :

- l’intensité ;
- l’âge ;
- le potentiel ;
- le niveau actuel de la statistique ;
- le poids primaire, secondaire ou hors domaine ;
- le niveau et la spécialité de l’entraîneur ;
- l’affinité nationale entraîneur-coureur.

Un entraîneur apporte +4 % par niveau sur les statistiques correspondant à sa spécialité. S’il possède la même nationalité que le coureur, toute la séance reçoit en plus un bonus de +5 %.

Les plafonds de gain saisonnier par statistique sont de +18 sous 60, +12 de 60 à 69, +8 de 70 à 79, +4 de 80 à 89 et +2 à partir de 90. Le plafond de moyenne lié au potentiel reste prioritaire.

## Déclin

À partir de 32 ans, une pression de déclin quotidienne s’applique aux caractéristiques. L’entraînement peut la réduire ou restaurer une baisse déjà subie pendant la saison, mais un coureur de 32 ans ou plus ne peut jamais dépasser sa note de début de saison. Le meilleur résultat possible est donc la stabilisation.

## Prise d’effet des réglages

Un réglage enregistré avant 8 h peut s’appliquer à la séance du jour. Après 8 h, il est historisé pour le lendemain. Les séances possèdent une clé unique par coureur et journée : un rechargement de page ne peut jamais appliquer deux fois les gains ou la perte de forme.
