export const SPONSOR_SPORTING_PHILOSOPHIES = [
  "cobbled_classics",
  "ardennes_classics",
  "medium_stage_races",
  "time_trials",
  "sprints",
  "grand_tour_general",
  "national_preference",
  "youth_development",
] as const;

const LEGACY_SPONSOR_SPORTING_PHILOSOPHIES = [
  "cobbled_classics",
  "ardennes_classics",
  "medium_stage_races",
  "time_trials",
  "sprints",
  "grand_tour_general",
] as const satisfies readonly SponsorSportingPhilosophy[];

const SPONSOR_SPORTING_PHILOSOPHY_OVERRIDES: Readonly<
  Record<string, SponsorSportingPhilosophy>
> = {
  "abbaye-du-lion": "national_preference",
  "dolci-bellini": "national_preference",
  "kapuluan-post": "national_preference",
  "nordhavn-post": "national_preference",
  "qhapaq-mail": "national_preference",
  "sahel-colis": "national_preference",
  "serra-dourada-foods": "national_preference",
  "terroirs-unis": "national_preference",
  "triglav-parcel": "national_preference",
  "windmill-foods": "national_preference",
  "atlas-racing-lab": "youth_development",
  "bohemia-velocity-project": "youth_development",
  "koru-racing-collective": "youth_development",
  "orion-cycling-lab": "youth_development",
  "pura-cadencia-test-team": "youth_development",
  "quebec-nord-racing": "youth_development",
  "savana-racing-project": "youth_development",
};

export type SponsorSportingPhilosophy =
  (typeof SPONSOR_SPORTING_PHILOSOPHIES)[number];

export const SPONSOR_SPORTING_PHILOSOPHY_CONFIG: Record<
  SponsorSportingPhilosophy,
  {
    label: string;
    description: string;
    initialBudgetBonusPercent: number;
  }
> = {
  cobbled_classics: {
    label: "Classiques pavées",
    description:
      "Le sponsor valorise les résultats sur les courses d’un jour disputées sur les pavés.",
    initialBudgetBonusPercent: 0,
  },
  ardennes_classics: {
    label: "Classiques ardennaises",
    description:
      "Le sponsor privilégie les classiques vallonnées et les arrivées pour puncheurs.",
    initialBudgetBonusPercent: 0,
  },
  medium_stage_races: {
    label: "Tours intermédiaires",
    description:
      "Le sponsor recherche des résultats au classement général des courses par étapes hors Grands Tours.",
    initialBudgetBonusPercent: 0,
  },
  time_trials: {
    label: "Contre-la-montre",
    description:
      "Le sponsor attend des performances sur les chronos individuels et par équipes.",
    initialBudgetBonusPercent: 0,
  },
  sprints: {
    label: "Sprints",
    description:
      "Le sponsor privilégie les arrivées massives et les courses favorables aux sprinteurs.",
    initialBudgetBonusPercent: 0,
  },
  grand_tour_general: {
    label: "Classement général des Grands Tours",
    description:
      "Le sponsor vise les classements généraux des Grands Tours dès que la réputation de l’équipe le permet.",
    initialBudgetBonusPercent: 0,
  },
  national_preference: {
    label: "Préférence nationale",
    description:
      "Le sponsor exige une forte majorité de coureurs de son pays. Cet engagement pèse lourd dans sa satisfaction et augmente de 15 % le budget proposé.",
    initialBudgetBonusPercent: 15,
  },
  youth_development: {
    label: "Formateur",
    description:
      "Le sponsor privilégie les promotions du Centre de formation, la Dev Team, les victoires juniors et la valorisation de quelques coureurs formés au club.",
    initialBudgetBonusPercent: 0,
  },
};

export function resolveSponsorSportingPhilosophy(
  sponsorCatalogKey: string,
): SponsorSportingPhilosophy {
  const normalizedCatalogKey = sponsorCatalogKey.trim().toLowerCase();

  if (!normalizedCatalogKey) {
    throw new Error(
      "La clé catalogue du sponsor est obligatoire pour déterminer sa philosophie sportive.",
    );
  }

  const configuredPhilosophy =
    SPONSOR_SPORTING_PHILOSOPHY_OVERRIDES[normalizedCatalogKey];

  if (configuredPhilosophy) {
    return configuredPhilosophy;
  }

  return LEGACY_SPONSOR_SPORTING_PHILOSOPHIES[
    stableSponsorBucket(
      normalizedCatalogKey,
      LEGACY_SPONSOR_SPORTING_PHILOSOPHIES.length,
    )
  ];
}

export function getSponsorInitialBudgetBonusPercent(
  philosophy: SponsorSportingPhilosophy,
): number {
  return SPONSOR_SPORTING_PHILOSOPHY_CONFIG[philosophy]
    .initialBudgetBonusPercent;
}

function stableSponsorBucket(value: string, bucketCount: number): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0) % bucketCount;
}
