import type { RaceCalendarStage } from "./race-calendar";

export { getRaceRegistrationHref } from "./race-navigation";

export const LIVE_START_HOURS_PARIS = [14, 18] as const;
export const RACE_SIMULATION_DEMO_SLUG =
  "criterium-de-namur";

export type StageLiveState =
  | {
      status: "scheduled";
      startsAt: string | null;
      endsAt: string | null;
      durationMinutes: number;
      progress: 0;
    }
  | {
      status: "live";
      startsAt: string;
      endsAt: string;
      durationMinutes: number;
      progress: number;
    }
  | {
      status: "finished";
      startsAt: string | null;
      endsAt: string | null;
      durationMinutes: number;
      progress: 1;
    }
  | {
      status: "cancelled";
      startsAt: string | null;
      endsAt: string | null;
      durationMinutes: number;
      progress: 0;
    };

export function getEstimatedLiveDurationMinutes(distanceKm: number) {
  return Math.max(8, Math.min(48, Math.round(distanceKm / 6)));
}

export function getEstimatedStageFinishAt({
  departureAt,
  distanceKm,
}: {
  departureAt: string | null;
  distanceKm: number;
}) {
  if (!departureAt) return null;

  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  const departureTimestamp = new Date(departureAt).getTime();
  if (!Number.isFinite(departureTimestamp)) return null;

  const durationMs = getEstimatedLiveDurationMinutes(distanceKm) * 60_000;
  return new Date(departureTimestamp + durationMs).toISOString();
}

export function canSimulateRaceEdition({
  slug,
  engagedRiderCount,
}: {
  slug: string;
  engagedRiderCount: number;
}) {
  return (
    engagedRiderCount > 0 ||
    slug === RACE_SIMULATION_DEMO_SLUG
  );
}

export function getStageLiveState(
  stage: Pick<
    RaceCalendarStage,
    "departureAt" | "distanceKm" | "status"
  >,
  now = new Date()
): StageLiveState {
  const durationMinutes = getEstimatedLiveDurationMinutes(stage.distanceKm);

  if (stage.status === "cancelled") {
    return {
      status: "cancelled",
      startsAt: stage.departureAt,
      endsAt: null,
      durationMinutes,
      progress: 0,
    };
  }

  if (!stage.departureAt) {
    return stage.status === "completed"
      ? {
          status: "finished",
          startsAt: null,
          endsAt: null,
          durationMinutes,
          progress: 1,
        }
      : {
          status: "scheduled",
          startsAt: null,
          endsAt: null,
          durationMinutes,
          progress: 0,
        };
  }

  const startsAt = new Date(stage.departureAt);
  const estimatedFinishAt = getEstimatedStageFinishAt(stage);
  if (!estimatedFinishAt) {
    return stage.status === "completed"
      ? {
          status: "finished",
          startsAt: null,
          endsAt: null,
          durationMinutes,
          progress: 1,
        }
      : {
          status: "scheduled",
          startsAt: null,
          endsAt: null,
          durationMinutes,
          progress: 0,
        };
  }
  const endsAt = new Date(estimatedFinishAt);

  if (stage.status === "completed" || now >= endsAt) {
    return {
      status: "finished",
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      durationMinutes,
      progress: 1,
    };
  }

  if (stage.status === "in_progress" || now >= startsAt) {
    return {
      status: "live",
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      durationMinutes,
      progress: Math.max(
        0,
        Math.min(1, (now.getTime() - startsAt.getTime()) / (endsAt.getTime() - startsAt.getTime()))
      ),
    };
  }

  return {
    status: "scheduled",
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    durationMinutes,
    progress: 0,
  };
}

export function shouldHideRaceGaps(
  segmentNumber: number,
  totalSegmentCount: number
) {
  return totalSegmentCount > 0 && segmentNumber >= totalSegmentCount;
}

export function getRaceGroupLayoutDensity(groupCount: number) {
  return groupCount >= 4 ? "compact" : "comfortable";
}

export function getRaceResultsHref(
  raceSlug: string,
  stageNumber?: number,
) {
  if (Number.isInteger(stageNumber) && (stageNumber ?? 0) > 0) {
    return `/jeu/resultats/${encodeURIComponent(raceSlug)}/${stageNumber}`;
  }

  return `/jeu/resultats?course=${encodeURIComponent(raceSlug)}#course-live`;
}

export function getRaceExperienceAvailability(
  stages: RaceCalendarStage[],
  now = new Date()
): "live" | "replay" | null {
  const statuses = stages.map((stage) => getStageLiveState(stage, now).status);

  if (statuses.includes("live")) return "live";
  if (statuses.includes("finished")) return "replay";
  return null;
}

export function selectRaceStageForLiveAccess(
  stages: RaceCalendarStage[],
  now = new Date()
): RaceCalendarStage | null {
  const liveStage = stages.find(
    (stage) => getStageLiveState(stage, now).status === "live"
  );
  if (liveStage) return liveStage;

  const latestFinishedStage = [...stages]
    .reverse()
    .find((stage) => getStageLiveState(stage, now).status === "finished");

  return latestFinishedStage ?? stages[0] ?? null;
}
