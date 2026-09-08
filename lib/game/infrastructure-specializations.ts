export type InfrastructureSpecializationScope = "team" | "federation";

export type InfrastructureSpecializationOption = {
  code: string;
  name: string;
  identity: string;
  primaryEffect: string;
  secondaryEffect?: string;
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
  infrastructureCode?: string,
): number {
  if (level < INFRASTRUCTURE_SPECIALIZATION_UNLOCK_LEVEL) return 0;
  if (infrastructureCode === "recruitment_data_room") return 100;
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
      option({ code: "market_intelligence", name: "Intelligence du marché", identity: "Rendre chaque rapport plus fiable et plus exploitable.", primaryEffect: "+5 % d’efficacité réelle des missions de scouting.", secondaryEffect: "+8 % de précision sur les notes et le potentiel du rapport.", guardrail: "Le bonus affine les rapports sans garantir un talent exceptionnel." }),
      option({ code: "talent_network", name: "Réseau de talents", identity: "Mieux repérer puis accompagner les singularités du vivier.", primaryEffect: "+2 points de chance de révéler une capacité spéciale chez un junior.", secondaryEffect: "−5 % sur le coût annuel de son école de cyclisme.", guardrail: "Le profil et la capacité spéciale éventuelle restent tirés aléatoirement." }),
      option({ code: "deal_room", name: "Cellule de négociation", identity: "Transformer l’information en contrats mieux maîtrisés.", primaryEffect: "−3 % sur les salaires des nouveaux contrats coureurs.", secondaryEffect: "−4 % sur le coût net des signatures avec indemnité de transfert.", guardrail: "Les enchères et les exigences sportives des coureurs restent inchangées." }),
    ],
  },
  {
    buildingCode: "training_center",
    buildingName: "Centre d’entraînement",
    domain: "Performance · Effectif professionnel",
    scope: "team",
    unlockRule: "Choix au niveau 3, effet progressif aux niveaux 4 et 5",
    options: [
      option({ code: "individualization", name: "Individualisation", identity: "Combler les faiblesses sans fabriquer trop vite des champions.", primaryEffect: "+5 % d’efficacité sur les notes inférieures à 70.", secondaryEffect: "+5 % sur les notes secondaires sous 65, cumulable : +10 % au total.", guardrail: "Les deux seuils d’éligibilité suffisent à encadrer cet effet." }),
      option({ code: "elite_performance", name: "Haute performance", identity: "Optimiser de faibles marges chez les leaders.", primaryEffect: "+2 % d’efficacité sur les notes comprises entre 75 et 82.", secondaryEffect: "+5 % d’efficacité lorsque l’entraîneur apporte son bonus de nationalité.", guardrail: "Aucune fatigue supplémentaire n’est appliquée." }),
      option({ code: "durability", name: "Développement durable", identity: "Préserver la régularité sur toute la saison.", primaryEffect: "Une séance annulée par le seuil de forme rend 3 points au lieu de 2.", guardrail: "Aucune notion de bloc de trois jours n’est appliquée." }),
    ],
  },
  {
    buildingCode: "indoor_track",
    buildingName: "Piste indoor",
    domain: "Préparation · Sprint",
    scope: "team",
    unlockRule: "Choix au niveau 3",
    options: [
      option({ code: "pure_speed", name: "Vitesse pure", identity: "Rendre le sprinteur plus difficile à battre dans l’emballage final.", primaryEffect: "Dans un sprint massif, votre sprinteur est 1,5 % plus performant dans le duel final.", secondaryEffect: "Il a 5 % de risque en moins d’être mal placé ou de perdre la bonne roue.", guardrail: "Actif uniquement lorsque l’étape se termine réellement au sprint massif." }),
      option({ code: "explosiveness", name: "Explosivité", identity: "Donner plus de tranchant aux relances et aux attaques courtes.", primaryEffect: "Les attaques et contre-attaques courtes sont 1,5 % plus tranchantes.", secondaryEffect: "+3 % d’efficacité des séances Accélération.", guardrail: "Ne renforce pas directement la vitesse finale d’un sprint massif." }),
      option({ code: "leadout_school", name: "École des lanceurs", identity: "Amener le sprinteur plus frais et mieux placé dans la dernière ligne droite.", primaryEffect: "Les poissons pilotes assignés dépensent 6 % d’énergie en moins.", secondaryEffect: "Le train place le sprinteur 4 % plus efficacement avant la dernière ligne droite.", guardrail: "Le bonus de placement exige au moins deux équipiers autour du sprinteur." }),
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
      option({ code: "solo_aero", name: "Aéro individuelle", identity: "Optimiser la position du spécialiste solitaire.", primaryEffect: "+1,5 % de performance en contre-la-montre individuel et prologue.", secondaryEffect: "−3 % de coût énergétique pendant ces chronos.", guardrail: "Aucun bonus collectif en contre-la-montre par équipes." }),
      option({ code: "team_aero", name: "Aéro collective", identity: "Synchroniser positions, relais et matériel.", primaryEffect: "+1,5 % de performance en contre-la-montre par équipes.", secondaryEffect: "Les meilleurs rouleurs peuvent prendre jusqu’à 4 % de relais en plus sans surcoût énergétique.", guardrail: "Aucun bonus sur un chrono individuel." }),
      option({ code: "versatile_aero", name: "Aéro polyvalente", identity: "Amortir les journées où les conditions aérologiques se dégradent.", primaryEffect: "−2 % d’impact énergétique par vent fort, pluie ou météo extrême.", secondaryEffect: "−2 % de perte de forme après une étape disputée dans ces conditions.", guardrail: "Aucun bonus par météo calme ou sur un chrono sans condition difficile." }),
    ],
  },
  {
    buildingCode: "weather_center",
    buildingName: "Centre météo",
    domain: "Course · Anticipation",
    scope: "team",
    unlockRule: "Choix au niveau 3",
    options: [
      option({ code: "normal_weather", name: "Météo normale", identity: "Optimiser les réglages dans les conditions les plus courantes.", primaryEffect: "+0,5 % de performance par temps normal.", secondaryEffect: "−1 % de coût énergétique sur l’étape.", guardrail: "Effet nul sous la pluie et lors de conditions extrêmes." }),
      option({ code: "wet_protocol", name: "Protocole pluie", identity: "Préparer matériel et placement sur route humide.", primaryEffect: "+1 % de performance sous la pluie.", secondaryEffect: "−3 % de coût énergétique sur l’étape.", guardrail: "Effet nul par temps sec et lors de conditions extrêmes." }),
      option({ code: "extreme_weather", name: "Conditions extrêmes", identity: "Mieux encaisser chaleur, froid, neige, tempête et vent violent.", primaryEffect: "+2 % de performance par météo extrême.", secondaryEffect: "−5 % de coût énergétique sur l’étape.", guardrail: "Effet nul lorsque les conditions restent ordinaires." }),
    ],
  },
  {
    buildingCode: "media_center",
    buildingName: "Média Center",
    domain: "Gazette · Popularité",
    scope: "team",
    unlockRule: "Choix au niveau 3",
    options: [
      option({ code: "prestige_press", name: "La Presse qui se creuse", identity: "Faire du journal un vrai rendez-vous cérébral.", primaryEffect: "+50 % de gains en réussissant les mots croisés.", secondaryEffect: "+50 % de gains en réussissant le Sudoku.", guardrail: "Chaque jeu reste récompensé une seule fois par édition." }),
      option({ code: "community_media", name: "Partenaires à la une", identity: "Mieux valoriser les engagements pris avec le sponsor.", primaryEffect: "+5 % sur le montant des nouveaux contrats de sponsoring.", secondaryEffect: "+10 % de satisfaction attribuée par un objectif sponsor réussi.", guardrail: "Les plafonds de satisfaction et les conditions des objectifs restent inchangés." }),
      option({ code: "crisis_room", name: "Micro ouvert", identity: "Transformer chaque prise de parole en lien avec la communauté.", primaryEffect: "+10 supporters à chaque conférence ou interview publiée.", secondaryEffect: "+1 point de ferveur et +1 point de popularité au coureur mis en avant.", guardrail: "Une même intervention ne peut attribuer son bonus qu’une fois." }),
    ],
  },
  {
    buildingCode: "international_welcome_center",
    buildingName: "Centre d’accueil international",
    domain: "International · Intégration",
    scope: "team",
    unlockRule: "Choix au niveau 3",
    options: [
      option({ code: "administrative_path", name: "Parcours administratif", identity: "Accélérer et simplifier les dossiers de naturalisation professionnelle.", primaryEffect: "−5 % supplémentaires sur le délai de naturalisation des professionnels.", secondaryEffect: "+1 naturalisation du staff disponible par saison.", guardrail: "N’accélère pas les dossiers des juniors." }),
      option({ code: "sporting_integration", name: "Intégration sportive", identity: "Faire fonctionner plus vite un effectif multiculturel.", primaryEffect: "+4 % d’efficacité sur les effets du staff étranger.", secondaryEffect: "+1 % de performance des coureurs étrangers dans le pays de l’équipe.", guardrail: "N’accélère pas la naturalisation administrative." }),
      option({ code: "youth_gateway", name: "Passerelle jeunes", identity: "Relier les écoles internationales à l’équipe première.", primaryEffect: "−5 % supplémentaires sur le délai de naturalisation des juniors.", secondaryEffect: "−4 % sur le coût de formation des jeunes étrangers.", guardrail: "Réservé aux juniors dont la nationalité diffère de celle de l’équipe." }),
    ],
  },
  {
    buildingCode: "fan_club_headquarters",
    buildingName: "Siège social du Fan Club",
    domain: "Supporters · Popularité",
    scope: "team",
    unlockRule: "Choix au niveau 3",
    options: [
      option({ code: "recruitment_campaigns", name: "Campagnes d’adhésion", identity: "Convertir la visibilité sportive en nouveaux membres.", primaryEffect: "+8 % sur le nombre de supporters gagnés par l’équipe.", secondaryEffect: "+5 % supplémentaires sur les supporters gagnés après une victoire à domicile.", guardrail: "La conversion désigne bien le nombre de nouveaux supporters acquis." }),
      option({ code: "loyalty_program", name: "Mobilité des supporters", identity: "Remplir les tribunes à l’extérieur plus efficacement.", primaryEffect: "+10 % de supporters mobilisables dans chaque car.", secondaryEffect: "−5 % sur le prix d’achat des cars du Fan Club.", guardrail: "Le nombre de véhicules et leur disponibilité restent inchangés." }),
      option({ code: "event_house", name: "Maison des supporters", identity: "Faire rayonner la ferveur sur toute l’équipe.", primaryEffect: "+5 % sur les gains de ferveur liés aux résultats récents.", secondaryEffect: "+3 % sur les gains de popularité des coureurs.", guardrail: "Les plafonds de ferveur et de popularité restent fixés à 100." }),
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
      option({ code: "premium_retail", name: "Gamme premium", identity: "Privilégier la marge et l’image de marque.", primaryEffect: "Jusqu’à +8 % de marge unitaire sans baisse du volume de ventes.", guardrail: "Le bonus augmente le prix accepté par les supporters, sans malus de volume." }),
      option({ code: "limited_editions", name: "Commerce opportuniste", identity: "Profiter des fortes demandes et acheter au meilleur coût.", primaryEffect: "+10 points de chance d’obtenir une journée prolifique.", secondaryEffect: "−5 % sur le prix des matières premières.", guardrail: "Les journées prolifiques restent aléatoires et le cours mondial ne change pas." }),
    ],
  },
];

