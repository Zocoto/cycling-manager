export type InfrastructureSpecializationScope = "team" | "federation";

export type InfrastructureSpecializationOption = {
  code: string;
  name: string;
  identity: string;
  primaryEffect: string;
  secondaryEffect: string;
  guardrail: string;
  powerBudget: 100;
};

export type InfrastructureSpecializationProposal = {
  buildingCode: string;
  buildingName: string;
  domain: string;
  scope: InfrastructureSpecializationScope;
  unlockRule: string;
  options: readonly [
    InfrastructureSpecializationOption,
    InfrastructureSpecializationOption,
    InfrastructureSpecializationOption,
  ];
};

export type InfrastructureSpecializationSelection = {
  activeCode: string | null;
  pendingCode: string | null;
  effectiveGameDayIndex: number | null;
  canSelectThisSeason: boolean;
  reorientationCost: number;
};

export const INFRASTRUCTURE_SPECIALIZATION_UNLOCK_LEVEL = 3;
export const INFRASTRUCTURE_SPECIALIZATION_TRANSITION_DAYS = 7;

export function getInfrastructureSpecializationPowerPercentage(
  level: number,
): number {
  if (level < INFRASTRUCTURE_SPECIALIZATION_UNLOCK_LEVEL) return 0;
  if (level === 3) return 60;
  if (level === 4) return 80;
  return 100;
}

const option = (
  value: Omit<InfrastructureSpecializationOption, "powerBudget">,
): InfrastructureSpecializationOption => ({ ...value, powerBudget: 100 });

