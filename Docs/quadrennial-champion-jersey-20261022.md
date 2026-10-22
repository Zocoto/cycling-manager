# Maillot des champions des Jeux quadriennaux

Le visuel validé le 22 octobre 2026 est décliné en deux assets WebP transparents :

- `public/images/quadrennial-games/champion-jersey-v1.webp` : maillot blanc, continents en contours colorés, motifs topographiques ton sur ton.
- `public/images/quadrennial-games/emblem-v1.webp` : emblème assorti.

La planche approuvée et les rendus de contrôle sont conservés dans `C:/Dev/artifacts/quadrennial-jersey-20261022/`. Les deux assets ont été extraits de cette planche avec l’outil intégré de génération d’images, puis optimisés en WebP avec alpha. Les instructions d’extraction demandaient de conserver le dessin validé, d’isoler respectivement la face et l’emblème, sans texte ni arrière-plan.

## Attribution

La migration `20261022120000_quadrennial_champion_jerseys.sql` ajoute `quadrennial_road` et `quadrennial_time_trial` à l’historique existant des titres. Seules les deux éditions explicitement référencées dans `national_federation_olympic_events`, en saison quadriennale, peuvent attribuer ces titres. Une victoire ordinaire de Nations Cup ne suffit pas.

Les triggers ne s’exécutent que sur une ligne de résultat de rang 1 (ancien ou nouveau). La fonction privée sérialise chaque discipline et réconcilie les vainqueurs officiels. Elle conserve un seul tenant du titre par discipline, jusqu’à la prochaine édition, et garde les anciennes éditions dans l’historique. Un rejeu ancien ne peut pas remplacer un champion plus récent. Un résultat corrigé, supprimé, disqualifié ou présentant deux vainqueurs est réconcilié sans modifier les résultats sportifs.

## Affichage

Fiche du coureur, comparaison, accueil et effectif : Jeux, puis CM, CC, CN et tenue d’équipe. La route est privilégiée sur le portrait si le même coureur détient les deux titres ; les deux maillots figurent dans sa fiche. Le titre demeure visible dans la carrière et les archives ; les anciens champions disposent du liseré existant.

En course, les maillots de classement et la sélection nationale restent prioritaires. Les autres courses utilisent le titre correspondant à leur discipline. Les avatars détaillés et compacts cadrent le haut du même asset, sans étirer le vêtement entier. Le moteur ne consulte pas le nouveau titre pour ses calculs sportifs.

Un rappel du maillot et de l’emblème apparaît sur la page des Jeux, leur bannière d’accueil, les fiches d’inscription et les pages résultats/direct/replay concernées. Aucun bonus de performance ni dotation financière supplémentaire n’est ajouté.

## Performances et validation

Le chargement groupé des titres inclut les Jeux dans sa requête existante. La RPC compacte du calendrier transmet déjà tous les titres actifs : aucun changement de RPC ni lecture supplémentaire n’est nécessaire sur ce chemin. Le repli historique dispose d’une lecture bornée par coureurs et discipline. Les images sont locales, versionnées et partagées entre tous les portraits.

Les fixtures SQL utilisent exclusivement PGlite, jamais la base de production. Le script `scripts/test-quadrennial-champion-titles-sql.mjs` couvre le rattrapage, l’idempotence, les éditions successives, les corrections, l’indépendance route/CLM, les droits et le maintien des autres titres. Les tests applicatifs couvrent le cadrage, les priorités en course, le chargement sans lecture supplémentaire et l’absence de changement des résultats ou événements simulés. Les composants réels sont aussi rendus localement avec le CSS compilé pour le contrôle PC et téléphone.
