/**
 * Guarded repair of Boucle des Provinces stage 9.
 *
 * The default mode is a read-only replay. `--apply` first replaces the
 * immutable official lock, the stage rows, the attack participants and all
 * four provisional secondary classifications in one database transaction.
 * `--verify` is read-only and checks every row.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- Historical simulation JSON and Supabase rows are validated at runtime. */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { isDeepStrictEqual } from "node:util";
import {
  buildOfficialStageRaceStandings,
  normalizeOfficialStageResultRanks,
  OFFICIAL_RACE_ENGINE_VERSION,
} from "../lib/game/official-race-simulation";
import { buildPersistedStageRaceStandings } from "../lib/game/race-results";
import { buildPostRaceNewsEvents } from "../lib/game/post-race-news";
import {
  getStageAttackParticipants,
  simulateRaceStage,
} from "../lib/game/race-simulation";
import { calculateStageRaceTimeBonuses } from "../lib/game/race-time-bonuses";

config({
  path:
    process.env.BOUCLE_REPAIR_ENV_FILE ??
    "../cycling-manager/.env.local",
  quiet: true,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error("Configuration Supabase absente.");
}

const apply = process.argv.includes("--apply");
const verifyOnly = process.argv.includes("--verify");
const editionId = "716dad06-c144-47a7-afbc-68bff48f8e57";
const stageId = "e426b44f-2393-439c-9d5c-c5c8f4afea0c";
const nextStageId = "244e7ac0-d11f-4381-a600-ca1fb8fd2768";
const hexaTeamId = "803e9755-570b-48ba-9b2d-6bbf5d8312d4";
const sourceEngineVersion = "2026.09-real-pursuit-groups-v33";
const correctionKey = "boucle-provinces-s3-stage9-race-dynamics-20260923";

const readOnlyFetch: typeof fetch = async (input, init) => {
  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    const address = new URL(
      input instanceof Request ? input.url : String(input),
    );
    throw new Error(
      `Écriture interdite en audit : ${method} ${address.pathname}`,
    );
  }
  return fetch(input, init);
};

const db = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
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
  assert(
    isDeepStrictEqual(actual, expected),
    `${label} divergent : ${JSON.stringify(actual)} au lieu de ${JSON.stringify(expected)}`,
  );
}

function buildStageClassifications(stages: any[], locksByStageId: Map<string, any>) {
  return stages.slice(0, 9).map((stage) => {
    const lock = locksByStageId.get(stage.id);
    assert(lock, `Verrou absent pour l'étape ${stage.stage_number}.`);
    const simulation = lock.simulation_data;
    const ridersById = new Map<string, any>(
      simulation.resolvedRiders.map((rider: any) => [rider.id, rider]),
    );
    const bonuses = calculateStageRaceTimeBonuses({
      raceFormat: "stage_race",
      stageType: stage.stage_type,
      simulation,
    });
    const winnerSeconds = Math.min(
      ...simulation.results
        .filter((result: any) => result.status === "finished")
        .map((result: any) => result.elapsedTimeSeconds),
    );

    return simulation.results.map((result: any) => {
      const rider = ridersById.get(result.riderId);
      assert(rider, `Identité absente du replay : ${result.riderId}.`);
      const hasElapsedTime =
        result.status === "finished" ||
        result.status === "outside_time_limit";
      return {
        riderId: result.riderId,
        riderName: rider.name,
        teamId: rider.teamId,
        teamName: rider.teamName,
        rank: result.status === "finished" ? result.rank : null,
        status: result.status,
        elapsedTimeMs: hasElapsedTime
          ? result.elapsedTimeSeconds * 1_000
          : null,
        gapToWinnerMs: hasElapsedTime
          ? Math.max(0, result.elapsedTimeSeconds - winnerSeconds) * 1_000
          : null,
        mountainPoints: simulation.mountainPoints[result.riderId] ?? 0,
        sprintPoints: simulation.sprintPoints[result.riderId] ?? 0,
        timeBonusSeconds: bonuses[result.riderId] ?? 0,
        timePenaltySeconds: 0,
        abandonmentReason: result.abandonment ? "crash" : null,
      };
    });
  });
}

