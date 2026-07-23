import type { RaceStageSegment } from "./race-profiles";
import type { RiderSimulationInput } from "./race-simulation";

export const RACE_CATEGORY_CODES = [
  "elite",
  "world",
  "continental",
  "national",
] as const;

export const RACE_DAY_SLOTS = ["early", "late"] as const;

export type RaceDaySlot = (typeof RACE_DAY_SLOTS)[number];

export const RACE_DAY_SLOT_CONFIG: Record<
  RaceDaySlot,
  {
    label: string;
    calendarLabel: "AM" | "PM";
    shortLabel: string;
    departureLabel: string;
    registrationCutoffLabel: string;
    departureHour: number;
    registrationCutoffHour: number;
  }
> = {
  early: {
    label: "Matin",
    calendarLabel: "AM",
    shortLabel: "14 h",
    departureLabel: "Départ à 14 h",
    registrationCutoffLabel: "Inscriptions figées à 8 h",
    departureHour: 14,
    registrationCutoffHour: 8,
  },
  late: {
    label: "Après-midi",
    calendarLabel: "PM",
    shortLabel: "18 h",
    departureLabel: "Départ à 18 h",
    registrationCutoffLabel: "Inscriptions figées à 12 h",
    departureHour: 18,
    registrationCutoffHour: 12,
  },
};

export type RaceCategoryCode =
  (typeof RACE_CATEGORY_CODES)[number];

export type RaceFormat =
  | "one_day"
  | "stage_race";

export type RaceCompetitionType =
  | "standard"
  | "national_road"
  | "national_time_trial";

export type RaceProfileType =
  | "flat"
  | "sprint"
  | "hilly"
  | "mountain"
  | "cobbles"
  | "time_trial"
  | "mixed";

export type RegistrationPolicy =
  | "open"
  | "criteria_pending"
  | "closed";

export type RaceStageType =
  | "road"
  | "individual_time_trial"
  | "team_time_trial"
  | "prologue";

export type RaceStageStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled";

export type RaceCalendarStage = {
  id: string;
  dayNumber: number;
  stageNumber: number;
  name: string;
  stageType: RaceStageType;
  status: RaceStageStatus;
  profileType: RaceProfileType;
  distanceKm: number;
  daySlot: RaceDaySlot;
  departureAt: string | null;
  segments: RaceStageSegment[];
  reconnaissanceBonuses?: Record<string, number>;
};

export type RaceCalendarEdition = {
  id: string;
  raceId: string;
  slug: string;
  name: string;
  shortName: string | null;
  countryName: string;
  countryCode: string;
  categoryCode: RaceCategoryCode;
  categoryName: string;
  prestigeRank: number;
  raceFormat: RaceFormat;
  competitionType: RaceCompetitionType;
  registrationClosesAt: string | null;
  withdrawalClosesAt: string | null;
  registrationPolicy: RegistrationPolicy;
  minimumReputation: number | null;
  minimumRosterSize: number;
  maximumRosterSize: number;
  engagedRiderCount: number;
  engagedRiders: RiderSimulationInput[];
  currentTeamRegistration: {
    status: "pending" | "accepted" | "rejected" | "withdrawn";
    rosterCount: number;
  } | null;
  stages: RaceCalendarStage[];
};

export type SeasonCalendarDay = {
  id: string;
  dayNumber: number;
  calendarDate: string;
  label: string | null;
};

export type SeasonCalendarEvent = {
  id: string;
  dayNumber: number;
  eventType:
    | "season_opening"
    | "sponsor_renewal"
    | "national_time_trial_championships"
    | "national_road_championships"
    | "continental_championships"
    | "world_championships";
  title: string;
  description: string | null;
  href: string | null;
};

export type SeasonRaceCalendar = {
  seasonId: string;
  seasonName: string;
  gameYear: number;
  startsOn: string;
  endsOn: string;
  currentDayNumber: number;
  days: SeasonCalendarDay[];
  events: SeasonCalendarEvent[];
  editions: RaceCalendarEdition[];
};

export type WeekRaceSegment = {
  edition: RaceCalendarEdition;
  stages: RaceCalendarStage[];
  startHalfDayIndex: number;
  endHalfDayIndex: number;
  startDay: number;
  endDay: number;
  startsBeforeWeek: boolean;
  continuesAfterWeek: boolean;
  lane: number;
};

export type CalendarWeek = {
  weekNumber: number;
  startDay: number;
  endDay: number;
  startHalfDayIndex: number;
  endHalfDayIndex: number;
  segments: WeekRaceSegment[];
  laneCount: number;
};

export const RACE_CATEGORY_STYLE: Record<
  RaceCategoryCode,
  {
    label: string;
    shortLabel: string;
    background: string;
    foreground: string;
    border: string;
  }
> = {
  elite: {
    label: "Elite",
    shortLabel: "ELI",
    background: "#2457C5",
    foreground: "#FFFFFF",
    border: "#163B91",
  },
  world: {
    label: "Mondial",
    shortLabel: "MON",
    background: "#A94735",
    foreground: "#FFFFFF",
    border: "#7A2F23",
  },
  continental: {
    label: "Continental",
    shortLabel: "CON",
    background: "#2F7D4B",
    foreground: "#FFFFFF",
    border: "#1F5934",
  },
  national: {
    label: "National",
    shortLabel: "NAT",
    background: "#F2C94C",
    foreground: "#17261E",
    border: "#B99525",
  },
};

