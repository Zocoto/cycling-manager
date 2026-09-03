import "server-only";

import type {
  RaceFormat,
  RaceProfileType,
} from "@/lib/game/race-calendar";
import type {
  RaceQuickPreview,
  RaceQuickPreviewStage,
} from "@/lib/game/race-quick-preview";
import {
  ensureCompleteRaceSegments,
  removeOneDayRaceMountainPrimes,
  resolveRaceProfileType,
} from "@/lib/game/race-profiles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SeasonRow = {
  id: string;
};

type RaceRow = {
  id: string;
  slug: string;
  race_format: RaceFormat;
};

type RaceEditionRow = {
  id: string;
  display_name: string;
};

type StageRow = {
  id: string;
  season_day_id: string;
  stage_number: number;
  name: string;
  profile_type: RaceProfileType;
  distance_km: number | string;
};

type SeasonDayRow = {
  id: string;
  day_number: number;
};

type StageSegmentPrimeRow = {
  prime_type: "mountain" | "intermediate_sprint";
  mountain_category: "HC" | "1" | "2" | "3" | "4" | null;
  points_scale: number[];
};

type StageSegmentRow = {
  stage_id: string;
  segment_number: number;
  distance_km: number | string;
  terrain_type: "flat" | "climb" | "descent";
  surface_type: "asphalt" | "cobbles";
  average_gradient_pct: number | string;
  stage_segment_primes: StageSegmentPrimeRow[] | null;
};

export async function getRaceQuickPreview(
  raceSlug: string,
  raceEditionId?: string | null,
): Promise<RaceQuickPreview | null> {
  const normalizedSlug = raceSlug.trim().toLowerCase();
  const normalizedEditionId = raceEditionId?.trim() || null;

  if (!normalizedSlug || normalizedSlug.length > 160) return null;
  if (
    normalizedEditionId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      normalizedEditionId,
    )
  ) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const raceResult = await supabase
    .from("races")
    .select("id, slug, race_format")
    .eq("slug", normalizedSlug)
    .maybeSingle<RaceRow>();

  assertQuerySucceeded(raceResult.error, "la course");

  if (!raceResult.data) return null;

  const race = raceResult.data;
  let editionQuery = supabase
    .from("race_editions")
    .select("id, display_name")
    .eq("race_id", race.id)
    .neq("status", "cancelled");

  if (normalizedEditionId) {
    editionQuery = editionQuery.eq("id", normalizedEditionId);
  } else {
    const seasonResult = await supabase
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle<SeasonRow>();

    assertQuerySucceeded(seasonResult.error, "la saison active");
    if (!seasonResult.data) return null;

    editionQuery = editionQuery.eq("season_id", seasonResult.data.id);
  }

  const editionResult = await editionQuery.maybeSingle<RaceEditionRow>();

  assertQuerySucceeded(editionResult.error, "l’édition de la course");

  if (!editionResult.data) return null;

  const edition = editionResult.data;

  const stagesResult = await supabase
    .from("stages")
    .select(
      "id, season_day_id, stage_number, name, profile_type, distance_km",
    )
    .eq("race_edition_id", edition.id)
    .neq("status", "cancelled")
    .order("stage_number", { ascending: true })
    .returns<StageRow[]>();

  assertQuerySucceeded(stagesResult.error, "les étapes");

  const stageRows = stagesResult.data ?? [];
  if (stageRows.length === 0) return null;

  const stageIds = stageRows.map((stage) => stage.id);
  const seasonDayIds = [
    ...new Set(stageRows.map((stage) => stage.season_day_id)),
  ];
  const [daysResult, segmentsResult] = await Promise.all([
    supabase
      .from("season_days")
      .select("id, day_number")
      .in("id", seasonDayIds)
      .returns<SeasonDayRow[]>(),
    supabase
      .from("stage_segments")
      .select(
        `
          stage_id,
          segment_number,
          distance_km,
          terrain_type,
          surface_type,
          average_gradient_pct,
          stage_segment_primes (
            prime_type,
            mountain_category,
            points_scale
          )
        `,
      )
      .in("stage_id", stageIds)
      .order("stage_id", { ascending: true })
      .order("segment_number", { ascending: true })
      .returns<StageSegmentRow[]>(),
  ]);

  assertQuerySucceeded(daysResult.error, "les journées des étapes");
  assertQuerySucceeded(segmentsResult.error, "les profils des étapes");

  const dayNumberById = new Map(
    (daysResult.data ?? []).map((day) => [day.id, day.day_number]),
  );
  const segmentRowsByStageId = new Map<string, StageSegmentRow[]>();

  for (const segment of segmentsResult.data ?? []) {
    const stageSegments = segmentRowsByStageId.get(segment.stage_id) ?? [];
    stageSegments.push(segment);
    segmentRowsByStageId.set(segment.stage_id, stageSegments);
  }

  const stages = stageRows.map((stage): RaceQuickPreviewStage => {
    const loadedSegments = (
      segmentRowsByStageId.get(stage.id) ?? []
    ).map((segment) => {
      const prime = segment.stage_segment_primes?.[0];

      return {
        segmentNumber: segment.segment_number,
        distanceKm: Number(segment.distance_km),
        terrain: segment.terrain_type,
        averageGradientPct: Number(segment.average_gradient_pct),
        surface: segment.surface_type,
        prime: prime
          ? {
              type: prime.prime_type,
              category: prime.mountain_category,
              pointsScale: prime.points_scale,
            }
          : null,
      };
    });
    const distanceKm = Number(stage.distance_km);
    const completeSegments = ensureCompleteRaceSegments({
      segments: loadedSegments,
      distanceKm,
      profileType: stage.profile_type,
      seed: stage.id,
      includeTourPrimes: loadedSegments.some(
        (segment) => segment.prime !== null,
      ),
    });
    const segments = removeOneDayRaceMountainPrimes(
      completeSegments,
      race.race_format,
    );

    return {
      id: stage.id,
      dayNumber:
        dayNumberById.get(stage.season_day_id) ?? stage.stage_number,
      stageNumber: stage.stage_number,
      name: stage.name,
      profileType: resolveRaceProfileType(
        stage.profile_type,
        segments,
      ),
      distanceKm,
      segments,
    };
  });

  return {
    id: edition.id,
    slug: race.slug,
    name: edition.display_name,
    raceFormat: race.race_format,
    stages,
  };
}

function assertQuerySucceeded(
  error: { message: string } | null,
  subject: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${subject} : ${error.message}`);
  }
}
