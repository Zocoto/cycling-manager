import "server-only";

import type {
  RiderRatingKey,
  RiderRatings,
} from "@/lib/game/rider-profile";
import {
  createProgressionValues,
  type RiderProgressionHistory,
  type RiderProgressionPoint,
  type RiderProgressionSeason,
} from "@/lib/game/rider-progression";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SeasonRow = {
  id: string;
  name: string;
  game_year: number;
  status: string;
  current_day_number: number | null;
};

type SeasonDayRow = {
  id: string;
  season_id: string;
  day_number: number;
};

type RatingRow = {
  rider_id: string;
  season_id: string;
  mountain: number;
  hills: number;
  flat: number;
  time_trial: number;
  cobbles: number;
  sprint: number;
  acceleration: number;
  downhill: number;
  endurance: number;
  resistance: number;
  recovery: number;
  breakaway: number;
  prologue: number;
};

type TrainingSessionRow = {
  rider_id: string;
  season_id: string;
  season_day_id: string;
  rating_changes: Record<string, number> | null;
};

type StatProgressRow = {
  rider_id: string;
  season_id: string;
  stat_code: string;
  initial_rating: number;
};

const DATABASE_STAT_TO_RATING_KEY = {
  mountain: "mountain",
  hills: "hills",
  flat: "flat",
  time_trial: "timeTrial",
  cobbles: "cobbles",
  sprint: "sprint",
  acceleration: "acceleration",
  downhill: "downhill",
  endurance: "endurance",
  resistance: "resistance",
  recovery: "recovery",
  breakaway: "breakaway",
  prologue: "prologue",
} as const satisfies Record<string, RiderRatingKey>;

const DATABASE_STAT_CODES = Object.keys(
  DATABASE_STAT_TO_RATING_KEY,
) as Array<keyof typeof DATABASE_STAT_TO_RATING_KEY>;

export async function getRiderProgressionHistories({
  riderIds,
  currentSeasonId,
  includePreviousSeasons = true,
}: {
  riderIds: readonly string[];
  currentSeasonId: string;
  includePreviousSeasons?: boolean;
}): Promise<RiderProgressionHistory[]> {
  const uniqueRiderIds = [...new Set(riderIds)];
  if (uniqueRiderIds.length === 0) return [];

  const admin = createSupabaseAdminClient();
  let seasonsQuery = admin
    .from("seasons")
    .select("id, name, game_year, status, current_day_number")
    .in("status", ["active", "completed"])
    .order("game_year", { ascending: false });

  if (!includePreviousSeasons) {
    seasonsQuery = seasonsQuery.eq("id", currentSeasonId);
  }

  const seasonsResult = await seasonsQuery.returns<SeasonRow[]>();
  assertQuery(seasonsResult.error, "les saisons de progression");

  const seasons = seasonsResult.data ?? [];
  const seasonIds = seasons.map((season) => season.id);
  if (seasonIds.length === 0) {
    return uniqueRiderIds.map((riderId) => ({ riderId, seasons: [] }));
  }

  const [daysResult, ratingsResult, sessionsResult, progressResult] =
    await Promise.all([
      admin
        .from("season_days")
        .select("id, season_id, day_number")
        .in("season_id", seasonIds)
        .returns<SeasonDayRow[]>(),
      admin
        .from("rider_season_ratings")
        .select(
          "rider_id, season_id, mountain, hills, flat, time_trial, cobbles, sprint, acceleration, downhill, endurance, resistance, recovery, breakaway, prologue",
        )
        .in("rider_id", uniqueRiderIds)
        .in("season_id", seasonIds)
        .returns<RatingRow[]>(),
      admin
        .from("rider_training_sessions")
        .select("rider_id, season_id, season_day_id, rating_changes")
        .in("rider_id", uniqueRiderIds)
        .in("season_id", seasonIds)
        .returns<TrainingSessionRow[]>(),
      admin
        .from("rider_training_stat_progress")
        .select("rider_id, season_id, stat_code, initial_rating")
        .in("rider_id", uniqueRiderIds)
        .in("season_id", seasonIds)
        .returns<StatProgressRow[]>(),
    ]);

  assertQuery(daysResult.error, "les journées de progression");
  assertQuery(ratingsResult.error, "les notes de progression");
  assertQuery(sessionsResult.error, "l’historique quotidien de progression");
  assertQuery(progressResult.error, "les notes initiales de progression");

  const dayNumberById = new Map(
    (daysResult.data ?? []).map((day) => [day.id, day.day_number]),
  );
  const ratingsByRiderSeason = groupByCompositeKey(
    ratingsResult.data ?? [],
    (rating) => rating.rider_id,
    (rating) => rating.season_id,
  );
  const sessionsByRiderSeason = groupByCompositeKey(
    sessionsResult.data ?? [],
    (session) => session.rider_id,
    (session) => session.season_id,
  );
  const progressByRiderSeason = groupByCompositeKey(
    progressResult.data ?? [],
    (progress) => progress.rider_id,
    (progress) => progress.season_id,
  );

  return uniqueRiderIds.map((riderId) => ({
    riderId,
    seasons: seasons.flatMap((season) => {
      const rating = ratingsByRiderSeason.get(compositeKey(riderId, season.id))?.[0];
      if (!rating) return [];

      const progressionSeason = buildProgressionSeason({
        season,
        currentSeasonId,
        rating,
        sessions:
          sessionsByRiderSeason.get(compositeKey(riderId, season.id)) ?? [],
        statProgress:
          progressByRiderSeason.get(compositeKey(riderId, season.id)) ?? [],
        dayNumberById,
      });

      return [progressionSeason];
    }),
  }));
}

