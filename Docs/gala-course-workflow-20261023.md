# Gala S4 : préparation course par course

La page publique regroupe le choix World Tour / Continental, le profil de la
course et sa composition dans une seule tuile. Le bandeau d’ouverture conserve
le titre, la date, les liens utiles et la clôture. Les trois blocs désignés dans
la capture du propriétaire et l’encart de recommandations PCM sont retirés.
Les gains restent consultables dans un volet fermé par défaut ; le live et les
cadeaux de présence sont placés juste sous le bandeau de présentation.
La startlist est visible dans chaque fiche de course, sans second menu à ouvrir.
Seul l’onglet actif déclenche son chargement : les données restent en mémoire
lors du passage entre les courses et un appel inachevé est annulé si l’on quitte
l’onglet. Le chargement reste paginé et borné à 8 secondes, sans polling.

Chaque course possède son propre formulaire : 7–8 coureurs, enregistrement,
modification et retrait indépendants. Les sélections non enregistrées restent
en mémoire lorsque l’on consulte une autre course. Un changement de format
déjà enregistré exige une confirmation explicite dans l’interface et vérifie
le format précédent en base pour éviter d’effacer une inscription concurrente.

La note clé native est mise en avant et sert au tri : MON en montagne, VAL dans
les vallons, PAV sur les pavés et SPR au sprint. Les cinq autres notes restent
visibles. Le Continental conserve le plafond exact de 75 sur toutes les notes
primaires, sans équipement. Les règles d’appartenance S4 et de fermeture sont
conservées, ainsi que les protections après import des résultats.

La migration `20261023190000_gala_course_by_course_registrations.sql` ajoute deux
RPC authentifiées étroites et adapte les lectures des engagés. Elle ne modifie
aucune composition existante, table de jeu ou récompense. Elle réutilise le
verrou de l’inscription du club, limite les attentes de verrou à 1 seconde et
les écritures à 5 secondes. Le contexte et les comptes par course restent dans
la même requête ; aucun polling ni appel par coureur.

SHA-256 normalisé LF :
`3afa0f958962a0ace645c6d8fb76dcdeb72f3ea22d45bdf331171a9a9b55cf79`.
Le script `apply-reviewed-gala-course-workflow.mjs` contrôle ce hash, le projet
lié et les empreintes des anciens enregistrements, des protections et du
règlement des résultats. Il accepte un répertoire Supabase lié en argument.

Les comptes d’engagés et les XML prennent seulement les clubs ayant enregistré
une composition pour la course concernée. Le ZIP contient les courses ayant
des inscrits ; les six modèles sans inscrits restent disponibles séparément.
Les contrôles des identifiants PCM, de capacité, des positions, de propriété et
du plafond des notes continuent de refuser un export incohérent.

Validation : 94 contrôles SQL sur PGlite isolé, tests applicatifs des actions,
de la page, de l’interface et des exports ; vérification du parcours et des
brouillons locaux sur ordinateur, à 390 px et 320 px. Aucune fixture ni
inscription de test n’est créée dans la base de production.
