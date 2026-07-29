import type {
  RaceCalendarEdition,
  RaceProfileType,
} from "@/lib/game/race-calendar";
import type { RaceRole } from "@/lib/game/race-simulation";
import type { TrainingDomain } from "@/lib/game/training";
import type { RaceRosterOption } from "@/services/race-calendar";
import type { TeamTrainingRider } from "@/services/team-training";

export const ALPHA_BOT_SLOTS = ["morning", "evening"] as const;
export type AlphaBotSlot = (typeof ALPHA_BOT_SLOTS)[number];

export type AlphaBotStrategy =
  | "climber"
  | "classics"
  | "sprinter"
  | "rouleur"
  | "development";

export type AlphaBotProfile = {
  key: string;
  email: string;
  managerName: string;
  teamName: string;
  countryCode: string;
  avatarKey: string;
  strategy: AlphaBotStrategy;
  minimumForm: number;
  trainingIntensity: number;
  jersey: {
    pattern: "classic" | "diagonal" | "hoops" | "split";
    primary: string;
    secondary: string;
    accent: string;
  };
};

export const ALPHA_BOT_PROFILES: readonly AlphaBotProfile[] = [
  {
    key: "elodie_martin",
    email: "alpha.manager.01@cyclostratege.fr",
    managerName: "Élodie Martin",
    teamName: "Aurore Cyclisme",
    countryCode: "FR",
    avatarKey: "director_f_02",
    strategy: "climber",
    minimumForm: 46,
    trainingIntensity: 55,
    jersey: {
      pattern: "classic",
      primary: "#173F35",
      secondary: "#E9C46A",
      accent: "#F7F3E8",
    },
  },
  {
    key: "thomas_vermeulen",
    email: "alpha.manager.02@cyclostratege.fr",
    managerName: "Thomas Vermeulen",
    teamName: "Flandres Horizon",
    countryCode: "BE",
    avatarKey: "director_m_04",
    strategy: "classics",
    minimumForm: 44,
    trainingIntensity: 58,
    jersey: {
      pattern: "hoops",
      primary: "#18181B",
      secondary: "#F5C542",
      accent: "#D13B3B",
    },
  },
  {
    key: "giulia_rinaldi",
    email: "alpha.manager.03@cyclostratege.fr",
    managerName: "Giulia Rinaldi",
    teamName: "Vento Corse",
    countryCode: "IT",
    avatarKey: "director_f_05",
    strategy: "sprinter",
    minimumForm: 43,
    trainingIntensity: 60,
    jersey: {
      pattern: "split",
      primary: "#B3261E",
      secondary: "#F7F1E3",
      accent: "#146B4A",
    },
  },
  {
    key: "mikkel_sorensen",
    email: "alpha.manager.04@cyclostratege.fr",
    managerName: "Mikkel Sørensen",
    teamName: "Nordkyst Racing",
    countryCode: "DK",
    avatarKey: "director_m_06",
    strategy: "rouleur",
    minimumForm: 48,
    trainingIntensity: 52,
    jersey: {
      pattern: "diagonal",
      primary: "#9E1B32",
      secondary: "#FFFFFF",
      accent: "#243B53",
    },
  },
  {
    key: "rafael_costa",
    email: "alpha.manager.05@cyclostratege.fr",
    managerName: "Rafael Costa",
    teamName: "Serra Verde Ciclismo",
    countryCode: "BR",
    avatarKey: "director_m_02",
    strategy: "development",
    minimumForm: 45,
    trainingIntensity: 50,
    jersey: {
      pattern: "classic",
      primary: "#0B6E4F",
      secondary: "#F2C94C",
      accent: "#184E9E",
    },
  },
] as const;

export function isAlphaBotSlot(value: string): value is AlphaBotSlot {
  return ALPHA_BOT_SLOTS.includes(value as AlphaBotSlot);
}

export function buildAlphaBotCycleKey(date: Date, slot: AlphaBotSlot) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

  return `${day}:${slot}`;
}

export function chooseTrainingPlan(
  profile: AlphaBotProfile,
  rider: TeamTrainingRider,
) {
  const domain = chooseTrainingDomain(profile.strategy, rider);
  const intensity =
    rider.form < profile.minimumForm
      ? 0
      : Math.min(
          profile.trainingIntensity,
          rider.age >= 32 ? 45 : profile.trainingIntensity,
        );

  return { domain, intensity };
}