function buildProgressionSeason({
  season,
  currentSeasonId,
  rating,
  sessions,
  statProgress,
  dayNumberById,
}: {
  season: SeasonRow;
  currentSeasonId: string;
  rating: RatingRow;
  sessions: TrainingSessionRow[];
  statProgress: StatProgressRow[];
  dayNumberById: ReadonlyMap<string, number>;
}): RiderProgressionSeason {
  const finalRatings = toRiderRatings(rating);
  const totalChanges = sumRatingChanges(sessions);
  const initialByStatCode = new Map(
    statProgress.map((progress) => [
      progress.stat_code,
      Number(progress.initial_rating),
    ]),
  );
  const runningRatings = { ...finalRatings };

  for (const statCode of DATABASE_STAT_CODES) {
    const ratingKey = DATABASE_STAT_TO_RATING_KEY[statCode];
    runningRatings[ratingKey] =
      initialByStatCode.get(statCode) ??
      finalRatings[ratingKey] - (totalChanges[ratingKey] ?? 0);
  }

  const points: RiderProgressionPoint[] = [
    {
      dayNumber: 0,
      values: createProgressionValues(runningRatings),
    },
  ];
  const orderedSessions = [...sessions].sort(
    (left, right) =>
      (dayNumberById.get(left.season_day_id) ?? 0) -
      (dayNumberById.get(right.season_day_id) ?? 0),
  );

  for (const session of orderedSessions) {
    applyRatingChanges(runningRatings, session.rating_changes);
    points.push({
      dayNumber: dayNumberById.get(session.season_day_id) ?? 1,
      values: createProgressionValues(runningRatings),
    });
  }

  const finalDayNumber =
    season.id === currentSeasonId
      ? Math.max(1, season.current_day_number ?? 1)
      : 28;
  const lastPoint = points.at(-1);
  if (
    !lastPoint ||
    lastPoint.dayNumber < finalDayNumber ||
    !sameRatings(runningRatings, finalRatings)
  ) {
    points.push({
      dayNumber: finalDayNumber,
      values: createProgressionValues(finalRatings),
    });
  }

  return {
    seasonId: season.id,
    seasonName: season.name,
    gameYear: season.game_year,
    isCurrent: season.id === currentSeasonId,
    points: deduplicateDayPoints(points),
  };
}

function toRiderRatings(row: RatingRow): RiderRatings {
  return {
    mountain: Number(row.mountain),
    hills: Number(row.hills),
    flat: Number(row.flat),
    timeTrial: Number(row.time_trial),
    cobbles: Number(row.cobbles),
    sprint: Number(row.sprint),
    acceleration: Number(row.acceleration),
    downhill: Number(row.downhill),
    endurance: Number(row.endurance),
    resistance: Number(row.resistance),
    recovery: Number(row.recovery),
    breakaway: Number(row.breakaway),
    prologue: Number(row.prologue),
  };
}

function sumRatingChanges(
  sessions: readonly TrainingSessionRow[],
): Partial<Record<RiderRatingKey, number>> {
  const totals: Partial<Record<RiderRatingKey, number>> = {};

  for (const session of sessions) {
    for (const [statCode, rawChange] of Object.entries(
      session.rating_changes ?? {},
    )) {
      const ratingKey =
        DATABASE_STAT_TO_RATING_KEY[
          statCode as keyof typeof DATABASE_STAT_TO_RATING_KEY
        ];
      if (!ratingKey) continue;
      totals[ratingKey] = (totals[ratingKey] ?? 0) + Number(rawChange);
    }
  }

  return totals;
}

function applyRatingChanges(
  ratings: RiderRatings,
  changes: Record<string, number> | null,
): void {
  for (const [statCode, rawChange] of Object.entries(changes ?? {})) {
    const ratingKey =
      DATABASE_STAT_TO_RATING_KEY[
        statCode as keyof typeof DATABASE_STAT_TO_RATING_KEY
      ];
    if (!ratingKey) continue;
    ratings[ratingKey] = Math.max(
      0,
      Math.min(100, ratings[ratingKey] + Number(rawChange)),
    );
  }
}

function sameRatings(left: RiderRatings, right: RiderRatings): boolean {
  return DATABASE_STAT_CODES.every((statCode) => {
    const key = DATABASE_STAT_TO_RATING_KEY[statCode];
    return left[key] === right[key];
  });
}

function deduplicateDayPoints(
  points: readonly RiderProgressionPoint[],
): RiderProgressionPoint[] {
  const byDay = new Map<number, RiderProgressionPoint>();
  for (const point of points) {
    byDay.set(point.dayNumber, point);
  }
  return [...byDay.values()].sort(
    (left, right) => left.dayNumber - right.dayNumber,
  );
}

function groupByCompositeKey<T>(
  rows: readonly T[],
  getFirst: (row: T) => string,
  getSecond: (row: T) => string,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const key = compositeKey(getFirst(row), getSecond(row));
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return grouped;
}

function compositeKey(first: string, second: string): string {
  return `${first}:${second}`;
}

function assertQuery(
  error: { message: string } | null,
  label: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${label} : ${error.message}`);
  }
}
