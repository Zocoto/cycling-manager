# Gala S5 — ouverture officielle

La page officielle est `/jeu/gala-saison-5`, accessible depuis une tuile dédiée
du bureau des DS. L’ancien lien `/apercus/gala-saison-5` redirige vers cette page.
La consultation et les actions demandent une session authentifiée ; l’accès
n’est plus limité aux comptes de préparation.

La clôture des inscriptions, modifications et retraits est fixée au
**jeudi 3 décembre 2026 à 18 h Europe/Paris**, soit `2026-12-03T17:00:00Z`.
La date et l’heure du live restent à confirmer : cette échéance est la clôture
des inscriptions, pas l’horaire de diffusion.

## Inscriptions

- Une seule catégorie par DS et par équipe : Pro Tour ou Continental.
- Pour chaque épreuve choisie, 7 à 8 coureurs distincts ; au moins une épreuve
  complète pour valider une inscription.
- Coureurs et notes natives de la saison 5, sans bonus d’équipement.
- Continental : plafond de 75 dans chaque note primaire lors de l’admission.
  Une progression naturelle ultérieure conserve cette admission, sans écrêter
  les notes du coureur.
- Enregistrement atomique des compositions, contrôle des contrats et protection
  contre les changements provenant d’un onglet périmé.
- Le serveur vérifie de nouveau la clôture après les attentes sur les verrous.
- La source S5 reste utilisable après le passage en S6 ; les couleurs S6 sont
  projetées depuis les identités et contrats prévus, sans modifier la saison 5.

## Programme natif conservé

| Programme | Épreuve | Course / étape PCM | XML | Équipes de joueurs par groupe |
|---|---|---|---|---|
| Pro Tour | Zoncolan, Giro 2021 étape 14 | 135 / 14135 | `top_giro.xml` | 22 |
| Pro Tour | Liège 2019 | 87 / 1087 | `topclas_lbl.xml` | 24 |
| Pro Tour | Hambourg 2023 | 26 / 1026 | `topclas_hamburg.xml` | 23 |
| Continental | Alpe-d’Huez, Tour 2022 étape 12 | 25 / 12025 | `top_tdf.xml` | 22 |
| Continental | Flèche Wallonne 2024 | 15 / 1015 | `topclas_fleche.xml` | 24 |
| Continental | Flandres 2024 | 11 / 1011 | `topclas_rondevv.xml` | 24 |

Les capacités réservent une place à l’équipe de simulation. Les règles du CDB
dédié au gala doivent accepter 7 à 8 coureurs pour les six épreuves ; les règles
natives du gabarit ne sont pas toutes identiques à ce format.

## Préparation du package après la clôture

Les inscriptions S5 utilisent `season_gala_editions`, `season_gala_events`,
`season_gala_entries`, `season_gala_entry_admissions` et
`season_gala_entry_riders`. Ne pas utiliser les inscriptions, fichiers de
référence ou clés de résultats S4 pour fabriquer cette édition.

L’export S5 prépare le CDB et les startlists à partir du même relevé
d’inscriptions, avec notes S5 et identités S6. Les groupes respectent la capacité
de chaque parcours ; aucune sélection ne doit être tronquée pour la faire entrer
dans une course. Les identifiants des équipes et coureurs des XML doivent
correspondre exactement au CDB fourni dans le même package.

L’outil privé est `/jeu/export-pcm?gala=saison-5`. Il refuse la génération avant
la clôture et réclame des identités S6 confirmées pour les équipes inscrites.
Le ZIP contient les XML par programme et, si nécessaire, par groupe, ainsi que
`Startlists/manifest.json` lié à l’empreinte du CDB généré.

Après extraction, `Installer-startlist-gala-S5.ps1 -Course pt-zoncolan -Groupe 1
-VerifyOnly` vérifie les empreintes de la base et du XML sans installer.
L’installation sans `-VerifyOnly` choisit un seul groupe de cette course,
sauvegarde sa précédente startlist et conserve le nom XML natif. Vérifier aussi
les graphismes et maillots S6 lors de la préparation du package Steam final.

La génération finale, l’installation des startlists choisies et la publication
Steam seront effectuées après la clôture. L’ouverture des inscriptions ne
génère aucune startlist de joueurs et ne modifie aucun package Steam installé.

Les résultats et dotations S5 devront garder leur identité d’édition lors de
leur règlement. Les anciens imports et récompenses S4 restent séparés ; cette
ouverture n’attribue aucun gain.