export const RACE_PROFILE_LABELS: Record<
  RaceProfileType,
  string
> = {
  flat: "Plaine",
  sprint: "Sprint",
  hilly: "Vallonné",
  mountain: "Montagne",
  cobbles: "Pavés",
  time_trial: "Contre-la-montre",
  mixed: "Mixte",
};

export function isRaceCategoryCode(
  value: string
): value is RaceCategoryCode {
  return RACE_CATEGORY_CODES.includes(
    value as RaceCategoryCode
  );
}

export function isRaceDaySlot(value: string): value is RaceDaySlot {
  return RACE_DAY_SLOTS.includes(value as RaceDaySlot);
}

export function compareRaceDaySlots(first: RaceDaySlot, second: RaceDaySlot) {
  return RACE_DAY_SLOTS.indexOf(first) - RACE_DAY_SLOTS.indexOf(second);
}

export function getSeasonHalfDayIndex(
  dayNumber: number,
  daySlot: RaceDaySlot
) {
  return (
    (Math.max(1, Math.trunc(dayNumber)) - 1) * RACE_DAY_SLOTS.length +
    RACE_DAY_SLOTS.indexOf(daySlot)
  );
}

export function getEffectiveSeasonDay({
  startsOn,
  persistedDayNumber,
  parisDate,
}: {
  startsOn: string;
  persistedDayNumber: number | null;
  parisDate: string;
}): number {
  const startTimestamp = Date.parse(
    `${startsOn}T00:00:00Z`
  );
  const currentTimestamp = Date.parse(
    `${parisDate}T00:00:00Z`
  );

  if (
    !Number.isFinite(startTimestamp) ||
    !Number.isFinite(currentTimestamp)
  ) {
    return clampSeasonDay(
      persistedDayNumber ?? 1
    );
  }

  const elapsedDays = Math.floor(
    (currentTimestamp - startTimestamp) /
      86_400_000
  );
  const calendarDay = clampSeasonDay(
    elapsedDays + 1
  );

  return Math.max(
    calendarDay,
    clampSeasonDay(persistedDayNumber ?? 1)
  );
}

export function buildCalendarWeeks(
  editions: RaceCalendarEdition[]
): CalendarWeek[] {
  return Array.from(
    { length: 4 },
    (_, weekIndex) => {
      const startDay = weekIndex * 7 + 1;
      const endDay = startDay + 6;
      const startHalfDayIndex = getSeasonHalfDayIndex(startDay, "early");
      const endHalfDayIndex = getSeasonHalfDayIndex(endDay, "late");
      const rawSegments = editions
        .flatMap((edition) =>
          getEditionHalfDayRuns(edition).map((run) =>
            getEditionWeekSegment(
              edition,
              run,
              startHalfDayIndex,
              endHalfDayIndex
            )
          )
        )
        .filter(
          (
            segment
          ): segment is Omit<
            WeekRaceSegment,
            "lane"
          > => segment !== null
        )
        .sort(compareWeekSegments);
      const laneEndHalfDayIndexes: number[] = [];

      const segments = rawSegments.map(
        (segment) => {
          const availableLane =
            laneEndHalfDayIndexes.findIndex(
              (laneEndHalfDayIndex) =>
                laneEndHalfDayIndex < segment.startHalfDayIndex
            );
          const lane =
            availableLane === -1
              ? laneEndHalfDayIndexes.length
              : availableLane;

          laneEndHalfDayIndexes[lane] = segment.endHalfDayIndex;

          return {
            ...segment,
            lane,
          };
        }
      );

      return {
        weekNumber: weekIndex + 1,
        startDay,
        endDay,
        startHalfDayIndex,
        endHalfDayIndex,
        segments,
        laneCount: laneEndHalfDayIndexes.length,
      };
    }
  );
}

export function getEditionDayRange(
  edition: RaceCalendarEdition
): { startDay: number; endDay: number } {
  const dayNumbers = edition.stages.map(
    (stage) => stage.dayNumber
  );

  return {
    startDay: Math.min(...dayNumbers),
    endDay: Math.max(...dayNumbers),
  };
}

export function getRegistrationAvailability({
  policy,
  closesAt,
  minimumReputation,
  reputationPoints,
  now = new Date(),
}: {
  policy: RegistrationPolicy;
  closesAt: string | null;
  minimumReputation: number | null;
  reputationPoints: number;
  now?: Date;
}):
  | "open"
  | "closed"
  | "criteria_pending"
  | "reputation_locked" {
  if (policy === "closed") {
    return "closed";
  }

  if (policy === "criteria_pending") {
    return "criteria_pending";
  }

  if (
    closesAt &&
    Date.parse(closesAt) <= now.getTime()
  ) {
    return "closed";
  }

  if (minimumReputation === null) {
    return "criteria_pending";
  }

  if (reputationPoints < minimumReputation) {
    return "reputation_locked";
  }

  return "open";
}

