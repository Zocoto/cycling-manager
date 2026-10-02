/** Authorized one-shot replay. Default dry-run, --apply is transactional,
 * --verify checks the saved replay, results and rewards. */
/* eslint-disable @typescript-eslint/no-explicit-any -- historical JSON is validated against persisted rows. */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { isDeepStrictEqual } from "node:util";
import { calculateRaceRewardBreakdown } from "../lib/game/economy";
import { normalizeOfficialStageResultRanks, OFFICIAL_RACE_ENGINE_VERSION } from "../lib/game/official-race-simulation";
import { buildPostRaceNewsEvents } from "../lib/game/post-race-news";
import { getStageAttackParticipants, simulateRaceStage, validateRoadSnapshotGroups } from "../lib/game/race-simulation";

config({ path: "../cycling-manager/.env.local", quiet: true });
const editionId = "696634c3-b04e-45cc-afb1-56494cde3102";
const stageId = "894e7bf7-ad24-406e-8e45-39be91ba4b09";
const correctionKey = "barichara-s3-group-clocks-20261002";
const sourceEngine = "2026.09-leadout-selective-finishes-v36";
const apply = process.argv.includes("--apply");
const verify = process.argv.includes("--verify");
const fixture = process.argv.includes("--fixture");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Configuration Supabase absente.");
const guardedFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const address = new URL(input instanceof Request ? input.url : String(input));
  const readRpc = address.pathname.endsWith("/rpc/get_active_team_staff_base_strength") ||
    address.pathname.endsWith("/rpc/get_active_team_staff_talent_strength");
  if (method !== "GET" && method !== "HEAD" && !(method === "POST" && readRpc))
    throw new Error(`Écriture interdite en audit : ${method} ${address.pathname}`);
  return fetch(input, init);
};
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: apply ? fetch : guardedFetch },
});
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function equal(left: unknown, right: unknown, label: string) {
  assert(isDeepStrictEqual(left, right), `${label} diverge de la source auditée.`);
}
async function rows(query: PromiseLike<any>, label: string): Promise<any[]> {
  const result = await query;
  assert(!result.error, `${label}: ${result.error?.message}`);
  return result.data ?? [];
}
const round = (value: number) => Math.round(value * 100) / 100;

