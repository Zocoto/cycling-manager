# Awards de fin de saison

Le palmarès de J28 devient récurrent pour toutes les saisons. Les anciens blocages spécifiques à S2 et au nombre exact de cinq awards sont retirés. Les 19 distinctions existantes conservent leur calcul ; trois nouvelles distinctions rejoignent le palmarès à partir de S4 :

| Distinction | Mesure |
| --- | --- |
| ADN du club | Pourcentage de l’effectif professionnel formé dans le centre de formation de ce même club |
| Fierté nationale | Pourcentage de l’effectif professionnel de la nationalité d’inscription de l’équipe |
| Peloton sans frontières | Nombre de nationalités sportives différentes dans l’effectif professionnel |

Les équipes éligibles sont celles des DS humains, comme pour les distinctions managériales existantes. Les juniors encore à l’école ne sont pas dans le dénominateur professionnel. La formation est identifiée via la promotion persistée depuis l’académie du club, indépendamment d’un bonus salarial ou d’une aptitude qui aurait expiré. Un ancien élève d’un autre club ne devient pas formé au nouveau club après un transfert.

Les contrats couvrant la saison sont dédoublonnés par coureur. Les signatures pour la saison suivante, contrats annulés et départs déjà intervenus sont exclus. Les pourcentages sont comparés sans arrondi avant de choisir le gagnant ; l’affichage conserve deux décimales et le rapport `coureurs concernés / effectif`. À pourcentage égal, le nombre de coureurs concernés départage, puis la taille de l’effectif, le nom et l’identifiant de l’équipe. Un award de pourcentage n’est pas attribué si aucune équipe ne possède de coureur répondant au critère.

## Cycle automatique

- À J28 à 20 h, la rédaction attend la clôture de toutes les éditions de course. Une ancienne étape restée non terminale sous une édition déjà terminée ou annulée ne bloque pas le palmarès.
- Le circuit habituel calcule le palmarès complet avant de publier la gazette. Les catégories sans candidat restent absentes et ne bloquent pas la publication.
- Un reçu unique par saison fige les gagnants et leurs statistiques en une transaction. Les relances, changements d’effectif et changement de saison ne recalculent pas une cérémonie publiée.
- Le déclencheur existant de clôture de saison est conservé comme secours, y compris si la publication de J28 n’a pas eu lieu.
- Une reprise planifiée toutes les vingt minutes en soirée (21 h–23 h, Paris) vérifie uniquement J28 et utilise le même circuit idempotent. Les autres jours ne déclenchent aucune publication tardive.
- Les awards de chaque J28 sont accessibles dans la gazette de cette saison. Le rappel de J1 présente exactement la saison précédente, sans reprendre un palmarès plus ancien si celle-ci est absente.
- Les palmarès antérieurs ne sont pas recalculés pendant cette migration. Les trois nouvelles distinctions ne sont pas attribuées rétroactivement à partir de nationalités et d’effectifs actuels.

## Performances et validation

Les trois mesures partagent une seule agrégation des effectifs. Les responsables éligibles sont résolus une fois par équipe. La finalisation n’a lieu qu’une fois par saison ; les relances consultent le reçu par clé primaire. L’affichage réutilise les requêtes de palmarès existantes. Une seconde lecture n’a lieu que si le premier lecteur de J28 a déclenché la publication en parallèle d’une première lecture des awards encore vide.

La fonction SQL est testée avec les vrais calculs des 19 awards précédents, sur PostgreSQL isolé (PGlite), sans données ni écritures de test en production. Les tests couvrent les 22 distinctions, les autres saisons, les contrats et nationalités, les égalités, les bots, les catégories vides, l’attente des courses, les relances, la clôture de secours et les permissions. Des tests applicatifs vérifient la publication, les archives, les médailles, les commentaires existants et le cron authentifié.
