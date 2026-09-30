/**
 * Read-only audit of declared stage profiles against their detailed routes.
 *
 * The audit deliberately uses a stricter, bidirectional classifier than the
 * runtime safeguard: it can flag both an understated route (flat/hilly route
 * containing real mountain terrain) and an overstated one.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { resolveRaceProfileType } from "../lib/game/race-profiles";

config({
  path:
    process.env.STAGE_PROFILE_AUDIT_ENV_FILE ??
    "../cycling-manager/.env.local",
  quiet: true,
});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) throw new Error("Configuration Supabase absente");

const readOnlyFetch: typeof fetch = async (input, init) => {
  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();

  if (method !== "GET" && method !== "HEAD") {
    throw new Error(`Écriture interdite : ${method}`);
  }

  return fetch(input, init);
};

const db = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: { fetch: readOnlyFetch },
});

type Profile =
  | "flat"
  | "sprint"
  | "hilly"
  | "mountain"
  | "cobbles"
  | "time_trial";

type StageRow = {
  id: string;
  race_edition_id: string;
  stage_number: number;
  name: string;
  stage_type: string;
  profile_type: Profile;
  distance_km: number | string;
  status: string;
};

type SegmentRow = {
  stage_id: string;
  segment_number: number;
  distance_km: number | string;
  terrain_type: "flat" | "climb" | "descent";
  surface_type: "asphalt" | "cobbles";
  average_gradient_pct: number | string;
};

async function selectRows<T>(query: PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>, label: string): Promise<T[]> {
  const result = await query;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? [];
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function getClimbBlocks(segments: SegmentRow[]) {
  const blocks: Array<{ distanceKm: number; gradientPct: number; finishes: boolean }> = [];
  let distanceKm = 0;
  let weightedGradient = 0;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment.terrain_type === "climb") {
      const distance = Number(segment.distance_km);
      distanceKm += distance;
      weightedGradient += distance * Number(segment.average_gradient_pct);
    }

    const closesBlock =
      segment.terrain_type !== "climb" || index === segments.length - 1;
    if (!closesBlock || distanceKm <= 0) continue;

    blocks.push({
      distanceKm,
      gradientPct: weightedGradient / distanceKm,
      finishes:
        segment.terrain_type === "climb" && index === segments.length - 1,
    });
    distanceKm = 0;
    weightedGradient = 0;
  }

  return blocks;
}

function assess(stage: StageRow, segments: SegmentRow[]) {
  const distanceKm = Number(stage.distance_km);
  const segmentDistanceKm = segments.reduce(
    (total, segment) => total + Number(segment.distance_km),
    0,
  );
  const ascentM = segments.reduce(
    (total, segment) =>
      total +
      (segment.terrain_type === "climb"
        ? Number(segment.distance_km) *
          Number(segment.average_gradient_pct) *
          10
        : 0),
    0,
  );
  const cobbleDistanceKm = segments.reduce(
    (total, segment) =>
      total +
      (segment.surface_type === "cobbles" ? Number(segment.distance_km) : 0),
    0,
  );
  const climbs = getClimbBlocks(segments);
  const biggestClimb = climbs.reduce(
    (best, climb) =>
      climb.distanceKm * climb.gradientPct > best.distanceKm * best.gradientPct
        ? climb
        : best,
    { distanceKm: 0, gradientPct: 0, finishes: false },
  );
  const finishClimb = climbs.find((climb) => climb.finishes) ?? null;

  const runtimeProfile = resolveRaceProfileType(
    stage.profile_type,
    segments.map((segment) => ({
      segmentNumber: segment.segment_number,
      distanceKm: Number(segment.distance_km),
      terrain: segment.terrain_type,
      averageGradientPct: Number(segment.average_gradient_pct),
      surface: segment.surface_type,
      prime: null,
    })),
  );
  const hasMountainEvidence =
    ascentM >= 1_800 ||
    (biggestClimb.distanceKm >= 10 && biggestClimb.gradientPct >= 5.5) ||
    ((finishClimb?.distanceKm ?? 0) >= 8 &&
      (finishClimb?.gradientPct ?? 0) >= 6);

  return {
    runtimeProfile,
    hasMountainEvidence,
    distanceKm,
    segmentDistanceKm: Math.round(segmentDistanceKm * 10) / 10,
    ascentM: Math.round(ascentM),
    cobbleDistanceKm: Math.round(cobbleDistanceKm * 10) / 10,
    biggestClimb: `${Math.round(biggestClimb.distanceKm * 10) / 10} km @ ${Math.round(biggestClimb.gradientPct * 10) / 10}%`,
    finishClimb: finishClimb
      ? `${Math.round(finishClimb.distanceKm * 10) / 10} km @ ${Math.round(finishClimb.gradientPct * 10) / 10}%`
      : null,
  };
}

async function main() {
  const seasons = await selectRows<{
    id: string;
    name: string;
    game_year: number;
    status: "active" | "planned" | "completed";
  }>(
    db
      .from("seasons")
      .select("id,name,game_year,status")
      .in("status", ["active", "planned"])
      .order("game_year"),
    "saisons",
  );
  const editions = await selectRows<{
    id: string;
    season_id: string;
    display_name: string;
    races: Array<{ name: string; slug: string; race_format: string }>;
  }>(
    db
      .from("race_editions")
      .select("id,season_id,display_name,races(name,slug,race_format)")
      .in("season_id", seasons.map((season) => season.id)),
    "éditions",
  );
  const stages: StageRow[] = [];
  for (const editionIds of chunks(
    editions.map((edition) => edition.id),
    100,
  )) {
    stages.push(
      ...(await selectRows<StageRow>(
        db
          .from("stages")
          .select(
            "id,race_edition_id,stage_number,name,stage_type,profile_type,distance_km,status",
          )
          .in("race_edition_id", editionIds)
          .order("race_edition_id")
          .order("stage_number"),
        "étapes",
      )),
    );
  }

  const segments: SegmentRow[] = [];
  for (const stageIds of chunks(
    stages.map((stage) => stage.id),
    100,
  )) {
    segments.push(
      ...(await selectRows<SegmentRow>(
        db
          .from("stage_segments")
          .select(
            "stage_id,segment_number,distance_km,terrain_type,surface_type,average_gradient_pct",
          )
          .in("stage_id", stageIds)
          .order("stage_id")
          .order("segment_number"),
        "segments",
      )),
    );
  }

  const seasonById = new Map(seasons.map((season) => [season.id, season]));
  const editionById = new Map(editions.map((edition) => [edition.id, edition]));
  const segmentsByStageId = new Map<string, SegmentRow[]>();
  for (const segment of segments) {
    const grouped = segmentsByStageId.get(segment.stage_id) ?? [];
    grouped.push(segment);
    segmentsByStageId.set(segment.stage_id, grouped);
  }

  const audited = stages.map((stage) => {
    const edition = editionById.get(stage.race_edition_id);
    const race = edition?.races?.[0];
    const season = edition ? seasonById.get(edition.season_id) : null;
    const stageSegments = segmentsByStageId.get(stage.id) ?? [];
    return {
      season: season?.name ?? "?",
      seasonStatus: season?.status ?? "?",
      race: edition?.display_name ?? race?.name ?? "?",
      slug: race?.slug ?? "?",
      stageNumber: stage.stage_number,
      stageName: stage.name,
      stageStatus: stage.status,
      declaredProfile: stage.profile_type,
      segmentCount: stageSegments.length,
      ...(stageSegments.length > 0 ? assess(stage, stageSegments) : null),
    };
  });
  const withSegments = audited.filter((stage) => stage.segmentCount > 0);
  const routeLengthMismatches = withSegments.filter(
    (stage) =>
      Math.abs((stage.segmentDistanceKm ?? 0) - (stage.distanceKm ?? 0)) > 0.1,
  );
  const mismatches = withSegments.filter(
    (stage) => {
      if (
        Math.abs((stage.segmentDistanceKm ?? 0) - (stage.distanceKm ?? 0)) > 0.1
      ) {
        return false;
      }
      if (
        (stage.declaredProfile === "sprint" && stage.runtimeProfile === "flat") ||
        (stage.declaredProfile === "flat" && stage.runtimeProfile === "sprint")
      ) {
        return false;
      }
      return stage.declaredProfile !== stage.runtimeProfile;
    },
  );
  const suspiciousMountains = withSegments.filter(
    (stage) =>
      Math.abs((stage.segmentDistanceKm ?? 0) - (stage.distanceKm ?? 0)) <= 0.1 &&
      stage.declaredProfile === "mountain" &&
      stage.hasMountainEvidence === false,
  );

  console.log(
    JSON.stringify(
      {
        summary: {
          seasons: seasons.map(({ name, game_year, status }) => ({
            name,
            gameYear: game_year,
            status,
          })),
          stages: audited.length,
          stagesWithSegments: withSegments.length,
          stagesWithoutSegments: audited.length - withSegments.length,
          routeLengthMismatches: routeLengthMismatches.length,
          runtimeProfileCorrections: mismatches.length,
          suspiciousMountains: suspiciousMountains.length,
        },
        runtimeProfileCorrections: mismatches.map((stage) => ({
          season: stage.season,
          race: stage.race,
          slug: stage.slug,
          stage: stage.stageNumber,
          status: stage.stageStatus,
          declared: stage.declaredProfile,
          runtime: stage.runtimeProfile,
          ascentM: stage.ascentM,
          biggestClimb: stage.biggestClimb,
          finishClimb: stage.finishClimb,
        })),
        suspiciousMountains: suspiciousMountains.map((stage) => ({
          season: stage.season,
          race: stage.race,
          slug: stage.slug,
          stage: stage.stageNumber,
        })),
        plannedRouteLengthMismatches: routeLengthMismatches
          .filter((stage) => stage.stageStatus === "planned")
          .map((stage) => ({
            season: stage.season,
            race: stage.race,
            slug: stage.slug,
            stage: stage.stageNumber,
            distanceKm: stage.distanceKm,
            segmentDistanceKm: stage.segmentDistanceKm,
          })),
        ruta: audited
          .filter((stage) => stage.slug === "ruta-de-las-sierras")
          .map((stage) => ({
            season: stage.season,
            stage: stage.stageNumber,
            status: stage.stageStatus,
            declared: stage.declaredProfile,
            runtime: stage.runtimeProfile ?? stage.declaredProfile,
            distanceKm: stage.distanceKm,
            segmentDistanceKm: stage.segmentDistanceKm,
            ascentM: stage.ascentM ?? null,
            biggestClimb: stage.biggestClimb ?? null,
          })),
        sampleNationalRoadSegments: segments
          .filter((segment) => {
            const stage = stages.find((candidate) => candidate.id === segment.stage_id);
            const edition = stage ? editionById.get(stage.race_edition_id) : null;
            return edition?.races?.[0]?.slug === "cn-fr-route";
          })
          .map((segment) => ({
            number: segment.segment_number,
            distanceKm: Number(segment.distance_km),
            terrain: segment.terrain_type,
            gradientPct: Number(segment.average_gradient_pct),
          })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
