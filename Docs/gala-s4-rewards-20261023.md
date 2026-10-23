# Gala S4 — page finalisée et dotations préparées

Accès toujours limité à Zocoto, inscriptions toujours fermées. Les engagés de démonstration ne sont jamais utilisés par un export ou une attribution. Aucun résultat ni cadeau n’est distribué au déploiement.

## Lots par course, identiques en World Tour et Continental

| Place | Lot |
| --- | --- |
| 1 | Cuissard Éclat de Gala, +3 dans la spécialité de l’épreuve |
| 2 | Casque Couronne de Gala, +2 dans la spécialité |
| 3 | Chaussures Dernier Éclair, +1 dans la spécialité |
| 4 | 1 Perfectionnement technique (+1 secondaire au choix), 3 Rations énergétiques (+5 forme chacune), 2 Trousses de récupération (−12 h chacune) |
| 5 | 3 Blocs haute intensité (trois séances collectives ×2), 2 rations, 2 trousses |
| 6–7 | 2 rations et 1 trousse |
| 8–10 | 1 ration et 1 trousse |

Les objets ne s’activent pas automatiquement. Forme plafonnée à 100, blessures non raccourcissables protégées et limites des statistiques conservées. Les trois bons d’entraînement passent par le système existant : un seul bonus par séance collective des professionnels à 8 h ; les autres restent en attente. Le bonus sélectionné est désormais conservé pour toute la séance même en cas d’horodatages identiques, avec affichage cohérent dans le suivi d’entraînement. L’expiration des objets et des effets activés reste celle du jeu.

Les douze équipements exclusifs (quatre spécialités × trois emplacements) utilisent le circuit `event_reward` déjà compatible avec les fiches et préparations de course. Ils ne sont ni vendus ni ajoutés aux cadeaux quotidiens. Aucun équipement du gala précédent n’est modifié.

## Import après le live

Transformer le classement PCM vérifié en top 10 des seuls coureurs participants, sans l’équipe spectateur. Utiliser les UUID Cyclostratège correspondant aux identifiants PCM permanents. Contrôler la course, le programme et les compositions de la startlist réellement simulée avant de confirmer.

Endpoint privé `POST /api/admin/gala-s4-results`, session Zocoto, même origine, en-têtes `Content-Type: application/json` et `X-CS-Requested-With: gala-s4-results` :

```json
{
  "confirm": true,
  "eventKey": "world-tour:mountain",
  "results": [
    { "rank": 1, "riderId": "UUID-CS-DU-COUREUR", "teamId": "UUID-CS-DE-SON-EQUIPE" }
  ]
}
```

L’exemple montre une seule ligne ; les dix places distinctes de 1 à 10 et dix coureurs distincts sont obligatoires. Six clés acceptées : `world-tour:mountain`, `world-tour:hills`, `world-tour:cobbles`, `continental:mountain`, `continental:hills`, `continental:sprint`.

Une seule RPC contrôlée distribue les trois équipements et 25 consommables, puis envoie les courriers du jeu. Tout est atomique. Répéter exactement le même classement retourne le reçu existant, même si les objets ont déjà été utilisés. Un classement différent est rejeté : pas d’écrasement ni de seconde distribution silencieuse. Une erreur ou un timeout client impose de vérifier/rejouer la même demande, pas de crédit manuel parallèle.

Les lots rejoignent l’équipe inscrite, dans son inventaire de la saison active et sous son manager actif, même après le passage en S5. Si ce contexte manque, l’import entier échoue sans distribution partielle. Les compositions et programmes sont figés après le premier import du programme. Les anciennes courses officielles, classements, argent, forme et objectifs ne sont pas réglés par cet import.

Les gants et boosters promis aux spectateurs Twitch ne sont pas inclus dans ce top 10 : leur attribution nécessite une liste de présence validée et un branchement distinct. Un classement n’est pas une preuve de présence au live.

## Exclusivité, performances et validation

Une seule inscription par équipe/saison, déjà garantie par unicité ; les nouvelles gardes SQL interdisent d’y glisser un profil de l’autre programme et de changer le programme tout en conservant les compositions. Les exports continuent de vérifier les 7–8 coureurs, l’appartenance et le plafond Continental de 75 sur chaque note primaire native, sans équipement.

La page réutilise le peloton vaporeux local en filigrane doré, sans nouveau média distant, requête de jeu ou polling. Les imports sont des opérations explicites et bornées ; aucun nouveau cron. Les vérifications SQL de dotation, d’annulation, de réimport et de consommables tournent exclusivement dans PostgreSQL/WASM isolé. La migration ne scanne pas l’inventaire existant pour ajouter sa provenance : contraintes `NOT VALID` qui restent imposées à toutes les nouvelles écritures, sans affaiblir l’exclusivité des sources.
