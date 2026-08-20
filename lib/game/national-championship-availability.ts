import type {
  RaceCalendarEdition,
  SeasonRaceCalendar,
} from "@/lib/game/race-calendar";

export type NationalChampionshipUnavailableReason =
  | {
      kind: "injury";
    }
  | {
      kind: "race";
      raceEditionId: string;
      raceName: string;
    };

export type NationalChampionshipInjuryInterval = {
  riderId: string;
  startedAt: string;
  expectedRecoveryAt: string;
};

export type NationalChampionshipRaceEngagement = {
  riderId: string;
  raceEditionId: string;
};

const INJURY_START_GRACE_MS = 8 * 60 * 60 * 1_000;

export function getNationalChampionshipUnavailableReasons({
  riderId,
  targetEdition,
  calendar,
  injuries,
  raceEngagements,
}: {
  riderId: string;
  targetEdition: RaceCalendarEdition | undefined;
  calendar: Pick<SeasonRaceCalendar, "editions">;
  injuries: readonly NationalChampionshipInjuryInterval[];
  raceEngagements: readonly NationalChampionshipRaceEngagement[];
}): NationalChampionshipUnavailableReason[] {
  const departureAt = targetEdition?.stages[0]?.departureAt;
  if (!targetEdition || !departureAt) return [];

  const departureTime = new Date(departureAt).getTime();
  const reasons: NationalChampionshipUnavailableReason[] = [];
  const hasInjuryAtDeparture = injuries.some(
    (injury) =>
      injury.riderId === riderId &&
      new Date(injury.startedAt).getTime() <
        departureTime + INJURY_START_GRACE_MS &&
      new Date(injury.expectedRecoveryAt).getTime() > departureTime,
  );
  if (hasInjuryAtDeparture) reasons.push({ kind: "injury" });

  const editionById = new Map(
    calendar.editions.map((edition) => [edition.id, edition]),
  );
  const targetDays = new Set(
    targetEdition.stages.map((stage) => stage.dayNumber),
  );
  const seenEditionIds = new Set<string>();

  for (const engagement of raceEngagements) {
    if (
      engagement.riderId !== riderId ||
      engagement.raceEditionId === targetEdition.id ||
      seenEditionIds.has(engagement.raceEditionId)
    ) {
      continue;
    }

    const otherEdition = editionById.get(engagement.raceEditionId);
    if (!otherEdition) continue;
    const isCompatibleNationalChampionship =
      otherEdition.countryCode === targetEdition.countryCode &&
      (otherEdition.competitionType === "national_road" ||
        otherEdition.competitionType === "national_time_trial");
    if (isCompatibleNationalChampionship) continue;
    if (
      !otherEdition.stages.some((stage) => targetDays.has(stage.dayNumber))
    ) {
      continue;
    }

    seenEditionIds.add(otherEdition.id);
    reasons.push({
      kind: "race",
      raceEditionId: otherEdition.id,
      raceName: otherEdition.name,
    });
  }

  return reasons.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "injury" ? -1 : 1;
    if (left.kind === "injury" || right.kind === "injury") return 0;
    return left.raceName.localeCompare(right.raceName, "fr");
  });
}
