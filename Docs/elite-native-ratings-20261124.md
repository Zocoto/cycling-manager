# Valeur des notes natives élevées — 24 novembre 2026

## Règle retenue

La simulation officielle passe en version **65** et le moteur léger des championnats nationaux en version **4**. Les notes enregistrées, leur affichage, l’entraînement et les plafonds de potentiel ne changent pas. Les résultats et les replays déjà verrouillés ne sont pas rejoués.

Un supplément de valeur sportive est calculé sur chaque note native, puis ajouté **une seule fois après les ajustements contextuels existants**. Cette position évite que les plafonds intermédiaires à 100 effacent le supplément. Les bonus de matériel, de préparation, de supporters ou de météo ne font pas franchir artificiellement les seuils natifs.

Avec `r = min(note native, 100)`, le supplément vaut :

```text
0,25 × max(0, r − 85)
+ 0,25 × max(0, r − 90)
+ 0,25 × max(0, r − 95)
```

La courbe est continue, y compris pour les notes décimales. Elle conserve les pondérations propres au terrain : un supplément en montagne conserve le poids de la montagne dans un col ou un CLM montagneux, sans devenir un bonus universel de vitesse.

| Point natif gagné | Valeur supplémentaire dans le calcul sportif |
| --- | ---: |
| Jusqu’à 85 | 1,00 |
| De 85 à 90 | 1,25 |
| De 90 à 95 | 1,50 |
| De 95 à 100 | 1,75 |

| Note native | Supplément | Indice avant pondération du terrain |
| ---: | ---: | ---: |
| 74 | 0 | 74 |
| 75 | 0 | 75 |
| 85 | 0 | 85 |
| 86 | 0,25 | 86,25 |
| 90 | 1,25 | 91,25 |
| 91 | 1,75 | 92,75 |
| 95 | 3,75 | 98,75 |
| 96 | 4,50 | 100,50 |
| 100 | 7,50 | 107,50 |

L’indice est interne au moteur : le coureur conserve par exemple sa note affichée de 96. Le supplément est borné à celui d’une note native de 100. Les 13 caractéristiques sont concernées. Les favoris et les rôles automatiques emploient la même valorisation intrinsèque, avant les bonus de course.

Les plafonds propres aux bonus existants sont conservés. Si une préparation porte déjà les notes natives 99 et 100 au même plafond contextuel de 100, les valeurs finales deviennent 106,75 et 107,50 : l’écart réapparaît, à 0,75 contre zéro auparavant. Le tableau décrit le poids intrinsèque d’un point hors écrêtage contextuel ; il ne remplace pas les règles des préparations, du matériel ou de la météo.

## Comparaison déterministe isolée

Le script `scripts/elite-native-ratings-calibration.ts` compare les nouveaux calculs à la révision de production `46f19feaa490e081081314240b206ed03682c7be`. Il importe temporairement les anciens modules de simulation et de favoris, puis les supprime dans un bloc `finally`. Il ne se connecte à aucune base et ne lance aucune course de joueur.

Les six coureurs synthétiques ont la même forme, le même moral et les mêmes notes secondaires, sans matériel, capacité spéciale ni bonus contextuel. Deux coureurs se distinguent par la note du profil, les quatre autres servent de témoins. L’identité du coureur le plus fort alterne pour limiter le biais lié aux graines. Les deux moteurs reçoivent exactement les mêmes entrées et les mêmes graines.

- CLM plat de 40 km : 50 graines pour chaque paire de notes.
- Arrivée au sommet, sprint et course pavée de 60 km : 5 graines par paire, pour vérifier les chemins de simulation sans batterie lourde.
- Paires : 74/75, 84/85, 85/86, 90/91, 95/96 et 99/100.

**130 simulations avec un peloton entièrement à 85 ou moins produisent une sortie strictement identique avant/après**, chronologie et résultat compris.

### Exemple observé sur le CLM plat

Les nombres ci-dessous sont les écarts moyens entre les deux coureurs synthétiques, et non une promesse de secondes par point dans le jeu.

| Paire | Ancien moteur | Nouveau moteur | Plus forte note devant l’autre, ancien / nouveau |
| --- | ---: | ---: | ---: |
| 74 / 75 | 7,44 s | 7,44 s | 41 / 50 · 41 / 50 |
| 84 / 85 | 7,24 s | 7,24 s | 41 / 50 · 41 / 50 |
| 85 / 86 | 7,28 s | 8,70 s | 41 / 50 · 45 / 50 |
| 90 / 91 | 7,02 s | 10,06 s | 41 / 50 · 45 / 50 |
| 95 / 96 | 6,80 s | 11,12 s | 41 / 50 · 45 / 50 |
| 99 / 100 | 6,78 s | 10,82 s | 41 / 50 · 45 / 50 |

L’avantage augmente aux seuils recherchés, sans rendre le résultat certain. Il n’est pas converti en pourcentage fixe de performance.

### Limites de lecture sur route

Les contrôles montagne, sprint et pavés passent également, mais cinq graines ne mesurent pas un taux de victoire. Les attaques, les transitions entre groupes, la sélection du parcours et les arrivées au même temps rendent les écarts chronométriques non linéaires. Un point mieux valorisé peut modifier une place sans modifier le temps d’arrivée ; une autre tactique peut aussi inverser le résultat d’une graine particulière. Ces observations ne justifient pas un barème de secondes par point sur route.

Le temps cumulé de calcul des simulations du contrôle était d’environ 384 ms pour l’ancien moteur et 365 ms pour le nouveau, hors démarrage et import des modules. Ce petit échantillon n’est pas un benchmark de production et ne démontre pas une accélération ; il ne montre pas de coût significatif ajouté. Le correctif n’ajoute aucune requête de base de données.

## Reproduire le contrôle

Depuis la racine du dépôt :

```powershell
node node_modules/tsx/dist/cli.mjs scripts/elite-native-ratings-calibration.ts --output C:/Dev/elite-native-ratings-calibration-20261124/results.json
```

`--seeds` règle le nombre de graines de CLM (1 à 100), `--road-seeds` celui des scénarios routiers (1 à 20) et `--baseline` permet d’indiquer une autre révision. Les valeurs par défaut restent volontairement limitées.