export function isRaceEditionAvailableToCurrentTeam({
  edition,
  reputationPoints,
  now = new Date(),
}: {
  edition: RaceCalendarEdition;
  reputationPoints: number;
  now?: Date;
}) {
  const registrationStatus =
    edition.currentTeamRegistration?.status;

  if (
    registrationStatus === "accepted" ||
    registrationStatus === "pending"
  ) {
    return true;
  }

  if (registrationStatus === "rejected") {
    return false;
  }

  if (
    registrationStatus === "withdrawn" &&
    !isBeforeRegistrationDeadline(
      edition.withdrawalClosesAt,
      now
    )
  ) {
    return false;
  }

  return (
    getRegistrationAvailability({
      policy: edition.registrationPolicy,
      closesAt: edition.registrationClosesAt,
      minimumReputation: edition.minimumReputation,
      reputationPoints,
      now,
    }) === "open"
  );
}

export function isCurrentTeamRegisteredForRace(
  edition: RaceCalendarEdition
) {
  return (
    edition.currentTeamRegistration?.status ===
      "accepted" &&
    edition.currentTeamRegistration.rosterCount > 0
  );
}

export function isRosterSelectionValid({
  selectedCount,
  minimum,
  maximum,
}: {
  selectedCount: number;
  minimum: number;
  maximum: number;
}) {
  return (
    selectedCount >= minimum &&
    selectedCount <= maximum
  );
}

export function isBeforeRegistrationDeadline(
  closesAt: string | null,
  now = new Date()
) {
  return (
    closesAt !== null &&
    Date.parse(closesAt) > now.getTime()
  );
}

function getEditionWeekSegment(
  edition: RaceCalendarEdition,
  run: EditionHalfDayRun,
  weekStartHalfDayIndex: number,
  weekEndHalfDayIndex: number
): Omit<WeekRaceSegment, "lane"> | null {
  if (
    run.endHalfDayIndex < weekStartHalfDayIndex ||
    run.startHalfDayIndex > weekEndHalfDayIndex
  ) {
    return null;
  }

  const startHalfDayIndex = Math.max(
    run.startHalfDayIndex,
    weekStartHalfDayIndex
  );
  const endHalfDayIndex = Math.min(
    run.endHalfDayIndex,
    weekEndHalfDayIndex
  );

  return {
    edition,
    stages: run.stages.filter((stage) => {
      const halfDayIndex = getSeasonHalfDayIndex(
        stage.dayNumber,
        stage.daySlot
      );

      return (
        halfDayIndex >= startHalfDayIndex &&
        halfDayIndex <= endHalfDayIndex
      );
    }),
    startHalfDayIndex,
    endHalfDayIndex,
    startDay: Math.floor(startHalfDayIndex / 2) + 1,
    endDay: Math.floor(endHalfDayIndex / 2) + 1,
    startsBeforeWeek: run.startHalfDayIndex < weekStartHalfDayIndex,
    continuesAfterWeek: run.endHalfDayIndex > weekEndHalfDayIndex,
  };
}

function compareWeekSegments(
  first: Omit<WeekRaceSegment, "lane">,
  second: Omit<WeekRaceSegment, "lane">
) {
  if (first.startHalfDayIndex !== second.startHalfDayIndex) {
    return first.startHalfDayIndex - second.startHalfDayIndex;
  }

  const firstDuration =
    first.endHalfDayIndex - first.startHalfDayIndex;
  const secondDuration =
    second.endHalfDayIndex - second.startHalfDayIndex;

  if (firstDuration !== secondDuration) {
    return secondDuration - firstDuration;
  }

  return (
    first.edition.prestigeRank -
    second.edition.prestigeRank
  );
}

type EditionHalfDayRun = {
  stages: RaceCalendarStage[];
  startHalfDayIndex: number;
  endHalfDayIndex: number;
};

function getEditionHalfDayRuns(
  edition: RaceCalendarEdition
): EditionHalfDayRun[] {
  const orderedStages = [...edition.stages].sort(
    (first, second) =>
      getSeasonHalfDayIndex(first.dayNumber, first.daySlot) -
        getSeasonHalfDayIndex(second.dayNumber, second.daySlot) ||
      first.stageNumber - second.stageNumber
  );
  const runs: EditionHalfDayRun[] = [];

  for (const stage of orderedStages) {
    const halfDayIndex = getSeasonHalfDayIndex(
      stage.dayNumber,
      stage.daySlot
    );
    const currentRun = runs.at(-1);

    if (
      !currentRun ||
      halfDayIndex !== currentRun.endHalfDayIndex + 1
    ) {
      runs.push({
        stages: [stage],
        startHalfDayIndex: halfDayIndex,
        endHalfDayIndex: halfDayIndex,
      });
      continue;
    }

    currentRun.stages.push(stage);
    currentRun.endHalfDayIndex = halfDayIndex;
  }

  return runs;
}

function clampSeasonDay(dayNumber: number) {
  return Math.min(
    28,
    Math.max(1, Math.trunc(dayNumber))
  );
}
