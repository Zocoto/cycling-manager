import { STAFF_ACADEMY_LEVELS } from "@/lib/game/staff-academy";

export const INFRASTRUCTURE_UNLOCK_LEVEL = 10;
export const MAX_INTERNATIONAL_CENTER_BONUS_PERCENTAGE = 90;

export type TeamInfrastructureCode =
  | "recruitment_data_room"
  | "staff_academy"
  | "training_center"
  | "indoor_track"
  | "cryotherapy_center"
  | "wind_tunnel"
  | "research_lab"
  | "international_welcome_center"
  | "weather_center"
  | "media_center"
  | "fan_club_headquarters"
  | "club_shop";

export type ArchitectSpecialty = "economist" | "foreman" | "balanced";

export const ARCHITECT_SPECIALTIES = [
  "economist",
  "foreman",
  "balanced",
] as const satisfies readonly ArchitectSpecialty[];

export const ARCHITECT_SPECIALTY_LABELS: Record<ArchitectSpecialty, string> = {
  economist: "Économe",
  foreman: "Chef de chantier",
  balanced: "Polyvalent",
};

export type InfrastructureLevelDefinition = {
  level: number;
  cost: number;
  durationDays: number;
  effect: string;
};

export type TeamInfrastructureDefinition = {
  code: TeamInfrastructureCode;
  name: string;
  domain: string;
  summary: string;
  illustration: {
    src: string;
    alt: string;
  };
  levels: readonly InfrastructureLevelDefinition[];
};

export const TEAM_INFRASTRUCTURE_DEFINITIONS: Record<
  TeamInfrastructureCode,
  TeamInfrastructureDefinition
