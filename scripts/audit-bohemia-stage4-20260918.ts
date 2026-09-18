/** Read-only comparison of the locked Bohême final stage with the corrected engine. */
/* eslint-disable @typescript-eslint/no-explicit-any -- Historical JSON is checked against database rows below. */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import {
  buildOfficialStageRaceStandings,
  normalizeOfficialStageResultRanks,
} from "../lib/game/official-race-simulation";
import { simulateRaceStage } from "../lib/game/race-simulation";
import { getStageAttackParticipants } from "../lib/game/race-simulation";
import { calculateRaceRewardBreakdown, calculateStageReward } from "../lib/game/economy";

config({ path: process.env.BOHEMIA_REPAIR_ENV_FILE ?? "../cycling-manager/.env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Configuration Supabase absente");
const readOnlyFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET" && method !== "HEAD") throw new Error(`Écriture interdite : ${method}`);
  return fetch(input, init);
};
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: readOnlyFetch },
});
async function rows(query: PromiseLike<any>, label: string): Promise<any[]> {
  const result = await query;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? [];
}
const editionId = "cb59a394-1463-4f10-91a2-6a73dbd74a42";
const stageId = "0ea120e6-9fd0-437d-b0d1-d5c98736f76a";

async function main() {
  const stages = await rows(db.from("stages")
    .select("id,stage_number,stage_type,status")
    .eq("race_edition_id", editionId).order("stage_number"), "étapes");
  if (stages.length !== 4 || stages[3]?.id !== stageId ||
      stages.some((stage) => stage.status !== "completed")) {
    throw new Error("Édition ou étapes inattendues");
  }
  const locks = await rows(db.from("official_stage_simulations")
    .select("stage_id,engine_version,input_data,simulation_data")
    .in("stage_id", stages.map((stage) => stage.id)), "simulations verrouillées");
  if (locks.length !== 4) throw new Error("Simulations officielles incomplètes");
  const byStageId = new Map(locks.map((lock) => [lock.stage_id, lock]));
  const old = byStageId.get(stageId);
  if (!old || old.engine_version !== "2026.09-observed-finish-times-v29") {
    throw new Error("Version de simulation inattendue");
  }
  const corrected = normalizeOfficialStageResultRanks(simulateRaceStage(old.input_data));
  const riderById = new Map<string, any>(old.input_data.riders.map((rider: any) => [rider.id, rider]));
  const oldResults = new Map<string, any>(old.simulation_data.results.map((result: any) => [result.riderId, result]));
  const stageChanges = corrected.results.flatMap((result: any) => {
    const before: any = oldResults.get(result.riderId);
    const rider: any = riderById.get(result.riderId);
    if (!before || !rider) throw new Error("Coureur absent du verrou");
    if (before.rank === result.rank && before.elapsedTimeSeconds === result.elapsedTimeSeconds &&
        before.gapToWinnerSeconds === result.gapToWinnerSeconds && before.status === result.status) return [];
    return [{ riderId: result.riderId, name: rider.name, team: rider.teamName,
      rank: [before.rank, result.rank], gapSeconds: [before.gapToWinnerSeconds, result.gapToWinnerSeconds],
      timeSeconds: [before.elapsedTimeSeconds, result.elapsedTimeSeconds], status: [before.status, result.status] }];
  });
  const oldRuns = stages.map((stage) => ({ stage: { id: stage.id, stageType: stage.stage_type },
    simulation: byStageId.get(stage.id).simulation_data }));
  const newRuns = oldRuns.map((run) => run.stage.id === stageId ? { ...run, simulation: corrected } : run);
  const before = buildOfficialStageRaceStandings(oldRuns as any);
  const after = buildOfficialStageRaceStandings(newRuns as any);
  const reportStandings = (type: "general" | "youth" | "teams") => {
    const oldStanding = before[type] as any[];
    const newStanding = after[type] as any[];
    const key = type === "teams" ? "teamId" : "riderId";
    const previous = new Map(oldStanding.map((entry, index) => [entry[key], { ...entry, rank: index + 1 }]));
     return newStanding.flatMap<any>((entry, index) => {
      const oldEntry: any = previous.get(entry[key]);
      if (!oldEntry) return [{ id: entry[key], status: "added" }];
      if (oldEntry.rank === index + 1 && oldEntry.elapsedTimeSeconds === entry.elapsedTimeSeconds &&
          oldEntry.points === entry.points) return [];
      return [{ id: entry[key], name: type === "teams" ? entry.teamName : (riderById.get(entry[key]) as any)?.name,
        rank: [oldEntry.rank, index + 1], seconds: [oldEntry.elapsedTimeSeconds, entry.elapsedTimeSeconds],
        points: [oldEntry.points, entry.points] }];
    });
  };
  const registrations = await rows(db.from("race_registrations")
    .select("id,team_season_id,historical_team_name")
    .eq("race_edition_id", editionId), "inscriptions");
  const rosters = await rows(db.from("race_rosters")
    .select("id,rider_id,race_registration_id,race_registrations!inner(race_edition_id)")
    .eq("race_registrations.race_edition_id", editionId), "startlist");
  const stageResults = await rows(db.from("stage_results")
    .select("race_roster_id,status,rank,elapsed_time_ms,gap_to_winner_ms")
    .eq("stage_id", stageId), "résultats d'étape");
  const raceResults = await rows(db.from("race_results")
    .select("race_roster_id,status,final_rank,total_time_ms,gap_to_winner_ms")
    .eq("race_edition_id", editionId), "général persisté");
  const secondary = await rows(db.from("race_secondary_results")
    .select("classification_type,race_roster_id,team_season_id,rank,total_time_ms,points")
    .eq("race_edition_id", editionId), "classements annexes");
  const rewards = await rows(db.from("reward_events")
    .select("source_reference,rider_id,team_season_id,cash_prize,uci_points,reputation_points,experience_points")
    .or(`source_reference.like.official-stage-%:${editionId}:stage:${stageId}:%,source_reference.like.official-race:${editionId}:%`), "récompenses");
  const persistedAttackers = await rows(db.from("stage_attack_participants")
    .select("race_roster_id,participation_type,first_segment_number")
    .eq("stage_id", stageId), "attaquants enregistrés");
  const affectedTeamId = "27948dd4-0dac-416d-8f6c-118771bcb6eb";
  const previousWinner = (riderById.get(old.simulation_data.results[0].riderId) as any)?.name;
  const correctedWinner = (riderById.get(corrected.results[0].riderId) as any)?.name;
  const oldPrimes = old.simulation_data.primes.map((prime: any) => ({
    segment: prime.segmentNumber,
    type: prime.prime.type,
    podium: prime.classification.slice(0, 3).map((entry: any) => entry.riderId),
  }));
  const newPrimes = corrected.primes.map((prime) => ({
    segment: prime.segmentNumber,
    type: prime.prime.type,
    podium: prime.classification.slice(0, 3).map((entry) => entry.riderId),
  }));
  const rewardFor = (runs: any[], standings: any, riderId: string, rank: number) => {
    const classifications: string[] = [];
    for (const type of ["mountain", "sprint", "youth"] as const) {
      if (standings[type][0]?.riderId === riderId) classifications.push(type);
    }
    const teamWinnerRider = standings.general.find((entry: any) =>
      riderById.get(entry.riderId)?.teamId === standings.teams[0]?.teamId);
    if (teamWinnerRider?.riderId === riderId) classifications.push("team");
    const primeWins = (type: string) => runs.reduce((count, run) => count +
      run.simulation.primes.filter((prime: any) =>
        prime.prime.type === type && prime.classification[0]?.riderId === riderId).length, 0);
    return calculateRaceRewardBreakdown({ tier: "national", scope: "tour", finalRank: rank,
      secondaryClassifications: classifications as any,
      mountainPrimesWon: primeWins("mountain"),
      intermediateSprintsWon: primeWins("intermediate_sprint") }).total;
  };
  const rewardChanges = after.general.flatMap((entry: any, index) => {
    const oldRank = before.general.findIndex((oldEntry) => oldEntry.riderId === entry.riderId) + 1;
    const oldReward = rewardFor(oldRuns, before, entry.riderId, oldRank);
    const newReward = rewardFor(newRuns, after, entry.riderId, index + 1);
    const oldStageRank = oldResults.get(entry.riderId)?.rank;
    const newStageRank = corrected.results.find((result) => result.riderId === entry.riderId)?.rank;
    const oldStageReward = calculateStageReward({ tier: "national", finalRank: oldStageRank ?? 0 });
    const newStageReward = calculateStageReward({ tier: "national", finalRank: newStageRank ?? 0 });
    if (JSON.stringify(oldReward) === JSON.stringify(newReward) &&
        JSON.stringify(oldStageReward) === JSON.stringify(newStageReward)) return [];
    return [{ name: riderById.get(entry.riderId)?.name, riderId: entry.riderId,
      race: [oldReward, newReward], stage: [oldStageReward, newStageReward] }];
  });
  console.log(JSON.stringify({
    editionId,
    stageId,
    oldEngine: old.engine_version,
    correctedSimulationBytes: Buffer.byteLength(JSON.stringify(corrected)),
    counts: { riders: old.input_data.riders.length, oldResults: old.simulation_data.results.length,
      correctedResults: corrected.results.length, stageRows: stageResults.length, raceRows: raceResults.length,
      secondaryRows: secondary.length, registrations: registrations.length, rosters: rosters.length, rewards: rewards.length },
    winners: { before: previousWinner, after: correctedWinner },
    stageChanges: process.argv.includes("--verbose") ? stageChanges :
      stageChanges.filter((change) => (riderById.get(change.riderId) as any)?.teamId === affectedTeamId),
    stageChangeCount: stageChanges.length,
    standings: process.argv.includes("--verbose")
      ? { general: reportStandings("general"), youth: reportStandings("youth"), teams: reportStandings("teams") }
      : { generalTopTen: after.general.slice(0, 10).map((entry, index) => ({
          rank: index + 1, name: (riderById.get(entry.riderId) as any)?.name })),
        youthWinner: (riderById.get(after.youth[0]?.riderId) as any)?.name,
        sprintWinner: (riderById.get(after.sprint[0]?.riderId) as any)?.name,
        mountainWinner: (riderById.get(after.mountain[0]?.riderId) as any)?.name,
        teamWinner: after.teams[0]?.teamName,
        teamChanges: reportStandings("teams") },
    primes: { before: oldPrimes, after: newPrimes },
    injuries: { before: old.simulation_data.results.filter((result: any) => result.injury).length,
      after: corrected.results.filter((result) => result.injury).length },
    incidents: { before: old.simulation_data.timeline.flatMap((snapshot: any) => snapshot.incidents).map((incident: any) => incident.type),
      after: corrected.timeline.flatMap((snapshot) => snapshot.incidents).map((incident) => incident.type) },
    attackParticipants: { before: getStageAttackParticipants(old.simulation_data),
      after: getStageAttackParticipants(corrected), persistedCount: persistedAttackers.length },
    sandwichRiders: corrected.resolvedRiders.filter((rider) =>
      rider.specialAbilities?.includes("sandwich_man")).map((rider) => rider.name),
    rewardSources: process.argv.includes("--verbose") ? rewards.map((reward) => ({ source: reward.source_reference,
      cash: reward.cash_prize, uci: reward.uci_points,
      reputation: reward.reputation_points, experience: reward.experience_points })) : undefined,
    rewardChanges,
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