export const TEAM_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS: readonly InfrastructureSpecializationProposal[] = [
  {
    buildingCode: "recruitment_data_room",
    buildingName: "Data Room du recrutement",
    domain: "Scouting · Transferts",
    scope: "team",
    unlockRule: "Choix au niveau 3",
    options: [
      option({ code: "market_intelligence", name: "Intelligence marché", identity: "Décider avec des estimations plus fiables.", primaryEffect: "+8 % de précision sur les valeurs et demandes salariales estimées.", secondaryEffect: "+4 % de précision sur la concurrence autour d’une cible.", guardrail: "N’améliore ni la qualité ni la vitesse des détections de jeunes." }),
      option({ code: "talent_network", name: "Réseau de talents", identity: "Élargir la profondeur du vivier observé.", primaryEffect: "+6 % de chances qu’un rapport contienne un profil rare cohérent avec la zone.", secondaryEffect: "+5 % de couverture sur les marchés peu observés.", guardrail: "N’accorde aucune remise financière lors d’une signature." }),
      option({ code: "deal_room", name: "Cellule de négociation", identity: "Transformer l’information en contrats mieux maîtrisés.", primaryEffect: "−4 % sur les primes à la signature négociées.", secondaryEffect: "−3 % sur le coût d’une rupture de négociation relancée.", guardrail: "N’améliore pas la précision des rapports ni la qualité des cibles." }),
    ],
  },
  {
    buildingCode: "staff_academy",
    buildingName: "Académie des métiers",
    domain: "Staff · Formation avancée",
    scope: "team",
    unlockRule: "Choix au niveau 3, puissance complète au niveau 5",
    options: [
      option({ code: "pedagogy", name: "École de pédagogie", identity: "Faire progresser plus vite l’ensemble du staff.", primaryEffect: "+6 % d’expérience sur les formations du personnel.", secondaryEffect: "−5 % de durée sur une formation généraliste.", guardrail: "N’augmente pas la puissance maximale des talents uniques." }),
      option({ code: "expertise", name: "Pôle d’expertise", identity: "Développer des spécialistes de très haut niveau.", primaryEffect: "+4 % d’efficacité sur le talent unique actif d’un staff niveau 5.", secondaryEffect: "+5 % de chances de proposer une formation spécialisée.", guardrail: "N’accélère pas la progression générale du personnel." }),
      option({ code: "versatility", name: "Campus polyvalent", identity: "Adapter le staff aux besoins qui changent.", primaryEffect: "−8 % sur le temps de reconversion d’une spécialité.", secondaryEffect: "−5 % sur le coût de la première reconversion de la saison.", guardrail: "N’apporte aucun coefficient direct sur une spécialité conservée." }),
    ],
  },
  {
    buildingCode: "training_center",
    buildingName: "Centre d’entraînement",
    domain: "Performance · Effectif professionnel",
    scope: "team",
    unlockRule: "Choix au niveau 3, effet progressif aux niveaux 4 et 5",
    options: [
      option({ code: "individualization", name: "Individualisation", identity: "Combler les faiblesses sans fabriquer trop vite des champions.", primaryEffect: "+4 % d’efficacité sur les notes strictement inférieures à 70.", secondaryEffect: "+2 % sur les compétences secondaires inférieures à 65.", guardrail: "Aucun bonus sur une note ayant atteint 75." }),
      option({ code: "elite_performance", name: "Haute performance", identity: "Optimiser de faibles marges chez les leaders.", primaryEffect: "+2 % d’efficacité sur les notes comprises entre 75 et 82.", secondaryEffect: "+2 % sur les séances parfaitement adaptées au profil.", guardrail: "+5 % de fatigue de séance et aucun effet au-dessus de 82." }),
      option({ code: "durability", name: "Développement durable", identity: "Préserver la régularité sur toute la saison.", primaryEffect: "+3 % de récupération de forme liée aux séances légères.", secondaryEffect: "−4 % de fatigue cumulée lors des blocs de trois jours.", guardrail: "N’ajoute aucun gain direct de caractéristique." }),
    ],
  },
  {
    buildingCode: "indoor_track",
    buildingName: "Piste indoor",
    domain: "Préparation · Sprint",
    scope: "team",
    unlockRule: "Choix au niveau 3",
    options: [
      option({ code: "pure_speed", name: "Vitesse pure", identity: "Construire le dernier geste du sprinteur.", primaryEffect: "+1,5 % d’exécution sur un sprint massif.", secondaryEffect: "−5 % d’aléa de placement dans les 500 derniers mètres.", guardrail: "Actif uniquement sur les profils plat et sprint." }),
      option({ code: "explosiveness", name: "Explosivité", identity: "Travailler les relances et efforts très courts.", primaryEffect: "+1,5 % d’exécution sur les accélérations de moins de deux kilomètres.", secondaryEffect: "+3 % d’efficacité des séances Accélération.", guardrail: "Aucun bonus lors d’un sprint massif classique." }),
      option({ code: "leadout_school", name: "École des lanceurs", identity: "Valoriser la coordination plutôt qu’un seul finisseur.", primaryEffect: "−6 % de coût énergétique pour les lanceurs assignés.", secondaryEffect: "+4 % de stabilité du train de sprint.", guardrail: "Exige au moins deux équipiers affectés au sprinteur." }),
    ],
  },
  {
    buildingCode: "cryotherapy_center",
    buildingName: "Centre de cryothérapie",
    domain: "Récupération · Après-course",
    scope: "team",
    unlockRule: "Choix au niveau 3",
    options: [
      option({ code: "rapid_recovery", name: "Récupération rapide", identity: "Enchaîner les courses avec davantage de fraîcheur.", primaryEffect: "+5 % de récupération de forme après une course.", secondaryEffect: "+3 % après une étape de plus de 200 km.", guardrail: "N’agit pas sur la durée d’une blessure déclarée." }),
      option({ code: "rehabilitation", name: "Réathlétisation", identity: "Ramener plus sûrement les blessés à la compétition.", primaryEffect: "−8 % sur la durée des blessures légères et modérées.", secondaryEffect: "−5 % sur la perte de forme pendant l’indisponibilité.", guardrail: "N’empêche pas la survenue des blessures." }),
      option({ code: "load_management", name: "Gestion des charges", identity: "Limiter l’usure des calendriers trop denses.", primaryEffect: "−4 % de fatigue cumulée sur trois jours de course consécutifs.", secondaryEffect: "+3 % de récupération lors d’un jour sans course.", guardrail: "Effet nul sur une course isolée et sur les soins d’urgence." }),
    ],
  },
  {
    buildingCode: "wind_tunnel",
    buildingName: "Soufflerie",
    domain: "Préparation · Aérodynamisme",
    scope: "team",
    unlockRule: "Choix au niveau 3",
    options: [
      option({ code: "solo_aero", name: "Aéro individuelle", identity: "Optimiser la position du spécialiste solitaire.", primaryEffect: "+1,5 % d’exécution en contre-la-montre individuel.", secondaryEffect: "−3 % de coût énergétique sur les longs secteurs roulants.", guardrail: "Aucun bonus collectif en contre-la-montre par équipes." }),
      option({ code: "team_aero", name: "Aéro collective", identity: "Synchroniser positions, relais et matériel.", primaryEffect: "+1,5 % d’exécution en contre-la-montre par équipes.", secondaryEffect: "−4 % d’écart de rendement entre les relais.", guardrail: "Aucun bonus sur un chrono individuel." }),
      option({ code: "versatile_aero", name: "Aéro polyvalente", identity: "Gagner moins, mais sur davantage de terrains.", primaryEffect: "+0,6 % d’exécution sur les chronos et secteurs plats exposés.", secondaryEffect: "−2 % de coût énergétique face au vent.", guardrail: "Plafond inférieur aux deux spécialisations dédiées." }),
    ],
  },
  {
    buildingCode: "weather_center",
    buildingName: "Centre météo",
    domain: "Course · Anticipation",
    scope: "team",
    unlockRule: "Choix au niveau 3",
    options: [
      option({ code: "microclimate", name: "Microclimats", identity: "Réduire l’incertitude locale avant le départ.", primaryEffect: "−8 % d’écart entre la prévision affichée et la météo officielle.", secondaryEffect: "+1 jour d’horizon fiable sur les courses nationales.", guardrail: "N’atténue aucun malus météo pendant la course." }),
      option({ code: "wet_protocol", name: "Protocole pluie", identity: "Préparer matériel et placement sur route humide.", primaryEffect: "−2 % sur les pénalités d’exécution liées à la pluie.", secondaryEffect: "−4 % de coût énergétique dans les conditions humides.", guardrail: "Effet nul par temps sec." }),
      option({ code: "extreme_weather", name: "Conditions extrêmes", identity: "Mieux encaisser chaleur, froid et vent violent.", primaryEffect: "−2 % sur les pénalités d’exécution par météo extrême.", secondaryEffect: "−4 % de fatigue additionnelle lors de ces journées.", guardrail: "Effet nul lorsque les conditions restent ordinaires." }),
    ],
  },
  {
    buildingCode: "tactical_center",
    buildingName: "Centre tactique",
    domain: "Course · Briefings avancés",
    scope: "team",
    unlockRule: "Choix au niveau 3, appliqué aux doctrines débloquées",
    options: [
      option({ code: "offensive_school", name: "École offensive", identity: "Donner davantage de poids aux plans qui prennent l’initiative.", primaryEffect: "+8 % d’efficacité relative des doctrines Bordure et Satellite.", secondaryEffect: "+4 % de stabilité lors de leur déclenchement.", guardrail: "Contrôle, Train et Tempo ne reçoivent aucun bonus." }),
      option({ code: "race_control", name: "Maîtrise de course", identity: "Réduire le coût des plans collectifs de contrôle.", primaryEffect: "−8 % sur le coût énergétique relatif des équipiers tactiques.", secondaryEffect: "+4 % d’efficacité relative de Contrôle et Tempo.", guardrail: "N’améliore pas les doctrines offensives." }),
      option({ code: "adaptive_cell", name: "Cellule adaptative", identity: "Faire du plan de repli un véritable filet de sécurité.", primaryEffect: "+10 % de stabilité du déclenchement du plan de repli.", secondaryEffect: "−5 % de son coût énergétique relatif.", guardrail: "Aucun avantage si la doctrine principale se déclenche." }),
    ],
  },
  {
    buildingCode: "media_center",
    buildingName: "Média Center",
    domain: "Gazette · Popularité",
    scope: "team",
    unlockRule: "Choix au niveau 3",
    options: [
      option({ code: "prestige_press", name: "Presse de prestige", identity: "Amplifier les grands résultats sportifs.", primaryEffect: "+10 % de popularité issue des victoires majeures publiées.", secondaryEffect: "+5 % de portée sur les annonces de leaders.", guardrail: "Faible rendement sans résultat sportif notable." }),
      option({ code: "community_media", name: "Média de proximité", identity: "Créer une relation régulière avec les supporters.", primaryEffect: "+8 % d’engagement sur les publications ordinaires.", secondaryEffect: "+5 % de croissance organique du Fan Club.", guardrail: "N’amplifie pas spécifiquement les résultats majeurs." }),
      option({ code: "crisis_room", name: "Cellule de crise", identity: "Protéger la réputation lors des périodes difficiles.", primaryEffect: "−12 % sur les pertes de popularité liées aux mauvaises nouvelles.", secondaryEffect: "+5 % d’efficacité des communiqués de réponse.", guardrail: "N’accorde aucun gain supplémentaire en période positive." }),
    ],
  },
  {
    buildingCode: "international_welcome_center",
    buildingName: "Centre d’accueil international",
    domain: "International · Intégration",
    scope: "team",
    unlockRule: "Choix au niveau 3",
    options: [
      option({ code: "administrative_path", name: "Parcours administratif", identity: "Accélérer les dossiers de naturalisation.", primaryEffect: "−5 % supplémentaires sur le délai de naturalisation.", secondaryEffect: "−5 % de risque d’interruption du dossier.", guardrail: "Ne se cumule pas avec un meilleur bonus fédéral." }),
      option({ code: "sporting_integration", name: "Intégration sportive", identity: "Faire fonctionner plus vite un effectif multiculturel.", primaryEffect: "+4 % sur les bonus d’affinité du staff étranger.", secondaryEffect: "+3 % de stabilité de forme des recrues étrangères.", guardrail: "N’accélère pas la naturalisation administrative." }),
      option({ code: "youth_gateway", name: "Passerelle jeunes", identity: "Relier les écoles internationales à l’équipe première.", primaryEffect: "+5 % d’efficacité d’intégration la première saison professionnelle.", secondaryEffect: "−4 % de coût d’accueil des juniors étrangers.", guardrail: "Réservé aux coureurs issus d’une école internationale de l’équipe." }),
    ],
  },
  {
    buildingCode: "research_lab",
    buildingName: "Laboratoire R&D",
    domain: "Matériel · Prototypes uniques",
    scope: "team",
    unlockRule: "Choix au niveau 3",
    options: [
      option({ code: "pure_performance", name: "Performance pure", identity: "Chercher le meilleur prototype possible.", primaryEffect: "+5 % de qualité sportive à la sortie du laboratoire.", secondaryEffect: "+3 % de chances d’obtenir l’affixe de performance ciblé.", guardrail: "−10 % de durabilité du prototype produit." }),
      option({ code: "reliability", name: "Fiabilité", identity: "Prolonger la valeur d’usage de chaque innovation.", primaryEffect: "+20 % de durabilité des prototypes.", secondaryEffect: "−8 % de risque d’usure critique lors d’une course.", guardrail: "Aucun bonus sur la puissance sportive initiale." }),
      option({ code: "frugal_innovation", name: "Innovation frugale", identity: "Multiplier les essais plutôt que viser une pièce parfaite.", primaryEffect: "−10 % sur les ressources consommées par un projet.", secondaryEffect: "−6 % sur sa durée de développement.", guardrail: "Qualité maximale plafonnée un palier sous Performance pure." }),
    ],
  },
  {
    buildingCode: "fan_club_headquarters",
    buildingName: "Siège social du Fan Club",
    domain: "Supporters · Popularité",
    scope: "team",
    unlockRule: "Choix au niveau 3",
    options: [
      option({ code: "recruitment_campaigns", name: "Campagnes d’adhésion", identity: "Faire grossir rapidement la communauté.", primaryEffect: "+8 % de nouveaux supporters lors des gains de popularité.", secondaryEffect: "+5 % de conversion après une victoire à domicile.", guardrail: "N’améliore pas la fidélité lors d’une mauvaise série." }),
      option({ code: "loyalty_program", name: "Programme fidélité", identity: "Conserver une base solide dans les périodes creuses.", primaryEffect: "−10 % d’attrition des supporters.", secondaryEffect: "+5 % de renouvellement des adhésions.", guardrail: "N’accélère pas l’acquisition de nouveaux membres." }),
      option({ code: "event_house", name: "Maison événementielle", identity: "Transformer la communauté en rendez-vous réguliers.", primaryEffect: "+8 % de revenus sur les événements du Fan Club.", secondaryEffect: "+4 % de ferveur après un événement réussi.", guardrail: "Exige un événement actif et n’agit pas sur la croissance passive." }),
    ],
  },
  {
    buildingCode: "club_shop",
    buildingName: "Boutique du club",
    domain: "Supporters · Merchandising",
    scope: "team",
    unlockRule: "Choix au niveau 3",
    options: [
      option({ code: "volume_retail", name: "Grande diffusion", identity: "Vendre davantage avec une gamme accessible.", primaryEffect: "+10 % de volume de ventes.", secondaryEffect: "+5 % de conversion des nouveaux supporters.", guardrail: "−2 points de marge sur chaque article." }),
      option({ code: "premium_retail", name: "Gamme premium", identity: "Privilégier la marge et l’image de marque.", primaryEffect: "+8 % de marge unitaire.", secondaryEffect: "+4 % de popularité sur les lancements premium.", guardrail: "−5 % de volume de ventes." }),
      option({ code: "limited_editions", name: "Éditions limitées", identity: "Créer des pics de demande autour des grands moments.", primaryEffect: "+14 % de revenus les jours d’édition événementielle.", secondaryEffect: "+6 % d’engagement lors du lancement.", guardrail: "Revenus ordinaires inchangés et un lancement au maximum par mois de jeu." }),
    ],
  },
];

