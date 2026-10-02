/** Read-only replay of the Highlands input; never writes sporting data. */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { simulateRaceStage, type StageSimulationInput } from "../lib/game/race-simulation";

config({ path: "../cycling-manager/.env.local", quiet: true });
const guardedFetch: typeof fetch = (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET" && method !== "HEAD") throw new Error("Audit en lecture seule.");
  return fetch(input, init);
};
async function main() {
  // Production inputs stay outside the repository and are never published.
  const fixturePath = "../tmp/highlands-breakaway-local-20261002.json";
  const local = process.argv.includes("--local");
  const db = local ? null : createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: guardedFetch },
    },
  );
  const { data, error } = db
    ? await db.from("official_stage_simulations")
        .select("engine_version,input_data,simulation_data")
        .eq("stage_id", "b6c55c99-e109-4248-afd1-7d3c6b3faebb").single()
    : {
        data: {
          engine_version: "local-fixture",
          input_data: JSON.parse(readFileSync(fixturePath, "utf8")),
          simulation_data: { results: [] },
        },
        error: null,
      };
  if (error || !data) throw new Error(error?.message ?? "Simulation absente.");
  const input = structuredClone(data.input_data) as StageSimulationInput;
  for (const rider of input.riders) {
    for (const field of [
      "teamJersey", "avatarProfileKey", "avatarSeed", "nationalChampionships",
      "worldChampionships", "continentalChampionships", "activeNationalChampion",
      "activeWorldChampion", "activeContinentalChampion", "classificationJerseyVisual",
    ]) delete (rider as unknown as Record<string, unknown>)[field];
  }
  if (process.argv.includes("--fixture")) {
    writeFileSync(fixturePath, `${JSON.stringify(input)}\n`);
  }
  const simulation = simulateRaceStage(input);
  console.log(JSON.stringify({
    sourceEngine: data.engine_version,
    riders: simulation.resolvedRiders.length,
    snapshots: simulation.timeline
      .filter((snapshot) => snapshot.completedDistanceKm >= 60 && snapshot.completedDistanceKm <= 110)
      .map((snapshot) => ({
        km: snapshot.completedDistanceKm, commentary: snapshot.commentary,
        groups: snapshot.groups
          .filter((group) => group.type === "breakaway" || group.type === "peloton")
          .map((group) => ({
            type: group.type, size: group.riderIds.length,
            gap: group.gapToLeaderSeconds, energy: group.averageEnergy,
          })),
      })),
    sourceWinner: data.simulation_data.results
      .find((result: { rank: number }) => result.rank === 1)?.riderId,
    replayWinner: simulation.results.find((result) => result.rank === 1)?.riderId,
    gapFrames: simulation.visualTimeline
      ?.filter((frame) => frame.completedDistanceKm >= 78 && frame.completedDistanceKm <= 102)
      .map((frame) => ({
        km: frame.completedDistanceKm,
        gap: frame.groups.find((group) => group.type === "peloton")?.gapToLeaderSeconds,
        pressure: frame.frontDynamics?.chasePressure,
        relays: frame.frontDynamics?.activeRelayRiderIds.length,
      })),
  }, null, 2));
}
main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
