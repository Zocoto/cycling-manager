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
export const ALPHA_BOT_AUTOMATION_END_DAY = 14;
export const ALPHA_BOT_TARGET_ROSTER_SIZE = 12;

export type AlphaBotStrategy =
  | "climber"
  | "classics"
  | "sprinter"
  | "rouleur"
  | "development";

export type AlphaBotProfile = {
  key: string;
  managerName: string;
  strategy: AlphaBotStrategy;
  minimumForm: number;
  trainingIntensity: number;
};

export const ALPHA_BOT_PROFILES: readonly AlphaBotProfile[] = [
  {
    key: "elodie_martin",
    managerName: "Élodie Martin",
    strategy: "climber",
    minimumForm: 46,
    trainingIntensity: 55,
  },
  {
    key: "thomas_vermeulen",
    managerName: "Thomas Vermeulen",
    strategy: "classics",
    minimumForm: 44,
    trainingIntensity: 58,
  },
  {
    key: "giulia_rinaldi",
    managerName: "Giulia Rinaldi",
    strategy: "sprinter",
    minimumForm: 43,
    trainingIntensity: 60,
  },
  {
    key: "mikkel_sorensen",
    managerName: "Mikkel Sørensen",
    strategy: "rouleur",
    minimumForm: 48,
    trainingIntensity: 52,
  },
  {
    key: "rafael_costa",
    managerName: "Rafael Costa",
    strategy: "development",
    minimumForm: 45,
    trainingIntensity: 50,
  },
  {
    key: "antoine_morel_29",
    managerName: "Antoine Morel 29",
    strategy: "development",
    minimumForm: 48,
    trainingIntensity: 52,
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
  const available = options.filter(
    (rider) =>
      rider.isAvailable &&
      (edition.competitionType === "standard" ||
        rider.countryCode === edition.countryCode),
  );
  if (available.length < edition.minimumRosterSize) return [];

  const profileType = edition.stages[0]?.profileType ?? "mixed";
  const count = Math.min(edition.maximumRosterSize, available.length);
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

export function getBotRaceRegistrationCandidates(
  editions: readonly RaceCalendarEdition[],
  now: Date,
  reputationPoints: number,
  riderCountryCodes: ReadonlySet<string>,
) {
  const nowTimestamp = now.getTime();

  return editions
    .filter((edition) => {
      const registrationStatus = edition.currentTeamRegistration?.status;
      const closesAtValue =
        registrationStatus === "withdrawn"
          ? edition.withdrawalClosesAt
          : edition.categoryCode === "elite"
            ? edition.wildcardClosesAt
            : edition.registrationClosesAt;
      const closesAt = closesAtValue
        ? Date.parse(closesAtValue)
        : Number.NaN;
      const supportedCompetition =
        edition.competitionType === "standard" ||
        edition.competitionType === "national_road" ||
        edition.competitionType === "national_time_trial";
      const nationalityEligible =
        edition.competitionType === "standard" ||
        riderCountryCodes.has(edition.countryCode);
      const reputationEligible =
        edition.competitionType !== "standard" ||
        edition.minimumReputation === null ||
        reputationPoints >= edition.minimumReputation;
      const registrationAvailable =
        !registrationStatus || registrationStatus === "withdrawn";
      const fieldHasRoom =
        edition.fieldLimit == null ||
        edition.engagedRiderCount + edition.minimumRosterSize <=
          edition.fieldLimit;

      return (
        edition.status === "registration_open" &&
        edition.registrationPolicy === "open" &&
        supportedCompetition &&
        nationalityEligible &&
        reputationEligible &&
        registrationAvailable &&
        fieldHasRoom &&
        Number.isFinite(closesAt) &&
        closesAt > nowTimestamp
      );
    })
    .sort(
      (left, right) =>
        getBotRegistrationDeadline(left) -
          getBotRegistrationDeadline(right) ||
        (left.stages[0]?.dayNumber ?? 999) -
          (right.stages[0]?.dayNumber ?? 999) ||
        left.id.localeCompare(right.id),
    );
}

export function isSharedMarketItemAssignedToBot({
  botKey,
  cycleKey,
  channel,
  itemId,
}: {
  botKey: string;
  cycleKey: string;
  channel: "staff" | "free-agent" | "transfer-listing";
  itemId: string;
}) {
  const profileIndex = ALPHA_BOT_PROFILES.findIndex(
    (profile) => profile.key === botKey,
  );
  if (profileIndex < 0) return false;

  return (
    deterministicIndex(
      `${cycleKey}:${channel}:${itemId}`,
      ALPHA_BOT_PROFILES.length,
    ) === profileIndex
  );
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

function getBotRegistrationDeadline(edition: RaceCalendarEdition) {
  const closesAt =
    edition.currentTeamRegistration?.status === "withdrawn"
      ? edition.withdrawalClosesAt
      : edition.categoryCode === "elite"
        ? edition.wildcardClosesAt
        : edition.registrationClosesAt;

  return Date.parse(closesAt ?? "");
}

function chooseTrainingDomain(
  strategy: AlphaBotStrategy,
  rider: TeamTrainingRider,
): TrainingDomain {
  const ratings = rider.ratings;
  const domains: Array<[TrainingDomain, number]> = [
    ["climber", ratings.mountain * 0.8 + ratings.downhill * 0.2],
    ["puncheur", ratings.hills * 0.75 + ratings.acceleration * 0.25],
    [
      "stage_racer",
      ratings.recovery * 0.3 +
        ratings.endurance * 0.3 +
        ratings.mountain * 0.4,
    ],
    [
      "northern_classics",
      ratings.cobbles * 0.75 + ratings.resistance * 0.25,
    ],
    [
      "rouleur",
      ratings.flat * 0.35 +
        ratings.time_trial * 0.4 +
        ratings.endurance * 0.25,
    ],
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
    .map(
      ([domain, score]) =>
        [domain, score + (domain === preferred[strategy] ? 12 : 0)] as const,
    )
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