async function loadState() {
  const stages = await rows(
    db
      .from("stages")
      .select(
        "id,stage_number,stage_type,status,name,departure_at,distance_km,season_day_id",
      )
      .eq("race_edition_id", editionId)
      .order("stage_number"),
    "étapes",
  );
  assert(
    stages.length === 12 &&
      stages[8]?.id === stageId &&
      stages[9]?.id === nextStageId,
    "Édition ou étapes de la Boucle des Provinces inattendues.",
  );

  const locks = await rows(
    db
      .from("official_stage_simulations")
      .select(
        "stage_id,race_edition_id,engine_version,seed,input_data,simulation_data",
      )
      .in(
        "stage_id",
        stages.map((stage) => stage.id),
      ),
    "simulations verrouillées",
  );
  const locksByStageId = new Map<string, any>(
    locks.map((lock) => [lock.stage_id, lock]),
  );
  const stageLock = locksByStageId.get(stageId);
  assert(stageLock, "Verrou officiel de l'étape 9 absent.");

  return { stages, locks, locksByStageId, stageLock };
}

function normalizeNewsRow(row: any) {
  return {
    id: row.id,
    eventKind: row.event_kind,
    title: row.title,
    detail: row.detail,
    featuredRiderId: row.featured_rider_id,
    featuredTeamId: row.featured_team_id,
    happenedAt: new Date(row.happened_at).toISOString(),
  };
}

async function loadAncillaryRows({
  stages,
  corrected,
  expectOriginalInterviews = true,
}: {
  stages: any[];
  corrected: any;
  expectOriginalInterviews?: boolean;
}) {
  const editions = await rows(
    db.from("race_editions").select("id,display_name,status").eq("id", editionId),
    "édition",
  );
  assert(editions.length === 1, "Édition de la Boucle absente.");
  const stage = stages[8];
  const generatedNews = buildPostRaceNewsEvents({
    edition: {
      id: editionId,
      name: editions[0].display_name,
      raceFormat: "stage_race",
    } as any,
    stage: {
      id: stage.id,
      name: stage.name,
      departureAt: stage.departure_at,
      distanceKm: Number(stage.distance_km),
    } as any,
    simulation: corrected,
  });
  const teamIds = [...new Set(generatedNews.flatMap((event) => event.featuredTeamId ? [event.featuredTeamId] : []))];
  const existingTeams = teamIds.length
    ? await rows(db.from("teams").select("id").in("id", teamIds), "équipes des actualités")
    : [];
  const existingTeamIds = new Set(existingTeams.map((team) => team.id));
  const newsAfter = generatedNews.map((event) => ({
    id: event.id,
    eventKind: event.eventKind,
    title: event.title,
    detail: event.detail,
    featuredRiderId: event.featuredRiderId,
    featuredTeamId: event.featuredTeamId && existingTeamIds.has(event.featuredTeamId) ? event.featuredTeamId : null,
    happenedAt: event.happenedAt,
  }));
  const currentNews = await rows(
    db.from("post_race_news_events")
      .select("id,event_kind,title,detail,featured_rider_id,featured_team_id,happened_at")
      .eq("stage_id", stageId)
      .order("id"),
    "actualités après-course",
  );
  const interviewsBefore = await rows(
    db.from("post_race_interviews")
      .select("id,race_edition_id,stage_id,team_id,sporting_director_id,season_id,question_set,answers,closing_note,context,status,submitted_at,created_at,updated_at,event_choice_id,event_outcome,event_resolved_at")
      .eq("stage_id", stageId)
      .order("id"),
    "interviews après-course",
  );
  const interviewsArePristine = interviewsBefore.every((interview) =>
      interview.status === "pending" && Array.isArray(interview.answers) && interview.answers.length === 0 &&
      interview.closing_note === null && interview.submitted_at === null && interview.event_choice_id === null &&
      interview.event_outcome === null && interview.event_resolved_at === null);
  assert(
    interviewsArePristine && (!expectOriginalInterviews || interviewsBefore.length === 8),
    "Les interviews ne sont plus dans l'état vierge audité ; correction interrompue.",
  );
  const interviewIds = interviewsBefore.map((interview) => interview.id);
  const reactionsBefore = interviewIds.length
    ? await rows(db.from("post_race_interview_answer_reactions").select("interview_id,question_id,sporting_director_id,emoji,created_at").in("interview_id", interviewIds), "réactions d'interview")
    : [];
  assert(reactionsBefore.length === 0, "Une interview a reçu une réaction ; correction interrompue.");
  return {
    newsBefore: currentNews.map(normalizeNewsRow),
    newsAfter: newsAfter.sort((left, right) => left.id.localeCompare(right.id)),
    interviewsBefore,
    reactionsBefore,
  };
}

