# Revue gameplay S3 — bâtiments, lisibilité et engagement

## 1. Décisions déjà implémentées

Les neuf bâtiments fédéraux doivent produire l’effet annoncé par leur fiche. Les effets sont centralisés et plafonnés par niveau :

| Bâtiment fédéral | Effet effectif au niveau 5 | Règle d’empilement |
| --- | ---: | --- |
| Réseau national de détection | +5 % de chance de rendre une donnée de rapport exacte | N’augmente ni le nombre ni la rareté des talents |
| Académies régionales | −5 % de scolarité et davantage d’archétypes secondaires | Réduction multipliée après celle du scout |
| Centre national de performance | +1,5 % de progression professionnelle | Multiplicatif avec staff, bâtiment d’équipe et récompenses |
| Institut fédéral du staff | +2,5 % d’efficacité du staff de la nation | Seulement si le pays du membre correspond à la fédération |
| Réseau médical fédéral | −5 % de durée de blessure | Ajouté au médecin, plafond global de 85 % |
| Laboratoire technique national | +1 % aux notes CLM/PRO de la sélection | Seulement en Mondiaux/Continentaux et sur CLM/prologue |
| Bureau d’organisation | +25 % de recettes fédérales territoriales | Déjà actif ; recettes réelles uniquement |
| Bureau fédéral d’intégration | −20 % de délai | Le meilleur délai entre équipe et fédération est retenu, sans cumul |
| Programme avantage du terrain | +1 point au bonus local | Coureur de la nation, course dans son pays uniquement |

Les prix et délais du catalogue sont désormais la même source fonctionnelle que les débits côté serveur. Le détail des bonus est calculé avec les données déjà chargées par la page : le survol n’émet aucune requête réseau. Sur écran tactile, le même composant s’ouvre au clic.

## 2. Durées de construction rééquilibrées

Une saison dure 28 jours. La nouvelle grille suit trois rythmes lisibles : les bâtiments utilitaires culminent entre 23 et 28 jours, les bâtiments structurants à 35 jours et les projets fédéraux les plus complexes à 32 jours. Les paliers intermédiaires restent strictement croissants et les architectes conservent leurs réductions.

### Équipe

| Bâtiment | Nouvelle progression |
| --- | --- |
| Data Room du recrutement | 7 · 14 · 21 j |
| Académie des métiers | 10 · 16 · 22 · 28 · 35 j |
| Centre d’entraînement | 5 · 9 · 14 · 20 · 28 j |
| Piste indoor | 7 · 11 · 16 · 22 · 28 j |
| Centre de cryothérapie | 6 · 10 · 15 · 21 · 28 j |
| Soufflerie | 9 · 14 · 20 · 27 · 35 j |
| Centre météo | 6 · 10 · 15 · 21 · 28 j |
| Média Center | 9 · 14 · 20 · 27 · 35 j |
| Centre d’accueil international | 10 · 16 · 22 · 28 · 35 j |
| Centre international des jeunes | 10 · 16 · 22 · 28 · 35 j |
| Laboratoire R&D | 10 · 15 · 20 · 25 · 30 · 33 · 35 j |
| Siège du Fan Club | 6 · 10 · 15 · 21 · 28 j |
| Boutique du club | 5 · 9 · 14 · 20 · 26 j |

### Fédération

| Bâtiment | Nouvelle progression |
| --- | --- |
| Réseau national de détection | 7 · 10 · 14 · 18 · 23 j |
| Académies régionales | 8 · 12 · 16 · 21 · 27 j |
| Centre national de performance | 9 · 14 · 19 · 24 · 30 j |
| Institut fédéral du staff | 7 · 11 · 15 · 20 · 26 j |
| Réseau médical fédéral | 7 · 10 · 14 · 18 · 23 j |
| Laboratoire technique national | 9 · 14 · 19 · 25 · 32 j |
| Bureau d’organisation | 7 · 10 · 14 · 18 · 23 j |
| Bureau fédéral d’intégration | 9 · 14 · 19 · 24 · 30 j |
| Programme avantage du terrain | 6 · 9 · 13 · 18 · 23 j |

