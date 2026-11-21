# Gala S5 — aperçu privé

Page : `/apercus/gala-saison-5`, réservée aux comptes vérifiés de Zocoto et Gouille.
Programme et lots proposés pour arbitrage. Inscriptions câblées en accès privé,
avec clôture au **4 décembre 2026 à 12 h Europe/Paris**. Aucune tuile dans le
bureau et aucune modification du package Steam.

## Inscriptions

Une édition S5 et six événements natifs utilisent des tables indépendantes de
S4. Une entrée unique par `(édition, DS)` et `(édition, équipe)` empêche les
catégories simultanées. Les compositions des trois courses s’enregistrent en
une opération : chacune contient 0 ou 7–8 coureurs, au moins une course complète.
Le changement de catégorie exige le programme précédent et remplace les
anciennes sélections ; une demande provenant d’un onglet périmé est rejetée.
Les verrous bornés protègent aussi la validation des contrats et notes natives.

Les admissions Continental sont conservées après progression naturelle, sans
écrêter les notes. Le contexte est chargé par un seul RPC avec délai maximal de
8 secondes. Les contrôles d’accès existent dans la page, les actions et les RPC :
seuls Zocoto et Gouille accèdent à cette édition privée jusqu’à sa publication.
Les formulaires permettent de trier les six notes et de valider les compositions
ensemble. Une indisponibilité de lecture affiche une erreur sans ouvrir le jeu.

La clôture reste valide pendant J1 de S6 : la source S5 peut être terminée.
L’identité S6 est projetée depuis les contrats prévus, sans modifier l’équipe S5.
Le Cuissard des Lumières proposé donne +1 PAV, +1 PLA et +1 RES, plus deux
boosters pour la présence au live. Aucun gain n’est attribué par cette livraison.

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
- Préparer le dédoublement des groupes selon les capacités natives.
- Versionner les résultats et récompenses par édition : les anciennes tables S4
  ont des clés globales `event_key` et des dotations live non versionnées.
  Ne pas y écrire les résultats S5 tels quels.
- Générer la BDD et ses SL ensemble après clôture, puis vérifier leur cohérence
  avant publication Steam. Aucun changement du package n’est livré ici.

L’aperçu est indépendant des actions S4, sans GameLayout. Les onglets, tris et
courbes sont locaux ; aucun polling, téléchargement de scènes 3D ou nouvelle
dépendance n’est ajouté.