export function buildRaceRoster(
  profile: AlphaBotProfile,
  edition: RaceCalendarEdition,
  options: RaceRosterOption[],
): Array<{ riderId: string; role: RaceRole }> {
  const available = options.filter((rider) => rider.isAvailable);
  if (available.length < edition.minimumRosterSize) return [];

  const profileType = edition.stages[0]?.profileType ?? "mixed";
  const count = Math.min(
    Math.max(edition.minimumRosterSize, 1),
    edition.maximumRosterSize,
    available.length,
  );
  const selected = [...available]
    .sort(
      (left, right) =>
        scoreRaceRider(right, profileType, profile.strategy) -
        scoreRaceRider(left, profileType, profile.strategy),
    )
    .slice(0, count);

  return selected.map((rider, index) => ({
    riderId: rider.riderId,
    role: chooseRaceRole(profileType, index),
  }));
}

export function deterministicIndex(seed: string, length: number) {
  if (length <= 0) return -1;
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % length;
}

function chooseTrainingDomain(
  strategy: AlphaBotStrategy,
  rider: TeamTrainingRider,
): TrainingDomain {
  const ratings = rider.ratings;
  const domains: Array<[TrainingDomain, number]> = [
    ["climber", ratings.mountain * 0.8 + ratings.downhill * 0.2],
    ["puncheur", ratings.hills * 0.75 + ratings.acceleration * 0.25],
    ["stage_racer", ratings.recovery * 0.3 + ratings.endurance * 0.3 + ratings.mountain * 0.4],
    ["northern_classics", ratings.cobbles * 0.75 + ratings.resistance * 0.25],
    ["rouleur", ratings.flat * 0.35 + ratings.time_trial * 0.4 + ratings.endurance * 0.25],
    ["breakaway", ratings.breakaway * 0.7 + ratings.endurance * 0.3],
    ["sprinter", ratings.sprint * 0.75 + ratings.acceleration * 0.25],
  ];

  const preferred: Record<AlphaBotStrategy, TrainingDomain> = {
    climber: "climber",
    classics: "northern_classics",
    sprinter: "sprinter",
    rouleur: "rouleur",
    development: rider.age <= 23 ? "stage_racer" : "breakaway",
  };

  return domains
    .map(([domain, score]) => [
      domain,
      score + (domain === preferred[strategy] ? 12 : 0),
    ] as const)
    .sort((left, right) => right[1] - left[1])[0][0];
}

function scoreRaceRider(
  rider: RaceRosterOption,
  profileType: RaceProfileType,
  strategy: AlphaBotStrategy,
) {
  const base = {
    flat: rider.flat * 0.55 + rider.sprint * 0.45,
    sprint: rider.sprint * 0.65 + rider.flat * 0.35,
    hilly: rider.hills * 0.65 + rider.mountain * 0.35,
    mountain: rider.mountain * 0.75 + rider.hills * 0.25,
    cobbles: rider.cobbles * 0.7 + rider.flat * 0.3,
    time_trial: rider.timeTrial * 0.8 + rider.flat * 0.2,
    mixed:
      (rider.mountain +
        rider.hills +
        rider.flat +
        rider.timeTrial +
        rider.cobbles +
        rider.sprint) /
      6,
  }[profileType];
  const affinity =
    (strategy === "climber" && profileType === "mountain") ||
    (strategy === "classics" && profileType === "cobbles") ||
    (strategy === "sprinter" &&
      (profileType === "flat" || profileType === "sprint")) ||
    (strategy === "rouleur" && profileType === "time_trial")
      ? 4
      : 0;
  return base + affinity;
}

function chooseRaceRole(
  profileType: RaceProfileType,
  index: number,
): RaceRole {
  if (index === 0) {
    return profileType === "flat" || profileType === "sprint"
      ? "sprinter"
      : "leader";
  }
  if (
    index === 1 &&
    (profileType === "flat" || profileType === "sprint")
  ) {
    return "leadout";
  }
  if (index === 1 && profileType === "mountain") {
    return "mountain_classification";
  }
  return index <= 2 ? "free_agent" : "domestique";
}
