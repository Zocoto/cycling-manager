# Objectifs sponsor : cohérence sportive à partir de S5

Les propositions de la saison 5 et des saisons suivantes sont adaptées à l'équipe, au lieu de déduire toute la catégorie des courses du prestige et du budget de son sponsor. La saison 4 et les engagements déjà signés conservent leurs conditions.

## Ordre des critères

1. Conserver la philosophie du sponsor : classiques pavées, classiques vallonnées, tours intermédiaires, chronos, sprints, grands tours, préférence nationale ou formation.
2. Choisir parmi les épreuves accessibles à l'équipe. Les règles de réputation et d'ouverture des inscriptions restent applicables ; aucune invitation Élite incertaine n'est imposée aux futures équipes des autres divisions.
3. Donner priorité à la division projetée lors de la proposition, issue du classement officiel de la saison active. Une projection connue prime sur la division actuelle, y compris en cas de relégation. En son absence, utiliser la division actuelle.
4. Tenir compte de la force native des leaders et de la profondeur du groupe pour repérer une équipe très forte encore classée dans une division inférieure. Cette remontée de niveau est limitée à World si l'équipe n'est pas projetée en Élite.
5. Départager les épreuves compatibles par proximité avec le pays du sponsor et par variété par rapport aux saisons précédentes.

Tous les objectifs nommant une épreuve suivent la philosophie, y compris ceux historiquement appelés domestiques/régionaux et ceux liés à l'arrivée d'un nouveau leader. Un sprint ou un chrono dans un tour ne transforme plus son classement général en objectif de sprint ou de chrono. Pour une philosophie grands tours sans accès garanti aux grands tours, les courses par étapes plus modestes constituent le repli.

Quand le calendrier compatible est trop court, les emplacements restants utilisent des objectifs de développement et de saison, sans imposer une épreuve hors spécialité. Le portefeuille conserve dix engagements totalisant 100 points.

## Exigence des résultats

Le prestige, le budget et la difficulté négociée restent la base de l'ambition du partenaire. La calibration sportive assouplit un résultat trop difficile pour les moyens connus : victoire, podium ou Top 5/10/15/20/25. Elle utilise les caractéristiques du parcours, le meilleur leader adapté et les équipiers ; un tour demande davantage de profondeur et de récupération qu'une classique.

Le niveau d'ensemble repose sur la meilleure note primaire native de chaque coureur et ses qualités physiques, puis sur les trois/six meilleurs coureurs connus. Il n'utilise pas la moyenne des treize notes comme seul indicateur d'un spécialiste. Les notes d'équipement, les bonus temporaires et la forme du jour ne déplacent pas les engagements de toute une saison.

Le rang UCI demandé est rapproché du classement projeté. Les quotas de victoires respectent un plafond de force/difficulté. Les objectifs complémentaires remplacent les paliers excédentaires ; on n'augmente pas le plafond simplement pour obtenir des objectifs distincts.

Les quotas nationaux et les quatre objectifs propres à la filière formatrice sont conservés. Les plafonds S5 de prime de l'objectif principal restent inchangés.

## Effectif de référence et coût des lectures

Le contexte est chargé une seule fois pour l'ensemble des nouvelles offres d'une équipe. Il comprend les coureurs actuels encore plausibles à J21, les contrats couvrant la saison cible et les arrivées prévues, en retirant les départs signés vers une autre équipe et les retraités. Un contrat simplement en fin de saison n'est pas assimilé à un départ confirmé.

Les notes de la saison cible sont prioritaires ; les notes natives actuelles servent uniquement aux coureurs sans notes futures. Les requêtes sont limitées à l'équipe et aux identifiants concernés, par lots de 75. Aucun chargement complet du classement ou des effectifs de toutes les équipes n'est ajouté.

Un plan complet déjà proposé n'est pas recalculé à chaque visite ou mouvement du classement. Un plan partiellement enregistré est complété à partir d'un seul portefeuille calibré ; il ne repasse pas par l'ancienne sélection fondée sur le prestige. Le chemin de lecture des contrats signés reste séparé et sans régénération.

## Vérification

Tests unitaires et clients Supabase simulés : philosophies, promotions/relégations, équipes faibles/fortes, spécialistes, absence de données, calendrier clairsemé, caps de victoires, dix objectifs/100 points, déterminisme, une lecture de contexte par lot d'offres, stabilité des revisites et des engagements signés, complétion d'un plan interrompu.

Aucune migration de schéma, simulation de course ou écriture de gameplay en production n'est nécessaire. Les nouvelles conditions s'appliqueront à la création des propositions S5 à partir de la fenêtre de négociation.
