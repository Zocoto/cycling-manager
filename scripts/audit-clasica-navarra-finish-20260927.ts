/** Read-only audit of the official Clásica de Navarra finish. */
/* eslint-disable @typescript-eslint/no-explicit-any -- official simulation snapshots are JSON. */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import {
  getFinalBattleScenario,
  isMassGroupFinish,
} from "../lib/game/race-simulation";
import {
  getFinalApproachPosition,
  getFinishPassagePosition,
} from "../lib/game/race-finish-visual";

config({
  path: process.env.NAVARRA_AUDIT_ENV_FILE ?? "../cycling-manager/.env.local",
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

async function main() {
  const [race] = await rows(
    db
      .from("races")
      .select("id,name,slug,race_format")
      .eq("slug", "clasica-de-navarra"),
    "course",
  );
  if (!race) throw new Error("Clásica de Navarra introuvable");

  const [director] = await rows(
    db
      .from("sporting_directors")
      .select("id,username,display_name")
      .or("username.ilike.belgiansteph,display_name.ilike.belgiansteph"),
    "BelgianSteph",
  );
  if (!director) throw new Error("BelgianSteph introuvable");

  const assignments = await rows(
    db
      .from("team_manager_assignments")
      .select("team_id,status,created_at")
      .eq("sporting_director_id", director.id)
      .order("created_at", { ascending: false }),
    "équipes de BelgianSteph",
  );
  const managedTeamIds = new Set(
    assignments.map((assignment) => assignment.team_id),
  );

  const editions = await rows(
    db
      .from("race_editions")
      .select("id,season_id,display_name,status,created_at")
      .eq("race_id", race.id)
      .order("created_at", { ascending: false }),
    "éditions",
  );
  const seasons = await rows(
    db
      .from("seasons")
      .select("id,name,game_year,status")
      .in(
        "id",
        editions.map((edition) => edition.season_id),
      ),
    "saisons",
  );
  const activeSeason = seasons.find((season) => season.status === "active");
  const edition =
    editions.find((candidate) => candidate.season_id === activeSeason?.id) ??
    editions[0];
  if (!edition) throw new Error("Édition officielle introuvable");

  const [stage] = await rows(
    db
      .from("stages")
      .select("id,stage_number,name,status,stage_type,profile_type")
      .eq("race_edition_id", edition.id)
      .order("stage_number"),
    "étape",
  );
  if (!stage) throw new Error("Étape officielle introuvable");

  const [lock] = await rows(
    db
      .from("official_stage_simulations")
      .select("stage_id,engine_version,input_data,simulation_data,created_at")
      .eq("stage_id", stage.id),
    "simulation officielle",
  );
  if (!lock) throw new Error("Simulation officielle introuvable");

  const simulation = lock.simulation_data;
  const riders = new Map<string, any>(
    (simulation.resolvedRiders ?? lock.input_data.riders).map((rider: any) => [
      rider.id,
      rider,
    ]),
  );
  const results = [...simulation.results]
    .filter((result: any) => result.status === "finished")
    .sort((left: any, right: any) => left.rank - right.rank);
  const scenario = getFinalBattleScenario(simulation);
  const contenderSet = new Set(scenario.contenderIds);
  const maximumGap = Math.max(
    0,
    ...results
      .filter((result: any) => contenderSet.has(result.riderId))
      .map((result: any) => result.gapToWinnerSeconds),
  );

  const rosters = await rows(
    db
      .from("race_rosters")
      .select(
        "id,rider_id,race_registration_id,race_registrations!inner(race_edition_id,team_season_id)",
      )
      .eq("race_registrations.race_edition_id", edition.id),
    "startlist",
  );
  const rosterByRiderId = new Map(
    rosters.map((roster) => [roster.rider_id, roster]),
  );
  const riderIdByRosterId = new Map(
    rosters.map((roster) => [roster.id, roster.rider_id]),
  );
  const rosterIds = rosters.map((roster) => roster.id);
  const [stageRows, raceRows] = await Promise.all([
    rows(
      db
        .from("stage_results")
        .select("race_roster_id,status,rank,elapsed_time_ms,gap_to_winner_ms")
        .eq("stage_id", stage.id)
        .in("race_roster_id", rosterIds),
      "résultats d’étape",
    ),
    rows(
      db
        .from("race_results")
        .select("race_roster_id,status,final_rank,total_time_ms,gap_to_winner_ms")
        .eq("race_edition_id", edition.id)
        .in("race_roster_id", rosterIds),
      "résultats finaux",
    ),
  ]);
  const stageByRiderId = new Map(
    stageRows.map((row) => [riderIdByRosterId.get(row.race_roster_id), row]),
  );
  const raceByRiderId = new Map(
    raceRows.map((row) => [riderIdByRosterId.get(row.race_roster_id), row]),
  );

  const summarize = (result: any) => {
    const rider = riders.get(result.riderId);
    const roster = rosterByRiderId.get(result.riderId);
    const teamSeasonId = roster?.race_registrations?.team_season_id ?? null;
    const stageRow = stageByRiderId.get(result.riderId);
    const raceRow = raceByRiderId.get(result.riderId);
    const approach = getFinalApproachPosition({
      rank: result.rank,
      gapToWinnerSeconds: result.gapToWinnerSeconds,
      finishLinePosition: 86,
    });

    return {
      riderId: result.riderId,
      rider: rider?.name,
      team: rider?.teamName,
      managedByBelgianSteph: managedTeamIds.has(rider?.teamId),
      rank: result.rank,
      gapSeconds: result.gapToWinnerSeconds,
      elapsedSeconds: result.elapsedTimeSeconds,
      persistedStageRank: stageRow?.rank ?? null,
      persistedRaceRank: raceRow?.final_rank ?? null,
      teamSeasonId,
      visibleInFinal: contenderSet.has(result.riderId),
      visualPositions: contenderSet.has(result.riderId)
        ? {
            beforeLine: approach,
            passageStart: getFinishPassagePosition({
              approachPosition: approach,
              rank: result.rank,
              riderCount: scenario.contenderIds.length,
              gapToWinnerSeconds: result.gapToWinnerSeconds,
              maximumGapToWinnerSeconds: maximumGap,
              finishPassageProgress: 0,
              finishLinePosition: 86,
              winnerHasFinished: true,
            }),
            passageMid: getFinishPassagePosition({
              approachPosition: approach,
              rank: result.rank,
              riderCount: scenario.contenderIds.length,
              gapToWinnerSeconds: result.gapToWinnerSeconds,
              maximumGapToWinnerSeconds: maximumGap,
              finishPassageProgress: 0.5,
              finishLinePosition: 86,
              winnerHasFinished: true,
            }),
          }
        : null,
    };
  };

  console.log(
    JSON.stringify(
      {
        director,
        assignments,
        race,
        edition: {
          ...edition,
          season: seasons.find((season) => season.id === edition.season_id),
        },
        stage,
        engineVersion: lock.engine_version,
        isMassGroupFinish: isMassGroupFinish(simulation),
        finishScenario: {
          contenderCount: scenario.contenderIds.length,
          decisiveContenderCount: scenario.decisiveContenderIds.length,
          entryGroups: scenario.entryGroups.map((group) => ({
            label: group.label,
            gap: group.gapToLeaderSeconds,
            size: group.riderIds.length,
          })),
        },
        top10: results.slice(0, 10).map(summarize),
        belgianStephRiders: results
          .map(summarize)
          .filter((result) => result.managedByBelgianSteph),
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