> = {
  recruitment_data_room: {
    code: "recruitment_data_room",
    name: "Data Room du recrutement",
    domain: "Scouting · Transferts",
    summary:
      "Réduit progressivement l’incertitude des rapports présentés sur le marché des transferts.",
    illustration: {
      src: "/images/infrastructure/recruitment-data-room.webp",
      alt: "Data Room moderne d’une équipe cycliste au crépuscule",
    },
    levels: [
      {
        level: 1,
        cost: 350_000,
        durationDays: 14,
        effect:
          "3 notes exactes, 8 fourchettes, 2 inconnues et potentiel toujours estimé.",
      },
      {
        level: 2,
        cost: 700_000,
        durationDays: 28,
        effect:
          "5 notes exactes, 8 fourchettes resserrées et plus aucune note inconnue.",
      },
      {
        level: 3,
        cost: 1_200_000,
        durationDays: 42,
        effect:
          "7 notes exactes et 6 fourchettes très resserrées ; potentiel estimé à une demi-étoile près.",
      },
    ],
  },
  staff_academy: {
    code: "staff_academy",
    name: "Académie des métiers",
    domain: "Staff · Formation avancée",
    summary:
      "Développe durablement les étoiles et les domaines d’expertise du staff.",
    illustration: {
      src: "/images/infrastructure/staff-academy.webp",
      alt: "Académie des métiers moderne au cœur d’un campus cycliste",
    },
    levels: STAFF_ACADEMY_LEVELS.map((definition) => ({
      level: definition.level,
      cost: definition.cost,
      durationDays: definition.durationDays,
      effect: `${definition.capacity} stage${definition.capacity > 1 ? "s" : ""} de staff ${definition.capacity > 1 ? "peuvent" : "peut"} être mené${definition.capacity > 1 ? "s" : ""} simultanément.`,
    })),
  },
  training_center: {
    code: "training_center",
    name: "Centre d’entraînement",
    domain: "Performance · Effectif professionnel",
    summary:
      "Améliore durablement la progression gagnée par tous les coureurs professionnels à chaque séance.",
    illustration: {
      src: "/images/infrastructure/training-center.webp",
      alt: "Centre d’entraînement contemporain pour coureurs professionnels",
    },
    levels: [
      {
        level: 1,
        cost: 100_000,
        durationDays: 7,
        effect: "+2 % de progression à chaque entraînement professionnel.",
      },
      {
        level: 2,
        cost: 250_000,
        durationDays: 14,
        effect: "+4 % de progression à chaque entraînement professionnel.",
      },
      {
        level: 3,
        cost: 500_000,
        durationDays: 24,
        effect: "+6 % de progression à chaque entraînement professionnel.",
      },
      {
        level: 4,
        cost: 900_000,
        durationDays: 35,
        effect: "+8 % de progression à chaque entraînement professionnel.",
      },
      {
        level: 5,
        cost: 1_500_000,
        durationDays: 49,
        effect: "+10 % de progression à chaque entraînement professionnel.",
      },
    ],
  },
  indoor_track: {
    code: "indoor_track",
    name: "Piste indoor",
    domain: "Préparation · Sprint",
    summary:
      "Débloque des préparations de deux jours qui renforcent temporairement le sprint et l’accélération.",
    illustration: {
      src: "/images/infrastructure/indoor-track.webp",
      alt: "Piste cycliste indoor moderne au sein du campus de l’équipe",
    },
    levels: [
      {
        level: 1,
        cost: 180_000,
        durationDays: 10,
        effect:
          "Après 2 jours de préparation : +1 SP et +1 ACC pendant 2 jours.",
      },
      {
        level: 2,
        cost: 450_000,
        durationDays: 18,
        effect:
          "Après 2 jours de préparation : +1 SP et +1 ACC pendant 3 jours.",
      },
      {
        level: 3,
        cost: 900_000,
        durationDays: 28,
        effect:
          "Après 2 jours de préparation : +2 SP et +2 ACC pendant 2 jours.",
      },
      {
        level: 4,
        cost: 1_550_000,
        durationDays: 40,
        effect:
          "Après 2 jours de préparation : +2 SP et +2 ACC pendant 3 jours.",
      },
      {
        level: 5,
        cost: 2_400_000,
        durationDays: 55,
        effect:
          "Après 2 jours de préparation : +3 SP et +3 ACC pendant 2 jours.",
      },
    ],
  },
  cryotherapy_center: {
    code: "cryotherapy_center",
    name: "Centre de cryothérapie",
    domain: "Récupération · Après-course",
    summary:
      "Réduit la perte de forme après chaque course pour tous les coureurs engagés et se cumule avec leur kiné.",
    illustration: {
      src: "/images/infrastructure/cryotherapy-center.webp",
      alt: "Centre de cryothérapie contemporain pour une équipe cycliste",
    },
    levels: [10, 20, 30, 40, 50].map((bonus, index) => ({
      level: index + 1,
      cost: [250_000, 600_000, 1_100_000, 1_800_000, 2_800_000][index]!,
      durationDays: [12, 22, 34, 48, 64][index]!,
      effect: `−${bonus} % sur la perte de forme post-course, après application du kiné.`,
    })),
  },
  wind_tunnel: {
    code: "wind_tunnel",
    name: "Soufflerie",
    domain: "Préparation · Aérodynamisme",
    summary:
      "Débloque des préparations de deux jours qui renforcent temporairement le TT, le PRL et la STA.",
    illustration: {
      src: "/images/infrastructure/wind-tunnel.webp",
      alt: "Soufflerie cycliste avec vélo de contre-la-montre sur banc d’essai",
    },
    levels: [
      {
        level: 1,
        cost: 400_000,
        durationDays: 16,
        effect:
          "Après 2 jours de préparation : +1 TT, +1 PRL et +1 STA pendant 2 jours.",
      },
      {
        level: 2,
        cost: 850_000,
        durationDays: 28,
        effect:
          "Après 2 jours de préparation : +1 TT, +1 PRL et +1 STA pendant 3 jours.",
      },
      {
        level: 3,
        cost: 1_500_000,
        durationDays: 42,
        effect:
          "Après 2 jours de préparation : +2 TT, +2 PRL et +2 STA pendant 2 jours.",
      },
      {
        level: 4,
        cost: 2_400_000,
        durationDays: 58,
        effect:
          "Après 2 jours de préparation : +2 TT, +2 PRL et +2 STA pendant 3 jours.",
      },
      {
        level: 5,
        cost: 3_600_000,
        durationDays: 76,
        effect:
          "Après 2 jours de préparation : +3 TT, +3 PRL et +3 STA pendant 2 jours.",
      },
    ],
  },
  weather_center: {
    code: "weather_center",
    name: "Centre météo",
    domain: "Course · Anticipation",
    summary:
      "Révèle la météo déterministe des étapes plusieurs jours avant leur départ, sans génération supplémentaire.",
    illustration: {
      src: "/images/infrastructure/weather-center.webp",
      alt: "Centre météorologique moderne équipé d’instruments et d’un radar",
    },
    levels: [1, 3, 5, 8, 28].map((horizon, index) => ({
      level: index + 1,
      cost: [500_000, 900_000, 1_500_000, 2_300_000, 3_300_000][index]!,
      durationDays: [14, 24, 36, 50, 66][index]!,
      effect:
        horizon === 28
          ? "Prévisions accessibles sur toute la saison."
          : `Prévisions accessibles ${horizon} jour${horizon > 1 ? "s" : ""} avant le départ.`,
    })),
  },
  media_center: {
    code: "media_center",
    name: "Média Center",
    domain: "Gazette · Popularité",
    summary:
      "Permet au DS de publier dans la Gazette, de valoriser son sponsor et d’amplifier réputation et popularité.",
    illustration: {
      src: "/images/infrastructure/media-center.webp",
      alt: "Studio média et rédaction d’une équipe cycliste",
    },
    levels: [
      {
        level: 1,
        cost: 650_000,
        durationDays: 18,
        effect: "1 tribune tous les 7 jours · bonus média de niveau 1.",
      },
      {
        level: 2,
        cost: 1_200_000,
        durationDays: 30,
        effect:
          "1 tribune tous les 5 jours · impact des community managers +10 %.",
      },
      {
        level: 3,
        cost: 2_000_000,
        durationDays: 44,
        effect:
          "1 tribune tous les 4 jours · publicité sponsor dans la Gazette.",
      },
      {
        level: 4,
        cost: 3_000_000,
        durationDays: 60,
        effect:
          "1 tribune tous les 3 jours · gains de fans et de réputation renforcés.",
      },
      {
        level: 5,
        cost: 4_300_000,
        durationDays: 78,
        effect: "1 tribune tous les 2 jours · rayonnement médiatique maximal.",
      },
    ],
  },
  international_welcome_center: {
    code: "international_welcome_center",
    name: "Centre d’accueil international",
    domain: "International · Intégration",
    summary:
      "Accélère les naturalisations et étend les affinités nationales aux pays voisins puis au continent.",
    illustration: {
      src: "/images/infrastructure/international-welcome-center.webp",
      alt: "Centre d’accueil international pour coureurs et staff cyclistes",
    },
    levels: [
      {
        level: 1,
        cost: 800_000,
        durationDays: 24,
        effect: "Naturalisation pro en 70 jours et junior en 21 jours.",
      },
      {
        level: 2,
        cost: 1_500_000,
        durationDays: 38,
        effect: "Naturalisation pro en 56 jours et junior en 14 jours.",
      },
      {
        level: 3,
        cost: 2_500_000,
        durationDays: 54,
        effect:
          "Affinité du staff et bonus local étendus aux pays frontaliers ; junior en 7 jours.",
      },
      {
        level: 4,
        cost: 3_800_000,
        durationDays: 72,
        effect:
          "Affinité du staff étendue au continent ; naturalisation pro en 28 jours.",
      },
      {
        level: 5,
        cost: 5_500_000,
        durationDays: 84,
        effect:
          "Naturalisation pro en 14 jours et naturalisation junior immédiate.",
      },
    ],
  },
  research_lab: {
    code: "research_lab",
    name: "Laboratoire R&D",
    domain: "Matériel · Prototypes uniques",
    summary:
      "Transforme un exemplaire du stock en prototype unique, avec un bonus ou un malus aléatoire.",
    illustration: {
      src: "/images/infrastructure/research-lab.webp",
      alt: "Laboratoire de recherche cycliste avec cadres et roues prototypes",
    },
    levels: [
      {
        level: 1,
        cost: 1_200_000,
        durationDays: 28,
        effect: "R&D sur les cadres · 50 % de réussite · base de 18 jours.",
      },
      {
        level: 2,
        cost: 2_000_000,
        durationDays: 42,
        effect: "Débloque les roues · 55 % de réussite · base de 16 jours.",
      },
      {
        level: 3,
        cost: 3_000_000,
        durationDays: 56,
        effect: "Débloque les casques · 60 % de réussite · base de 14 jours.",
      },
      {
        level: 4,
        cost: 4_200_000,
        durationDays: 70,
        effect:
          "Débloque les chaussures · 65 % de réussite · base de 12 jours.",
      },
      {
        level: 5,
        cost: 5_600_000,
        durationDays: 84,
        effect: "Débloque les cuissards · 70 % de réussite · base de 10 jours.",
      },
      {
        level: 6,
        cost: 7_200_000,
        durationDays: 84,
        effect: "Débloque les gants · 75 % de réussite · base de 9 jours.",
      },
      {
        level: 7,
        cost: 9_000_000,
        durationDays: 84,
        effect: "Débloque les lunettes · 80 % de réussite · base de 8 jours.",
      },
    ],
  },
  fan_club_headquarters: {
    code: "fan_club_headquarters",
    name: "Siège social du Fan Club",
    domain: "Supporters · Popularité",
    summary:
      "Débloque le Fan Club, augmente son audience et agrandit progressivement le parc de cars.",
    illustration: {
      src: "/images/infrastructure/fan-club-headquarters.webp",
      alt: "Siège social accueillant du Fan Club d’une équipe cycliste",
    },
    levels: [
      {
        level: 1,
        cost: 200_000,
        durationDays: 10,
        effect: "Débloque le Fan Club et permet de gérer jusqu’à 2 cars.",
      },
      {
        level: 2,
        cost: 450_000,
        durationDays: 18,
        effect: "+10 % d’audience calculée et un parc porté à 5 cars.",
      },
      {
        level: 3,
        cost: 850_000,
        durationDays: 28,
        effect: "+20 % d’audience calculée et un parc porté à 10 cars.",
      },
      {
        level: 4,
        cost: 1_400_000,
        durationDays: 40,
        effect: "+30 % d’audience calculée et un parc porté à 18 cars.",
      },
      {
        level: 5,
        cost: 2_200_000,
        durationDays: 56,
        effect: "+40 % d’audience calculée et un parc porté à 30 cars.",
      },
    ],
  },
  club_shop: {
    code: "club_shop",
    name: "Boutique du club",
    domain: "Supporters · Merchandising",
    summary:
      "Développe les ventes du Fan Club en augmentant le stock et le nombre de produits disponibles.",
    illustration: {
      src: "/images/infrastructure/club-shop.webp",
      alt: "Boutique contemporaine d’un club cycliste",
    },
    levels: [
      {
        level: 1,
        cost: 150_000,
        durationDays: 8,
        effect: "Maillots disponibles et capacité maximale de 300 objets.",
      },
      {
        level: 2,
        cost: 350_000,
        durationDays: 16,
        effect: "2 produits disponibles et capacité maximale de 800 objets.",
      },
      {
        level: 3,
        cost: 650_000,
        durationDays: 24,
        effect: "3 produits disponibles et capacité maximale de 1 600 objets.",
      },
      {
        level: 4,
        cost: 1_050_000,
        durationDays: 34,
        effect: "4 produits disponibles et capacité maximale de 3 000 objets.",
      },
      {
        level: 5,
        cost: 1_600_000,
        durationDays: 46,
        effect: "5 produits disponibles et capacité maximale de 5 000 objets.",
      },
    ],
  },
};