async function main() {
  const [lock] = await rows(db.from("official_stage_simulations").select("*").eq("stage_id", stageId), "verrou");
  assert(lock?.race_edition_id === editionId, "Édition source inattendue.");
  if (fixture) {
    // Keep sporting input, omit appearance-only metadata from the regression fixture.
    const input = structuredClone(lock.input_data);
    for (const rider of input.riders) {
      for (const field of ["teamJersey", "avatarProfileKey", "avatarSeed", "nationalChampionships",
        "worldChampionships", "continentalChampionships", "activeNationalChampion",
        "activeWorldChampion", "activeContinentalChampion", "classificationJerseyVisual"])
        delete rider[field];
    }
    console.log(JSON.stringify(input));
    return;
  }
  const [journal] = await rows(db.from("official_race_historical_corrections").select("*")
    .eq("correction_key", correctionKey), "journal");
  const original = journal?.before_snapshot?.officialLock ?? lock;
  assert(original.engine_version === sourceEngine, "Version source inattendue.");
  const corrected = normalizeOfficialStageResultRanks(simulateRaceStage(original.input_data));
  equal(corrected, normalizeOfficialStageResultRanks(simulateRaceStage(original.input_data)), "Déterminisme du replay");
  assert(corrected.results.length === original.simulation_data.results.length, "Startlist modifiée.");
  assert(corrected.results.every((r) => r.status === "finished" && !r.injury && !r.abandonment),
    "Le replay produit un nouvel abandon ou une blessure : rattrapage à réévaluer.");
  assert(original.simulation_data.results.every((r: any) => r.status === "finished" && !r.injury),
    "La source comporte une blessure homologuée.");
  const riders = new Map<string, any>(corrected.resolvedRiders.map((r) => [r.id, r]));
  const newById = new Map(corrected.results.map((r) => [r.riderId, r]));
  const oldById = new Map<string, any>(original.simulation_data.results.map((r: any) => [r.riderId, r]));
  equal(corrected.results.find((r) => r.rank === 1)?.riderId,
    original.simulation_data.results.find((r: any) => r.rank === 1)?.riderId, "Vainqueur");
  for (const snapshot of corrected.timeline)
    validateRoadSnapshotGroups(snapshot.groups, corrected.results.map((r) => r.riderId));

  const [edition] = await rows(db.from("race_editions").select("*").eq("id", editionId), "édition");
  const [category] = await rows(db.from("race_categories").select("code").eq("id", edition.race_category_id), "catégorie");
  const [season] = await rows(db.from("seasons").select("game_year").eq("id", edition.season_id), "saison");
  const [stage] = await rows(db.from("stages").select("*").eq("id", stageId), "étape source");
  const newsAfter = buildPostRaceNewsEvents({
    edition: { id: editionId, name: edition.display_name, raceFormat: "one_day" } as any,
    stage: { id: stageId, name: stage.name, departureAt: stage.departure_at, distanceKm: stage.distance_km } as any,
    simulation: corrected,
  });
  const registrations = await rows(db.from("race_registrations").select("*").eq("race_edition_id", editionId), "inscriptions");
  assert(registrations.every((r) => r.team_season_id && r.detection_team_number === null), "Équipe libre hors périmètre.");
  const registrationById = new Map(registrations.map((r) => [r.id, r]));
  const rosters = await rows(db.from("race_rosters").select("*").in("race_registration_id", registrations.map((r) => r.id)), "startlist");
  const rosterByRider = new Map(rosters.map((r) => [r.rider_id, r]));
  const riderByRoster = new Map(rosters.map((r) => [r.id, r.rider_id]));
  const [stageRows, raceRows, rewardEvents] = await Promise.all([
    rows(db.from("stage_results").select("*").eq("stage_id", stageId).order("id"), "étape"),
    rows(db.from("race_results").select("*").eq("race_edition_id", editionId).order("id"), "course"),
    rows(db.from("reward_events").select("*").like("source_reference", `official-race:${editionId}:%`).order("id"), "gains"),
  ]);
  assert(stageRows.length === corrected.results.length && raceRows.length === corrected.results.length, "Classement incomplet.");
  const expectedById = verify ? newById : oldById;
  for (const row of stageRows) {
    const result = expectedById.get(riderByRoster.get(row.race_roster_id));
    assert(result, "Résultat d’étape inconnu.");
    equal([row.status, row.rank, row.elapsed_time_ms, row.gap_to_winner_ms],
      ["finished", result.rank, result.elapsedTimeSeconds * 1000, result.gapToWinnerSeconds * 1000], "Classement d’étape");
    assert(row.injury_id === null && row.time_bonus_seconds === 0 && row.time_penalty_seconds === 0, "État historique hors périmètre.");
  }
  for (const row of raceRows) {
    const result = expectedById.get(riderByRoster.get(row.race_roster_id));
    assert(result, "Résultat de course inconnu.");
    equal([row.status, row.final_rank, row.total_time_ms, row.gap_to_winner_ms],
      ["classified", result.rank, result.elapsedTimeSeconds * 1000, result.gapToWinnerSeconds * 1000], "Classement final");
  }
  const rewardFor = (rank: number | null) => calculateRaceRewardBreakdown({
    gameYear: season.game_year, tier: category.code, scope: "one_day", finalRank: rank,
  }).total;
  const rewardByRider = new Map(rewardEvents.map((r) => [r.rider_id, r]));
  const rewardChanges: any[] = [];
  for (const result of corrected.results) {
    const previous = oldById.get(result.riderId);
    const roster = rosterByRider.get(result.riderId);
    const registration = roster && registrationById.get(roster.race_registration_id);
    assert(registration, "Équipe manquante.");
    const oldReward = rewardFor(previous.rank);
    const newReward = rewardFor(result.rank);
    const current = rewardByRider.get(result.riderId);
    const expected = verify ? newReward : oldReward;
    const nonzero = Object.values(expected).some((amount) => amount !== 0);
    assert(!nonzero || current, `Gains absents pour ${riders.get(result.riderId).name}.`);
    if (current) equal([Number(current.cash_prize), current.uci_points, current.experience_points],
      [expected.cashPrize, expected.uciPoints, expected.experience], "Gains enregistrés");
    const oldEvent = journal?.before_snapshot?.rewardEvents?.find((r: any) => r.rider_id === result.riderId) ?? current;
    const staff = await db.rpc("get_active_team_staff_base_strength", {
      p_team_id: riders.get(result.riderId).teamId, p_role: "community_manager", p_points_per_level: 2,
    });
    assert(!staff.error, "Bonus de réputation absent.");
    const oldRep = Number(oldEvent?.reputation_points ?? 0);
    // Winner stays the same; preserve its historically boosted reputation.
    const newRep = result.rank === 1 ? oldRep : round(newReward.reputation * (1 + Number(staff.data ?? 0) / 100));
    if (verify && current) equal(Number(current.reputation_points), newRep, "Réputation corrigée");
    rewardChanges.push({ riderId: result.riderId, rosterId: roster.id, teamSeasonId: registration.team_season_id,
      oldRank: previous.rank, newRank: result.rank,
      source: `official-race:${editionId}:rider:${result.riderId}:v1`,
      oldCash: oldReward.cashPrize, newCash: newReward.cashPrize,
      oldUci: oldReward.uciPoints, newUci: newReward.uciPoints,
      oldXp: oldReward.experience, newXp: newReward.experience,
      oldRep, newRep, description: `Clásica de Barichara — ${riders.get(result.riderId).name} · ${result.rank}e place · classement rectifié` });
  }
  const named = corrected.results.find((r) => riders.get(r.riderId)?.name === "Gautam Patel");
  assert(named?.rank === 3 && named.gapToWinnerSeconds === 0, "Contrôle Gautam inattendu.");
  const summary = { mode: verify ? "verify" : apply ? "apply" : "dry-run", engineVersion: OFFICIAL_RACE_ENGINE_VERSION,
    classified: corrected.results.length, changedRanks: corrected.results.filter((r) => oldById.get(r.riderId).rank !== r.rank).length,
    top10: corrected.results.slice(0, 10).map((r) => ({ name: riders.get(r.riderId).name, rank: r.rank, gap: r.gapToWinnerSeconds })),
    rewardsChanged: rewardChanges.filter((r) => r.oldCash !== r.newCash || r.oldUci !== r.newUci || r.oldXp !== r.newXp || r.oldRep !== r.newRep).length,
    netCash: rewardChanges.reduce((n, r) => n + r.newCash - r.oldCash, 0),
    netUci: rewardChanges.reduce((n, r) => n + r.newUci - r.oldUci, 0),
    gautamReward: rewardChanges.find((r) => r.riderId === named.riderId),
  };
  if (verify) {
    assert(journal?.after_summary?.status === "applied", "Journal de correction absent.");
    assert(lock.engine_version === OFFICIAL_RACE_ENGINE_VERSION, "Moteur officiel divergent.");
    equal(lock.simulation_data, corrected, "Replay officiel");
    const attacks = await rows(db.from("stage_attack_participants")
      .select("race_roster_id,participation_type,first_segment_number").eq("stage_id", stageId), "attaquants corrigés");
    equal(attacks.map((r) => [riderByRoster.get(r.race_roster_id), r.participation_type, r.first_segment_number]).sort(),
      getStageAttackParticipants(corrected).map((r) => [r.riderId, r.participationType, r.firstSegmentNumber]).sort(), "Attaquants corrigés");
    const finance = await rows(db.from("team_finance_transactions")
      .select("team_season_id,source_reference,amount").like("source_reference", `historical-correction:${correctionKey}:%`), "ajustements financiers");
    const cashChanges = rewardChanges.filter((r) => r.oldCash !== r.newCash);
    assert(finance.length === cashChanges.length, "Nombre d’ajustements financiers incorrect.");
    for (const change of cashChanges) {
      const transaction = finance.find((r) => r.source_reference === `historical-correction:${correctionKey}:${change.source}`);
      equal([transaction?.team_season_id, Number(transaction?.amount)],
        [change.teamSeasonId, change.newCash - change.oldCash], "Delta financier");
    }
    const news = await rows(db.from("post_race_news_events").select("*").eq("stage_id", stageId), "brèves corrigées");
    equal(news.map((r) => [r.id, r.title, r.detail, r.featured_rider_id]).sort(),
      newsAfter.map((r) => [r.id, r.title, r.detail, r.featuredRiderId]).sort(), "Brèves corrigées");
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  assert(!journal && lock.engine_version === sourceEngine, "Correction déjà enregistrée.");
  const attackAfter = getStageAttackParticipants(corrected).map((entry) => ({
    rosterId: rosterByRider.get(entry.riderId)?.id, participationType: entry.participationType, firstSegmentNumber: entry.firstSegmentNumber,
  }));
  assert(attackAfter.every((entry) => entry.rosterId), "Attaquant hors startlist.");
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) return;
  const outcome = await db.rpc("repair_barichara_group_clocks_20261002", { p_payload: {
    editionId, stageId, oldEngineVersion: sourceEngine, newEngineVersion: OFFICIAL_RACE_ENGINE_VERSION,
    sourceSimulation: original.simulation_data, simulation: corrected,
    stageBefore: stageRows, raceBefore: raceRows, rewardsBefore: rewardEvents,
    rewardChanges, attackAfter, newsAfter, summary,
  } });
  assert(!outcome.error, `Transaction de correction : ${outcome.error?.message}`);
  console.log(JSON.stringify({ applied: outcome.data }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
