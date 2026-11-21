# Gala S5 — aperçu privé

Page : `/apercus/gala-saison-5`, réservée aux comptes vérifiés de Zocoto et Gouille.
Programme, date et lots proposés pour arbitrage. Inscriptions fermées ; aucune
tuile dans le bureau, aucune écriture en base ni modification du package Steam.

## Parcours vérifiés le 21 novembre 2026

Source : PCM26, `pakchunk1-Windows.pak`, paires CDS/ZCES présentes. Les courbes
de la page viennent des CDS, réduites en conservant les extrema. Distances
normalisées de 0 à 1 ; hauteurs en unités PCM, sans conversion en mètres.
Les identités et règles natives ont été relues dans la CDB du Workshop
**3811779261**, Cyclostratège S4 / Gala du 6 novembre / v5, empreinte SHA256
`ddf5e528e9c6420eaab5838031c08bd6717d90966dcbf8d7a797a72203940976`.
Les empreintes des six CDS sont conservées dans le catalogue JSON.

| Programme | Variante | Course / étape | Startlist | Capacité native | Coureurs natifs |
|---|---|---|---|---|---|
| Pro Tour | Zoncolan, Giro 2021 étape 14 | 135 / 14135 | `top_giro.xml` | 23 | 8–8 |
| Pro Tour | Liège 2019 | 87 / 1087 | `topclas_lbl.xml` | 25 | 7–7 |
| Pro Tour | Flandres 2024 | 11 / 1011 | `topclas_rondevv.xml` | 25 | 7–7 |
| Continental | Alpe-d’Huez, Tour 2022 étape 12 | 25 / 12025 | `top_tdf.xml` | 23 | 7–8 |
| Continental | Flèche Wallonne 2024 | 15 / 1015 | `topclas_fleche.xml` | 25 | 6–8 |
| Continental | Hambourg 2023 | 26 / 1026 | `topclas_hamburg.xml` | 24 | 7–7 |

Les six identités et les six noms XML sont distincts. Aucun parcours S4 repris
(Hautacam, Amstel, Roubaix, Dunkerque). Les deux montagnes demandent le mode
étape et leur variante exacte. Les capacités affichées aux participants
réservent une place à l’équipe de simulation, comme le précédent export.
Présence des fichiers vérifiée ; aucun lancement de course 3D effectué.

## À câbler après arbitrage

- Harmoniser dans le nouvel export les règles natives pour accepter 7–8 coureurs
  par équipe sur ces six épreuves ; ne pas tronquer silencieusement une SL.
- Garder le plafond Continental à 75 dans les six notes primaires natives,
  hors matériel, à l’admission ; aucune réduction artificielle des notes.
- Prévoir inscriptions, clôture et dédoublement des groupes selon les capacités.
- Versionner les résultats et récompenses par édition : les anciennes tables S4
  ont des clés globales `event_key` et des dotations live non versionnées.
  Ne pas y écrire les résultats S5 tels quels.
- Générer la BDD et ses SL ensemble après clôture, puis vérifier leur cohérence
  avant publication Steam. Aucun changement du package n’est livré ici.

L’aperçu est indépendant des actions S4, sans GameLayout ni requête de jeu.
Seule la vérification de session protège sa consultation. Les onglets et courbes
sont locaux ; pas de polling, téléchargement de scènes 3D ou nouvelle dépendance.