export function getTeamInfrastructureCodesByStartingCost() {
  return (
    Object.keys(TEAM_INFRASTRUCTURE_DEFINITIONS) as TeamInfrastructureCode[]
  ).sort((left, right) => {
    const leftCost =
      TEAM_INFRASTRUCTURE_DEFINITIONS[left].levels[0]?.cost ??
      Number.POSITIVE_INFINITY;
    const rightCost =
      TEAM_INFRASTRUCTURE_DEFINITIONS[right].levels[0]?.cost ??
      Number.POSITIVE_INFINITY;

    return (
      leftCost - rightCost ||
      TEAM_INFRASTRUCTURE_DEFINITIONS[left].name.localeCompare(
        TEAM_INFRASTRUCTURE_DEFINITIONS[right].name,
        "fr",
      )
    );
  });
}

export const INTERNATIONAL_CENTER_LEVELS = [
  {
    level: 1,
    cost: 500_000,
    durationDays: 28,
    bonusPercentage: 10,
  },
  {
    level: 2,
    cost: 750_000,
    durationDays: 35,
    bonusPercentage: 20,
  },
  {
    level: 3,
    cost: 1_000_000,
    durationDays: 42,
    bonusPercentage: 30,
  },
  {
    level: 4,
    cost: 1_350_000,
    durationDays: 49,
    bonusPercentage: 40,
  },
  {
    level: 5,
    cost: 1_800_000,
    durationDays: 56,
    bonusPercentage: 50,
  },
] as const;