function replayCorrection(stageLock: any) {
  const corrected = normalizeOfficialStageResultRanks(
    simulateRaceStage(stageLock.input_data),
  );
  assert(
    corrected.stageId === stageId && corrected.results.length === 177,
    "Replay corrigé incomplet.",
  );
  assert(
    corrected.results[0]?.riderId ===
      stageLock.simulation_data.results[0]?.riderId,
    "Le vainqueur de l'étape changerait ; correction interrompue.",
  );
  const previousByRiderId = new Map<string, any>(
    stageLock.simulation_data.results.map((result: any) => [
      result.riderId,
      result,
    ]),
  );
  assert(
    corrected.results.every((result) => {
      const previous = previousByRiderId.get(result.riderId);
      return (
        previous &&
        previous.status === result.status &&
        isDeepStrictEqual(previous.injury ?? null, result.injury ?? null) &&
        isDeepStrictEqual(
          previous.abandonment ?? null,
          result.abandonment ?? null,
        )
      );
    }),
    "Une disponibilité, blessure ou un abandon changerait ; correction interrompue.",
  );
  return corrected;
}

async function loadRosterContext(input: any) {
  const registrations = await rows(
    db
      .from("race_registrations")
      .select("id,team_season_id,historical_team_name")
      .eq("race_edition_id", editionId),
    "inscriptions",
  );
  const rosters = await rows(
    db
      .from("race_rosters")
      .select(
        "id,rider_id,race_registration_id,status,race_registrations!inner(race_edition_id)",
      )
      .eq("race_registrations.race_edition_id", editionId),
    "startlist",
  );
  assert(
    rosters.length >= 177,
    `La startlist historique est incomplète (${rosters.length} lignes).`,
  );

  const registrationById = new Map<string, any>(
    registrations.map((registration) => [registration.id, registration]),
  );
  const rosterByRiderId = new Map<string, any>();
  for (const roster of rosters) {
    const current = rosterByRiderId.get(roster.rider_id);
    const active = roster.status === "selected" || roster.status === "confirmed";
    const currentActive =
      current?.status === "selected" || current?.status === "confirmed";
    if (!current || (active && !currentActive)) {
      rosterByRiderId.set(roster.rider_id, roster);
    }
  }
  const riderByRosterId = new Map<string, string>(
    rosters.map((roster) => [roster.id, roster.rider_id]),
  );
  const teamIdentityBySimulationTeamId = new Map<
    string,
    { teamSeasonId: string | null; historicalTeamName: string | null }
  >();
  for (const rider of input.riders) {
    const roster = rosterByRiderId.get(rider.id);
    assert(roster, `Coureur absent de la startlist : ${rider.id}.`);
    const registration = registrationById.get(roster.race_registration_id);
    assert(registration, `Inscription absente : ${roster.race_registration_id}.`);
    teamIdentityBySimulationTeamId.set(rider.teamId, {
      teamSeasonId: registration.team_season_id,
      historicalTeamName: registration.historical_team_name,
    });
  }

  return {
    registrations,
    rosterByRiderId,
    riderByRosterId,
    teamIdentityBySimulationTeamId,
  };
}