export const FEDERATION_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS: readonly InfrastructureSpecializationProposal[] = [
  {
    buildingCode: "national_detection_network", buildingName: "Réseau national de détection", domain: "Scouting · Maillage territorial", scope: "federation", unlockRule: "Vote de spécialisation au niveau 3",
    options: [
      option({ code: "territorial_coverage", name: "Couverture territoriale", identity: "Ne laisser aucune région hors du radar.", primaryEffect: "+8 % de couverture des régions secondaires.", secondaryEffect: "+4 % de précision sur les rapports locaux.", guardrail: "N’augmente pas la probabilité des potentiels exceptionnels." }),
      option({ code: "elite_detection", name: "Détection élite", identity: "Concentrer les moyens sur les signaux les plus rares.", primaryEffect: "+3 % de chances relatives d’identifier un très haut potentiel.", secondaryEffect: "+5 % de précision sur le plafond estimé.", guardrail: "−6 % de couverture sur les régions secondaires." }),
      option({ code: "profile_diversity", name: "Diversité des profils", identity: "Élargir l’identité sportive de la nation.", primaryEffect: "+10 % de chances relatives de détecter un style hors des archétypes nationaux.", secondaryEffect: "+4 % de variété régionale.", guardrail: "Qualité moyenne inchangée." }),
    ],
  },
  {
    buildingCode: "regional_academies", buildingName: "Académies régionales", domain: "Jeunesse · Formation de proximité", scope: "federation", unlockRule: "Vote de spécialisation au niveau 3",
    options: [
      option({ code: "open_access", name: "Accès populaire", identity: "Former davantage sans privilégier une élite précoce.", primaryEffect: "−6 % sur les frais de formation des jeunes nationaux.", secondaryEffect: "+5 % de capacité régionale.", guardrail: "Aucun bonus de progression individuelle." }),
      option({ code: "regional_excellence", name: "Pôles d’excellence", identity: "Renforcer les meilleurs bassins existants.", primaryEffect: "+3 % d’efficacité d’entraînement dans les académies régionales.", secondaryEffect: "+4 % de précision sur le potentiel à 18 ans.", guardrail: "Aucune réduction des frais de formation." }),
      option({ code: "multidiscipline", name: "Passerelles multidisciplinaires", identity: "Faire émerger des jeunes plus polyvalents.", primaryEffect: "+5 % d’efficacité sur les compétences secondaires inférieures à 65.", secondaryEffect: "+6 % de variété des styles formés.", guardrail: "Aucun bonus sur la meilleure caractéristique du jeune." }),
    ],
  },
  {
    buildingCode: "national_performance_center", buildingName: "Centre national de performance", domain: "Entraînement · Haute performance", scope: "federation", unlockRule: "Vote de spécialisation au niveau 3",
    options: [
      option({ code: "altitude_endurance", name: "Altitude et endurance", identity: "Façonner une sélection résistante aux longues courses.", primaryEffect: "+1,5 % d’efficacité fédérale en Montagne et Endurance.", secondaryEffect: "+0,5 % de récupération sur les stages nationaux.", guardrail: "Aucun bonus sur Sprint et Accélération." }),
      option({ code: "speed_power", name: "Vitesse et puissance", identity: "Construire des finisseurs et des spécialistes des efforts courts.", primaryEffect: "+1,5 % d’efficacité fédérale en Sprint et Accélération.", secondaryEffect: "+0,5 % sur les exercices de piste.", guardrail: "Aucun bonus sur Montagne et Endurance." }),
      option({ code: "rolling_engine", name: "Moteur rouleur", identity: "Développer chrono, plaine et résistance.", primaryEffect: "+1,5 % d’efficacité fédérale en Chrono et Plaine.", secondaryEffect: "+0,5 % en Résistance.", guardrail: "Aucun bonus sur Montagne et Sprint." }),
    ],
  },
  {
    buildingCode: "federal_staff_institute", buildingName: "Institut fédéral du staff", domain: "Staff · Transmission des compétences", scope: "federation", unlockRule: "Vote de spécialisation au niveau 3",
    options: [
      option({ code: "coach_school", name: "École des entraîneurs", identity: "Diffuser les meilleures méthodes d’entraînement.", primaryEffect: "+3 % d’efficacité du bonus fédéral des entraîneurs nationaux.", secondaryEffect: "+5 % d’expérience sur leurs formations.", guardrail: "Scouts et personnel médical inchangés." }),
      option({ code: "scout_school", name: "École des recruteurs", identity: "Professionnaliser l’observation du territoire.", primaryEffect: "+3 % d’efficacité du bonus fédéral des scouts nationaux.", secondaryEffect: "+5 % de précision de leurs rapports.", guardrail: "Entraîneurs et personnel médical inchangés." }),
      option({ code: "medical_school", name: "École médicale", identity: "Partager protocoles de soin et prévention.", primaryEffect: "+3 % d’efficacité du bonus fédéral du staff médical national.", secondaryEffect: "+5 % d’expérience sur ses formations.", guardrail: "Entraîneurs et scouts inchangés." }),
    ],
  },
  {
    buildingCode: "federal_medical_network", buildingName: "Réseau médical fédéral", domain: "Santé · Coordination médicale", scope: "federation", unlockRule: "Vote de spécialisation au niveau 3",
    options: [
      option({ code: "emergency_network", name: "Urgence coordonnée", identity: "Améliorer la prise en charge immédiate en course.", primaryEffect: "−8 % de risque d’aggravation après une blessure légère.", secondaryEffect: "−4 % de coût des interventions urgentes.", guardrail: "Durée standard de rééducation inchangée." }),
      option({ code: "rehab_network", name: "Réseau de rééducation", identity: "Réduire le temps passé loin de la compétition.", primaryEffect: "−6 % supplémentaires sur la durée des blessures modérées.", secondaryEffect: "−4 % de perte de forme pendant l’arrêt.", guardrail: "N’agit pas sur la fréquence des blessures." }),
      option({ code: "prevention_network", name: "Observatoire des charges", identity: "Détecter les calendriers à risque.", primaryEffect: "−5 % de fatigue cumulée des coureurs nationaux très sollicités.", secondaryEffect: "+4 % d’efficacité des jours de repos prescrits.", guardrail: "Aucun effet après une blessure déjà déclarée." }),
    ],
  },
  {
    buildingCode: "national_technical_laboratory", buildingName: "Laboratoire technique national", domain: "Chrono · Matériel · Collectif", scope: "federation", unlockRule: "Vote de spécialisation au niveau 3",
    options: [
      option({ code: "individual_tt", name: "Chrono individuel", identity: "Optimiser la position de chaque leader national.", primaryEffect: "+1 % d’exécution en chrono individuel international.", secondaryEffect: "+4 % de précision des recommandations aérodynamiques.", guardrail: "Aucun bonus en contre-la-montre par équipes." }),
      option({ code: "national_ttt", name: "Collectif chronométré", identity: "Faire de la sélection une unité aérodynamique.", primaryEffect: "+1 % d’exécution en chrono par équipes international.", secondaryEffect: "−5 % d’écart de rendement entre les relais.", guardrail: "Aucun bonus sur les chronos individuels." }),
      option({ code: "equipment_standards", name: "Standards matériels", identity: "Diffuser des gains modestes à toutes les disciplines.", primaryEffect: "+0,4 % d’exécution sur les épreuves internationales équipées.", secondaryEffect: "−5 % d’usure du matériel de sélection.", guardrail: "Plafond sportif inférieur aux spécialisations chrono." }),
    ],
  },
  {
    buildingCode: "race_organization_office", buildingName: "Bureau d’organisation", domain: "Courses · Revenus territoriaux", scope: "federation", unlockRule: "Vote de spécialisation au niveau 3",
    options: [
      option({ code: "prestige_events", name: "Événements de prestige", identity: "Attirer moins d’épreuves, mais mieux classées.", primaryEffect: "+8 % de qualité de dossier pour les candidatures majeures.", secondaryEffect: "+6 % de revenus sur une épreuve internationale accueillie.", guardrail: "Aucun avantage sur les courses locales ordinaires." }),
      option({ code: "dense_calendar", name: "Calendrier territorial", identity: "Multiplier les occasions de courir dans le pays.", primaryEffect: "−8 % de coût d’organisation des épreuves locales.", secondaryEffect: "+5 % de capacité annuelle d’accueil.", guardrail: "Aucun bonus de prestige international." }),
      option({ code: "profitable_events", name: "Événements rentables", identity: "Maximiser la contribution de chaque course aux finances fédérales.", primaryEffect: "+10 % de recettes fédérales nettes par épreuve.", secondaryEffect: "−4 % de risque de déficit organisationnel.", guardrail: "N’améliore ni le prestige ni la capacité d’accueil." }),
    ],
  },
  {
    buildingCode: "federal_integration_office", buildingName: "Bureau fédéral d’intégration", domain: "International · Naturalisation", scope: "federation", unlockRule: "Vote de spécialisation au niveau 3",
    options: [
      option({ code: "fast_track", name: "Guichet accéléré", identity: "Réduire le délai des dossiers les plus solides.", primaryEffect: "−5 % supplémentaires sur le délai de naturalisation fédéral.", secondaryEffect: "−5 % de risque d’interruption administrative.", guardrail: "Ne se cumule pas avec un meilleur Centre d’accueil d’équipe." }),
      option({ code: "diaspora_network", name: "Réseau diaspora", identity: "Maintenir un lien avec les talents formés à l’étranger.", primaryEffect: "+8 % de couverture de détection des coureurs éligibles par ascendance.", secondaryEffect: "+5 % de précision sur leur disponibilité internationale.", guardrail: "N’accélère pas les dossiers de naturalisation." }),
      option({ code: "integration_program", name: "Programme d’intégration", identity: "Privilégier la stabilité sportive après l’arrivée.", primaryEffect: "+5 % de stabilité de forme la première saison suivant la naturalisation.", secondaryEffect: "+4 % d’affinité avec le staff national.", guardrail: "Le délai administratif reste inchangé." }),
    ],
  },
  {
    buildingCode: "home_advantage_program", buildingName: "Programme avantage du terrain", domain: "Course · Connaissance locale", scope: "federation", unlockRule: "Vote de spécialisation au niveau 3",
    options: [
      option({ code: "terrain_library", name: "Bibliothèque des parcours", identity: "Connaître chaque difficulté et chaque route décisive.", primaryEffect: "+0,6 % d’exécution locale sur le profil dominant du pays.", secondaryEffect: "+4 % de précision des reconnaissances nationales.", guardrail: "Aucun bonus météo supplémentaire." }),
      option({ code: "climate_lab", name: "Laboratoire climatique", identity: "Transformer le climat local en avantage maîtrisé.", primaryEffect: "+0,6 % d’exécution locale par météo caractéristique du pays.", secondaryEffect: "−4 % de fatigue liée à cette météo.", guardrail: "Aucun bonus par conditions neutres." }),
      option({ code: "supporter_roads", name: "Routes populaires", identity: "Faire de la ferveur nationale une force de course.", primaryEffect: "+0,6 % d’exécution locale lorsque la ferveur dépasse son seuil élevé.", secondaryEffect: "+5 % de gain de ferveur après un podium national.", guardrail: "Aucun bonus si la mobilisation populaire est insuffisante." }),
    ],
  },
];

export const INFRASTRUCTURE_SPECIALIZATION_PROPOSALS = [
  ...TEAM_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS,
  ...FEDERATION_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS,
] as const;

export function getInfrastructureSpecializationProposal(
  scope: InfrastructureSpecializationScope,
  buildingCode: string,
): InfrastructureSpecializationProposal | null {
  return (
    INFRASTRUCTURE_SPECIALIZATION_PROPOSALS.find(
      (proposal) =>
        proposal.scope === scope && proposal.buildingCode === buildingCode,
    ) ?? null
  );
}

export function isInfrastructureSpecializationChoice(
  scope: InfrastructureSpecializationScope,
  buildingCode: string,
  specializationCode: string,
): boolean {
  return Boolean(
    getInfrastructureSpecializationProposal(scope, buildingCode)?.options.some(
      (candidate) => candidate.code === specializationCode,
    ),
  );
}
