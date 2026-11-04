# PCM26 : cohérence du gala S4 et des exports — 4 novembre 2026

Le pack Workshop existant 3811779261 a été actualisé avec une BDD issue de la
capture du 4 novembre et six startlists contrôlées contre cette même BDD.
Les quatre PAK graphiques approuvés sont conservés sans modification.

## Causes établies

- L'export général et l'export gala n'utilisaient pas les mêmes codes graphiques.
  Le même club pouvait ainsi demander un mini-maillot absent ou celui d'une
  équipe officielle PCM. Les deux exports utilisent maintenant le registre de
  49 clubs, indexé par identifiant permanent, avec priorité aux assets S4 et
  reprise du dernier asset disponible pour le même club.
- Une base exportée seule ne charge pas les graphismes `/Mod/` simplement parce
  que leurs PAK sont présents dans `~mods`. PCM enregistre cette racine lorsque
  le mod contenant les PAK est sélectionné. L'avertissement initial de montage
  n'est donc pas une preuve d'incompatibilité des textures. Un outil inclus dans
  chaque ZIP copie les quatre PAK Steam compatibles à côté des CDB et de mod.xml,
  après contrôle des SHA et avec sauvegarde des fichiers différents.
- L'ancienne BDD Workshop associait encore Babacar Sow au club 351 alors que
  ses engagements conservés dans les SL actuelles sont au club 307. La nouvelle
  copie d'exhibition respecte le club d'inscription et la correction du doublon
  déjà livrée, sans modifier les contrats du site.
- Les exports conservaient des clubs sans aucun coureur et pouvaient les placer
  dans les présélections des courses. Le builder retire désormais ces clubs,
  sans imposer un effectif minimum aux clubs possédant des coureurs.
- Un XML téléchargé sous un nom avec suffixe `(1)` n'est pas le fichier natif
  recherché par PCM. WT et Continental partagent aussi deux noms de fichiers :
  ils doivent être installés séparément. L'outil `Install-Startlists.ps1` livré
  dans le Workshop contrôle les SHA, sauvegarde les quatre noms concernés et
  leurs doublons numérotés, puis installe les trois XML du programme demandé.

## Résultat contrôlé

- 70 clubs avec effectif et une équipe de simulation : 55 clubs vides retirés de
  la capture actuelle de 125 clubs. La sentinelle native PCM 119 « - » reste
  présente et n'est jamais présélectionnée.
- 1 599 coureurs et contrats, dont dix Simulos. Les liens `fkIDcontract` sont
  explicites et contrôlés ; leur valeur nulle précédente n'est pas présentée
  comme une cause démontrée d'absence des Simulos à l'écran.
- Six SL : 33 clubs, 582 coureurs distincts, 737 engagements, sept Simulos par
  épreuve, effectifs de 7 à 8, aucun doublon ni écart d'identifiant ou de club.
- Les 33 clubs inscrits ont tous un maillot et un mini-maillot physiquement
  présents dans les quatre PAK. Aucun PNG existant n'a été modifié.
- Noms XML, capacités, règles natives des quatre parcours et toutes les
  présélections de la BDD vérifiés hors production.
- Les nouveaux exports du site ont un nom de ZIP, un identifiant de mod et un
  titre PCM uniques : saison, édition, date/heure UTC et identifiant d'export.
  Les noms natifs `OfficialRelease.cdb` et `OfficialLocal.cdb` sont conservés.

## Vérification et publication

57 tests ciblés réussis, TypeScript et ESLint ciblé réussis. Les outils
d'installation ont été vérifiés dans un profil isolé ; le contrôle des quatre
PAK Steam par SHA a également réussi sur l'installation réelle. Aucun essai de
jeu ni migration n'a été exécuté dans la BDD de production ; capture GET bornée
et séquentielle seulement. Connectivité SQL vérifiée après la capture.

Steam a confirmé le commit de la mise à jour. Son API publique confirme le
manifest **5096166018157259908**, publié le **4 novembre 2026 à 15:42:58 Paris**.
BDD publiée : `7d0d82d467d5d9c89aadac50de0352d0c3229755eb96d060b0bb9c0215adac22`.
Titre de sélection PCM : **Cyclostratège S4 · Gala · 04/11/2026 15:36 · v2**.

Preuves locales : `C:/Dev/pcm26-bridge-lab/gala-consistency-20261104/`, notamment
`Steam/upload-result-v2.json`, `canonical-asset-registry.json`,
`asset-pack-coverage.json` et le `Startlists/audit.json` du dossier Release v2.
Le contrôle visuel des mini-maillots et des sept Simulos a été observé dans PCM ;
aucune nouvelle validation complète des raccords 3D n'est revendiquée.
