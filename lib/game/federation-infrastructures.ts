export const FEDERATION_INFRASTRUCTURE_CODES = [
  "national_detection_network",
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
      "Partage les observations entre les équipes, améliore légèrement les jeunes réellement trouvés et fiabilise leur rapport.",
    principle: "",
    illustration: {
      src: "/images/infrastructure/recruitment-data-room.webp",
      alt: "Cellule nationale de détection et d’analyse des jeunes cyclistes",
    },
    levels: makeLevels({
      costs: [900_000, 1_700_000, 2_800_000, 4_400_000, 6_400_000],
      durations: [7, 10, 14, 18, 23],
      effects: [
        "+1 % sur la qualité réelle des juniors et la précision des rapports dans le pays.",
        "+2 % sur la qualité réelle des juniors et la précision des rapports dans le pays.",
        "+3 % sur la qualité réelle et la précision, plus +2 % de chances relatives de détecter un style hors des archétypes du pays.",
        "+4 % sur la qualité réelle et la précision des détections nationales.",
        "+5 % sur la qualité réelle des juniors et la précision des rapports dans le pays.",
      ],
    }),
  },
  {
    code: "national_performance_center",
    name: "Centre national de performance",
    domain: "Entraînement · Haute performance",
    summary:
      "Améliore la progression obtenue lors des entraînements quotidiens des coureurs professionnels des équipes affiliées.",
    principle:
      "Chaque niveau renforce les séances réellement effectuées, sans attribuer directement de statistiques.",
    illustration: {
      src: "/images/infrastructure/indoor-track.webp",
      alt: "Centre national de haute performance cycliste",
    },
    levels: makeLevels({
      costs: [1_400_000, 2_500_000, 4_000_000, 6_000_000, 8_500_000],
      durations: [9, 14, 19, 24, 30],
      effects: [
        "+0,3 % de progression sur les entraînements quotidiens réalisés.",
        "+0,6 % de progression sur les entraînements quotidiens réalisés.",
        "+0,9 % de progression sur les entraînements quotidiens réalisés.",
        "+1,2 % de progression sur les entraînements quotidiens réalisés.",
        "+1,5 % de progression sur les entraînements quotidiens réalisés.",
      ],
    }),
  },
  {
    code: "federal_staff_institute",
    name: "Institut fédéral du staff",
    domain: "Staff · Transmission des compétences",
    summary:
      "Renforce les effets quantitatifs du staff de la nation employé par les équipes affiliées.",
    principle:
      "Le bonus se cumule avec l’affinité d’équipe et s’applique uniquement aux effets réellement produits.",
    illustration: {
      src: "/images/infrastructure/staff-academy.webp",
      alt: "Institut de formation du staff de la fédération cycliste",
    },
    levels: makeLevels({
      costs: [800_000, 1_550_000, 2_600_000, 4_000_000, 5_800_000],
      durations: [7, 11, 15, 20, 26],
      effects: [
        "+0,5 % d’efficacité pour le staff de la nation.",
        "+1 % d’efficacité pour le staff de la nation.",
        "+1,5 % d’efficacité pour le staff de la nation.",
        "+2 % d’efficacité pour le staff de la nation.",
        "+2,5 % d’efficacité pour le staff de la nation.",
      ],
    }),
  },
  {
    code: "federal_medical_network",
    name: "Réseau médical fédéral",
    domain: "Santé · Coordination médicale",
    summary:
      "Réduit la convalescence des blessures soignables pour tous les coureurs des équipes affiliées. Les blessures de fatigue restent fixées à trois jours.",
    principle: "",
    illustration: {
      src: "/images/infrastructure/cryotherapy-center.webp",
      alt: "Réseau médical et centre de récupération de la fédération",
    },
    levels: makeLevels({
      costs: [1_100_000, 2_000_000, 3_200_000, 4_800_000, 7_000_000],
      durations: [7, 10, 14, 18, 23],
      effects: [
        "−1 % sur la durée des blessures soignables des coureurs affiliés.",
        "−2 % sur la durée des blessures soignables des coureurs affiliés.",
        "−3 % sur la durée des blessures soignables des coureurs affiliés.",
        "−4 % sur la durée des blessures soignables des coureurs affiliés.",
        "−5 % sur la durée des blessures soignables des coureurs affiliés.",
      ],
    }),
  },
  {
    code: "national_technical_laboratory",
    name: "Laboratoire technique national",
    domain: "Chrono · Matériel · Collectif",
    summary:
      "Améliore les notes Contre-la-montre et Prologue des sélections lors des épreuves chronométrées mondiales et continentales.",
    principle: "",
    illustration: {
      src: "/images/infrastructure/wind-tunnel.webp",
      alt: "Laboratoire aérodynamique de la sélection nationale",
    },
    levels: makeLevels({
      costs: [1_500_000, 2_700_000, 4_400_000, 6_500_000, 9_300_000],
      durations: [9, 14, 19, 25, 32],
      effects: [
        "+0,2 % sur les notes CLM et Prologue de la sélection en chrono international.",
        "+0,4 % sur les notes CLM et Prologue de la sélection en chrono international.",
        "+0,6 % sur les notes CLM et Prologue de la sélection en chrono international.",
        "+0,8 % sur les notes CLM et Prologue de la sélection en chrono international.",
        "+1 % sur les notes CLM et Prologue de la sélection en chrono international.",
      ],
    }),
  },
  {
    code: "race_organization_office",
    name: "Bureau d’organisation",
    domain: "Courses · Revenus territoriaux",
    summary:
      "Professionnalise les courses du pays, augmente leur contribution au budget fédéral et développe son rayonnement international.",
    principle:
      "Les recettes nationales alimentent le budget de la saison suivante. Les remises d’accueil sont figées au dépôt d’une candidature.",
    illustration: {
      src: "/images/infrastructure/media-center.webp",
      alt: "Bureau organisant les courses cyclistes du pays",
    },
    levels: makeLevels({
      costs: [900_000, 1_800_000, 3_000_000, 4_600_000, 6_600_000],
      durations: [7, 10, 14, 18, 23],
      effects: [
        "+5 % sur les recettes nationales et homologation d’une nouvelle course débloquée.",
        "+10 % sur les recettes nationales alimentant le budget fédéral suivant.",
        "+15 % sur ces recettes et candidatures d’accueil internationales ouvertes.",
        "+20 % sur ces recettes et −5 % sur les coûts d’accueil internationaux.",
        "+25 % sur ces recettes, −10 % sur l’accueil et une prospection sponsor par saison.",
      ],
    }),
  },
  {
    code: "federal_integration_office",
    name: "Bureau fédéral d’intégration",
    domain: "International · Naturalisation",
    summary:
      "Crée un parcours commun de naturalisation pour les coureurs durablement installés et peut accompagner les encadrants des équipes affiliées.",
    principle:
      "Le meilleur bonus entre la fédération et le Centre d’accueil de l’équipe s’applique : ils ne se cumulent jamais.",
    illustration: {
      src: "/images/infrastructure/international-welcome-center.webp",
      alt: "Bureau fédéral accompagnant l’intégration internationale",
    },
    levels: makeLevels({
      costs: [1_200_000, 2_200_000, 3_500_000, 5_300_000, 7_600_000],
      durations: [9, 14, 19, 24, 30],
      effects: [
        "−10 % sur le délai fédéral : 76 jours pour un pro, 26 pour un junior.",
        "−20 % : 68 jours pour un pro, 23 pour un junior.",
        "−30 % : 59 jours pour un pro, 20 pour un junior.",
        "−40 % : 51 jours pour un pro, 17 pour un junior.",
        "−50 % : 42 jours pour un pro, 14 pour un junior.",
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
      "Les points fédéraux ne s’appliquent qu’aux coureurs de la nation sur une étape disputée dans leur pays. Un statut local accordé par une infrastructure d’équipe ne les reçoit pas.",
    illustration: {
      src: "/images/infrastructure/weather-center.webp",
      alt: "Programme fédéral d’analyse des routes et conditions locales",
    },
    levels: makeLevels({
      costs: [700_000, 1_350_000, 2_250_000, 3_500_000, 5_000_000],
      durations: [6, 9, 13, 18, 23],
      effects: [
        "+0,2 point d’exécution locale sur les étapes du pays.",
        "+0,4 point d’exécution locale sur les étapes du pays.",
        "+0,6 point d’exécution locale sur les étapes du pays.",
        "+0,8 point d’exécution locale sur les étapes du pays.",
        "+1 point d’exécution locale sur les étapes du pays.",
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
