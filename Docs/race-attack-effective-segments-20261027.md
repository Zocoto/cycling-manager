# Validation des attaques sur le parcours effectif

## Incident confirmé

Sur Strade del Monferrato S4 J19, l'étape `8855a85c-467b-4e8c-9535-cd59e97a9e3d` annonce 204 km. Les 19 tronçons physiques, numérotés de 1 à 19, totalisent pourtant 235 km.

Le chargement du calendrier applique depuis longtemps `ensureCompleteRaceSegments` : si les tronçons chargés ne couvrent pas la distance officielle, le parcours est reconstruit en mémoire en sections de 10 km. L'écran et le moteur utilisent ainsi 21 tronçons, dont le dernier mesure 4 km. La sauvegarde historique des attaques exigeait une ligne physique dans `stage_segments`, ce qui refusait les tronçons 20 et 21 pourtant proposés par l'interface.

## Correction limitée

La validation SQL des attaques utilise désormais la même définition du parcours que le calendrier et le moteur :

- Pour un parcours physique complet, elle conserve exactement les numéros enregistrés, même si les longueurs sont variables ou les numéros non consécutifs.
- Pour un parcours absent ou dont la distance est incohérente, elle accepte uniquement `1..ceil(distance_officielle / 10)`.
- Elle reproduit l'arrondi à deux décimales et la comparaison en double précision employés par TypeScript autour de la tolérance de 0,05 km.

Les validations d'identité, d'appartenance de l'équipe, de roster, d'indisponibilité sportive, d'horaire, de rôle, de mission et de nombre d'attaques sont conservées. Le wrapper de train de sprint reste inchangé. Les parcours, inscriptions, stratégies enregistrées, simulations et résultats ne sont pas modifiés.

Le correctif porte sur la sauvegarde des consignes de club. La fonction fédérale ne contient pas le contrôle physique responsable du refus ; elle n'est pas durcie dans cette intervention.

## Vérification

Les contrôles de production sont des lectures bornées portant sur l'étape concernée et sur la définition des fonctions. Les tests de sauvegarde et les fixtures sont exécutés exclusivement dans PostgreSQL isolé avec PGlite.

Les régressions couvrent le cas 204 km/19 tronçons/235 km, les bornes 20/21/22, les profils complets personnalisés, les données absentes et les limites d'arrondi, ainsi que les protections de sauvegarde et le train de sprint.

Validation : 57 tests TypeScript ciblés et 47 contrôles PostgreSQL isolés passent. La migration `20261027190000` est appliquée et enregistrée en production. Le contrôle en lecture seule de l'étape confirme 20/21 disponibles et 22 indisponible ; l'empreinte du parcours et celles des wrappers sprint, CLM et fédéraux restent inchangées.
