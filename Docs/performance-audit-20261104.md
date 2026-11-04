# Audit de fluidité et de consommation — 4 novembre 2026

## Constat

Les contrôles publics répondaient normalement au début de l'audit : accueil
133 ms, connexion 153 ms, santé Auth Supabase 178 ms (HTTP 200). Cela ne mesure
pas les pages privées. Les mesures utilisateurs disponibles confirmaient une
variabilité : LCP médian du bureau sur ordinateur 1 680 ms, percentile 95
3 516 ms, sur seulement 10 mesures des dernières 24 heures. Ces échantillons
ne permettent pas de promettre un gain global précis.

Les statistiques PostgreSQL sont cumulées depuis le 19 octobre 2026 à
18:53:49 UTC. Avant correction :

| Fonction | Appels | Durée moyenne |
| --- | ---: | ---: |
| Synchronisation des sélections fédérales | 300 | 6 646,5 ms |
| Recherche des courses à traiter | 1 020 | 1 285,4 ms |
| Assistant du bureau | 10 450 | 300,3 ms |
| Compteur des objectifs | 10 450 | 247,9 ms |

Le volume de `realtime.list_changes` était également élevé : 2 337 398 appels,
10,05 ms en moyenne. Ces durées incluent l'attente et ne constituent pas une
mesure de CPU. Aucun reset des statistiques n'a été réalisé.

## Corrections

- **Bureau** : le pays du DS est joint à son profil ; suppression de la lecture
  séparée des 173 pays. Une équipe disposant d'un sponsor ne charge plus aussi
  son identité amateur : deux lectures supplémentaires évitées. Le repli
  amateur reste disponible.
- **Préparations professionnelles et fédérales** : chargement des seuls profils
  correspondant aux plans autorisés. Aucun calendrier chargé sans plan. Les
  profils complets et les séries internationales autorisées restent présents.
  Les enrichissements de simulation et les compteurs inutilisés sont exclus.
  Sur la fixture comparative : 19 → 12 lectures, 4 → 1 éditions, 5 → 2 étapes.
- **Fédération** : la page et ses objectifs partagent le même instantané UCI,
  sans seconde lecture/décompression du cache. Pas de cache privé partagé
  entre utilisateurs ni de prolongation des délais de fraîcheur.
- **Notifications** : fermeture du canal et de ses cinq abonnements PostgreSQL
  lorsque l'onglet devient caché ; récupération de l'état puis reconnexion au
  retour. Les anciennes réponses et anciens callbacks sont ignorés.
- **Présence** : cadence de deux minutes, alignée sur le minimum d'écriture
  existant. Instantané et coordination entre onglets via stockage local et
  Web Locks lorsque disponibles. Un onglet visible passe de 60 à 30 requêtes
  réussies par heure ; quatre onglets de 240 à environ 30 avec ces mécanismes.
  Sans stockage/verrou, le repli fonctionne par onglet. Les erreurs et leurs
  reprises ne sont pas comprises dans ces projections. Le serveur limitait
  déjà ses écritures à deux minutes : le gain porte surtout sur les requêtes.
- **Messages privés** : les nouveaux messages conservent leurs indicateurs,
  mais ne relisent plus la liste des conversations lorsque le panneau est
  inactif ou l'onglet caché. Rattrapage regroupé à la réouverture.
- **Traitements programmés** : les variantes été/hiver inactives s'arrêtent
  avant les accès Supabase et le chargement des traitements. Cela évite le
  travail réel de 36 déclenchements par jour. Les déclenchements Vercel existent
  toujours ; les reprises génériques et reprises manuelles ciblées restent
  actives. Les transitions d'heure de Paris sont couvertes par les tests.
- **Réparation des courses terminées** : recherche des résultats manquants
  avant de lire le JSON volumineux des simulations. Le minimum de participants
  reste calculé sur tous les coureurs attendus. Non-partants et abandons hors
  délai conservent leurs règles. Sur PostgreSQL isolé, 24 éditions complètes de
  80 coureurs et environ 372 ko de simulation chacune : médiane de trois
  passages 1 353,72 → 9 ms. Ce benchmark local n'est pas une mesure de gain
  global de production.
- **Sélections automatiques** : les boucles par pays sont évitées lorsqu'aucun
  départ futur ou horaire inconnu ne subsiste pour la compétition. Réconciliation,
  gel des qualifications et expiration des convocations restent exécutés.

## Vérification et limites

Les tests isolés exécutent les anciennes et nouvelles fonctions et comparent
leurs résultats, dont la viabilité des pelotons, les non-partants, les statuts,
les saisons, les dates nulles et l'expiration des convocations. Ils vérifient
aussi les droits et la réapplication de la migration : 29 assertions.

Les diagnostics de production sont bornés et en lecture seule, exécutés en
série. Aucune fixture ni simulation de mutation n'est exécutée sur Supabase.
La migration ne modifie que deux fonctions ; leurs droits et paramètres sont
préservés. Après application, la saison active ne comporte aucune édition
terminée dont le classement final soit incomplet ; Auth et connexion répondent
HTTP 200. Le reçu détaillé est conservé dans les artefacts locaux de l'audit.

Les tests applicatifs couvrent la conservation des profils, l'isolation des
instantanés UCI, les notifications, les MP, les concurrences entre onglets et
les traitements programmés. TypeScript, lint ciblé et contrôles des traductions
font partie de la validation ; le build et ses contrôles de traçage sont
obligatoires avant de déclarer le déploiement terminé.

Aucun changement d'offre ni ajout de service payant. Aucun nouvel abonnement
ou dispositif de mesure permanent. Les économies de facture exactes nécessitent
une période de trafic comparable après déploiement. L'assistant et les objectifs
restent des postes à suivre avec la télémétrie déjà en place ; leurs durées
cumulées antérieures ne permettent pas à elles seules d'en supprimer des règles.