Les chantiers déjà actifs sont raccourcis lors de la migration. Tous les jours précédemment économisés grâce à un architecte ou une récompense sont conservés en valeur absolue et aucun chantier existant ne peut être rallongé.

## 3. Popularité, ferveur et supporters

Les trois métriques se recoupent aujourd’hui : la popularité agrégée des coureurs alimente les supporters puis la ferveur, tandis que popularité et ferveur remultiplient ensuite les ventes. Le joueur voit donc trois valeurs partiellement dérivées l’une de l’autre.

Modèle cible recommandé :

- **Supporters** : stock durable et dénombrable. Sert aux déplacements, à l’audience et à la taille du marché boutique.
- **Ferveur** : état court terme de 0 à 100. Monte avec les résultats, les animations et les publications ; revient progressivement vers une valeur neutre. Sert au taux de présence et à la propension d’achat.
- **Popularité des coureurs** : attribut individuel conservé sur chaque fiche, utile aux interviews, transferts, ventes de maillots nominatifs et départs de vedettes.
- **Rayonnement de l’équipe** : valeur affichée mais dérivée, non stockée, calculée à partir des supporters, de la réputation, du top 5 des coureurs populaires et des résultats récents.

La tuile « Popularité / 100 » du Fan Club disparaîtrait donc au profit de « Rayonnement », explicitement présenté comme un indicateur synthétique. Le moteur boutique ne devrait plus multiplier à la fois ferveur et popularité agrégée : supporters × ferveur × prix suffit, avec un petit bonus « star » réservé aux produits nominatifs.

Migration conseillée en S3 : conserver toutes les données historiques, calculer le rayonnement en lecture, faire tourner une saison en double calcul observé, puis retirer `popularity_index` de l’économie seulement après calibration. Aucun changement destructif n’est à faire directement en production.

## 4. Plan vélo scolaire

**Statut : livré pour la Saison 3.** Le programme, son financement fédéral,
sa montée en puissance et la traçabilité des probabilités dans les rapports de
scouting sont implémentés.

Le Plan vélo scolaire devient un **programme fédéral pluri-saisonnier** rattaché aux Académies régionales, et non un bonus instantané.

### Parcours président

1. Débloquer les Académies régionales N2.
2. Ouvrir « Politique de formation » et consulter les probabilités actuelles du pays.
3. Choisir un objectif parmi les huit archétypes. Le style principal historique ne peut pas être choisi comme nouveau style.
4. Prévisualiser le transfert de probabilités avant de voter le plan.
5. Financer le plan puis attendre 56 jours, soit deux saisons complètes.
6. À la livraison, l’effet monte en puissance sur trois promotions : +3, +6 puis +10 points de probabilité pour le style choisi.

### Effet de simulation

Le plan ne crée pas de meilleurs coureurs. À pleine maturité, il transfère 10 points de probabilité depuis le style principal vers le style choisi. Le potentiel, les notes initiales et le taux de capacités rares restent inchangés. Les Académies régionales continuent séparément à élargir légèrement la part des profils secondaires.

Un pays ne peut avoir qu’un plan actif. Changer d’orientation relance 56 jours de déploiement et ne modifie jamais les juniors déjà générés. Chaque rapport affiche « style historique », « plan scolaire » et les probabilités utilisées au moment de la détection.

## 5. Centre tactique — fonctionnement proposé

Le Centre tactique doit donner des choix avant-course et produire un compte rendu compréhensible. Il ne doit pas vendre des points de caractéristiques.

### Parcours utilisateur

1. Depuis une course où l’équipe est acceptée, le DS ouvre « Briefing tactique ».
2. Il choisit une doctrine éligible au parcours et assigne les rôles requis.
3. Une prévisualisation indique la condition de déclenchement, le bénéfice possible et le coût certain ou le risque.
4. Le plan est verrouillé au départ de l’étape et enregistré dans l’entrée officielle de simulation.
5. Pendant la course, un événement signale si la doctrine se déclenche.
6. Le débrief explique son impact : énergie dépensée, écart évité/créé, positionnement ou variance modifiée.

