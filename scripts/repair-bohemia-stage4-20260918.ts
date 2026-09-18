/** Guarded correction of the final Bohême stage. Default mode is read-only. */
/* eslint-disable @typescript-eslint/no-explicit-any -- Locked historical JSON and database rows are validated before mutation. */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { isDeepStrictEqual } from "node:util";
import { calculateRaceRewardBreakdown, calculateStageReward } from "../lib/game/economy";
import {
  buildOfficialStageRaceStandings,
  normalizeOfficialStageResultRanks,
  OFFICIAL_RACE_ENGINE_VERSION,
} from "../lib/game/official-race-simulation";
import { buildPersistedStageRaceStandings } from "../lib/game/race-results";
import { getStageAttackParticipants, simulateRaceStage } from "../lib/game/race-simulation";
import { calculateStageRaceTimeBonuses } from "../lib/game/race-time-bonuses";

config({ path: process.env.BOHEMIA_REPAIR_ENV_FILE ?? "../cycling-manager/.env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Configuration Supabase absente.");
const apply = process.argv.includes("--apply");
const verify = process.argv.includes("--verify");
const oldEngine = "2026.09-observed-finish-times-v29";
const editionId = "cb59a394-1463-4f10-91a2-6a73dbd74a42";
const stageId = "0ea120e6-9fd0-437d-b0d1-d5c98736f76a";
const correctionKey = "bohemia-s3-stage4-leader-recovery-20260918";
const readOnlyFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const address = new URL(input instanceof Request ? input.url : String(input));
  const readOnlyRpc = address.pathname.endsWith("/rpc/get_active_team_staff_base_strength") ||
    address.pathname.endsWith("/rpc/get_active_team_staff_talent_strength");
  if (method !== "GET" && method !== "HEAD" && !(method === "POST" && readOnlyRpc)) {
    throw new Error(`Écriture interdite en audit : ${method} ${address.pathname}`);
  }
  return fetch(input, init);
};
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: apply ? fetch : readOnlyFetch },
});
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
async function rows(query: PromiseLike<any>, label: string): Promise<any[]> {
  const result = await query;
  if (result.error) throw new Error(`${label} : ${result.error.message}`);
  return result.data ?? [];
}
function equal(actual: unknown, expected: unknown, label: string) {
  assert(isDeepStrictEqual(actual, expected), `${label} divergent : ${JSON.stringify(actual)} au lieu de ${JSON.stringify(expected)}`);
}
function nonzero(reward: any) {
  return reward.reputation || reward.experience || reward.cashPrize || reward.uciPoints;
}
function cents(amount: number) { return Math.round(amount * 100) / 100; }

