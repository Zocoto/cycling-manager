export const FEDERATION_INFRASTRUCTURE_CODES = [
  "national_detection_network",
  "regional_academies",
  "national_performance_center",
  "federal_staff_institute",
  "federal_medical_network",
  "national_technical_laboratory",
  "race_organization_office",
  "federal_integration_office",
  "home_advantage_program",
] as const;

export type FederationInfrastructureCode =
  (typeof FEDERATION_INFRASTRUCTURE_CODES)[number];

export type FederationInfrastructureLevel = {
  level: 1 | 2 | 3 | 4 | 5;
  cost: number;
  durationDays: number;
  effect: string;
};

export type FederationInfrastructureDefinition = {
  code: FederationInfrastructureCode;
  name: string;
  domain: string;
  summary: string;
  principle: string;
  illustration: {
    src: string;
    alt: string;
  };
  levels: FederationInfrastructureLevel[];
};

export const MAX_FEDERATION_PROJECT_ARCHITECTS = 5;

const makeLevels = ({
  costs,
  durations,
  effects,
}: {
  costs: [number, number, number, number, number];
  durations: [number, number, number, number, number];
  effects: [string, string, string, string, string];
}): FederationInfrastructureLevel[] =>
  effects.map((effect, index) => ({
    level: (index + 1) as FederationInfrastructureLevel["level"],
    cost: costs[index],
    durationDays: durations[index],
    effect,
  }));