async function verifyPersistedResults({
  stages,
  locksByStageId,
  corrected,
}: {
  stages: any[];
  locksByStageId: Map<string, any>;
  corrected: any;
}) {
  const currentStageLock = {
    ...locksByStageId.get(stageId),
    engine_version: OFFICIAL_RACE_ENGINE_VERSION,
    simulation_data: corrected,
  };
  const currentLocks = new Map(locksByStageId);
  currentLocks.set(stageId, currentStageLock);
  const roster = await loadRosterContext(currentStageLock.input_data);

  const stageRows = await rows(
    db
      .from("stage_results")
      .select(
        "race_roster_id,status,rank,elapsed_time_ms,gap_to_winner_ms,mountain_points,sprint_points,time_bonus_seconds,time_penalty_seconds,abandonment_reason,injury_id",
      )
      .eq("stage_id", stageId),
    "résultats corrigés de l'étape",
  );
  assert(stageRows.length === 177, "Résultats corrigés incomplets.");
  const storedStageByRiderId = new Map<string, any>();
  for (const row of stageRows) {
    const riderId = roster.riderByRosterId.get(row.race_roster_id);
    assert(riderId, `Dossard inconnu dans les résultats : ${row.race_roster_id}.`);
    storedStageByRiderId.set(riderId, row);
  }
  const timeBonuses = calculateStageRaceTimeBonuses({
    raceFormat: "stage_race",
    stageType: stages[8].stage_type,
    simulation: corrected,
  });
  const winnerSeconds = corrected.results[0].elapsedTimeSeconds;
  for (const result of corrected.results) {
    const stored = storedStageByRiderId.get(result.riderId);
    const hasElapsedTime =
      result.status === "finished" || result.status === "outside_time_limit";
    equal(
      stored && [
        stored.status,
        stored.rank,
        stored.elapsed_time_ms,
        stored.gap_to_winner_ms,
        stored.mountain_points,
        stored.sprint_points,
        stored.time_bonus_seconds,
        stored.time_penalty_seconds,
      ],
      [
        result.status,
        result.status === "finished" ? result.rank : null,
        hasElapsedTime ? result.elapsedTimeSeconds * 1_000 : null,
        hasElapsedTime
          ? Math.max(0, result.elapsedTimeSeconds - winnerSeconds) * 1_000
          : null,
        corrected.mountainPoints[result.riderId] ?? 0,
        corrected.sprintPoints[result.riderId] ?? 0,
        timeBonuses[result.riderId] ?? 0,
        0,
      ],
      `Résultat corrigé de ${result.riderId}`,
    );
  }

  const stageClassifications = buildStageClassifications(stages, currentLocks);
  const riderAgeById = new Map<string, number>(
    currentStageLock.input_data.riders.map((rider: any) => [
      rider.id,
      rider.age,
    ]),
  );
  const expected = buildPersistedStageRaceStandings(
    stageClassifications,
    riderAgeById,
  );
  const secondaryRows = await rows(
    db
      .from("race_secondary_results")
      .select(
        "classification_type,race_roster_id,team_season_id,historical_team_name,rank,points,total_time_ms",
      )
      .eq("race_edition_id", editionId)
      .order("classification_type")
      .order("rank"),
    "classements annexes",
  );
  const expectedCount =
    expected.mountain.length +
    expected.sprint.length +
    expected.youth.length +
    expected.teams.length;
  assert(
    secondaryRows.length === expectedCount,
    `Classements annexes incomplets (${secondaryRows.length}/${expectedCount}).`,
  );

  for (const [type, entries] of [
    ["mountain", expected.mountain],
    ["sprint", expected.sprint],
    ["youth", expected.youth],
  ] as const) {
    const stored = secondaryRows.filter(
      (row) => row.classification_type === type,
    );
    assert(stored.length === entries.length, `Classement ${type} incomplet.`);
    for (const [index, entry] of entries.entries()) {
      equal(
        [
          roster.riderByRosterId.get(stored[index].race_roster_id),
          stored[index].rank,
          stored[index].points,
          stored[index].total_time_ms,
        ],
        [
          entry.riderId,
          index + 1,
          "points" in entry ? entry.points : null,
          "elapsedTimeSeconds" in entry
            ? entry.elapsedTimeSeconds * 1_000
            : null,
        ],
        `Classement ${type}, rang ${index + 1}`,
      );
    }
  }

  const storedTeams = secondaryRows.filter(
    (row) => row.classification_type === "team",
  );
  assert(
    storedTeams.length === expected.teams.length,
    "Classement des équipes incomplet.",
  );
  for (const [index, entry] of expected.teams.entries()) {
    const identity = roster.teamIdentityBySimulationTeamId.get(entry.teamId);
    assert(identity, `Équipe du replay sans inscription : ${entry.teamId}.`);
    equal(
      [
        storedTeams[index].team_season_id,
        storedTeams[index].historical_team_name,
        storedTeams[index].rank,
        storedTeams[index].points,
        storedTeams[index].total_time_ms,
      ],
      [
        identity.teamSeasonId,
        identity.historicalTeamName,
        index + 1,
        null,
        entry.elapsedTimeSeconds * 1_000,
      ],
      `Classement équipes, rang ${index + 1}`,
    );
  }

  return {
    stageRows: stageRows.length,
    secondaryRows: secondaryRows.length,
    secondaryCounts: {
      mountain: expected.mountain.length,
      sprint: expected.sprint.length,
      youth: expected.youth.length,
      team: expected.teams.length,
    },
  };
}