async function main() {
  if (verify) {
    const corrections = await rows(db.from("official_race_historical_corrections")
      .select("correction_key,after_summary,before_snapshot").eq("correction_key", correctionKey), "journal correction");
    assert(corrections.length === 1 && corrections[0].after_summary?.status === "applied", "Correction non appliquée.");
    const lock = await rows(db.from("official_stage_simulations")
      .select("engine_version,input_data,simulation_data").eq("stage_id", stageId), "verrou corrigé");
    assert(lock.length === 1 && lock[0].engine_version === OFFICIAL_RACE_ENGINE_VERSION, "Version corrigée absente.");
    equal(lock[0].simulation_data, normalizeOfficialStageResultRanks(simulateRaceStage(lock[0].input_data)), "Replay corrigé");
    console.log(JSON.stringify({ mode: "verify", correction: corrections[0].after_summary,
      backupBytes: JSON.stringify(corrections[0].before_snapshot).length,
      engine: lock[0].engine_version }, null, 2));
    return;
  }
  const stages = await rows(db.from("stages")
    .select("id,stage_number,stage_type,status,name").eq("race_edition_id", editionId).order("stage_number"), "étapes");
  assert(stages.length === 4 && stages[3].id === stageId && stages.every((stage) => stage.status === "completed"),
    "Édition non conforme à l'audit.");
  const edition = await rows(db.from("race_editions").select("id,status").eq("id", editionId), "édition");
  assert(edition.length === 1 && edition[0].status === "completed", "Édition non terminée.");
  const locks = await rows(db.from("official_stage_simulations")
    .select("stage_id,engine_version,input_data,simulation_data")
    .in("stage_id", stages.map((stage) => stage.id)), "simulations verrouillées");
  assert(locks.length === 4, "Verrous incomplets.");
  const lockByStage = new Map(locks.map((lock) => [lock.stage_id, lock]));
  const original = lockByStage.get(stageId);
  assert(original?.engine_version === oldEngine, "La simulation a changé depuis l'audit.");
  const corrected = normalizeOfficialStageResultRanks(simulateRaceStage(original.input_data));
  assert(corrected.stageId === stageId && corrected.results.length === 33, "Rejeu inattendu.");
  const oldRuns = stages.map((stage) => ({ stage: { id: stage.id, stageType: stage.stage_type },
    simulation: lockByStage.get(stage.id).simulation_data }));
  const newRuns = oldRuns.map((run) => run.stage.id === stageId ? { ...run, simulation: corrected } : run);
  const oldOfficial = buildOfficialStageRaceStandings(oldRuns as any);
  const newOfficial = buildOfficialStageRaceStandings(newRuns as any);
  const riderById = new Map<string, any>(original.input_data.riders.map((rider: any) => [rider.id, rider]));
  const ageByRider = new Map<string, number>(original.input_data.riders.map((rider: any) => [rider.id, rider.age]));
  const officialStageResults = (runs: any[]) => runs.map(({ stage, simulation }) => {
    const identities = new Map<string, any>(simulation.resolvedRiders.map((rider: any) => [rider.id, rider]));
    const bonuses = calculateStageRaceTimeBonuses({ raceFormat: "stage_race", stageType: stage.stageType, simulation });
    const winner = Math.min(...simulation.results.filter((result: any) => result.status === "finished")
      .map((result: any) => result.elapsedTimeSeconds));
    return simulation.results.map((result: any) => {
      const rider = identities.get(result.riderId);
      assert(rider, `Coureur sans identité : ${result.riderId}`);
      return { riderId: result.riderId, riderName: rider.name, teamId: rider.teamId, teamName: rider.teamName,
        rank: result.status === "finished" ? result.rank : null, status: result.status,
        elapsedTimeMs: result.status === "finished" ? result.elapsedTimeSeconds * 1000 : null,
        gapToWinnerMs: result.status === "finished" ? (result.elapsedTimeSeconds - winner) * 1000 : null,
        mountainPoints: simulation.mountainPoints[result.riderId] ?? 0,
        sprintPoints: simulation.sprintPoints[result.riderId] ?? 0,
        timeBonusSeconds: bonuses[result.riderId] ?? 0, timePenaltySeconds: 0,
        abandonmentReason: result.abandonment ? "crash" : null };
    });
  });
  const oldStageClassifications = officialStageResults(oldRuns);
  const newStageClassifications = officialStageResults(newRuns);
  const oldSecondary = buildPersistedStageRaceStandings(oldStageClassifications, ageByRider);
  const newSecondary = buildPersistedStageRaceStandings(newStageClassifications, ageByRider);
  assert(oldOfficial.general[0]?.riderId === newOfficial.general[0]?.riderId &&
    oldSecondary.youth[0]?.riderId === newSecondary.youth[0]?.riderId &&
    oldSecondary.mountain[0]?.riderId === newSecondary.mountain[0]?.riderId &&
    oldSecondary.sprint[0]?.riderId === newSecondary.sprint[0]?.riderId &&
    oldSecondary.teams[0]?.teamId === newSecondary.teams[0]?.teamId &&
    original.simulation_data.results[0]?.riderId === corrected.results[0]?.riderId,
  "Un vainqueur a changé ; le plan de victoires doit être étendu.");
  assert(corrected.results.every((result) => result.status === "finished" && !result.injury) &&
    original.simulation_data.results.every((result: any) => result.status === "finished" && !result.injury) &&
    corrected.timeline.every((snapshot) => snapshot.incidents.length === 0),
  "Abandon ou blessure : un autre plan de régularisation est nécessaire.");

  const registrations = await rows(db.from("race_registrations")
    .select("id,team_season_id,historical_team_name").eq("race_edition_id", editionId), "inscriptions");
  const rosters = await rows(db.from("race_rosters")
    .select("id,rider_id,race_registration_id,race_registrations!inner(race_edition_id)")
    .eq("race_registrations.race_edition_id", editionId), "startlist");
  assert(registrations.length === 6 && rosters.length === 34, "Startlist modifiée.");
  const rosterByRider = new Map<string, any>(rosters.map((roster) => [roster.rider_id, roster]));
  const riderByRoster = new Map<string, string>(rosters.map((roster) => [roster.id, roster.rider_id]));
  const registrationById = new Map<string, any>(registrations.map((row) => [row.id, row]));
  const teamSeasonIds = registrations.flatMap((row) => row.team_season_id ? [row.team_season_id] : []);
  const teamSeasons = await rows(db.from("team_seasons").select("id,team_id").in("id", teamSeasonIds), "équipes saison");
  const teamIdBySeason = new Map<string, string>(teamSeasons.map((team) => [team.id, team.team_id]));
  const teamSeasonBySimTeam = new Map<string, string>();
  for (const rider of original.input_data.riders) {
    const roster = rosterByRider.get(rider.id);
    const seasonId = roster && registrationById.get(roster.race_registration_id)?.team_season_id;
    if (seasonId) teamSeasonBySimTeam.set(rider.teamId, seasonId);
  }

  const stageDb = await rows(db.from("stage_results")
    .select("id,race_roster_id,status,rank,elapsed_time_ms,gap_to_winner_ms,mountain_points,sprint_points,time_bonus_seconds,time_penalty_seconds,abandonment_reason,injury_id")
    .eq("stage_id", stageId), "résultats étape");
  const oldLast = new Map<string, any>(oldStageClassifications[3].map((result: any) => [result.riderId, result]));
  const newLast = new Map<string, any>(newStageClassifications[3].map((result: any) => [result.riderId, result]));
  assert(stageDb.length === 33, "Nombre de résultats d'étape inattendu.");
  const stageRows = stageDb.map((row) => {
    const riderId = riderByRoster.get(row.race_roster_id);
    assert(riderId, `Startlist d'étape absente : ${row.race_roster_id}`);
    const old = oldLast.get(riderId); const next = newLast.get(riderId);
    assert(old && next, `Coureur d'étape manquant : ${riderId}`);
    equal([row.status, row.rank, row.elapsed_time_ms, row.gap_to_winner_ms,
      row.mountain_points, row.sprint_points, row.time_bonus_seconds, row.time_penalty_seconds,
      row.abandonment_reason, row.injury_id],
    [old.status, old.rank, old.elapsedTimeMs, old.gapToWinnerMs,
      old.mountainPoints, old.sprintPoints, old.timeBonusSeconds, old.timePenaltySeconds,
      old.abandonmentReason, null], `Résultat d'étape de ${riderId}`);
    return { id: row.id, riderId, oldRank: old.rank, oldTime: old.elapsedTimeMs, oldGap: old.gapToWinnerMs,
      oldMountain: old.mountainPoints, oldSprint: old.sprintPoints, oldBonus: old.timeBonusSeconds,
      newRank: next.rank, newTime: next.elapsedTimeMs, newGap: next.gapToWinnerMs,
      newMountain: next.mountainPoints, newSprint: next.sprintPoints, newBonus: next.timeBonusSeconds };
  });
  const oldGeneralByRider = new Map(oldOfficial.general.map((result, index) =>
    [result.riderId, { rank: index + 1, seconds: result.elapsedTimeSeconds }]));
  const newGeneralByRider = new Map(newOfficial.general.map((result, index) =>
    [result.riderId, { rank: index + 1, seconds: result.elapsedTimeSeconds }]));
  const oldGcWinner = oldOfficial.general[0].elapsedTimeSeconds;
  const newGcWinner = newOfficial.general[0].elapsedTimeSeconds;
  const raceDb = await rows(db.from("race_results")
    .select("id,race_roster_id,status,final_rank,total_time_ms,gap_to_winner_ms")
    .eq("race_edition_id", editionId), "classement final");
  assert(raceDb.length === 33, "Nombre de classés inattendu.");
  const raceRows = raceDb.map((row) => {
    const riderId = riderByRoster.get(row.race_roster_id);
    assert(riderId, `Startlist finale absente : ${row.race_roster_id}`);
    const old = oldGeneralByRider.get(riderId); const next = newGeneralByRider.get(riderId);
    assert(old && next, `Général manquant pour ${riderId}`);
    equal([row.status, row.final_rank, row.total_time_ms, row.gap_to_winner_ms],
      ["classified", old.rank, old.seconds * 1000, (old.seconds - oldGcWinner) * 1000], `Général de ${riderId}`);
    return { id: row.id, riderId, oldRank: old.rank, oldTime: old.seconds * 1000,
      oldGap: (old.seconds - oldGcWinner) * 1000,
      newRank: next.rank, newTime: next.seconds * 1000,
      newGap: (next.seconds - newGcWinner) * 1000 };
  });
  const secondaryDb = await rows(db.from("race_secondary_results")
    .select("id,classification_type,race_roster_id,team_season_id,historical_team_name,rank,points,total_time_ms")
    .eq("race_edition_id", editionId), "classements annexes");
  assert(secondaryDb.length === 49, "Nombre de classements annexes inattendu.");
  const secondaryRows = secondaryDb.map((row) => {
    const type = row.classification_type as keyof typeof oldSecondary | "team";
    assert(["mountain", "sprint", "youth", "teams"].includes(type === "team" ? "teams" : type),
      `Classement inconnu : ${type}`);
    const collection = type === "team" ? "teams" : type;
    const teamId = row.team_season_id ? teamIdBySeason.get(row.team_season_id) : null;
    const riderId = row.race_roster_id ? riderByRoster.get(row.race_roster_id) : null;
    const find = (entries: any[]) => entries.findIndex((entry) =>
      collection === "teams" ? entry.teamId === teamId : entry.riderId === riderId);
    const oldIndex = find(oldSecondary[collection] as any[]);
    const nextIndex = find(newSecondary[collection] as any[]);
    assert(oldIndex >= 0 && nextIndex >= 0, `Classement annexe manquant : ${type}/${riderId ?? teamId}`);
    const old: any = oldSecondary[collection][oldIndex];
    const next: any = newSecondary[collection][nextIndex];
    const oldTime = old.elapsedTimeSeconds === undefined ? null : old.elapsedTimeSeconds * 1000;
    const newTime = next.elapsedTimeSeconds === undefined ? null : next.elapsedTimeSeconds * 1000;
    equal([row.rank, row.points, row.total_time_ms], [oldIndex + 1, old.points ?? null, oldTime],
      `Classement annexe ${type}/${riderId ?? teamId}`);
    return { id: row.id, type, oldRank: oldIndex + 1, oldPoints: old.points ?? null, oldTime,
      newRank: nextIndex + 1, newPoints: next.points ?? null, newTime };
  });

  const rewardDb = await rows(db.from("reward_events")
    .select("id,source_reference,source_type,rider_id,team_season_id,sporting_director_id,cash_prize,uci_points,reputation_points,experience_points,description")
    .or(`source_reference.like.official-stage-%:${editionId}:stage:${stageId}:%,source_reference.like.official-race:${editionId}:%`), "récompenses");
  assert(rewardDb.length === 25, "Nombre de récompenses de l'édition inattendu.");
  const rewardBySource = new Map<string, any>(rewardDb.map((event) => [event.source_reference, event]));
  const staffBaseByTeam = new Map<string, number>();
  const staffVictoryByTeam = new Map<string, number>();
  for (const teamSeason of teamSeasons) {
    const base = await db.rpc("get_active_team_staff_base_strength", {
      p_team_id: teamSeason.team_id, p_role: "community_manager", p_points_per_level: 2 });
    const victory = await db.rpc("get_active_team_staff_talent_strength", {
      p_team_id: teamSeason.team_id, p_talent_code: "community_victory_reputation", p_points_per_level: 3 });
    assert(!base.error && !victory.error, `Bonus de réputation indisponible : ${teamSeason.id}`);
    staffBaseByTeam.set(teamSeason.id, Number(base.data ?? 0));
    staffVictoryByTeam.set(teamSeason.id, Number(victory.data ?? 0));
  }
  const winnersFor = (standings: typeof oldSecondary, general: typeof oldOfficial.general) => {
    const result = new Map<string, string[]>();
    for (const type of ["mountain", "sprint", "youth"] as const) {
      const riderId = standings[type][0]?.riderId;
      if (riderId) result.set(riderId, [...(result.get(riderId) ?? []), type]);
    }
    const teamWinner = general.find((rider) => riderById.get(rider.riderId)?.teamId === standings.teams[0]?.teamId);
    if (teamWinner) result.set(teamWinner.riderId, [...(result.get(teamWinner.riderId) ?? []), "team"]);
    return result;
  };
  const oldWinners = winnersFor(oldSecondary, oldOfficial.general);
  const newWinners = winnersFor(newSecondary, newOfficial.general);
  const primeWins = (runs: any[], riderId: string, type: string) => runs.reduce((count, run) =>
    count + run.simulation.primes.filter((prime: any) =>
      prime.prime.type === type && prime.classification[0]?.riderId === riderId).length, 0);
  const raceReward = (runs: any[], winners: Map<string, string[]>, riderId: string, rank: number) =>
    calculateRaceRewardBreakdown({ tier: "national", scope: "tour", finalRank: rank,
      secondaryClassifications: (winners.get(riderId) ?? []) as any,
      mountainPrimesWon: primeWins(runs, riderId, "mountain"),
      intermediateSprintsWon: primeWins(runs, riderId, "intermediate_sprint") }).total;
  const rewardRows: any[] = [];
  const observedSources = new Set<string>();
  const pushReward = (riderId: string, kind: "race_result" | "stage_result", oldSource: string,
      newSource: string, oldBase: any, newBase: any, isVictory: boolean) => {
    const roster = rosterByRider.get(riderId);
    const seasonId = roster && registrationById.get(roster.race_registration_id)?.team_season_id;
    assert(roster && seasonId, `Destinataire absent : ${riderId}`);
    const oldEvent = rewardBySource.get(oldSource);
    if (oldEvent) observedSources.add(oldSource);
    assert(!nonzero(oldBase) || oldEvent, `Récompense source absente : ${oldSource}`);
    assert(!oldEvent || (oldEvent.rider_id === riderId && oldEvent.team_season_id === seasonId &&
      Number(oldEvent.cash_prize) === oldBase.cashPrize && oldEvent.uci_points === oldBase.uciPoints &&
      oldEvent.experience_points === oldBase.experience), `Récompense source divergente : ${oldSource}`);
    const repPercent = (staffBaseByTeam.get(seasonId) ?? 0) + (isVictory ? staffVictoryByTeam.get(seasonId) ?? 0 : 0);
    const expectedOldRep = cents(oldBase.reputation + cents(oldBase.reputation * repPercent / 100));
    const expectedNewRep = cents(newBase.reputation + cents(newBase.reputation * repPercent / 100));
    assert(!oldEvent || Number(oldEvent.reputation_points) === expectedOldRep,
      `Bonus de réputation source divergent : ${oldSource}, attendu ${expectedOldRep}, trouvé ${oldEvent?.reputation_points}`);
    if (!oldEvent && !nonzero(newBase)) return;
    const newRank = kind === "race_result" ? newGeneralByRider.get(riderId)?.rank : newLast.get(riderId)?.rank;
    const riderName = riderById.get(riderId)?.name;
    const newDescription = kind === "race_result"
      ? `Tour de la Voie Royale de Bohême — ${riderName} · ${newRank}e place au général · classement rectifié`
      : `Tour de la Voie Royale de Bohême — Étape 4 : ${stages[3].name} — ${riderName} · ${newRank}e place · classement rectifié`;
    rewardRows.push({ riderId, rosterId: roster.id, kind, oldSource, newSource,
      oldCash: oldBase.cashPrize, newCash: newBase.cashPrize,
      oldUci: oldBase.uciPoints, newUci: newBase.uciPoints,
      oldRep: expectedOldRep, newRep: expectedNewRep,
      oldXp: oldBase.experience, newXp: newBase.experience, newDescription });
  };
  for (const riderId of riderById.keys()) {
    const oldStage = oldLast.get(riderId); const newStage = newLast.get(riderId);
    const oldRace = oldGeneralByRider.get(riderId); const newRace = newGeneralByRider.get(riderId);
    assert(oldStage && newStage && oldRace && newRace, `Classement de ${riderId} manquant.`);
    const oldStageReward = calculateStageReward({ tier: "national", finalRank: oldStage.rank });
    const newStageReward = calculateStageReward({ tier: "national", finalRank: newStage.rank });
    const cashSource = `official-stage-prize:${editionId}:stage:${stageId}:rider:${riderId}:v1`;
    pushReward(riderId, "stage_result", cashSource, cashSource,
      { ...oldStageReward, uciPoints: 0 }, { ...newStageReward, uciPoints: 0 }, false);
    const oldSportSource = `official-stage-sporting:${editionId}:stage:${stageId}:rider:${riderId}:rank:${oldStage.rank}:v1`;
    const newSportSource = `official-stage-sporting:${editionId}:stage:${stageId}:rider:${riderId}:rank:${newStage.rank}:v1`;
    pushReward(riderId, "stage_result", oldSportSource, newSportSource,
      { ...oldStageReward, cashPrize: 0 }, { ...newStageReward, cashPrize: 0 }, oldStage.rank === 1);
    const raceSource = `official-race:${editionId}:rider:${riderId}:v1`;
    pushReward(riderId, "race_result", raceSource, raceSource,
      raceReward(oldRuns, oldWinners, riderId, oldRace.rank),
      raceReward(newRuns, newWinners, riderId, newRace.rank), oldRace.rank === 1);
  }
  assert(observedSources.size === rewardDb.length, "Certaines récompenses enregistrées ne sont pas couvertes.");
  const changedRewards = rewardRows.filter((row) => row.oldCash !== row.newCash || row.oldUci !== row.newUci ||
    row.oldRep !== row.newRep || row.oldXp !== row.newXp || row.oldSource !== row.newSource);

  const attackDb = await rows(db.from("stage_attack_participants")
    .select("race_roster_id,participation_type,first_segment_number").eq("stage_id", stageId), "attaquants");
  const attackRows = getStageAttackParticipants(corrected).map((participant) => ({
    rosterId: rosterByRider.get(participant.riderId)?.id,
    riderId: participant.riderId, type: participant.participationType, segment: participant.firstSegmentNumber }));
  const oldAttack = getStageAttackParticipants(original.simulation_data);
  equal(attackDb.map((row) => [riderByRoster.get(row.race_roster_id), row.participation_type, row.first_segment_number]).sort(),
    oldAttack.map((row) => [row.riderId, row.participationType, row.firstSegmentNumber]).sort(), "Attaquants sources");
  assert(attackRows.length === 4 && attackRows.every((row) => row.rosterId), "Attaquants corrigés inattendus.");
  const newsDb = await rows(db.from("post_race_news_events")
    .select("id,event_kind,title,detail,featured_rider_id,featured_team_id")
    .eq("stage_id", stageId), "brèves de course");
  assert(newsDb.length === 2, "Brèves de course inattendues.");
  const classificationNews = newsDb.find((row) => row.event_kind === "classification");
  const oldSprint = original.simulation_data.primes.find((prime: any) => prime.prime.type === "intermediate_sprint")
    ?.classification[0];
  const newSprint = corrected.primes.find((prime) => prime.prime.type === "intermediate_sprint")?.classification[0];
  assert(classificationNews && oldSprint && newSprint, "Brève de classement absente.");
  const oldDetail = `${riderById.get(oldSprint.riderId).name} marque ${oldSprint.points} pt(s) aux SI sur ${stages[3].name}.`;
  const newDetail = `${riderById.get(newSprint.riderId).name} marque ${newSprint.points} pt(s) aux SI sur ${stages[3].name}.`;
  equal([classificationNews.detail, classificationNews.featured_rider_id], [oldDetail, oldSprint.riderId], "Brève source");
  const newsRow = { id: classificationNews.id, oldDetail, newDetail, oldRiderId: oldSprint.riderId,
    newRiderId: newSprint.riderId, oldTeamId: classificationNews.featured_team_id,
    newTeamId: riderById.get(newSprint.riderId).teamId };
  const payload = { editionId, stageId, oldEngineVersion: oldEngine, newEngineVersion: OFFICIAL_RACE_ENGINE_VERSION,
    stageRows, raceRows, secondaryRows, rewardRows, attackRows, newsRow, simulation: corrected };
  const result = { mode: apply ? "apply" : "dry-run", correctionKey,
    counts: { stageRows: stageRows.length, raceRows: raceRows.length, secondaryRows: secondaryRows.length,
      rewardRows: rewardRows.length, changedRewards: changedRewards.length, attackRows: attackRows.length },
    changes: { stage: stageRows.filter((r) => r.oldRank !== r.newRank || r.oldTime !== r.newTime).length,
      general: raceRows.filter((r) => r.oldRank !== r.newRank || r.oldTime !== r.newTime).length,
      secondary: secondaryRows.filter((r) => r.oldRank !== r.newRank || r.oldTime !== r.newTime || r.oldPoints !== r.newPoints).length },
    rewards: changedRewards.map((row) => ({ riderId: row.riderId, source: row.oldSource,
      cash: [row.oldCash, row.newCash], uci: [row.oldUci, row.newUci],
      reputation: [row.oldRep, row.newRep], experience: [row.oldXp, row.newXp] })),
    news: [oldDetail, newDetail], payloadBytes: Buffer.byteLength(JSON.stringify(payload)) };
  console.log(JSON.stringify(result, null, 2));
  if (!apply) return;
  const applied = await db.rpc("repair_bohemia_stage4_20260918", { p_payload: payload });
  if (applied.error) throw new Error(`Rattrapage transactionnel échoué : ${applied.error.message}`);
  console.log(JSON.stringify({ result: applied.data }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
