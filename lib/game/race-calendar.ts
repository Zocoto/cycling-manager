import type { RaceStageSegment } from "./race-profiles";
import type { RiderSimulationInput } from "./race-simulation";

export const RACE_CATEGORY_CODES = [
  "elite",
  "world",
  "continental",
  "national",
] as const;

export type RaceCategoryCode =
  (typeof RACE_CATEGORY_CODES)[number];

export type RaceFormat =
  | "one_day"
  | "stage_race";

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
  departureAt: string | null;
  segments: RaceStageSegment[];
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
      const rawSegments = editions
        .map((edition) =>
          getEditionWeekSegment(
            edition,
            startDay,
            endDay
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
      const laneEndDays: number[] = [];

      const segments = rawSegments.map(
        (segment) => {
          const availableLane =
            laneEndDays.findIndex(
              (laneEndDay) =>
                laneEndDay < segment.startDay
            );
          const lane =
            availableLane === -1
              ? laneEndDays.length
              : availableLane;

          laneEndDays[lane] = segment.endDay;

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
        segments,
        laneCount: laneEndDays.length,
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
  weekStartDay: number,
  weekEndDay: number
): Omit<WeekRaceSegment, "lane"> | null {
  if (edition.stages.length === 0) {
    return null;
  }

  const { startDay, endDay } =
    getEditionDayRange(edition);

  if (
    endDay < weekStartDay ||
    startDay > weekEndDay
  ) {
    return null;
  }

  return {
    edition,
    startDay: Math.max(startDay, weekStartDay),
    endDay: Math.min(endDay, weekEndDay),
    startsBeforeWeek: startDay < weekStartDay,
    continuesAfterWeek: endDay > weekEndDay,
  };
}

function compareWeekSegments(
  first: Omit<WeekRaceSegment, "lane">,
  second: Omit<WeekRaceSegment, "lane">
) {
  if (first.startDay !== second.startDay) {
    return first.startDay - second.startDay;
  }

  const firstDuration =
    first.endDay - first.startDay;
  const secondDuration =
    second.endDay - second.startDay;

  if (firstDuration !== secondDuration) {
    return secondDuration - firstDuration;
  }

  return (
    first.edition.prestigeRank -
    second.edition.prestigeRank
  );
}

function clampSeasonDay(dayNumber: number) {
  return Math.min(
    28,
    Math.max(1, Math.trunc(dayNumber))
  );
}
