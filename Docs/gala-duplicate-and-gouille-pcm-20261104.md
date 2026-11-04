# Doublon du gala et accès PCM de Gouille

Le 4 novembre, Babacar Sow est inscrit pour la montagne continentale avec
Yukikaze Outdoor, ainsi que dans deux épreuves avec son club actuel, Okavango
Stack. La correspondance coureur/club commune aux exports BDD et SL refuse ce
doublon ; la même personne ne peut appartenir à deux équipes dans une base PCM.

La migration `20261104193037` retire exclusivement son inscription obsolète chez
Yukikaze. Elle conserve les sept autres coureurs, remet leurs positions à 1–7
dans le même ordre et ne modifie aucune inscription d'Okavango. Elle vérifie
l'appartenance actuelle, l'absence de résultats importés et la composition à huit
avant écriture, avec verrouillage des deux inscriptions et délais bornés.

Les autres inscriptions historiques après transfert restent régies par la règle
du 2 novembre : conserver le club d'inscription lorsqu'il n'y a pas de doublon.
Aucun remplacement de coureur, changement de club réel, de note ou de récompense.
Le contrôle d'export qui refuse les clubs multiples reste actif.

Gouille disposait déjà des exports propres à la page du gala S4. Le menu général
« Export PCM26 », sa page et ses deux API dépendaient encore du rôle de staff.
Une délégation indépendante, limitée aux téléchargements PCM, est ajoutée pour
l'UUID authentifié du compte actif `gouilleTW` (Cidrerie de l'Aulne) :
`ee244935-5722-4626-a28f-dc3cf63aa6f4`. Le compte homonyme inutilisé reste exclu.
Pas de rôle staff/admin, d'accès aux résultats, aux actualités ou au laboratoire.
Les contrôles d'authentification, d'origine et d'en-tête des API sont conservés.

La visibilité du menu réutilise le cycle d'authentification déjà présent dans le
header, sans requête, abonnement ni polling supplémentaire. Elle se réinitialise
à la déconnexion. Le menu et ses styles téléphone/ordinateur ne changent pas.

Validation : 104 tests ciblés (droits, API, menu, cycle d'authentification et
startlists), 14 contrôles PostgreSQL isolés de la migration, TypeScript et ESLint.
Les tests de migration ne s'exécutent jamais sur la base de production.

Livraison de la correction ciblée : définir
`SUPABASE_LINKED_WORKDIR=C:/Dev/cycling-manager`, puis utiliser
`node scripts/deliver-gala-duplicate-cleanup.mjs --inspect|--apply|--verify`.
Le script vérifie les doublons de toute la S4 et les compositions de 7–8 coureurs,
conserve un reçu atomique et contrôle le site public après installation.
Les six XML sont ensuite validés localement depuis un instantané de lecture seule
limité aux inscriptions du gala et à leurs coureurs, identifiants et notes S4.

Correction SQL appliquée le 4 novembre à 12:47 UTC. Vérification : aucun coureur
inscrit dans plusieurs clubs, aucune composition invalide, sept coureurs chez
Yukikaze sur la montagne et les deux inscriptions de Babacar chez Okavango intactes.
Les six XML réels passent la génération locale : 33 clubs et 737 places de
coureurs, sans doublon par course, avec les capacités PCM respectées. Preuves :
`C:/Dev/artifacts/gala-roster-audit-20261104/`.