export function getTeamInfrastructureLevelDefinition(
  code: TeamInfrastructureCode,
  level: number,
): InfrastructureLevelDefinition | null {
  return (
    TEAM_INFRASTRUCTURE_DEFINITIONS[code].levels.find(
      (definition) => definition.level === level,
    ) ?? null
  );
}

export function getInternationalCenterLevelDefinition(level: number) {
  return (
    INTERNATIONAL_CENTER_LEVELS.find(
      (definition) => definition.level === level,
    ) ?? null
  );
}

export function getInternationalCenterBonusPercentage(
  totalQualityStars: number,
): number {
  return Math.min(
    MAX_INTERNATIONAL_CENTER_BONUS_PERCENTAGE,
    Math.max(0, Math.floor(totalQualityStars)) * 10,
  );
}

export function applyInternationalCenterPotentialBonus({
  potentialSteps,
  totalQualityStars,
  random,
}: {
  potentialSteps: number;
  totalQualityStars: number;
  random: () => number;
}): {
  potentialSteps: number;
  bonusApplied: boolean;
  bonusPercentage: number;
} {
  const safePotential = Math.min(8, Math.max(1, Math.round(potentialSteps)));
  const bonusPercentage =
    getInternationalCenterBonusPercentage(totalQualityStars);
  const bonusApplied = safePotential <= 6 && random() < bonusPercentage / 100;

  return {
    potentialSteps: bonusApplied ? safePotential + 2 : safePotential,
    bonusApplied,
    bonusPercentage,
  };
}