function createExpectedSecondaryRows({
  standings,
  roster,
}: {
  standings: ReturnType<typeof buildPersistedStageRaceStandings>;
  roster: Awaited<ReturnType<typeof loadRosterContext>>;
}) {
  return [
    ...standings.mountain.map((entry, index) => ({
      classificationType: "mountain",
      rosterId: roster.rosterByRiderId.get(entry.riderId)?.id ?? null,
      teamSeasonId: null,
      historicalName: null,
      rank: index + 1,
      points: entry.points,
      time: null,
    })),
    ...standings.sprint.map((entry, index) => ({
      classificationType: "sprint",
      rosterId: roster.rosterByRiderId.get(entry.riderId)?.id ?? null,
      teamSeasonId: null,
      historicalName: null,
      rank: index + 1,
      points: entry.points,
      time: null,
    })),
    ...standings.youth.map((entry, index) => ({
      classificationType: "youth",
      rosterId: roster.rosterByRiderId.get(entry.riderId)?.id ?? null,
      teamSeasonId: null,
      historicalName: null,
      rank: index + 1,
      points: null,
      time: entry.elapsedTimeSeconds * 1_000,
    })),
    ...standings.teams.map((entry, index) => {
      const identity = roster.teamIdentityBySimulationTeamId.get(entry.teamId);
      assert(identity, `Équipe sans inscription : ${entry.teamId}.`);
      return {
        classificationType: "team",
        rosterId: null,
        teamSeasonId: identity.teamSeasonId,
        historicalName: identity.historicalTeamName,
        rank: index + 1,
        points: null,
        time: entry.elapsedTimeSeconds * 1_000,
      };
    }),
  ].sort(
    (left, right) =>
      left.classificationType.localeCompare(right.classificationType) ||
      left.rank - right.rank,
  );
}