export const FEDERATION_INFRASTRUCTURE_DEFINITIONS: FederationInfrastructureDefinition[] = [
  {
    code: "national_detection_network",
    name: "Réseau national de détection",
    domain: "Scouting · Maillage territorial",
    summary:
      "Partage les observations entre les équipes et diversifie les zones couvertes sans multiplier artificiellement les grands talents.",
    principle:
      "La qualité des rapports progresse légèrement ; la probabilité brute de trouver un phénomène reste rare.",
    illustration: {
      src: "/images/infrastructure/recruitment-data-room.webp",
      alt: "Cellule nationale de détection et d’analyse des jeunes cyclistes",
    },
    levels: makeLevels({
      costs: [450_000, 800_000, 1_300_000, 2_000_000, 2_900_000],
      durations: [4, 6, 8, 10, 12],
      effects: [
        "+1 % de précision des rapports dans le pays.",
        "+2 % de précision et meilleure couverture des régions peu scoutées.",
        "+3 % de précision et profils géographiques plus variés.",
        "+4 % de précision, sans hausse directe du taux de talents rares.",
        "+5 % de précision et couverture nationale complète.",
      ],
    }),
  },
  {
    code: "regional_academies",
    name: "Académies régionales",
    domain: "Jeunesse · Formation de proximité",
    summary:
      "Structure un réseau local complémentaire aux écoles internationales déjà construites par les équipes.",
    principle:
      "Le bâtiment réduit modérément les coûts de formation et accentue la variété des profils, avec un plafond strict de 5 %.",
    illustration: {
      src: "/images/infrastructure/training-center.webp",
      alt: "Académie régionale accueillant de jeunes cyclistes",
    },
    levels: makeLevels({
      costs: [500_000, 900_000, 1_450_000, 2_150_000, 3_100_000],
      durations: [5, 6, 8, 10, 12],
      effects: [
        "−1 % sur les frais de formation des jeunes de la nation.",
        "−2 % et davantage de profils issus de régions secondaires.",
        "−3 % et diversité accrue des archétypes formés.",
        "−4 % et maillage régional renforcé.",
        "−5 % au maximum et réseau national arrivé à maturité.",
      ],
    }),
  },
  {
    code: "national_performance_center",
    name: "Centre national de performance",
    domain: "Entraînement · Haute performance",
    summary:
      "Diffuse méthodes, données et protocoles communs aux structures affiliées sans attribuer directement de statistiques.",
    principle:
      "L’effet porte uniquement sur l’efficacité future des entraînements et reste plafonné à 1,5 %.",
    illustration: {
      src: "/images/infrastructure/indoor-track.webp",
      alt: "Centre national de haute performance cycliste",
    },
    levels: makeLevels({
      costs: [700_000, 1_200_000, 1_900_000, 2_800_000, 4_000_000],
      durations: [5, 7, 9, 11, 13],
      effects: [
        "+0,3 % d’efficacité sur les entraînements éligibles.",
        "+0,6 % d’efficacité sur les entraînements éligibles.",
        "+0,9 % d’efficacité sur les entraînements éligibles.",
        "+1,2 % d’efficacité sur les entraînements éligibles.",
        "+1,5 % au maximum, sans gain instantané de statistique.",
      ],
    }),
  },
  {
    code: "federal_staff_institute",
    name: "Institut fédéral du staff",
    domain: "Staff · Transmission des compétences",
    summary:
      "Met en commun les méthodes du personnel local et valorise les spécialistes de la nationalité de la fédération.",
    principle:
      "Seuls les membres du staff de la nation sont concernés ; l’affinité d’équipe reste le bonus principal.",
    illustration: {
      src: "/images/infrastructure/staff-academy.webp",
      alt: "Institut de formation du staff de la fédération cycliste",
    },
    levels: makeLevels({
      costs: [400_000, 750_000, 1_200_000, 1_850_000, 2_650_000],
      durations: [4, 5, 7, 9, 11],
      effects: [
        "+0,5 % d’efficacité pour le staff de la nation.",
        "+1 % d’efficacité pour le staff de la nation.",
        "+1,5 % d’efficacité pour le staff de la nation.",
        "+2 % d’efficacité pour le staff de la nation.",
        "+2,5 % au maximum pour le staff de la nation.",
      ],
    }),
  },
  {
    code: "federal_medical_network",
    name: "Réseau médical fédéral",
    domain: "Santé · Coordination médicale",
    summary:
      "Coordonne les protocoles de soin des équipes affiliées sans rendre les blessures moins probables.",
    principle:
      "Le réseau réduit uniquement la durée de récupération, avec un avantage maximal de 5 %.",
    illustration: {
      src: "/images/infrastructure/cryotherapy-center.webp",
      alt: "Réseau médical et centre de récupération de la fédération",
    },
    levels: makeLevels({
      costs: [550_000, 950_000, 1_500_000, 2_250_000, 3_250_000],
      durations: [4, 6, 8, 10, 12],
      effects: [
        "−1 % sur la durée des blessures des coureurs affiliés.",
        "−2 % sur la durée des blessures des coureurs affiliés.",
        "−3 % sur la durée des blessures des coureurs affiliés.",
        "−4 % sur la durée des blessures des coureurs affiliés.",
        "−5 % au maximum, sans effet sur la fréquence des blessures.",
      ],
    }),
  },
  {
    code: "national_technical_laboratory",
    name: "Laboratoire technique national",
    domain: "Chrono · Matériel · Collectif",
    summary:
      "Mutualise l’aérodynamisme et la préparation collective, particulièrement pour le contre-la-montre par équipes.",
    principle:
      "Le bonus est situationnel et réservé aux sélections nationales, jamais aux résultats ordinaires des clubs.",
    illustration: {
      src: "/images/infrastructure/wind-tunnel.webp",
      alt: "Laboratoire aérodynamique de la sélection nationale",
    },
    levels: makeLevels({
      costs: [750_000, 1_300_000, 2_050_000, 3_000_000, 4_300_000],
      durations: [5, 7, 9, 11, 14],
      effects: [
        "+0,2 % sur la préparation chrono des sélections.",
        "+0,4 % sur la préparation chrono des sélections.",
        "+0,6 % et premiers protocoles collectifs CLM.",
        "+0,8 % sur les épreuves chronométrées internationales.",
        "+1 % au maximum, priorité au CLM par équipes.",
      ],
    }),
  },
  {
    code: "race_organization_office",
    name: "Bureau d’organisation",
    domain: "Courses · Revenus territoriaux",
    summary:
      "Professionnalise l’accueil des épreuves du pays et augmente la faible part reversée à la fédération.",
    principle:
      "Les recettes restent dépendantes du nombre réel de partants et le bâtiment n’autorise aucune course Élite.",
    illustration: {
      src: "/images/infrastructure/media-center.webp",
      alt: "Bureau organisant les courses cyclistes du pays",
    },
    levels: makeLevels({
      costs: [450_000, 850_000, 1_400_000, 2_100_000, 3_000_000],
      durations: [4, 6, 8, 10, 12],
      effects: [
        "+5 % sur les recettes fédérales des courses du pays.",
        "+10 % sur ces recettes et dossiers d’accueil mieux préparés.",
        "+15 % sur ces recettes et candidatures internationales ouvertes.",
        "+20 % sur ces recettes et coûts d’accueil mieux maîtrisés.",
        "+25 % au maximum sur les recettes des courses du pays.",
      ],
    }),
  },
  {
    code: "federal_integration_office",
    name: "Bureau fédéral d’intégration",
    domain: "International · Naturalisation",
    summary:
      "Crée un parcours commun de naturalisation pour les coureurs durablement installés dans les équipes affiliées.",
    principle:
      "Le meilleur bonus entre la fédération et le Centre d’accueil de l’équipe s’applique : ils ne se cumulent jamais.",
    illustration: {
      src: "/images/infrastructure/international-welcome-center.webp",
      alt: "Bureau fédéral accompagnant l’intégration internationale",
    },
    levels: makeLevels({
      costs: [600_000, 1_050_000, 1_650_000, 2_450_000, 3_500_000],
      durations: [5, 7, 9, 11, 13],
      effects: [
        "−4 % sur le délai commun de naturalisation.",
        "−8 % sur le délai commun de naturalisation.",
        "−12 % sur le délai commun de naturalisation.",
        "−16 % sur le délai commun de naturalisation.",
        "−20 % au maximum, sans cumul avec un meilleur bonus d’équipe.",
      ],
    }),
  },
  {
    code: "home_advantage_program",
    name: "Programme avantage du terrain",
    domain: "Course · Connaissance locale",
    summary:
      "Documente les routes, le climat et les particularités du pays pour renforcer subtilement l’avantage local.",
    principle:
      "Le bonus ne s’applique qu’aux coureurs de la nation sur une étape disputée dans leur pays.",
    illustration: {
      src: "/images/infrastructure/weather-center.webp",
      alt: "Programme fédéral d’analyse des routes et conditions locales",
    },
    levels: makeLevels({
      costs: [350_000, 650_000, 1_050_000, 1_600_000, 2_300_000],
      durations: [3, 5, 7, 9, 11],
      effects: [
        "+0,2 % au bonus local sur les étapes du pays.",
        "+0,4 % au bonus local sur les étapes du pays.",
        "+0,6 % au bonus local sur les étapes du pays.",
        "+0,8 % au bonus local sur les étapes du pays.",
        "+1 % au maximum au bonus local sur les étapes du pays.",
      ],
    }),
  },
];

export type FederationConstructionPriority = "balanced" | "cost" | "time";

export function calculateFederationConstructionPreview({
  level,
  architectCount,
  priority,
}: {
  level: FederationInfrastructureLevel;
  architectCount: number;
  priority: FederationConstructionPriority;
}) {
  const architects = Math.min(
    MAX_FEDERATION_PROJECT_ARCHITECTS,
    Math.max(0, Math.trunc(architectCount)),
  );
  const costReductionRate =
    priority === "cost"
      ? architects * 0.04
      : priority === "balanced"
        ? architects * 0.02
        : 0;
  const durationReductionRate =
    priority === "time"
      ? architects * 0.06
      : priority === "balanced"
        ? architects * 0.03
        : 0;
  const cost = roundToNearest(level.cost * (1 - costReductionRate), 5_000);
  const durationDays = Math.max(
    1,
    Math.ceil(level.durationDays * (1 - durationReductionRate)),
  );

  return {
    architectCount: architects,
    cost,
    durationDays,
    savedAmount: level.cost - cost,
    savedDays: level.durationDays - durationDays,
    costReductionPercentage: Math.round(costReductionRate * 100),
    durationReductionPercentage: Math.round(durationReductionRate * 100),
  };
}

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}
