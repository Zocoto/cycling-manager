/** One-off, guarded historical correction. Run without --apply for a read-only audit. */
/* eslint-disable @typescript-eslint/no-explicit-any -- Dynamic Supabase rows are checked against the locked simulation and SQL preconditions before mutation. */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { isDeepStrictEqual } from "node:util";
import {
  buildOfficialStageRaceStandings,
  normalizeOfficialStageResultRanks,
  OFFICIAL_RACE_ENGINE_VERSION,
} from "../lib/game/official-race-simulation";
import { simulateRaceStage } from "../lib/game/race-simulation";

config({ path: process.env.CORSA_REPAIR_ENV_FILE ?? "../cycling-manager/.env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Configuration Supabase absente.");
const apply = process.argv.includes("--apply");
const verify = process.argv.includes("--verify");
const readOnlyFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET" && method !== "HEAD") throw new Error(`Méthode interdite: ${method}`);
  return fetch(input, init);
};
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: apply ? fetch : readOnlyFetch },
});
async function rows(query: PromiseLike<any>, label: string): Promise<any[]> {
  const result = await query;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? [];
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const editionId = "d62c5b5b-1552-473a-89a5-5747496c9a21";
const stageId = "d6d9dfa6-bf76-42b4-93fb-f8c75db070f5";

async function main() {
  const stages = await rows(db.from("stages").select("id,stage_number,stage_type").eq("race_edition_id", editionId).order("stage_number"), "étapes");
  assert(stages.length === 12 && stages[10].id === stageId, "Édition ou étape inattendue.");
  const locks = await rows(db.from("official_stage_simulations")
    .select("stage_id,engine_version,input_data,simulation_data")
    .in("stage_id", stages.map((stage) => stage.id)), "simulations verrouillées");
  const lockByStage = new Map(locks.map((lock) => [lock.stage_id, lock]));
  const oldLock = lockByStage.get(stageId);
  if (verify) {
    const correction = await rows(db.from("official_race_historical_corrections")
      .select("correction_key,payload_md5,applied_at,after_summary")
      .eq("correction_key", "corsa-s3-stage11-observed-finish-times-20260918"), "audit du rattrapage");
    const rosters = await rows(db.from("race_rosters")
      .select("id,rider_id,race_registrations!inner(race_edition_id)")
      .eq("race_registrations.race_edition_id", editionId), "startlist vérification");
    const yashRoster = rosters.find((row) => row.rider_id === "f669e5b3-0830-4a54-af98-be1d9950cde7");
    const yashStage = yashRoster ? await rows(db.from("stage_results")
      .select("rank,elapsed_time_ms,gap_to_winner_ms")
      .eq("stage_id", stageId).eq("race_roster_id", yashRoster.id), "étape Yash") : [];
    const cashCorrections = await rows(db.from("team_finance_transactions")
      .select("team_season_id,amount,status,source_reference")
      .like("source_reference", "historical-correction:corsa-s3-stage11-observed-finish-times-20260918:%"), "écritures de rattrapage");
    assert(oldLock?.engine_version === OFFICIAL_RACE_ENGINE_VERSION && correction.length === 1, "Correction non enregistrée.");
    const replay = normalizeOfficialStageResultRanks(simulateRaceStage(oldLock.input_data));
    assert(isDeepStrictEqual(oldLock.simulation_data, replay), "Simulation et replay corrigé divergents.");
    const rosterIdByRider = new Map<string, string>(rosters.map((r) => [r.rider_id, r.id]));
    const actualStage = await rows(db.from("stage_results")
      .select("race_roster_id,status,rank,elapsed_time_ms,gap_to_winner_ms")
      .eq("stage_id", stageId), "étape corrigée");
    const actualStageByRoster = new Map(actualStage.map((r) => [r.race_roster_id, r]));
    assert(actualStage.length === replay.results.length, "Nombre de coureurs de l'étape divergent.");
    for (const result of replay.results) {
      const stored = actualStageByRoster.get(rosterIdByRider.get(result.riderId));
      assert(stored && stored.status === result.status && stored.rank === result.rank &&
        stored.elapsed_time_ms === (result.status === "finished" ? result.elapsedTimeSeconds * 1000 : null) &&
        stored.gap_to_winner_ms === (result.status === "finished" ? result.gapToWinnerSeconds * 1000 : null),
      `Étape divergente pour ${result.riderId}`);
    }
    const currentRuns = stages.map((stage) => ({ stage: { id: stage.id, stageType: stage.stage_type }, simulation: lockByStage.get(stage.id)!.simulation_data }));
    const standings = buildOfficialStageRaceStandings(currentRuns as any);
    const generalRows = await rows(db.from("race_results")
      .select("race_roster_id,status,final_rank,total_time_ms,gap_to_winner_ms")
      .eq("race_edition_id", editionId), "général corrigé");
    const generalByRoster = new Map(generalRows.map((r) => [r.race_roster_id, r]));
    const winnerSeconds = standings.general[0]?.elapsedTimeSeconds;
    assert(generalRows.length === 199 && winnerSeconds, "Général incomplet.");
    for (const [index, rider] of standings.general.entries()) {
      const stored = generalByRoster.get(rosterIdByRider.get(rider.riderId));
      assert(stored && stored.status === "classified" && stored.final_rank === index + 1 &&
        stored.total_time_ms === rider.elapsedTimeSeconds * 1000 &&
        stored.gap_to_winner_ms === (rider.elapsedTimeSeconds - winnerSeconds) * 1000,
      `Général divergent pour ${rider.riderId}`);
    }
    const secondaryRows = await rows(db.from("race_secondary_results")
      .select("classification_type,race_roster_id,team_season_id,historical_team_name,rank,total_time_ms")
      .eq("race_edition_id", editionId).in("classification_type", ["youth", "team"]), "jeunes/équipes corrigés");
    const youthByRoster = new Map(secondaryRows.filter((r) => r.classification_type === "youth").map((r) => [r.race_roster_id, r]));
    assert(youthByRoster.size === standings.youth.length, "Classement des jeunes incomplet.");
    for (const [index, rider] of standings.youth.entries()) {
      const stored = youthByRoster.get(rosterIdByRider.get(rider.riderId));
      assert(stored && stored.rank === index + 1 && stored.total_time_ms === rider.elapsedTimeSeconds * 1000,
      `Jeunes divergents pour ${rider.riderId}`);
    }
    const expectedTeamTimes = new Map<string, number>();
    const teamNames = new Map<string, string>();
    const riderTeam = new Map<string, string>();
    for (const run of currentRuns) {
      const identities = new Map<string, any>(run.simulation.resolvedRiders.map((r: any) => [r.id, r]));
      const finished = run.simulation.results.filter((r: any) => r.status === "finished").map((r: any) => r.elapsedTimeSeconds * 1000);
      const fallback = Math.max(0, ...finished) + 300_000;
      const byTeam = new Map<string, number[]>();
      for (const result of run.simulation.results) {
        const rider = identities.get(result.riderId);
        assert(rider, `Coureur sans équipe : ${result.riderId}`);
        riderTeam.set(result.riderId, rider.teamId);
        teamNames.set(rider.teamId, rider.teamName);
        const times = byTeam.get(rider.teamId) ?? [];
        times.push(result.status === "finished" ? result.elapsedTimeSeconds * 1000 : fallback);
        byTeam.set(rider.teamId, times);
      }
      for (const [teamId, times] of byTeam) expectedTeamTimes.set(teamId,
        (expectedTeamTimes.get(teamId) ?? 0) + times.reduce((sum, time) => sum + time, 0) / times.length);
    }
    const activeTeams = new Set(standings.general.map((r) => riderTeam.get(r.riderId)));
    const expectedTeams = [...expectedTeamTimes.entries()].filter(([id]) => activeTeams.has(id))
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    const teamRows = secondaryRows.filter((r) => r.classification_type === "team");
    assert(teamRows.length === expectedTeams.length, "Classement des équipes incomplet.");
    const teamSeasonToTeamId = new Map<string, string>();
    const registrations = await rows(db.from("race_registrations")
      .select("id,team_season_id,historical_team_name")
      .eq("race_edition_id", editionId), "inscriptions d'équipe");
    const registrationById = new Map(registrations.map((r) => [r.id, r]));
    const rosterDetails = await rows(db.from("race_rosters")
      .select("rider_id,race_registration_id,race_registrations!inner(race_edition_id)")
      .eq("race_registrations.race_edition_id", editionId), "équipes de la startlist");
    for (const roster of rosterDetails) {
      const teamId = riderTeam.get(roster.rider_id);
      const registration = registrationById.get(roster.race_registration_id);
      if (teamId && registration?.team_season_id) teamSeasonToTeamId.set(registration.team_season_id, teamId);
    }
    for (const [index, [teamId, milliseconds]] of expectedTeams.entries()) {
      const stored = teamRows.find((r) => r.team_season_id
        ? teamSeasonToTeamId.get(r.team_season_id) === teamId
        : r.historical_team_name === teamNames.get(teamId));
      assert(stored && stored.rank === index + 1 && stored.total_time_ms === Math.round(milliseconds / 1000) * 1000,
      `Équipe divergente : ${teamId}`);
    }
    const prizeSources = [
      [`official-stage-prize:${editionId}:stage:${stageId}:rider:3504b28f-db03-4258-8eb2-f06faf811d20:v1`, 500, 0, 0, 0],
      [`official-stage-sporting:${editionId}:stage:${stageId}:rider:3504b28f-db03-4258-8eb2-f06faf811d20:rank:9:v1`, 0, 10, 0, 0],
      [`official-stage-prize:${editionId}:stage:${stageId}:rider:4fd2a414-232e-4cc1-8545-4938f53285ad:v1`, 500, 0, 0, 0],
      [`official-stage-sporting:${editionId}:stage:${stageId}:rider:4fd2a414-232e-4cc1-8545-4938f53285ad:rank:10:v1`, 0, 10, 0, 0],
      [`official-stage-prize:${editionId}:stage:${stageId}:rider:64452c48-1876-468b-a8c0-18ff6407e974:v1`, 0, 0, 0, 0],
      [`official-stage-sporting:${editionId}:stage:${stageId}:rider:64452c48-1876-468b-a8c0-18ff6407e974:rank:12:v1`, 0, 0, 0, 0],
      [`official-stage-prize:${editionId}:stage:${stageId}:rider:aa8fcf50-2b19-4725-a351-3fad7a7e3417:v1`, 0, 0, 0, 0],
      [`official-stage-sporting:${editionId}:stage:${stageId}:rider:aa8fcf50-2b19-4725-a351-3fad7a7e3417:rank:13:v1`, 0, 0, 0, 0],
      [`official-race:${editionId}:rider:65886cdc-f745-4ff5-8ac8-47c1a48a91b7:v1`, 15000, 300, 5, 190],
      [`official-race:${editionId}:rider:3beb50f4-b431-4c16-ad92-89d610c2eefe:v1`, 4750, 132, 2, 100],
      [`official-race:${editionId}:rider:c71e1d55-a68b-4f52-8732-b69ef373df71:v1`, 0, 40, 0, 35],
      [`official-race:${editionId}:rider:18882bee-d827-4f96-a4a8-710ca87e3ee9:v1`, 0, 0, 0, 0],
    ] as const;
    const prizeEvents = await rows(db.from("reward_events")
      .select("source_reference,cash_prize,uci_points,reputation_points,experience_points")
      .in("source_reference", prizeSources.map((entry) => entry[0])), "primes corrigées");
    const prizeBySource = new Map(prizeEvents.map((event) => [event.source_reference, event]));
    for (const [source, cash, uci, rep, xp] of prizeSources) {
      const event = prizeBySource.get(source);
      assert(event && Number(event.cash_prize) === cash && event.uci_points === uci &&
        Number(event.reputation_points) === rep && event.experience_points === xp, `Prime divergente : ${source}`);
    }
    assert(cashCorrections.length === 6 && cashCorrections.every((row) => row.status === "posted") &&
      cashCorrections.reduce((sum, row) => sum + Number(row.amount), 0) === 0, "Écritures de correction divergentes.");
    const snapshotRows = await rows(db.from("official_race_historical_corrections")
      .select("before_snapshot")
      .eq("correction_key", "corsa-s3-stage11-observed-finish-times-20260918"), "état antérieur audité");
    const snapshot = snapshotRows[0]?.before_snapshot;
    assert(snapshot, "Sauvegarde avant correction absente.");
    const riderDeltas = [
      ["3504b28f-db03-4258-8eb2-f06faf811d20", 500, 10, 0, 0],
      ["4fd2a414-232e-4cc1-8545-4938f53285ad", 500, 10, 0, 0],
      ["64452c48-1876-468b-a8c0-18ff6407e974", -500, -10, 0, 0],
      ["aa8fcf50-2b19-4725-a351-3fad7a7e3417", -500, -10, 0, 0],
      ["65886cdc-f745-4ff5-8ac8-47c1a48a91b7", 11000, 180, 3, 105],
      ["3beb50f4-b431-4c16-ad92-89d610c2eefe", -11000, -180, -3, -105],
      ["c71e1d55-a68b-4f52-8732-b69ef373df71", 0, 40, 0, 35],
      ["18882bee-d827-4f96-a4a8-710ca87e3ee9", 0, -40, 0, -35],
    ] as const;
    const eventWithOwners = await rows(db.from("reward_events")
      .select("source_reference,rider_id,team_season_id,sporting_director_id")
      .in("source_reference", prizeSources.map((entry) => entry[0])), "destinataires de primes");
    const eventForRider = new Map<string, any>();
    for (const event of eventWithOwners) eventForRider.set(event.rider_id, event);
    const summarySeasonId = snapshot.riderSummaries?.[0]?.season_id;
    assert(summarySeasonId, "Saison des palmarès absente.");
    const summaries = await rows(db.from("rider_season_summaries")
      .select("rider_id,season_id,points")
      .eq("season_id", summarySeasonId).in("rider_id", riderDeltas.map(([id]) => id)), "points coureurs");
    const summaryBefore = new Map<string, any>(snapshot.riderSummaries.map((row: any) => [row.rider_id, row]));
    const summaryAfter = new Map(summaries.map((row) => [row.rider_id, row]));
    const teamDeltas = new Map<string, { cash: number; uci: number }>();
    const directorDeltas = new Map<string, { rep: number; xp: number }>();
    const pointIssues: Array<{ riderId: string; before: number | null; after: number | null; expected: number }> = [];
    for (const [riderId, cash, uci, rep, xp] of riderDeltas) {
      const owner = eventForRider.get(riderId);
      const oldSummary = summaryBefore.get(riderId);
      const newSummary = summaryAfter.get(riderId);
      assert(owner && oldSummary && newSummary, `Compte saisonnier absent pour ${riderId}`);
      const expectedPoints = Number(oldSummary.points ?? 0) + uci;
      if (newSummary.points !== expectedPoints) pointIssues.push({ riderId, before: oldSummary.points,
        after: newSummary.points, expected: expectedPoints });
      const team = teamDeltas.get(owner.team_season_id) ?? { cash: 0, uci: 0 };
      team.cash += cash; team.uci += uci;
      teamDeltas.set(owner.team_season_id, team);
      if (rep || xp) {
        assert(owner.sporting_director_id, `Directeur sportif absent pour ${riderId}`);
        const director = directorDeltas.get(owner.sporting_director_id) ?? { rep: 0, xp: 0 };
        director.rep += rep; director.xp += xp;
        directorDeltas.set(owner.sporting_director_id, director);
      }
    }
    const currentTeams = await rows(db.from("team_seasons")
      .select("id,cash_balance,points").in("id", [...teamDeltas.keys()]), "soldes équipes");
    const previousTeams = new Map<string, any>(snapshot.teamSeasons.map((row: any) => [row.id, row]));
    const teamIssues: Array<{ teamId: string; oldCash: number | null; newCash: number | null;
      expectedCash: number; oldPoints: number | null; newPoints: number | null; expectedPoints: number }> = [];
    for (const team of currentTeams) {
      const old = previousTeams.get(team.id);
      const delta = teamDeltas.get(team.id)!;
      assert(old, `Équipe absente de la sauvegarde : ${team.id}`);
      const expectedCash = Number(old.cash_balance ?? 0) + delta.cash;
      const expectedPoints = Number(old.points ?? 0) + delta.uci;
      if (Number(team.cash_balance) !== expectedCash || team.points !== expectedPoints) {
        teamIssues.push({ teamId: team.id, oldCash: old.cash_balance, newCash: team.cash_balance,
          expectedCash, oldPoints: old.points, newPoints: team.points, expectedPoints });
      }
    }
    const currentDirectors = await rows(db.from("sporting_directors")
      .select("id,reputation_points,experience_points")
      .in("id", [...directorDeltas.keys()]), "gains DS");
    const previousDirectors = new Map<string, any>(snapshot.sportingDirectors.map((row: any) => [row.id, row]));
    const directorIssues: Array<{ directorId: string; oldRep: number; newRep: number; expectedRep: number;
      oldXp: number; newXp: number; expectedXp: number }> = [];
    for (const director of currentDirectors) {
      const old = previousDirectors.get(director.id);
      const delta = directorDeltas.get(director.id)!;
      assert(old, `DS absent de la sauvegarde : ${director.id}`);
      const expectedRep = Number(old.reputation_points ?? 0) + delta.rep;
      const expectedXp = Number(old.experience_points ?? 0) + delta.xp;
      if (Number(director.reputation_points) !== expectedRep || Number(director.experience_points) !== expectedXp) {
        directorIssues.push({ directorId: director.id, oldRep: old.reputation_points,
          newRep: director.reputation_points, expectedRep, oldXp: old.experience_points,
          newXp: director.experience_points, expectedXp });
      }
    }
    const recentTeamTransactions = teamIssues.length
      ? await rows(db.from("team_finance_transactions")
        .select("team_season_id,amount,category,status,source_reference,created_at,posted_at")
        .in("team_season_id", teamIssues.map((issue) => issue.teamId))
        .gte("created_at", correction[0].applied_at)
        .order("created_at", { ascending: false }).limit(30), "mouvements récents des équipes")
      : [];
    const unresolvedTeamIssues = teamIssues.filter((issue) => {
      const unrelatedPosted = recentTeamTransactions
        .filter((row) => row.team_season_id === issue.teamId && row.status === "posted" &&
          !row.source_reference.startsWith("historical-correction:corsa-s3-stage11-observed-finish-times-20260918:"))
        .reduce((sum, row) => sum + Number(row.amount), 0);
      return Number(issue.newCash) !== issue.expectedCash + unrelatedPosted ||
        issue.newPoints !== issue.expectedPoints;
    });
    assert(unresolvedTeamIssues.length === 0 && directorIssues.length === 0,
      "Un compte reste divergent après prise en compte des opérations indépendantes.");
    console.log(JSON.stringify({ mode: "verify", engine: oldLock?.engine_version,
      correction: correction[0] ?? null, yashStage: yashStage[0] ?? null,
      pointIssues, teamIssues: unresolvedTeamIssues, directorIssues,
      unrelatedPostedAfterCorrection: recentTeamTransactions
        .filter((row) => row.status === "posted" && !row.source_reference.startsWith("historical-correction:"))
        .reduce((sum, row) => sum + Number(row.amount), 0),
      checked: { stage: actualStage.length, general: generalRows.length,
        youth: youthByRoster.size, teams: teamRows.length, prizes: prizeSources.length,
        riderSummaries: summaries.length, teamAccounts: currentTeams.length,
        sportingDirectors: currentDirectors.length },
      cashCorrections: { count: cashCorrections.length, net: cashCorrections.reduce((sum, row) => sum + Number(row.amount), 0),
        allPosted: cashCorrections.every((row) => row.status === "posted") } }, null, 2));
    return;
  }
  assert(oldLock && oldLock.engine_version !== OFFICIAL_RACE_ENGINE_VERSION, "Version source inattendue ou déjà corrigée.");
  const oldSimulation = oldLock.simulation_data;
  const newSimulation = normalizeOfficialStageResultRanks(simulateRaceStage(oldLock.input_data));
  const visualTimeline = newSimulation.visualTimeline;
  assert(visualTimeline, "Replay visuel absent.");
  const changedKeys = Object.keys(newSimulation).filter((key) => !isDeepStrictEqual((newSimulation as any)[key], oldSimulation[key]));
  assert(JSON.stringify(changedKeys.sort()) === JSON.stringify(["results", "timeline", "visualTimeline"]), `Champs de simulation inattendus : ${changedKeys.join(", ")}`);
  assert(oldSimulation.timeline.length === newSimulation.timeline.length &&
    oldSimulation.visualTimeline.length === visualTimeline.length, "Longueur du replay modifiée.");
  for (let i = 0; i < oldSimulation.timeline.length - 1; i++) {
    assert(isDeepStrictEqual(oldSimulation.timeline[i], newSimulation.timeline[i]), `Chronologie modifiée au segment ${i}.`);
  }
  for (let i = 0; i < oldSimulation.visualTimeline.length - 1; i++) {
    assert(isDeepStrictEqual(oldSimulation.visualTimeline[i], visualTimeline[i]), `Replay modifié à l'image ${i}.`);
  }
  const runs = stages.map((stage) => ({ stage: { id: stage.id, stageType: stage.stage_type }, simulation: lockByStage.get(stage.id)!.simulation_data }));
  const before = buildOfficialStageRaceStandings(runs as any);
  const after = buildOfficialStageRaceStandings(runs.map((run) => run.stage.id === stageId ? { ...run, simulation: newSimulation } : run) as any);
  // The persisted team table uses mean time of the riders present on each
  // stage, not the replay's registered-roster mean. Reproduce that precise
  // rule to avoid changing unrelated historical team positions.
  function persistedTeamStandings(simulations: any[], activeRiderIds: string[]) {
    const teamTimes = new Map<string, number>();
    const teamNames = new Map<string, string>();
    const riderTeam = new Map<string, string>();
    for (const simulation of simulations) {
      const identity = new Map<string, any>(simulation.resolvedRiders.map((r: any) => [r.id, r]));
      const finisherTimes = simulation.results.filter((r: any) => r.status === "finished").map((r: any) => r.elapsedTimeSeconds * 1000);
      const nonFinisherTime = Math.max(0, ...finisherTimes) + 300_000;
      const byTeam = new Map<string, number[]>();
      for (const result of simulation.results) {
        const rider = identity.get(result.riderId);
        assert(rider, `Identité manquante : ${result.riderId}`);
        riderTeam.set(result.riderId, rider.teamId);
        teamNames.set(rider.teamId, rider.teamName);
        const times = byTeam.get(rider.teamId) ?? [];
        times.push(result.status === "finished" ? result.elapsedTimeSeconds * 1000 : nonFinisherTime);
        byTeam.set(rider.teamId, times);
      }
      for (const [teamId, times] of byTeam) {
        teamTimes.set(teamId, (teamTimes.get(teamId) ?? 0) + times.reduce((sum, time) => sum + time, 0) / times.length);
      }
    }
    const activeTeams = new Set(activeRiderIds.map((riderId) => riderTeam.get(riderId)));
    return [...teamTimes.entries()].filter(([teamId]) => activeTeams.has(teamId))
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .map(([teamId, time], i) => ({ teamId, teamName: teamNames.get(teamId), elapsedTimeSeconds: Math.round(time / 1000), rank: i + 1 }));
  }
  const oldTeams = persistedTeamStandings(runs.map((r) => r.simulation), before.general.map((r) => r.riderId));
  const newTeams = persistedTeamStandings(runs.map((r) => r.stage.id === stageId ? newSimulation : r.simulation), after.general.map((r) => r.riderId));
  assert(oldTeams[0]?.teamId === newTeams[0]?.teamId && before.youth[0]?.riderId === after.youth[0]?.riderId &&
    before.mountain[0]?.riderId === after.mountain[0]?.riderId && before.sprint[0]?.riderId === after.sprint[0]?.riderId,
  "Un vainqueur annexe a changé : le plan de gains doit être recalculé.");
  const rosters = await rows(db.from("race_rosters")
    .select("id,rider_id,race_registration_id,race_registrations!inner(race_edition_id,team_season_id,historical_team_name)")
    .eq("race_registrations.race_edition_id", editionId), "startlist");
  const rosterByRider = new Map(rosters.map((r) => [r.rider_id, r]));
  const stageResults = await rows(db.from("stage_results")
    .select("id,race_roster_id,status,rank,elapsed_time_ms,gap_to_winner_ms")
    .eq("stage_id", stageId), "résultats de l'étape");
  const raceResults = await rows(db.from("race_results")
    .select("id,race_roster_id,status,final_rank,total_time_ms,gap_to_winner_ms")
    .eq("race_edition_id", editionId), "classement général enregistré");
  const secondary = await rows(db.from("race_secondary_results")
    .select("id,classification_type,race_roster_id,team_season_id,historical_team_name,rank,points,total_time_ms")
    .eq("race_edition_id", editionId), "classements annexes");
  const riderByRoster = new Map(rosters.map((r) => [r.id, r.rider_id]));
  const oldStageByRider = new Map<string, any>(oldSimulation.results.map((r: any) => [r.riderId, r]));
  const newStageByRider = new Map<string, any>(newSimulation.results.map((r) => [r.riderId, r]));
  assert(stageResults.length === oldSimulation.results.length, "Nombre de résultats d'étape incohérent.");
  const winnerTime = newSimulation.results.find((r) => r.rank === 1)?.elapsedTimeSeconds;
  assert(winnerTime, "Vainqueur de l'étape absent.");
  const stageRows = stageResults.map((stored) => {
    const riderId = riderByRoster.get(stored.race_roster_id);
    const old = oldStageByRider.get(riderId);
    const next = newStageByRider.get(riderId);
    assert(old && next, `Coureur de l'étape absent : ${riderId}`);
    assert(stored.status === old.status && stored.rank === old.rank &&
      stored.elapsed_time_ms === (old.status === "finished" ? old.elapsedTimeSeconds * 1000 : null), `Résultat d'étape divergent : ${riderId}`);
    return {
      id: stored.id, riderId, oldRank: stored.rank, oldTime: stored.elapsed_time_ms,
      oldGap: stored.gap_to_winner_ms,
      newRank: next.status === "finished" ? next.rank : null,
      newTime: next.status === "finished" ? next.elapsedTimeSeconds * 1000 : null,
      newGap: next.status === "finished" ? (next.elapsedTimeSeconds - winnerTime) * 1000 : null,
    };
  });
  const beforeByRider = new Map(before.general.map((r, i) => [r.riderId, { rank: i + 1, seconds: r.elapsedTimeSeconds }]));
  const afterByRider = new Map(after.general.map((r, i) => [r.riderId, { rank: i + 1, seconds: r.elapsedTimeSeconds }]));
  const finalWinnerTime = after.general[0]?.elapsedTimeSeconds;
  assert(finalWinnerTime, "Vainqueur du général absent.");
  const raceRows = raceResults.map((stored) => {
    const riderId = riderByRoster.get(stored.race_roster_id);
    const old = beforeByRider.get(riderId);
    const next = afterByRider.get(riderId);
    assert(stored.status === (old ? "classified" : stored.status), `Statut final inattendu : ${riderId}`);
    assert(stored.final_rank === (old?.rank ?? null) && stored.total_time_ms === (old ? old.seconds * 1000 : null), `Classement final divergent : ${riderId}`);
    return {
      id: stored.id, riderId, oldRank: stored.final_rank, oldTime: stored.total_time_ms,
      oldGap: stored.gap_to_winner_ms,
      newRank: next?.rank ?? null, newTime: next ? next.seconds * 1000 : null,
      newGap: next ? (next.seconds - finalWinnerTime) * 1000 : null,
    };
  });
  const group = (name: string, standings: any) => standings[name].map((r: any, i: number) => ({ ...r, rank: i + 1 }));
  const oldSecondary = {
    mountain: group("mountain", before), sprint: group("sprint", before),
    youth: group("youth", before), team: oldTeams,
  };
  const newSecondary = {
    mountain: group("mountain", after), sprint: group("sprint", after),
    youth: group("youth", after), team: newTeams,
  };
  const teamSeasonToTeamId = new Map<string, string>();
  const oldInputTeamByRider = new Map<string, string>(oldLock.input_data.riders.map((r: any) => [r.id, r.teamId]));
  for (const roster of rosters) {
    const teamId = oldInputTeamByRider.get(roster.rider_id);
    const registration = roster.race_registrations;
    if (teamId && registration.team_season_id) teamSeasonToTeamId.set(registration.team_season_id, teamId);
  }
  // Mountain and sprint points are identical in the corrected replay. Their
  // historical tie-break order can differ from a fresh re-aggregation.
  const timeSecondary = secondary.filter((stored) => stored.classification_type === "youth" || stored.classification_type === "team");
  const secondaryRows = timeSecondary.map((stored) => {
    const type = stored.classification_type as keyof typeof oldSecondary;
    const riderId = stored.race_roster_id ? riderByRoster.get(stored.race_roster_id) : null;
    const teamId = stored.team_season_id
      ? teamSeasonToTeamId.get(stored.team_season_id)
      : oldTeams.find((team) => team.teamName === stored.historical_team_name)?.teamId;
    const match = (item: any) => type === "team" ? item.teamId === teamId : item.riderId === riderId;
    const old = oldSecondary[type].find(match);
    const next = newSecondary[type].find(match);
    assert(old && next, `Classement annexe absent : ${type}, ${riderId ?? teamId}`);
    const oldTime = type === "youth" || type === "team" ? old.elapsedTimeSeconds * 1000 : null;
    const newTime = type === "youth" || type === "team" ? next.elapsedTimeSeconds * 1000 : null;
    assert(stored.rank === old.rank && stored.total_time_ms === oldTime &&
      stored.points === (old.points ?? null), `Classement annexe divergent : ${type}, ${riderId ?? teamId} ; base=${JSON.stringify(stored)} ; simulé=${JSON.stringify(old)}`);
    return { id: stored.id, type, oldRank: stored.rank, oldTime, newRank: next.rank, newTime };
  });
  assert(secondaryRows.length === oldSecondary.youth.length + oldSecondary.team.length, "Classements jeunes/équipes incomplets.");
  const impacted = ["3504b28f-db03-4258-8eb2-f06faf811d20", "4fd2a414-232e-4cc1-8545-4938f53285ad",
    "64452c48-1876-468b-a8c0-18ff6407e974", "aa8fcf50-2b19-4725-a351-3fad7a7e3417",
    "65886cdc-f745-4ff5-8ac8-47c1a48a91b7", "3beb50f4-b431-4c16-ad92-89d610c2eefe",
    "c71e1d55-a68b-4f52-8732-b69ef373df71", "18882bee-d827-4f96-a4a8-710ca87e3ee9"];
  const rewardEvents = await rows(db.from("reward_events")
    .select("id,source_reference,team_season_id,rider_id,reputation_points,experience_points,cash_prize,uci_points")
    .in("rider_id", impacted), "récompenses concernées");
  const rewardBySource = new Map(rewardEvents.map((event) => [event.source_reference, event]));
  const source = (kind: string, riderId: string, rank?: number) => kind === "race"
    ? `official-race:${editionId}:rider:${riderId}:v1`
    : kind === "cash"
      ? `official-stage-prize:${editionId}:stage:${stageId}:rider:${riderId}:v1`
      : `official-stage-sporting:${editionId}:stage:${stageId}:rider:${riderId}:rank:${rank}:v1`;
  const correctionPlan = [
    { riderId: impacted[0], stageOldRank: 15, stageNewRank: 9, stageCash: 500, stageUci: 10 },
    { riderId: impacted[1], stageOldRank: 20, stageNewRank: 10, stageCash: 500, stageUci: 10 },
    { riderId: impacted[2], stageOldRank: 10, stageNewRank: 12, stageCash: 0, stageUci: 0 },
    { riderId: impacted[3], stageOldRank: 9, stageNewRank: 13, stageCash: 0, stageUci: 0 },
    { riderId: impacted[4], raceOldRank: 16, raceNewRank: 10, raceCash: 15000, raceUci: 300, raceRep: 5, raceXp: 190 },
    { riderId: impacted[5], raceOldRank: 10, raceNewRank: 11, raceCash: 4750, raceUci: 132, raceRep: 2, raceXp: 100 },
    { riderId: impacted[6], raceOldRank: 41, raceNewRank: 35, raceCash: 0, raceUci: 40, raceRep: 0, raceXp: 35 },
    { riderId: impacted[7], raceOldRank: 40, raceNewRank: 44, raceCash: 0, raceUci: 0, raceRep: 0, raceXp: 0 },
  ];
  const prizeRows: any[] = [];
  for (const plan of correctionPlan) {
    assert(rosterByRider.has(plan.riderId), `Startlist absente pour ${plan.riderId}`);
    if (plan.stageOldRank) {
      assert(oldStageByRider.get(plan.riderId).rank === plan.stageOldRank && newStageByRider.get(plan.riderId).rank === plan.stageNewRank, `Rang d'étape inattendu pour ${plan.riderId}`);
      prizeRows.push({ riderId: plan.riderId, rosterId: rosterByRider.get(plan.riderId).id,
        oldSource: source("cash", plan.riderId), newSource: source("cash", plan.riderId), kind: "stage_result",
        oldCash: rewardBySource.get(source("cash", plan.riderId))?.cash_prize ?? 0,
        newCash: plan.stageCash, oldUci: 0, newUci: 0, oldRep: 0, newRep: 0, oldXp: 0, newXp: 0 });
      prizeRows.push({ riderId: plan.riderId, rosterId: rosterByRider.get(plan.riderId).id,
        oldSource: source("sporting", plan.riderId, plan.stageOldRank), newSource: source("sporting", plan.riderId, plan.stageNewRank), kind: "stage_result",
        oldCash: 0, newCash: 0, oldUci: rewardBySource.get(source("sporting", plan.riderId, plan.stageOldRank))?.uci_points ?? 0,
        newUci: plan.stageUci, oldRep: 0, newRep: 0, oldXp: 0, newXp: 0 });
    } else {
      assert(beforeByRider.get(plan.riderId)?.rank === plan.raceOldRank && afterByRider.get(plan.riderId)?.rank === plan.raceNewRank, `Rang final inattendu pour ${plan.riderId}`);
      const oldEvent = rewardBySource.get(source("race", plan.riderId));
      prizeRows.push({ riderId: plan.riderId, rosterId: rosterByRider.get(plan.riderId).id,
        oldSource: source("race", plan.riderId), newSource: source("race", plan.riderId), kind: "race_result",
        oldCash: oldEvent?.cash_prize ?? 0, newCash: plan.raceCash,
        oldUci: oldEvent?.uci_points ?? 0, newUci: plan.raceUci,
        oldRep: oldEvent?.reputation_points ?? 0, newRep: plan.raceRep,
        oldXp: oldEvent?.experience_points ?? 0, newXp: plan.raceXp });
    }
  }
  assert(prizeRows.length === 12, "Plan des récompenses incomplet.");
  const signed = (field: string) => prizeRows.reduce((n, r) => n + (r[`new${field}`] - r[`old${field}`]), 0);
  assert(["Cash", "Uci", "Rep", "Xp"].every((field) => signed(field) === 0), "Les gains ne se compensent pas à l'échelle de l'édition.");
  const payload = {
    editionId, stageId, oldEngineVersion: oldLock.engine_version, newEngineVersion: OFFICIAL_RACE_ENGINE_VERSION,
    stageRows, raceRows, secondaryRows, prizeRows,
    replay: { results: newSimulation.results, timelineIndex: newSimulation.timeline.length - 1,
      timelineFinal: newSimulation.timeline.at(-1), visualIndex: visualTimeline.length - 1,
      visualFinal: visualTimeline.at(-1) },
  };
  const yashId = oldLock.input_data.riders.find((r: any) => r.name === "Yash Patel")?.id;
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", engine: [oldLock.engine_version, OFFICIAL_RACE_ENGINE_VERSION],
    counts: { stage: stageRows.length, general: raceRows.length, secondary: secondaryRows.length, rewards: prizeRows.length },
    changed: { stage: stageRows.filter((r) => r.oldRank !== r.newRank || r.oldTime !== r.newTime).length,
      general: raceRows.filter((r) => r.oldRank !== r.newRank || r.oldTime !== r.newTime).length,
      secondary: secondaryRows.filter((r) => r.oldRank !== r.newRank || r.oldTime !== r.newTime).length },
    yash: { old: oldStageByRider.get(yashId), corrected: newStageByRider.get(yashId) },
    prizes: prizeRows.filter((r) => r.oldCash !== r.newCash || r.oldUci !== r.newUci || r.oldRep !== r.newRep || r.oldXp !== r.newXp)
      .map(({ riderId, oldCash, newCash, oldUci, newUci, oldRep, newRep, oldXp, newXp }) => ({ riderId, oldCash, newCash, oldUci, newUci, oldRep, newRep, oldXp, newXp })),
    team: { oldWinner: oldTeams[0], newWinner: newTeams[0], oldCount: oldTeams.length, newCount: newTeams.length,
      rankChanges: newTeams.filter((team) => oldTeams.find((old) => old.teamId === team.teamId)?.rank !== team.rank) },
    payloadBytes: JSON.stringify(payload).length }, null, 2));
  if (!apply) return;
  const result = await db.rpc("repair_corsa_stage11_20260918", { p_payload: payload });
  if (result.error) throw new Error(`Rattrapage transactionnel échoué : ${result.error.message}`);
  console.log(JSON.stringify({ result: result.data }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
