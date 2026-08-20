export const SPONSOR_SPORTING_PHILOSOPHIES = [
  "cobbled_classics",
  "ardennes_classics",
  "medium_stage_races",
  "time_trials",
  "sprints",
  "grand_tour_general",
] as const;

export type SponsorSportingPhilosophy =
  (typeof SPONSOR_SPORTING_PHILOSOPHIES)[number];

export const SPONSOR_SPORTING_PHILOSOPHY_CONFIG: Record<
  SponsorSportingPhilosophy,
  {
    label: string;
    description: string;
  }
> = {
  cobbled_classics: {
    label: "Classiques pavées",
    description:
      "Le sponsor valorise les résultats sur les courses d’un jour disputées sur les pavés.",
  },
  ardennes_classics: {
    label: "Classiques ardennaises",
    description:
      "Le sponsor privilégie les classiques vallonnées et les arrivées pour puncheurs.",
  },
  medium_stage_races: {
    label: "Tours intermédiaires",
    description:
      "Le sponsor recherche des résultats au classement général des courses par étapes hors Grands Tours.",
  },
  time_trials: {
    label: "Contre-la-montre",
    description:
      "Le sponsor attend des performances sur les chronos individuels et par équipes.",
  },
  sprints: {
    label: "Sprints",
    description:
      "Le sponsor privilégie les arrivées massives et les courses favorables aux sprinteurs.",
  },
  grand_tour_general: {
    label: "Classement général des Grands Tours",
    description:
      "Le sponsor vise les classements généraux des Grands Tours dès que la réputation de l’équipe le permet.",
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

  return SPONSOR_SPORTING_PHILOSOPHIES[
    stableSponsorBucket(
      normalizedCatalogKey,
      SPONSOR_SPORTING_PHILOSOPHIES.length,
    )
  ];
}

function stableSponsorBucket(value: string, bucketCount: number): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0) % bucketCount;
}
