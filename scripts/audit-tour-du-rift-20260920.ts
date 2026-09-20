/** Read-only sporting audit of the current Tour du Rift. */
/* eslint-disable @typescript-eslint/no-explicit-any -- production snapshots are schemaless JSON. */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import {
  buildOfficialStageRaceStandings,
  normalizeOfficialStageResultRanks,
} from "../lib/game/official-race-simulation";
import { simulateRaceStage } from "../lib/game/race-simulation";

config({
  path:
    process.env.RIFT_AUDIT_ENV_FILE ?? "../cycling-manager/.env.local",
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

async function rows(query: PromiseLike<any>, label: string): Promise<any[]> {
  const result = await query;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? [];
}

function riderProfile(rider: any) {
  if (!rider) return null;
  return {
    id: rider.id,
    name: rider.name,
    team: rider.teamName,
    role: rider.role,
    MON: rider.ratings.mountain,
    VAL: rider.ratings.hills,
    PLA: rider.ratings.flat,
    CLM: rider.ratings.timeTrial,
    SPR: rider.ratings.sprint,
    ACC: rider.ratings.acceleration,
    END: rider.ratings.endurance,
    RES: rider.ratings.resistance,
    form: rider.form,
  };
}

async function main() {
  const [race] = await rows(
    db.from("races").select("id,name,slug").eq("slug", "tour-du-rift"),
    "course",
  );
  if (!race) throw new Error("Tour du Rift introuvable");

  const editions = await rows(
    db
      .from("race_editions")
      .select("id,season_id,edition_number,status,display_name,created_at")
      .eq("race_id", race.id)
      .order("created_at", { ascending: false }),
    "éditions",
  );
  const seasons = await rows(
    db
      .from("seasons")
      .select("id,name,game_year,status,starts_on,ends_on,current_day_number")
      .in(
        "id",
        editions.map((candidate) => candidate.season_id),
      ),
    "saisons",
  );
  const seasonById = new Map(seasons.map((season) => [season.id, season]));
  const activeSeason = seasons.find((season) => season.status === "active");
  const edition =
    editions.find((candidate) => candidate.season_id === activeSeason?.id) ??
    editions[0];
  if (!edition) throw new Error("Édition du Tour du Rift introuvable");

  const stages = await rows(
    db
      .from("stages")
      .select(
        "id,stage_number,name,stage_type,profile_type,distance_km,status,departure_at,season_day_id,day_slot",
      )
      .eq("race_edition_id", edition.id)
      .order("stage_number"),
    "étapes",
  );
  const stageIds = stages.map((stage) => stage.id);
  const segments = await rows(
    db
      .from("stage_segments")
      .select(
        "stage_id,segment_number,distance_km,terrain_type,surface_type,average_gradient_pct",
      )
      .in("stage_id", stageIds)
      .order("stage_id")
      .order("segment_number"),
    "segments",
  );
  const locks = await rows(
    db
      .from("official_stage_simulations")
      .select("stage_id,engine_version,input_data,simulation_data")
      .in("stage_id", stageIds),
    "simulations",
  );
  const lockByStageId = new Map(locks.map((lock) => [lock.stage_id, lock]));
  const completedStages = stages.filter((stage) => lockByStageId.has(stage.id));
  const lockedRuns = completedStages.map((stage) => ({
    stage: {
      id: stage.id,
      stageType: stage.stage_type,
    },
    simulation: lockByStageId.get(stage.id).simulation_data,
  }));
  const replayRuns = completedStages.map((stage) => {
    const lock = lockByStageId.get(stage.id);
    return {
      stage: {
        id: stage.id,
        stageType: stage.stage_type,
      },
      simulation: normalizeOfficialStageResultRanks(
        simulateRaceStage(lock.input_data),
      ),
    };
  });
  const referenceRiders = new Map<string, any>(
    locks.flatMap((lock) =>
      (lock.input_data?.riders ?? []).map(
        (rider: any) => [rider.id, rider] as const,
      ),
    ),
  );
  const buildGeneral = (runs: typeof lockedRuns) => {
    const standings = buildOfficialStageRaceStandings(runs as any);
    const winnerTime = standings.general[0]?.elapsedTimeSeconds ?? 0;
    return standings.general.map((result, index) => ({
      rank: index + 1,
      gapSeconds: result.elapsedTimeSeconds - winnerTime,
      ...riderProfile(referenceRiders.get(result.riderId)),
    }));
  };
  const lockedGeneral = buildGeneral(lockedRuns);
  const replayGeneral = buildGeneral(replayRuns);
  const isVashadze = (entry: any) =>
    entry?.name?.toLocaleLowerCase("fr").includes("vashadze");

  const report = stages.map((stage) => {
    const stageSegments = segments.filter(
      (segment) => segment.stage_id === stage.id,
    );
    const lock = lockByStageId.get(stage.id);
    const riders = new Map<string, any>(
      (lock?.simulation_data?.resolvedRiders ?? lock?.input_data?.riders ?? []).map(
        (rider: any) => [rider.id, rider] as const,
      ),
    );
    const results = lock?.simulation_data?.results ?? [];
    const replay = replayRuns.find((run) => run.stage.id === stage.id)?.simulation;
    const replayRiders = new Map<string, any>(
      (replay?.resolvedRiders ?? []).map(
        (rider: any) => [rider.id, rider] as const,
      ),
    );
    const buildTop = (stageResults: any[], stageRiders: Map<string, any>) =>
      [...stageResults]
        .filter((result: any) => result.status === "finished")
        .sort(
          (left: any, right: any) =>
            left.elapsedTimeSeconds - right.elapsedTimeSeconds ||
            (left.rank ?? 999) - (right.rank ?? 999),
        )
        .slice(0, 15)
        .map((result: any) => ({
          rank: result.rank,
          gapSeconds: result.gapToWinnerSeconds,
          energyAfter: result.energyAfter,
          ...riderProfile(stageRiders.get(result.riderId)),
        }));
    const buildNamedResult = (
      stageResults: any[],
      stageRiders: Map<string, any>,
      namePart: string,
    ) => {
      const rider = [...stageRiders.values()].find((candidate) =>
        candidate.name.toLocaleLowerCase("fr").includes(namePart),
      );
      const result = stageResults.find(
        (candidate: any) => candidate.riderId === rider?.id,
      );
      return result && rider
        ? {
            rank: result.rank,
            gapSeconds: result.gapToWinnerSeconds,
            energyAfter: result.energyAfter,
            ...riderProfile(rider),
          }
        : null;
    };
    const summarizeTimeline = (simulation: any) =>
      (simulation?.timeline ?? []).slice(-6).map((snapshot: any) => ({
        segment: snapshot.segmentNumber,
        distanceKm: snapshot.completedDistanceKm,
        groups: snapshot.groups.map((group: any) => ({
          type: group.type,
          size: group.riderIds.length,
          gap: group.gapToLeaderSeconds,
          containsVashadze: group.riderIds.some((riderId: string) =>
            isVashadze(riderProfile(
              riders.get(riderId) ?? replayRiders.get(riderId),
            )),
          ),
        })),
      }));
    return {
      stage: {
        number: stage.stage_number,
        name: stage.name,
        type: stage.stage_type,
        profile: stage.profile_type,
        distanceKm: stage.distance_km,
        status: stage.status,
        departureAt: stage.departure_at,
        seasonDayId: stage.season_day_id,
        daySlot: stage.day_slot,
        engine: lock?.engine_version ?? null,
      },
      terrain: {
        counts: Object.fromEntries(
          ["flat", "climb", "descent"].map((terrain) => [
            terrain,
            stageSegments.filter(
              (segment) => segment.terrain_type === terrain,
            ).length,
          ]),
        ),
        finish: stageSegments.slice(-5).map((segment) => ({
          number: segment.segment_number,
          distanceKm: segment.distance_km,
          terrain: segment.terrain_type,
          gradient: segment.average_gradient_pct,
        })),
      },
      top:
        results.length > 0
          ? buildTop(results, riders)
          : [],
      replayTop: replay ? buildTop(replay.results, replayRiders) : [],
      named: {
        lockedJohnsen: buildNamedResult(results, riders, "johnsen"),
        replayJohnsen: replay
          ? buildNamedResult(replay.results, replayRiders, "johnsen")
          : null,
      },
      timeline: {
        locked: summarizeTimeline(lock?.simulation_data),
        replay: summarizeTimeline(replay),
      },
    };
  });

  const fullReport = {
        race,
        edition,
        editions: editions.map((candidate) => ({
          ...candidate,
          season: seasonById.get(candidate.season_id) ?? null,
        })),
        general: {
          lockedTop20: lockedGeneral.slice(0, 20),
          lockedVashadze: lockedGeneral.find(isVashadze) ?? null,
          replayTop20: replayGeneral.slice(0, 20),
          replayVashadze: replayGeneral.find(isVashadze) ?? null,
        },
        stages: report,
      };
  const summarizeEntry = (entry: any) => ({
    rank: entry.rank,
    gapSeconds: entry.gapSeconds,
    name: entry.name,
    team: entry.team,
    MON: entry.MON,
    VAL: entry.VAL,
    CLM: entry.CLM,
    form: entry.form,
    role: entry.role,
    energyAfter: entry.energyAfter,
  });
  const compactReport = {
    race: race.name,
    edition: edition.edition_number,
    lockedGeneral: lockedGeneral.slice(0, 10).map(summarizeEntry),
    lockedVashadze: summarizeEntry(lockedGeneral.find(isVashadze)),
    replayGeneral: replayGeneral.slice(0, 10).map(summarizeEntry),
    replayVashadze: summarizeEntry(replayGeneral.find(isVashadze)),
    stages: report
      .filter(
        (stage) =>
          !process.env.RIFT_AUDIT_STAGE ||
          stage.stage.number === Number(process.env.RIFT_AUDIT_STAGE),
      )
      .map((stage) => ({
      stage: stage.stage,
      finish: stage.terrain.finish,
      lockedTop: stage.top.slice(0, 12).map(summarizeEntry),
      replayTop: stage.replayTop.slice(0, 12).map(summarizeEntry),
      lockedVashadze: stage.top.find(isVashadze)
        ? summarizeEntry(stage.top.find(isVashadze))
        : null,
      replayVashadze: stage.replayTop.find(isVashadze)
        ? summarizeEntry(stage.replayTop.find(isVashadze))
        : null,
      timeline: stage.timeline,
      named: stage.named,
    })),
  };

  console.log(
    JSON.stringify(
      process.env.RIFT_AUDIT_VERBOSE === "1" ? fullReport : compactReport,
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