export const FEDERATION_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS: readonly InfrastructureSpecializationProposal[] = [
  {
    buildingCode: "national_detection_network", buildingName: "Réseau national de détection", domain: "Scouting · Maillage territorial", scope: "federation", unlockRule: "Vote de spécialisation au niveau 3",
    options: [
      option({ code: "territorial_coverage", name: "Maillage territorial", identity: "Faire remonter davantage de profils à chaque mission nationale.", primaryEffect: "Jusqu’à 1 candidat supplémentaire par mission dans le pays.", secondaryEffect: "+4 % de précision sur l’ensemble du rapport.", guardrail: "" }),
      option({ code: "elite_detection", name: "Détection élite", identity: "Concentrer les moyens sur les signaux les plus rares.", primaryEffect: "+3 % de chances relatives de détecter un junior de 3,5★ ou 4★.", secondaryEffect: "+5 % de précision sur l’estimation de son potentiel.", guardrail: "" }),
      option({ code: "profile_diversity", name: "Diversité des profils", identity: "Élargir l’identité sportive de la nation.", primaryEffect: "+10 % de chances relatives de détecter un style hors des deux archétypes historiques du pays.", guardrail: "" }),
    ],
  },
  {
    buildingCode: "national_performance_center", buildingName: "Centre national de performance", domain: "Entraînement · Haute performance", scope: "federation", unlockRule: "Vote au niveau 3 · effet progressif jusqu’au niveau 5",
    options: [
      option({ code: "altitude_endurance", name: "Altitude et endurance", identity: "Renforcer les grimpeurs et les coureurs de longues épreuves.", primaryEffect: "Jusqu’à +1,5 % de progression supplémentaire en Montagne et Endurance.", secondaryEffect: "Jusqu’à +0,5 % supplémentaire en Récupération.", guardrail: "" }),
      option({ code: "speed_power", name: "Vitesse et puissance", identity: "Construire des finisseurs et des spécialistes des efforts courts.", primaryEffect: "Jusqu’à +1,5 % de progression supplémentaire en Sprint et Accélération.", secondaryEffect: "Jusqu’à +0,5 % supplémentaire en Prologue.", guardrail: "" }),
      option({ code: "rolling_engine", name: "Moteur rouleur", identity: "Développer les rouleurs capables de soutenir les efforts prolongés.", primaryEffect: "Jusqu’à +1,5 % de progression supplémentaire en Contre-la-montre et Plaine.", secondaryEffect: "Jusqu’à +0,5 % supplémentaire en Résistance.", guardrail: "" }),
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