### Doctrines

| Doctrine | Condition | Bénéfice | Contrepartie |
| --- | --- | --- | --- |
| Contrôle de l’échappée | Course en ligne | Réduit de 8 % la probabilité qu’une échappée dangereuse prenne un gros écart | Deux équipiers perdent 5 à 8 % d’énergie avant le final |
| Bordure offensive | Secteur plat + vent soutenu | +10 % de chance d’initier la première cassure et meilleur placement de l’équipe | +8 % de dépense d’énergie ; risque de piéger son propre leader mal protégé |
| Coureur satellite | Étape vallonnée/montagne | Si le satellite est encore devant à 35 km, le leader économise 4 % d’énergie lors de son attaque | Le satellite sacrifie son résultat et ne dispute pas le final |
| Train de sprint | Arrivée massive probable | Réduit la variance de placement du sprinteur de 15 % | Trois lanceurs consomment leur énergie, efficacité nulle si l’arrivée n’est pas massive |
| Tempo montagne | Étape montagneuse | Réduit de 6 % la réussite des attaques lointaines contre le leader | Usure collective accrue et moins de liberté pour viser l’étape |

### Niveaux et garde-fous

- N1 : une doctrine de base et un briefing par étape.
- N2 : historique et recommandations liées au parcours.
- N3 : doctrines avancées ; choix d’une spécialisation tactique.
- N4 : un plan de secours conditionnel, jamais deux bonus simultanés.
- N5 : meilleur diagnostic post-course, sans coefficient supplémentaire.

Le niveau débloque de la variété et de l’information, pas une montée linéaire de puissance. Tous les effets modifient probabilités, placement ou énergie dans des bornes de 3 à 10 %. Ils utilisent la graine déterministe de l’étape et sont stockés avec la simulation officielle : un replay donnera toujours le même résultat.

## 6. Spécialisations de bâtiments

### Règle commune

Une spécialisation est choisie au N3. Sa puissance vaut 60 % au N3, 80 % au N4 et 100 % au N5. Les valeurs ci-dessous sont les valeurs N5. Un changement est possible une fois par saison contre 15 % du coût cumulé du bâtiment et prend 14 jours. Chaque branche contient une contrepartie ou remplace un bonus de même budget.

### Équipe

| Bâtiment | Spécialisation A | Spécialisation B | Spécialisation C |
| --- | --- | --- | --- |
| Data Room | **Précision** : +2 notes exactes, −2 fourchettes | **Profondeur** : potentiel jamais inconnu, mais −2 notes exactes | **Veille marché** : fourchettes contractuelles resserrées, rapport sportif inchangé |
| Académie des métiers | **Expertise** : formation d’un talent −15 %, une place en moins | **Promotion** : formation d’un niveau −15 %, talents au délai normal | **Cohorte** : +1 place, toutes les formations +15 % longues |
| Centre d’entraînement | **Pointu** : +12 % sur notes principales, −12 % sur secondaires | **Polyvalent** : +8 % sur secondaires, −8 % sur principales | **Charge maîtrisée** : coût de forme −20 %, progression −8 % |
| Piste indoor | **Explosivité** : bonus ACC renforcé de 1, durée −1 jour | **Train de sprint** : effet +1 jour, bonus de notes réduit de 1 | **Volume** : deux groupes simultanés, préparation +1 jour |
| Cryothérapie | **Retour express** : effet post-course +10 %, aucun bonus blessure | **Rééducation** : −10 % sur convalescence, effet post-course −10 % | **Grands Tours** : effet doublé à partir du 10e jour de course, moitié sur courses d’un jour |
| Soufflerie | **CLM individuel** : +1 CLM, pas de bonus END | **CLM par équipes** : variance des relais −12 %, bonus individuel réduit de 1 | **Aéro sprint** : +1 PLA/SPR, durée de préparation −1 jour |
| Centre météo | **Vent** : précision maximale sur vent, autres horizons −2 jours | **Chaleur** : idem température | **Pluie** : idem pluie et risque de chute |
| Média Center | **Sponsor** : satisfaction des publications +25 %, supporters −20 % | **Communauté** : supporters +25 %, satisfaction sponsor −20 % | **Rédaction** : délai entre tribunes −1 jour, gains unitaires −15 % |
| Centre d’accueil | **Coureurs** : délai pro −15 %, bonus staff désactivé | **Staff** : affinité staff étendue un palier plus tôt, délai coureur inchangé | **Implantation locale** : bonus local frontalier +1, naturalisation −10 % moins efficace |
| Laboratoire R&D | **Fiabilité** : malus prototype divisés par deux, bonus max −20 % | **Audace** : bonus max +20 %, malus max +20 % | **Industrialisation** : revente +25 %, chance de réussite −8 points |
| Siège du Fan Club | **Ancrage local** : ferveur domicile +12, déplacements −15 % | **Déplacements** : capacité mobilisable +15 %, base supporters −10 % | **International** : gains hors pays +20 %, domicile −10 % |
| Boutique | **Volume** : demande +15 %, marge −10 % | **Premium** : marge +15 %, demande −10 % | **Collection** : séries limitées et maillots nominatifs, réassort +25 % cher |

