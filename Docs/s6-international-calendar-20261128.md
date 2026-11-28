# Journées internationales réservées à partir de S6

À partir de S6, seules les courses régionales et locales peuvent partager une
journée de CN, CC, CM, Nations Cup ou Jeux quadriennaux avec ces compétitions.
La S5 et les résultats passés sont conservés. J1 reste sans course.

Le Circuit des Salines et le GP des Plaines du Danube passent d'Élite à Mondial
à partir de S6. Ce sont deux classiques plates hors Monuments ; les épreuves
restent présentes. Le minimum de réputation suit le barème Mondial (200).
Pour conserver le plafond de deux épreuves Élite par jour, la Cime du Tyrol
passe en J2, la Couronne des Ardennes en J6, l'Enfer des Dunes en J7 et le Tour
des Plaines en J9–J11. Les trois Grands Tours conservent leurs dates et profils.

La génération utilise un plan Élite selon la saison, puis décale en bloc les
épreuves ordinaires qui chevauchent une journée réservée. Elle conserve leurs
identifiants, étapes, parcours, créneaux, inscriptions et préparations. Les
échéances suivent le déplacement en heure de Paris, y compris lors d'un
changement d'heure. Les conflits avec les courses du même pays et les projets
fédéraux restent contrôlés. Une course commencée ou simulée ne peut pas être
déplacée par ce traitement.

Le traitement est branché sur `provision_season_race_calendar` pour toutes les
saisons suivantes. Les gardes différées contrôlent les dates finales des étapes
et les changements de catégorie d'une édition. Les protections ne dépendent
d'aucun cron supplémentaire et n'ajoutent aucune requête aux pages.

Le calendrier affiche la Nations Cup dans un seul repère beige au-dessus des
courses, dérivé des éditions déjà chargées. Il ouvre `/jeu/nations-cup`, dont la
page sélectionne la division et le groupe de la fédération de l'équipe du DS.
Le nombre de ses coureurs mobilisés, toutes nationalités confondues, reste
visible. Les Jeux gardent leur présentation distincte.

## Vérifications de production

Migration `20261128120000` installée le 28 novembre. Le contrôle après application
confirme 887 éditions et 1 159 étapes en S6, sans suppression ni changement des
identifiants des segments. 29 éditions / 62 étapes ont été déplacées. Le hash
du calendrier S5 est identique avant et après. S6 n'avait aucune inscription ni
course commencée avant l'installation.

Zéro étape ordinaire hors REG/LOC en J8, J15, J24 ou J26 ; deux éditions Élite
au maximum par jour ; aucune anomalie de date ou course en J1. Les contrôles ont
été exécutés en lecture seule, séquentiellement et avec un délai SQL de cinq
secondes. Aucune simulation ni fixture n'a été lancée en production.

375 assertions PostgreSQL passent dans PGlite isolé avec les 1 159 étapes
capturées et les fonctions existantes de placement, délais et espacement
national. Le script couvre l'idempotence, les saisons futures, les Jeux, les
gardes, les droits, les changements d'heure et les données liées aux inscriptions.

Preuves locales : `C:/Dev/artifacts/s6-international-calendar-20261128/`.
La vérification du déploiement de l'interface est suivie séparément.