async function main() {
  assert(
    String(OFFICIAL_RACE_ENGINE_VERSION) ===
      "2026.09-real-pursuit-groups-v34",
    "La version du moteur a changé depuis la préparation de la correction.",
  );
  assert(
    !(apply && verifyOnly),
    "Utiliser soit --apply, soit --verify, pas les deux.",
  );

  const state = await loadState();
  const { stages, locksByStageId, stageLock } = state;
  const corrected = replayCorrection(stageLock);
  const ridersById = new Map<string, any>(
    stageLock.input_data.riders.map((rider: any) => [rider.id, rider]),
  );
  const summarizeHexa = (simulation: any) =>
    simulation.results
      .filter(
        (result: any) => ridersById.get(result.riderId)?.teamId === hexaTeamId,
      )
      .map((result: any) => ({
        rider: ridersById.get(result.riderId)?.name,
        role: ridersById.get(result.riderId)?.role,
        rank: result.rank,
        gap: result.gapToWinnerSeconds,
        energy: result.energyAfter,
      }))
      .sort((left: any, right: any) => left.rank - right.rank);
  const changedStageResults = corrected.results.filter((result: any) => {
    const previous = stageLock.simulation_data.results.find(
      (candidate: any) => candidate.riderId === result.riderId,
    );
    return (
      previous?.rank !== result.rank ||
      previous?.elapsedTimeSeconds !== result.elapsedTimeSeconds ||
      previous?.mountainPoints !== result.mountainPoints ||
      previous?.sprintPoints !== result.sprintPoints
    );
  }).length;

  if (verifyOnly) {
    assert(
      stageLock.engine_version === OFFICIAL_RACE_ENGINE_VERSION,
      "Le verrou corrigé n'est pas déployé.",
    );
    equal(stageLock.simulation_data, corrected, "Replay officiel corrigé");
    const correctionRows = await rows(
      db
        .from("official_race_historical_corrections")
        .select("correction_key,after_summary,before_snapshot")
        .eq("correction_key", correctionKey),
      "journal de correction",
    );
    assert(
      correctionRows.length === 1 &&
        correctionRows[0].after_summary?.status === "applied",
      "Correction non finalisée dans le journal.",
    );
    const persistence = await verifyPersistedResults({
      stages,
      locksByStageId,
      corrected,
    });
    const ancillary = await loadAncillaryRows({
      stages,
      corrected,
      expectOriginalInterviews: false,
    });
    equal(ancillary.newsBefore, ancillary.newsAfter, "Actualités corrigées");
    assert(
      ancillary.interviewsBefore.length === 0,
      "Des interviews obsolètes subsistent après la correction.",
    );
    console.log(
      JSON.stringify(
        {
          mode: "verify",
          engineVersion: stageLock.engine_version,
          persistence,
          newsRows: ancillary.newsAfter.length,
          resetInterviews: true,
          hexa: summarizeHexa(corrected),
          backupBytes: JSON.stringify(correctionRows[0].before_snapshot).length,
        },
        null,
        2,
      ),
    );
    return;
  }

  assert(
    stageLock.engine_version === sourceEngineVersion ||
      stageLock.engine_version === OFFICIAL_RACE_ENGINE_VERSION,
    `Version source inattendue : ${stageLock.engine_version}.`,
  );
  assert(
    stages.slice(0, 9).every((stage) => stage.status === "completed") &&
      stages[9].status === "planned" &&
      !locksByStageId.has(nextStageId),
    "La course a progressé depuis l'audit ; ce rattrapage doit être réévalué.",
  );
  const ancillary = await loadAncillaryRows({ stages, corrected });

  const oldRuns = stages.slice(0, 9).map((stage) => ({
    stage: { id: stage.id, stageType: stage.stage_type },
    simulation: locksByStageId.get(stage.id)?.simulation_data,
  }));
  const newRuns = oldRuns.map((run) =>
    run.stage.id === stageId
      ? { ...run, simulation: corrected }
      : run,
  );
  const oldStandings = buildOfficialStageRaceStandings(oldRuns as any);
  const newStandings = buildOfficialStageRaceStandings(newRuns as any);
  const chandlerId = [...ridersById.entries()].find(
    ([, rider]) => rider.name === "Chandler Davis",
  )?.[0];
  assert(chandlerId, "Chandler Davis absent du replay.");
  const chandlerStage = corrected.results.find(
    (result) => result.riderId === chandlerId,
  );
  const chandlerGeneral = newStandings.general.findIndex(
    (result) => result.riderId === chandlerId,
  );
  assert(
    chandlerStage?.rank === 14 && chandlerGeneral === 8,
    `Résultat de contrôle inattendu pour Chandler (${chandlerStage?.rank}/${chandlerGeneral + 1}).`,
  );

  const auditSummary = {
    mode: apply ? "apply" : "dry-run",
    engine: {
      before: stageLock.engine_version,
      after: OFFICIAL_RACE_ENGINE_VERSION,
    },
    winnerUnchanged:
      stageLock.simulation_data.results[0]?.riderId ===
      corrected.results[0]?.riderId,
    changedStageResults,
    hexaBefore: summarizeHexa(stageLock.simulation_data),
    hexaAfter: summarizeHexa(corrected),
    chandlerGeneral: {
      before:
        oldStandings.general.findIndex(
          (result) => result.riderId === chandlerId,
        ) + 1,
      after: chandlerGeneral + 1,
    },
  };

  const roster = await loadRosterContext(stageLock.input_data);
  const oldClassifications = buildStageClassifications(stages, locksByStageId);
  const correctedLocks = new Map(locksByStageId);
  correctedLocks.set(stageId, {
    ...stageLock,
    simulation_data: corrected,
    engine_version: OFFICIAL_RACE_ENGINE_VERSION,
  });
  const newClassifications = buildStageClassifications(stages, correctedLocks);
  const riderAgeById = new Map<string, number>(
    stageLock.input_data.riders.map((rider: any) => [rider.id, rider.age]),
  );
  const oldSecondary = buildPersistedStageRaceStandings(
    oldClassifications,
    riderAgeById,
  );
  const newSecondary = buildPersistedStageRaceStandings(
    newClassifications,
    riderAgeById,
  );
  const expectedSecondaryBefore = createExpectedSecondaryRows({
    standings: oldSecondary,
    roster,
  });
  const secondaryAfter = createExpectedSecondaryRows({
    standings: newSecondary,
    roster,
  });
  const currentSecondary = await rows(
    db
      .from("race_secondary_results")
      .select(
        "id,classification_type,race_roster_id,team_season_id,historical_team_name,rank,points,total_time_ms",
      )
      .eq("race_edition_id", editionId)
      .order("classification_type")
      .order("rank"),
    "classements annexes sources",
  );
  equal(
    currentSecondary.map((row) => ({
      classificationType: row.classification_type,
      rosterId: row.race_roster_id,
      teamSeasonId: row.team_season_id,
      historicalName: row.historical_team_name,
      rank: row.rank,
      points: row.points,
      time: row.total_time_ms,
    })),
    expectedSecondaryBefore,
    "Classements annexes sources",
  );

  const currentStageRows = await rows(
    db
      .from("stage_results")
      .select(
        "id,race_roster_id,status,rank,elapsed_time_ms,gap_to_winner_ms,mountain_points,sprint_points,time_bonus_seconds,time_penalty_seconds,abandonment_reason,injury_id",
      )
      .eq("stage_id", stageId),
    "résultats sources de l'étape",
  );
  assert(currentStageRows.length === 177, "Résultats sources incomplets.");
  const oldStageByRiderId = new Map<string, any>(
    oldClassifications[8].map(
      (result: any) => [result.riderId, result] as const,
    ),
  );
  const newStageByRiderId = new Map<string, any>(
    newClassifications[8].map(
      (result: any) => [result.riderId, result] as const,
    ),
  );
  const stageRows = currentStageRows.map((row) => {
    const riderId = roster.riderByRosterId.get(row.race_roster_id);
    const oldResult = riderId ? oldStageByRiderId.get(riderId) : null;
    const newResult = riderId ? newStageByRiderId.get(riderId) : null;
    assert(riderId && oldResult && newResult, `Résultat sans coureur : ${row.id}.`);
    equal(
      [
        row.status,
        row.rank,
        row.elapsed_time_ms,
        row.gap_to_winner_ms,
        row.mountain_points,
        row.sprint_points,
        row.time_bonus_seconds,
        row.time_penalty_seconds,
        row.abandonment_reason,
      ],
      [
        oldResult.status,
        oldResult.rank,
        oldResult.elapsedTimeMs,
        oldResult.gapToWinnerMs,
        oldResult.mountainPoints,
        oldResult.sprintPoints,
        oldResult.timeBonusSeconds,
        oldResult.timePenaltySeconds,
        oldResult.abandonmentReason,
      ],
      `Résultat source de ${riderId}`,
    );
    return {
      resultId: row.id,
      rosterId: row.race_roster_id,
      riderId,
      oldStatus: row.status,
      oldRank: row.rank,
      oldTime: row.elapsed_time_ms,
      oldGap: row.gap_to_winner_ms,
      oldMountain: row.mountain_points,
      oldSprint: row.sprint_points,
      oldBonus: row.time_bonus_seconds,
      oldPenalty: row.time_penalty_seconds,
      oldAbandonment: row.abandonment_reason,
      oldInjuryId: row.injury_id,
      newStatus: newResult.status,
      newRank: newResult.rank,
      newTime: newResult.elapsedTimeMs,
      newGap: newResult.gapToWinnerMs,
      newMountain: newResult.mountainPoints,
      newSprint: newResult.sprintPoints,
      newBonus: newResult.timeBonusSeconds,
      newPenalty: newResult.timePenaltySeconds,
      newAbandonment: newResult.abandonmentReason,
      newInjuryId: row.injury_id,
    };
  });

  const currentAttackRows = await rows(
    db
      .from("stage_attack_participants")
      .select("race_roster_id,participation_type,first_segment_number")
      .eq("stage_id", stageId)
      .order("race_roster_id"),
    "attaquants sources",
  );
  const attackRowsAfter = getStageAttackParticipants(corrected)
    .map((participant) => ({
      rosterId: roster.rosterByRiderId.get(participant.riderId)?.id ?? null,
      riderId: participant.riderId,
      participationType: participant.participationType,
      firstSegmentNumber: participant.firstSegmentNumber,
    }))
    .sort((left, right) =>
      (left.rosterId ?? "").localeCompare(right.rosterId ?? ""),
    );
  assert(
    attackRowsAfter.every((row) => row.rosterId),
    "Un attaquant corrigé est absent de la startlist.",
  );

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          ...auditSummary,
          secondaryBefore: {
            mountain: oldSecondary.mountain.length,
            sprint: oldSecondary.sprint.length,
            youth: oldSecondary.youth.length,
            team: oldSecondary.teams.length,
          },
          secondaryAfter: {
            mountain: newSecondary.mountain.length,
            sprint: newSecondary.sprint.length,
            youth: newSecondary.youth.length,
            team: newSecondary.teams.length,
          },
          attackRows: {
            before: currentAttackRows.length,
            after: attackRowsAfter.length,
          },
          newsRows: {
            before: ancillary.newsBefore.length,
            after: ancillary.newsAfter.length,
          },
          interviewsToReset: ancillary.interviewsBefore.length,
        },
        null,
        2,
      ),
    );
    return;
  }

  const repair = await db.rpc(
    "repair_boucle_stage9_race_dynamics_20260923",
    {
      p_payload: {
        editionId,
        stageId,
        oldEngineVersion: sourceEngineVersion,
        newEngineVersion: OFFICIAL_RACE_ENGINE_VERSION,
        simulation: corrected,
        stageRows,
        secondaryBefore: currentSecondary.map((row) => ({
          id: row.id,
          classificationType: row.classification_type,
          rosterId: row.race_roster_id,
          teamSeasonId: row.team_season_id,
          historicalName: row.historical_team_name,
          rank: row.rank,
          points: row.points,
          time: row.total_time_ms,
        })),
        secondaryAfter,
        auditSummary: {
          changedStageResults,
          chandlerStageRank: chandlerStage.rank,
          chandlerGeneralRank: chandlerGeneral + 1,
        },
        attackBefore: currentAttackRows.map((row) => ({
          rosterId: row.race_roster_id,
          participationType: row.participation_type,
          firstSegmentNumber: row.first_segment_number,
        })),
        attackAfter: attackRowsAfter,
        newsBefore: ancillary.newsBefore,
        newsAfter: ancillary.newsAfter,
        interviewsBefore: ancillary.interviewsBefore,
        interviewReactionsBefore: ancillary.reactionsBefore,
      },
    },
  );
  if (repair.error) {
    throw new Error(`Rattrapage transactionnel : ${repair.error.message}`);
  }

  const refreshed = await loadState();
  assert(
    refreshed.stageLock.engine_version === OFFICIAL_RACE_ENGINE_VERSION,
    "Le verrou officiel corrigé n'a pas été conservé.",
  );
  equal(
    refreshed.stageLock.simulation_data,
    corrected,
    "Replay officiel après consolidation",
  );
  const persistence = await verifyPersistedResults({
    stages: refreshed.stages,
    locksByStageId: refreshed.locksByStageId,
    corrected,
  });
  const verifiedAncillary = await loadAncillaryRows({
    stages: refreshed.stages,
    corrected,
    expectOriginalInterviews: false,
  });
  equal(verifiedAncillary.newsBefore, verifiedAncillary.newsAfter, "Actualités corrigées");
  assert(
    verifiedAncillary.interviewsBefore.length === 0,
    "Des interviews obsolètes subsistent après la correction.",
  );

  console.log(
    JSON.stringify(
      {
        ...auditSummary,
        repair: repair.data,
        persistence,
        newsRows: verifiedAncillary.newsAfter.length,
        resetInterviews: ancillary.interviewsBefore.length,
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