export function getScoutingVisibilityForDataRoom(level: number): {
  exactRatingCount: number;
  rangeRatingCount: number;
  minimumRangeSpread: number;
  maximumRangeSpread: number;
  potentialCanBeUnknown: boolean;
  potentialMaximumSpreadSteps: number;
} {
  const safeLevel = Math.min(3, Math.max(0, Math.floor(level)));

  if (safeLevel === 1) {
    return {
      exactRatingCount: 3,
      rangeRatingCount: 8,
      minimumRangeSpread: 2,
      maximumRangeSpread: 4,
      potentialCanBeUnknown: false,
      potentialMaximumSpreadSteps: 2,
    };
  }

  if (safeLevel === 2) {
    return {
      exactRatingCount: 5,
      rangeRatingCount: 8,
      minimumRangeSpread: 1,
      maximumRangeSpread: 3,
      potentialCanBeUnknown: false,
      potentialMaximumSpreadSteps: 1,
    };
  }

  if (safeLevel === 3) {
    return {
      exactRatingCount: 7,
      rangeRatingCount: 6,
      minimumRangeSpread: 1,
      maximumRangeSpread: 1,
      potentialCanBeUnknown: false,
      potentialMaximumSpreadSteps: 1,
    };
  }

  return {
    exactRatingCount: 3,
    rangeRatingCount: 6,
    minimumRangeSpread: 2,
    maximumRangeSpread: 4,
    potentialCanBeUnknown: true,
    potentialMaximumSpreadSteps: 2,
  };
}

export function isTeamInfrastructureCode(
  value: string,
): value is TeamInfrastructureCode {
  return (
    value === "recruitment_data_room" ||
    value === "staff_academy" ||
    value === "training_center" ||
    value === "indoor_track" ||
    value === "cryotherapy_center" ||
    value === "wind_tunnel" ||
    value === "research_lab" ||
    value === "international_welcome_center" ||
    value === "weather_center" ||
    value === "media_center" ||
    value === "fan_club_headquarters" ||
    value === "club_shop"
  );
}

export function isArchitectSpecialty(
  value: string,
): value is ArchitectSpecialty {
  return ARCHITECT_SPECIALTIES.includes(value as ArchitectSpecialty);
}