### Fédération

| Bâtiment | Spécialisation A | Spécialisation B | Spécialisation C |
| --- | --- | --- | --- |
| Réseau de détection | **Précision** : +2 points de précision, −10 % de volume | **Maillage** : +1 candidat potentiel, précision divisée par deux | **Diversité** : +8 points vers profils secondaires, aucune précision additionnelle |
| Académies régionales | **Accessibilité** : réduction de scolarité doublée, diversité annulée | **Plan scolaire** : débloque l’orientation pluri-saisons, réduction divisée par deux | **Territoires** : diversité doublée, réduction de scolarité annulée |
| Centre de performance | **Endurance** : bonus sur END/RES/REC uniquement, coefficient ×2 | **Vitesse** : bonus sur SPR/ACC/PLA uniquement, coefficient ×2 | **Relief** : bonus sur MON/VAL/DES uniquement, coefficient ×2 |
| Institut du staff | **Entraîneurs** : bonus ×2 pour entraîneurs seulement | **Médical** : bonus ×2 pour médecins/kinés/nutritionnistes | **Détection** : bonus ×2 pour scouts ; autres rôles sans bonus fédéral |
| Réseau médical | **Prévention** : −5 % de risque, plus de réduction de durée | **Récupération** : réduction de durée ×2, aucun effet prévention | **Forme** : −1 perte de forme/jour blessé, réduction de durée divisée par deux |
| Laboratoire technique | **CLM individuel** : bonus CLM individuel ×2 | **Collectif** : bonus CLM par équipes ×2 | **Fiabilité** : −10 % d’incidents mécaniques en sélection, plus de bonus de notes |
| Bureau d’organisation | **Classiques** : revenus ×1,5 sur courses d’un jour, ×0,75 ailleurs | **Tours** : revenus ×1,5 sur courses par étapes, ×0,75 ailleurs | **Base** : petites courses +50 % et vivier local, courses majeures −25 % |
| Bureau d’intégration | **Coureurs** : délai pro ×0,8, aucun effet junior/staff | **Jeunes** : délai junior ×0,6, aucun effet pro/staff | **Staff** : quota et délai staff améliorés, aucun effet coureur |
| Avantage du terrain | **Routes** : bonus ×2 sur profils choisis, nul ailleurs | **Climat** : réduit de moitié l’inadaptation météo, plus de point local | **Public** : ferveur et affluence domicile +15 %, plus de bonus simulation |

## 7. Ordre de réalisation recommandé

1. Stabiliser et mesurer les effets fédéraux ainsi que les détails de bonus.
2. Ajouter les spécialisations à trois bâtiments pilotes : Centre d’entraînement, Réseau de détection, Bureau d’organisation.
3. Livrer le Plan vélo scolaire avec ses probabilités visibles et son délai de 56 jours.
4. Construire le Centre tactique derrière un drapeau S3, avec simulations comparatives automatisées.
5. Faire tourner Rayonnement en lecture seule pendant une saison avant de simplifier l’économie du Fan Club.
