# Maillot actif et palmarès après naturalisation

Le passeport sportif autorise la naturalisation des champions depuis le 23 novembre, mais le changement de pays ne clôturait pas leur droit de porter les maillots devenus incompatibles. Les lecteurs actifs utilisaient seulement `relinquished_at`, et le profil attribuait par erreur certains anciens titres au pays actuel du coureur.

## Règle

- Champion national route/CLM : le pays du titre doit correspondre au pays sportif actuel pour porter son maillot.
- Champion continental : le continent du titre doit correspondre au continent sportif actuel. Un changement de pays dans le même continent conserve ce droit.
- Champion du monde et des Jeux : ces titres individuels restent portables après naturalisation.
- Le pays, la saison, la date, le résultat et le titre gagnés restent conservés au palmarès. Aucune réattribution au suivant.

Les contrôles sont ajoutés dans les requêtes actuelles par jointures, sans requête supplémentaire par coureur. Les snapshots figés des replays et albums ne sont pas recalculés. La base clôture les droits incompatibles lors d’un changement de pays et contrôle les nouvelles attributions ; elle conserve les titres historiques, sans les réactiver si le coureur revient plus tard dans son ancien pays. Le garde d’attribution lit sans verrouiller le coureur pour éviter une inversion de verrous avec le règlement des courses.

## Cas Gocha Vashadze

Nationalité actuelle : Colombie (Amérique). Il possède cinq titres historiques arméniens. Ses trois titres nationaux étaient déjà inactifs ; deux titres asiatiques du 20 novembre restaient actifs. Le rattrapage ne change que leur date de fin de port. Les cinq identités historiques et les trois anciennes dates de fin de port sont contrôlées avant et après par empreinte.

La migration requise est uniquement `20261127120000_relinquish_ineligible_champion_jerseys_on_nationality_change.sql`. L’outil d’application refuse une source modifiée ou un périmètre inattendu, enregistre la migration et conserve un reçu local. Les tests SQL utilisent une base isolée, jamais de fixtures en production.
