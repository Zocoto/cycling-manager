import "server-only";

import {
  calculateNationalChampionshipReward,
  calculateRaceRewardBreakdown,
  calculateStagePrize,
  type RaceRewardScope,
} from "@/lib/game/economy";
import type {
  RaceCalendarEdition,
  RaceCalendarStage,
  SeasonRaceCalendar,
} from "@/lib/game/race-calendar";
import { getStageLiveState } from "@/lib/game/race-live";
import {
  buildPersistedGeneralClassification,
  buildPersistedStageRaceStandings,
  normalizeOfficialResultGapsToLeader,
  type OfficialAttackParticipant,
  type OfficialRaceEditionResults,
  type OfficialRaceResultsDirectory,
  type OfficialResultStatus,
  type OfficialRiderResult,
  type OfficialSecondaryClassification,
  type PersistedStageResultForGeneral,
} from "@/lib/game/race-results";
import { createCalendarSimulationInput } from "@/lib/game/race-simulation-demo";
import {
  getStageAttackParticipants,
  simulateRaceStage,
  type StageRaceStandings,
  type StageSimulationResult,
} from "@/lib/game/race-simulation";
import { hasSpecialAbility } from "@/lib/game/special-abilities";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { persistPostRaceNewsEvents } from "@/services/post-race-news";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type RosterContext = {
  rosterId: string;
  riderId: string;
  teamSeasonId: string;
};

type RaceRegistrationRow = {
  id: string;
  race_edition_id: string;
  team_season_id: string;
};

type RaceRosterRow = {
  id: string;
  race_registration_id: string;
  rider_id: string;
};

type TeamSeasonRow = {
  id: string;
  team_id: string;
  display_name: string;
};

type StageResultRow = {
  stage_id: string;
  race_roster_id: string;
  status: Exclude<OfficialResultStatus, "withdrawn">;
  rank: number | null;
  elapsed_time_ms: number | null;
  gap_to_winner_ms: number | null;
  mountain_points: number;
  sprint_points: number;
  abandonment_reason: string | null;
  injury_id: string | null;
};

type RaceResultRow = {
  race_edition_id: string;
  race_roster_id: string;
  status:
    | "classified"
    | "did_not_start"
    | "did_not_finish"
    | "disqualified"
    | "outside_time_limit"
    | "withdrawn";
  final_rank: number | null;
  total_time_ms: number | null;
  gap_to_winner_ms: number | null;
  abandonment_reason: string | null;
};

type SecondaryResultRow = {
  race_edition_id: string;
  classification_type: "mountain" | "sprint" | "youth" | "team";
  race_roster_id: string | null;
  team_season_id: string | null;
  rank: number;
  points: number | null;
  total_time_ms: number | null;
};

type StageAttackParticipantRow = {
  stage_id: string;
  race_roster_id: string;
  participation_type: "breakaway" | "chase";
  first_segment_number: number;
};

export async function settleFinishedRaceResults(
  calendar: SeasonRaceCalendar,
  now = new Date()
) {
  const admin = createSupabaseAdminClient();
  let processedStages = 0;
  let completedEditions = 0;

  for (const edition of calendar.editions) {
    if (edition.status === "completed" || edition.status === "cancelled") {
      continue;
    }

    const minimumFieldSize =
      edition.competitionType === "standard" ? 2 : 1;
    if (edition.engagedRiders.length < minimumFieldSize) continue;

    const rosterByRiderId = await loadRosterContext(admin, edition.id);
    if (rosterByRiderId.size < minimumFieldSize) continue;

    const unavailableRiderIds = new Set<string>();
    const finishedSimulations: StageSimulationResult[] = [];
    const persistedStageClassifications: Array<{
      stage: RaceCalendarStage;
      results: OfficialRiderResult[];
    }> = [];
    const orderedStages = [...edition.stages].sort(
      (first, second) => first.stageNumber - second.stageNumber
    );
    let persistedStageRows = await loadPersistedStageResultRows(
      admin,
      orderedStages.map((stage) => stage.id)
    );

    for (const stage of orderedStages) {
      if (getStageLiveState(stage, now).status !== "finished") break;

      const input = createCalendarSimulationInput({
        edition,
        stage,
        seed: `${edition.id}:${stage.id}:official`,
      });
      const simulation = simulateRaceStage({
        ...input,
        unavailableRiderIds: [...unavailableRiderIds],
      });
      let stageRows = persistedStageRows.filter(
        (row) => row.stage_id === stage.id
      );
      const stageAlreadyComplete = stageRows.length === rosterByRiderId.size;

      if (!stageAlreadyComplete) {
        await persistStageResult({
          admin,
          edition,
          stage,
          simulation,
          rosterByRiderId,
        });
        processedStages += 1;
        stageRows = await loadPersistedStageResultRows(admin, [stage.id]);
        persistedStageRows = [
          ...persistedStageRows.filter((row) => row.stage_id !== stage.id),
          ...stageRows,
        ];
      }

      if (stageRows.length !== rosterByRiderId.size) {
        throw new Error(
          `Le classement de ${stage.name} est incomplet (${stageRows.length}/${rosterByRiderId.size}).`
        );
      }

      const officialStageResults = buildPersistedStageClassification({
        rows: stageRows,
        edition,
        rosterByRiderId,
      });
      persistedStageClassifications.push({
        stage,
        results: officialStageResults,
      });
      finishedSimulations.push(simulation);

      for (const result of officialStageResults) {
        if (result.status !== "finished") {
          unavailableRiderIds.add(result.riderId);
        }
      }
      for (const row of stageRows) {
        if (!row.injury_id) continue;
        const riderId = findRiderIdByRosterId(
          rosterByRiderId,
          row.race_roster_id
        );
        if (riderId) unavailableRiderIds.add(riderId);
      }
    }

    if (persistedStageClassifications.length === 0) continue;

    const standings = buildPersistedStageRaceStandings(
      persistedStageClassifications.map(
        (classification) => classification.results
      ),
      new Map(edition.engagedRiders.map((rider) => [rider.id, rider.age]))
    );
    if (edition.raceFormat === "stage_race") {
      await persistSecondaryClassifications({
        admin,
        edition,
        standings,
        rosterByRiderId,
      });
    }

    const editionIsComplete =
      persistedStageClassifications.length === orderedStages.length;
    if (!editionIsComplete) continue;

    const general = buildPersistedGeneralClassification(
      persistedStageClassifications.map((classification) =>
        classification.results.map(toPersistedGeneralInput)
      )
    );
    const raceClassificationAlreadyComplete =
      await hasCompleteRaceClassification(
        admin,
        edition.id,
        rosterByRiderId.size
      );
    await persistRaceClassification({
      admin,
      edition,
      finalStage: orderedStages.at(-1)!,
      general,
      simulations: finishedSimulations,
      standings: edition.raceFormat === "stage_race" ? standings : null,
      stageClassifications: persistedStageClassifications,
      rosterByRiderId,
    });

    const { error: editionError } = await admin
      .from("race_editions")
      .update({ status: "completed" })
      .eq("id", edition.id);
    assertQuery(editionError, `la clôture de ${edition.name}`);
    if (!raceClassificationAlreadyComplete) completedEditions += 1;
  }

  return { processedStages, completedEditions };
}

export async function getOfficialRaceResults(
  calendar: SeasonRaceCalendar
): Promise<OfficialRaceResultsDirectory> {
  const admin = createSupabaseAdminClient();
  const editionIds = calendar.editions.map((edition) => edition.id);
  const stageIds = calendar.editions.flatMap((edition) =>
    edition.stages.map((stage) => stage.id)
  );

  if (editionIds.length === 0 || stageIds.length === 0) return {};

  const [
    stageResultQuery,
    raceResultQuery,
    secondaryQuery,
    registrationQuery,
    attackParticipantQuery,
  ] =
    await Promise.all([
      admin
        .from("stage_results")
        .select(
          "stage_id, race_roster_id, status, rank, elapsed_time_ms, gap_to_winner_ms, mountain_points, sprint_points, abandonment_reason, injury_id"
        )
        .in("stage_id", stageIds)
        .returns<StageResultRow[]>(),
      admin
        .from("race_results")
        .select(
          "race_edition_id, race_roster_id, status, final_rank, total_time_ms, gap_to_winner_ms, abandonment_reason"
        )
        .in("race_edition_id", editionIds)
        .returns<RaceResultRow[]>(),
      admin
        .from("race_secondary_results")
        .select(
          "race_edition_id, classification_type, race_roster_id, team_season_id, rank, points, total_time_ms"
        )
        .in("race_edition_id", editionIds)
        .returns<SecondaryResultRow[]>(),
      admin
        .from("race_registrations")
        .select("id, race_edition_id, team_season_id")
        .in("race_edition_id", editionIds)
        .returns<RaceRegistrationRow[]>(),
      admin
        .from("stage_attack_participants")
        .select(
          "stage_id, race_roster_id, participation_type, first_segment_number"
        )
        .in("stage_id", stageIds)
        .returns<StageAttackParticipantRow[]>(),
    ]);

  assertQuery(stageResultQuery.error, "les résultats d’étapes");
  assertQuery(raceResultQuery.error, "les classements généraux");
  assertQuery(secondaryQuery.error, "les classements annexes");
  assertQuery(registrationQuery.error, "les inscriptions historiques");
  assertQuery(attackParticipantQuery.error, "les attaquants de course");

  const registrations = registrationQuery.data ?? [];
  const registrationIds = registrations.map((row) => row.id);
  const teamSeasonIds = [...new Set(registrations.map((row) => row.team_season_id))];
  const [rosterQuery, teamSeasonQuery] = await Promise.all([
    registrationIds.length > 0
      ? admin
          .from("race_rosters")
          .select("id, race_registration_id, rider_id")
          .in("race_registration_id", registrationIds)
          .returns<RaceRosterRow[]>()
      : Promise.resolve({ data: [] as RaceRosterRow[], error: null }),
    teamSeasonIds.length > 0
      ? admin
          .from("team_seasons")
          .select("id, team_id, display_name")
          .in("id", teamSeasonIds)
          .returns<TeamSeasonRow[]>()
      : Promise.resolve({ data: [] as TeamSeasonRow[], error: null }),
  ]);

  assertQuery(rosterQuery.error, "les startlists historiques");
  assertQuery(teamSeasonQuery.error, "les équipes historiques");

  const registrationById = new Map(registrations.map((row) => [row.id, row]));
  const rosterById = new Map((rosterQuery.data ?? []).map((row) => [row.id, row]));
  const teamSeasonById = new Map(
    (teamSeasonQuery.data ?? []).map((row) => [row.id, row])
  );
  const directory: OfficialRaceResultsDirectory = {};

  for (const edition of calendar.editions) {
    const riderById = new Map(
      edition.engagedRiders.map((rider) => [rider.id, rider])
    );
    const stageClassifications = [...edition.stages]
      .sort((first, second) => first.stageNumber - second.stageNumber)
      .map((stage) => {
        const results = normalizeOfficialResultGapsToLeader(
          (stageResultQuery.data ?? [])
            .filter((row) => row.stage_id === stage.id)
            .map((row) =>
              toOfficialStageRiderResult({
                row,
                editionId: edition.id,
                rosterById,
                registrationById,
                teamSeasonById,
                riderById,
              })
            )
            .filter((row): row is OfficialRiderResult => row !== null)
            .sort(compareOfficialResults)
        );

        return {
          stageId: stage.id,
          stageNumber: stage.stageNumber,
          stageName: stage.name,
          results,
        };
      })
      .filter((stage) => stage.results.length > 0);

    if (stageClassifications.length === 0) continue;

    const persistedGeneral = normalizeOfficialResultGapsToLeader(
      (raceResultQuery.data ?? [])
        .filter((row) => row.race_edition_id === edition.id)
        .map((row) =>
          toOfficialRaceRiderResult({
            row,
            editionId: edition.id,
            rosterById,
            registrationById,
            teamSeasonById,
            riderById,
          })
        )
        .filter((row): row is OfficialRiderResult => row !== null)
        .sort(compareOfficialResults)
    );
    const general =
      persistedGeneral.length > 0
        ? persistedGeneral
        : buildPersistedGeneralClassification(
            stageClassifications.map((stage) =>
              stage.results.map(toPersistedGeneralInput)
            )
          );
    const secondary = buildOfficialSecondaryClassifications({
      rows: (secondaryQuery.data ?? []).filter(
        (row) => row.race_edition_id === edition.id
      ),
      editionId: edition.id,
      rosterById,
      registrationById,
      teamSeasonById,
      riderById,
    });
    const attackParticipants = buildOfficialAttackParticipants({
      rows: attackParticipantQuery.data ?? [],
      edition,
      rosterById,
      registrationById,
      teamSeasonById,
      riderById,
    });

    directory[edition.id] = {
      editionId: edition.id,
      isComplete: persistedGeneral.length > 0,
      stages: stageClassifications,
      general,
      generalIsProvisional:
        edition.raceFormat === "stage_race" && persistedGeneral.length === 0,
      secondary,
      attackParticipants,
    } satisfies OfficialRaceEditionResults;
  }

  return directory;
}

async function loadRosterContext(admin: AdminClient, editionId: string) {
  const { data: registrations, error: registrationError } = await admin
    .from("race_registrations")
    .select("id, race_edition_id, team_season_id")
    .eq("race_edition_id", editionId)
    .eq("status", "accepted")
    .returns<RaceRegistrationRow[]>();
  assertQuery(registrationError, "les inscriptions officielles");

  const registrationById = new Map(
    (registrations ?? []).map((row) => [row.id, row])
  );
  const registrationIds = [...registrationById.keys()];
  if (registrationIds.length === 0) return new Map<string, RosterContext>();

  const { data: rosters, error: rosterError } = await admin
    .from("race_rosters")
    .select("id, race_registration_id, rider_id")
    .in("race_registration_id", registrationIds)
    .in("status", ["selected", "confirmed"])
    .returns<RaceRosterRow[]>();
  assertQuery(rosterError, "la startlist officielle");

  return new Map(
    (rosters ?? []).flatMap((roster) => {
      const registration = registrationById.get(roster.race_registration_id);
      return registration
        ? [
            [
              roster.rider_id,
              {
                rosterId: roster.id,
                riderId: roster.rider_id,
                teamSeasonId: registration.team_season_id,
              },
            ] as const,
          ]
        : [];
    })
  );
}

async function loadPersistedStageResultRows(
  admin: AdminClient,
  stageIds: string[]
) {
  if (stageIds.length === 0) return [] as StageResultRow[];

  const { data, error } = await admin
    .from("stage_results")
    .select(
      "stage_id, race_roster_id, status, rank, elapsed_time_ms, gap_to_winner_ms, mountain_points, sprint_points, abandonment_reason, injury_id"
    )
    .in("stage_id", stageIds)
    .returns<StageResultRow[]>();
  assertQuery(error, "les résultats d'étapes déjà enregistrés");
  return data ?? [];
}

async function hasCompleteRaceClassification(
  admin: AdminClient,
  editionId: string,
  expectedRiderCount: number
) {
  const { count, error } = await admin
    .from("race_results")
    .select("id", { count: "exact", head: true })
    .eq("race_edition_id", editionId);
  assertQuery(error, "le contrôle du classement général existant");
  return count === expectedRiderCount;
}

function buildPersistedStageClassification({
  rows,
  edition,
  rosterByRiderId,
}: {
  rows: StageResultRow[];
  edition: RaceCalendarEdition;
  rosterByRiderId: Map<string, RosterContext>;
}) {
  const riderById = new Map(
    edition.engagedRiders.map((rider) => [rider.id, rider])
  );

  return normalizeOfficialResultGapsToLeader(
    rows
      .flatMap((row) => {
        const riderId = findRiderIdByRosterId(
          rosterByRiderId,
          row.race_roster_id
        );
        const rider = riderId ? riderById.get(riderId) : null;
        return rider
          ? [
              {
                riderId: rider.id,
                riderName: rider.name,
                teamId: rider.teamId,
                teamName: rider.teamName,
                rank: row.rank,
                status: row.status,
                elapsedTimeMs: row.elapsed_time_ms,
                gapToWinnerMs: row.gap_to_winner_ms,
                mountainPoints: row.mountain_points,
                sprintPoints: row.sprint_points,
                abandonmentReason: row.abandonment_reason,
              } satisfies OfficialRiderResult,
            ]
          : [];
      })
      .sort(compareOfficialResults)
  );
}

function findRiderIdByRosterId(
  rosterByRiderId: Map<string, RosterContext>,
  rosterId: string
) {
  for (const [riderId, context] of rosterByRiderId) {
    if (context.rosterId === rosterId) return riderId;
  }
  return null;
}

async function persistStageResult({
  admin,
  edition,
  stage,
  simulation,
  rosterByRiderId,
}: {
  admin: AdminClient;
  edition: RaceCalendarEdition;
  stage: RaceCalendarStage;
  simulation: StageSimulationResult;
  rosterByRiderId: Map<string, RosterContext>;
}) {
  const injuryIdByRiderId = new Map<string, string>();
  const winnerElapsedTimeSeconds = Math.min(
    ...simulation.results
      .filter((result) => result.status === "finished")
      .map((result) => result.elapsedTimeSeconds)
  );

  for (const result of simulation.results) {
    if (!result.injury) continue;
    const existing = await admin
      .from("rider_injuries")
      .select("id")
      .eq("rider_id", result.riderId)
      .eq("source_stage_id", stage.id)
      .maybeSingle<{ id: string }>();
    assertQuery(existing.error, "la blessure de course existante");

    if (existing.data) {
      injuryIdByRiderId.set(result.riderId, existing.data.id);
      continue;
    }

    const departureTimestamp = stage.departureAt
      ? new Date(stage.departureAt).getTime()
      : Number.NaN;
    const recordedAtTimestamp = Number.isFinite(departureTimestamp)
      ? Math.min(
          Date.now(),
          departureTimestamp +
            Math.max(0, result.elapsedTimeSeconds) * 1_000
        )
      : Date.now();
    const startedAt = new Date(recordedAtTimestamp);
    const expectedRecoveryAt = new Date(
      startedAt.getTime() + result.injury.recoveryHours * 3_600_000
    );
    let inserted = await admin
      .from("rider_injuries")
      .insert({
        rider_id: result.riderId,
        source_stage_id: stage.id,
        injury_type: result.injury.type,
        diagnosis_code: result.injury.diagnosisCode,
        severity: result.injury.severity,
        recovery_days: result.injury.recoveryDays,
        recovery_hours: result.injury.recoveryHours,
        started_at: startedAt.toISOString(),
        base_expected_recovery_at: expectedRecoveryAt.toISOString(),
        expected_recovery_at: expectedRecoveryAt.toISOString(),
      })
      .select("id")
      .single<{ id: string }>();
    if (inserted.error?.code === "23505") {
      inserted = await admin
        .from("rider_injuries")
        .select("id")
        .eq("rider_id", result.riderId)
        .eq("source_stage_id", stage.id)
        .single<{ id: string }>();
    }
    assertQuery(inserted.error, "l’enregistrement d’une blessure de course");
    injuryIdByRiderId.set(result.riderId, inserted.data!.id);
  }

  const rows = simulation.results.map((result) => {
    const roster = requireRoster(rosterByRiderId, result.riderId);
    const finished = result.status === "finished";
    return {
      stage_id: stage.id,
      race_roster_id: roster.rosterId,
      status: result.status,
      rank: finished ? result.rank : null,
      elapsed_time_ms: finished ? result.elapsedTimeSeconds * 1_000 : null,
      gap_to_winner_ms:
        finished && Number.isFinite(winnerElapsedTimeSeconds)
          ? Math.max(
              0,
              result.elapsedTimeSeconds - winnerElapsedTimeSeconds
            ) * 1_000
          : null,
      mountain_points: simulation.mountainPoints[result.riderId] ?? 0,
      sprint_points: simulation.sprintPoints[result.riderId] ?? 0,
      abandonment_reason: result.abandonment ? "crash" : null,
      injury_id: injuryIdByRiderId.get(result.riderId) ?? null,
      updated_at: new Date().toISOString(),
    };
  });
  const { error } = await admin
    .from("stage_results")
    .upsert(rows, { onConflict: "stage_id,race_roster_id" });
  assertQuery(error, `l’enregistrement du classement de ${stage.name}`);

  await persistStageAttackParticipants({
    admin,
    stage,
    simulation,
    rosterByRiderId,
  });

  await persistPostRaceNewsEvents({
    admin,
    edition,
    stage,
    simulation,
  });

  const { error: stageError } = await admin
    .from("stages")
    .update({ status: "completed" })
    .eq("id", stage.id);
  assertQuery(stageError, `la clôture de ${stage.name}`);
}

async function persistStageAttackParticipants({
  admin,
  stage,
  simulation,
  rosterByRiderId,
}: {
  admin: AdminClient;
  stage: RaceCalendarStage;
  simulation: StageSimulationResult;
  rosterByRiderId: Map<string, RosterContext>;
}) {
  const participants = getStageAttackParticipants(simulation);
  const rows = participants.map((participant) => ({
    stage_id: stage.id,
    race_roster_id: requireRoster(
      rosterByRiderId,
      participant.riderId
    ).rosterId,
    participation_type: participant.participationType,
    first_segment_number: participant.firstSegmentNumber,
  }));

  if (rows.length > 0) {
    const { error } = await admin
      .from("stage_attack_participants")
      .upsert(rows, { onConflict: "stage_id,race_roster_id" });
    assertQuery(error, `les attaquants de ${stage.name}`);
  }

  const { data: persistedRows, error: persistedError } = await admin
    .from("stage_attack_participants")
    .select("race_roster_id")
    .eq("stage_id", stage.id)
    .returns<Array<{ race_roster_id: string }>>();
  assertQuery(persistedError, `la vérification des attaquants de ${stage.name}`);

  const currentRosterIds = new Set(rows.map((row) => row.race_roster_id));
  const staleRosterIds = (persistedRows ?? [])
    .map((row) => row.race_roster_id)
    .filter((rosterId) => !currentRosterIds.has(rosterId));
  if (staleRosterIds.length > 0) {
    const { error: staleError } = await admin
      .from("stage_attack_participants")
      .delete()
      .eq("stage_id", stage.id)
      .in("race_roster_id", staleRosterIds);
    assertQuery(staleError, `le nettoyage des attaquants de ${stage.name}`);
  }
}

async function persistSecondaryClassifications({
  admin,
  edition,
  standings,
  rosterByRiderId,
}: {
  admin: AdminClient;
  edition: RaceCalendarEdition;
  standings: StageRaceStandings;
  rosterByRiderId: Map<string, RosterContext>;
}) {
  const teamSeasonByTeamId = new Map<string, string>();
  for (const rider of edition.engagedRiders) {
    const context = rosterByRiderId.get(rider.id);
    if (context) teamSeasonByTeamId.set(rider.teamId, context.teamSeasonId);
  }

  const rows = [
    ...standings.mountain.map((entry, index) => ({
      race_edition_id: edition.id,
      classification_type: "mountain",
      race_roster_id: requireRoster(rosterByRiderId, entry.riderId).rosterId,
      team_season_id: null,
      rank: index + 1,
      points: entry.points,
      total_time_ms: null,
    })),
    ...standings.sprint.map((entry, index) => ({
      race_edition_id: edition.id,
      classification_type: "sprint",
      race_roster_id: requireRoster(rosterByRiderId, entry.riderId).rosterId,
      team_season_id: null,
      rank: index + 1,
      points: entry.points,
      total_time_ms: null,
    })),
    ...standings.youth.map((entry, index) => ({
      race_edition_id: edition.id,
      classification_type: "youth",
      race_roster_id: requireRoster(rosterByRiderId, entry.riderId).rosterId,
      team_season_id: null,
      rank: index + 1,
      points: null,
      total_time_ms: entry.elapsedTimeSeconds * 1_000,
    })),
    ...standings.teams.flatMap((entry, index) => {
      const teamSeasonId = teamSeasonByTeamId.get(entry.teamId);
      return teamSeasonId
        ? [
            {
              race_edition_id: edition.id,
              classification_type: "team",
              race_roster_id: null,
              team_season_id: teamSeasonId,
              rank: index + 1,
              points: null,
              total_time_ms: entry.elapsedTimeSeconds * 1_000,
            },
          ]
        : [];
    }),
  ];

  for (const classificationType of ["mountain", "sprint", "youth", "team"] as const) {
    const classificationRows = rows.filter(
      (row) => row.classification_type === classificationType
    );
    if (classificationRows.length > 0) {
      const { error } = await admin
        .from("race_secondary_results")
        .upsert(classificationRows, {
          onConflict: "race_edition_id,classification_type,rank",
        });
      assertQuery(error, `le classement ${classificationType} de ${edition.name}`);
    }

    let staleRowsQuery = admin
      .from("race_secondary_results")
      .delete()
      .eq("race_edition_id", edition.id)
      .eq("classification_type", classificationType);
    if (classificationRows.length > 0) {
      staleRowsQuery = staleRowsQuery.gt("rank", classificationRows.length);
    }
    const { error: staleRowsError } = await staleRowsQuery;
    assertQuery(
      staleRowsError,
      `le nettoyage du classement ${classificationType} de ${edition.name}`
    );
  }
}

async function persistRaceClassification({
  admin,
  edition,
  finalStage,
  general,
  simulations,
  standings,
  stageClassifications,
  rosterByRiderId,
}: {
  admin: AdminClient;
  edition: RaceCalendarEdition;
  finalStage: RaceCalendarStage;
  general: OfficialRiderResult[];
  simulations: StageSimulationResult[];
  standings: StageRaceStandings | null;
  stageClassifications: Array<{
    stage: RaceCalendarStage;
    results: OfficialRiderResult[];
  }>;
  rosterByRiderId: Map<string, RosterContext>;
}) {
  const nowIso = new Date().toISOString();
  const rows = general.map((result) => ({
    race_edition_id: edition.id,
    race_roster_id: requireRoster(rosterByRiderId, result.riderId).rosterId,
    status: result.status === "finished" ? "classified" : result.status,
    final_rank: result.status === "finished" ? result.rank : null,
    total_time_ms: result.status === "finished" ? result.elapsedTimeMs : null,
    gap_to_winner_ms:
      result.status === "finished" ? result.gapToWinnerMs : null,
    abandonment_reason: result.abandonmentReason,
    updated_at: nowIso,
  }));
  const { error } = await admin
    .from("race_results")
    .upsert(rows, { onConflict: "race_edition_id,race_roster_id" });
  assertQuery(error, `le classement final de ${edition.name}`);

  if (edition.raceFormat === "stage_race") {
    await persistStagePrizeRewards({
      admin,
      edition,
      finalStage,
      stageClassifications,
      rosterByRiderId,
    });
  }

  const secondaryWinners = standings
    ? new Map<string, Array<"mountain" | "sprint" | "youth" | "team">>(
        general.map((result) => [result.riderId, []])
      )
    : new Map<string, Array<"mountain" | "sprint" | "youth" | "team">>();
  if (standings?.mountain[0]) {
    secondaryWinners.get(standings.mountain[0].riderId)?.push("mountain");
  }
  if (standings?.sprint[0]) {
    secondaryWinners.get(standings.sprint[0].riderId)?.push("sprint");
  }
  if (standings?.youth[0]) {
    secondaryWinners.get(standings.youth[0].riderId)?.push("youth");
  }
  if (standings?.teams[0]) {
    const teamPrizeRecipient = general.find(
      (result) => result.teamId === standings.teams[0].teamId
    );
    if (teamPrizeRecipient) {
      secondaryWinners.get(teamPrizeRecipient.riderId)?.push("team");
    }
  }

  for (const result of general) {
    const mountainPrimesWon = countPrimeWins(
      simulations,
      result.riderId,
      "mountain"
    );
    const intermediateSprintsWon = countPrimeWins(
      simulations,
      result.riderId,
      "intermediate_sprint"
    );
    const rewardBreakdown = edition.competitionType === "standard"
      ? calculateRaceRewardBreakdown({
          tier: edition.categoryCode,
          scope: getRewardScope(edition),
          finalRank: result.rank,
          secondaryClassifications: secondaryWinners.get(result.riderId) ?? [],
          mountainPrimesWon,
          intermediateSprintsWon,
        })
      : null;
    const reward = rewardBreakdown?.total
      ?? calculateNationalChampionshipReward({ finalRank: result.rank });
    if (
      reward.reputation === 0 &&
      reward.experience === 0 &&
      reward.cashPrize === 0 &&
      reward.uciPoints === 0
    ) {
      continue;
    }

    const roster = requireRoster(rosterByRiderId, result.riderId);
    const placement = result.rank === 1
      ? "Victoire"
      : result.rank
        ? `${result.rank}e place`
        : "Primes et classements annexes";
    const cashBreakdown = rewardBreakdown
      ? describeCashRewardBreakdown(rewardBreakdown)
      : null;
    const settlementDetail = edition.raceFormat === "stage_race"
      ? `${result.riderName} · ${placement}${cashBreakdown ? ` · ${cashBreakdown}` : ""} · règlement de fin de tour`
      : `${result.riderName} · ${placement}`;
    const { error: rewardError } = await admin.rpc(
      "apply_race_roster_competition_reward",
      {
        p_source_reference: `official-race:${edition.id}:rider:${result.riderId}:v1`,
        p_source_type: "race_result",
        p_race_roster_id: roster.rosterId,
        p_stage_id: finalStage.id,
        p_reputation_points: reward.reputation,
        p_experience_points: reward.experience,
        p_cash_prize: reward.cashPrize,
        p_uci_points: reward.uciPoints,
        p_is_victory: result.rank === 1,
        p_description: `${edition.name} — ${settlementDetail}`,
      }
    );
    assertQuery(rewardError, `les gains de ${result.riderName}`);
  }

  const attackedRiderIds = new Set(
    simulations.flatMap((simulation) =>
      getStageAttackParticipants(simulation).map(
        (participant) => participant.riderId
      )
    )
  );
  const winnerRiderId = general.find((result) => result.rank === 1)?.riderId;
  const riderById = new Map(
    simulations.flatMap((simulation) =>
      simulation.resolvedRiders.map((rider) => [rider.id, rider] as const)
    )
  );

  for (const [riderId, rider] of riderById) {
    if (!hasSpecialAbility(rider, "sandwich_man")) continue;
    const attacked = attackedRiderIds.has(riderId);
    const won = winnerRiderId === riderId;
    if (!attacked && !won) continue;

    const roster = requireRoster(rosterByRiderId, riderId);
    const reason = attacked && won
      ? "échappée et victoire"
      : attacked
        ? "échappée"
        : "victoire";
    const { error: sandwichRewardError } = await admin.rpc(
      "apply_race_roster_reputation_bonus",
      {
        p_source_reference: `special-ability:sandwich-man:edition:${edition.id}:rider:${riderId}:v1`,
        p_race_roster_id: roster.rosterId,
        p_stage_id: finalStage.id,
        p_reputation_points: 0.5,
        p_description: `${edition.name} — Homme Sandwich : ${reason}`,
      }
    );
    assertQuery(
      sandwichRewardError,
      `le bonus Homme Sandwich de ${rider.name}`
    );
  }
}

async function persistStagePrizeRewards({
  admin,
  edition,
  finalStage,
  stageClassifications,
  rosterByRiderId,
}: {
  admin: AdminClient;
  edition: RaceCalendarEdition;
  finalStage: RaceCalendarStage;
  stageClassifications: Array<{
    stage: RaceCalendarStage;
    results: OfficialRiderResult[];
  }>;
  rosterByRiderId: Map<string, RosterContext>;
}) {
  for (const { stage, results } of stageClassifications) {
    for (const result of results) {
      if (result.status !== "finished") continue;

      const cashPrize = calculateStagePrize({
        tier: edition.categoryCode,
        finalRank: result.rank ?? 0,
      });
      if (cashPrize === 0) continue;

      const roster = requireRoster(rosterByRiderId, result.riderId);
      const placement = result.rank === 1
        ? "Victoire d'étape"
        : `${result.rank}e place`;
      const { error: rewardError } = await admin.rpc(
        "apply_race_roster_competition_reward",
        {
          p_source_reference: `official-stage-prize:${edition.id}:stage:${stage.id}:rider:${result.riderId}:v1`,
          p_source_type: "stage_result",
          p_race_roster_id: roster.rosterId,
          // Toutes les primes sont comptabilisées au jour de la dernière étape.
          p_stage_id: finalStage.id,
          p_reputation_points: 0,
          p_experience_points: 0,
          p_cash_prize: cashPrize,
          p_uci_points: 0,
          p_is_victory: false,
          p_description: `${edition.name} — Étape ${stage.stageNumber} : ${stage.name} — ${result.riderName} · ${placement} · règlement de fin de tour`,
        }
      );
      assertQuery(
        rewardError,
        `la prime d'étape de ${stage.name} pour ${result.riderId}`
      );
    }
  }
}

function toOfficialStageRiderResult({
  row,
  editionId,
  rosterById,
  registrationById,
  teamSeasonById,
  riderById,
}: {
  row: StageResultRow;
  editionId: string;
  rosterById: Map<string, RaceRosterRow>;
  registrationById: Map<string, RaceRegistrationRow>;
  teamSeasonById: Map<string, TeamSeasonRow>;
  riderById: Map<string, RaceCalendarEdition["engagedRiders"][number]>;
}): OfficialRiderResult | null {
  const identity = resolveResultIdentity({
    rosterId: row.race_roster_id,
    editionId,
    rosterById,
    registrationById,
    teamSeasonById,
    riderById,
  });
  return identity
    ? {
        ...identity,
        rank: row.rank,
        status: row.status,
        elapsedTimeMs: row.elapsed_time_ms,
        gapToWinnerMs: row.gap_to_winner_ms,
        mountainPoints: row.mountain_points,
        sprintPoints: row.sprint_points,
        abandonmentReason: row.abandonment_reason,
      }
    : null;
}

function toOfficialRaceRiderResult({
  row,
  editionId,
  rosterById,
  registrationById,
  teamSeasonById,
  riderById,
}: {
  row: RaceResultRow;
  editionId: string;
  rosterById: Map<string, RaceRosterRow>;
  registrationById: Map<string, RaceRegistrationRow>;
  teamSeasonById: Map<string, TeamSeasonRow>;
  riderById: Map<string, RaceCalendarEdition["engagedRiders"][number]>;
}): OfficialRiderResult | null {
  const identity = resolveResultIdentity({
    rosterId: row.race_roster_id,
    editionId,
    rosterById,
    registrationById,
    teamSeasonById,
    riderById,
  });
  return identity
    ? {
        ...identity,
        rank: row.final_rank,
        status: row.status === "classified" ? "finished" : row.status,
        elapsedTimeMs: row.total_time_ms,
        gapToWinnerMs: row.gap_to_winner_ms,
        mountainPoints: 0,
        sprintPoints: 0,
        abandonmentReason: row.abandonment_reason,
      }
    : null;
}

function resolveResultIdentity({
  rosterId,
  editionId,
  rosterById,
  registrationById,
  teamSeasonById,
  riderById,
}: {
  rosterId: string;
  editionId: string;
  rosterById: Map<string, RaceRosterRow>;
  registrationById: Map<string, RaceRegistrationRow>;
  teamSeasonById: Map<string, TeamSeasonRow>;
  riderById: Map<string, RaceCalendarEdition["engagedRiders"][number]>;
}) {
  const roster = rosterById.get(rosterId);
  const registration = roster
    ? registrationById.get(roster.race_registration_id)
    : null;
  if (!roster || !registration || registration.race_edition_id !== editionId) {
    return null;
  }
  const rider = riderById.get(roster.rider_id);
  const teamSeason = teamSeasonById.get(registration.team_season_id);
  if (!rider || !teamSeason) return null;
  return {
    riderId: rider.id,
    riderName: rider.name,
    teamId: teamSeason.team_id,
    teamName: teamSeason.display_name,
  };
}

function buildOfficialAttackParticipants({
  rows,
  edition,
  rosterById,
  registrationById,
  teamSeasonById,
  riderById,
}: {
  rows: StageAttackParticipantRow[];
  edition: RaceCalendarEdition;
  rosterById: Map<string, RaceRosterRow>;
  registrationById: Map<string, RaceRegistrationRow>;
  teamSeasonById: Map<string, TeamSeasonRow>;
  riderById: Map<string, RaceCalendarEdition["engagedRiders"][number]>;
}): OfficialAttackParticipant[] {
  const stageNumberById = new Map(
    edition.stages.map((stage) => [stage.id, stage.stageNumber])
  );
  const participantByRiderId = new Map<string, OfficialAttackParticipant>();

  for (const row of rows) {
    const stageNumber = stageNumberById.get(row.stage_id);
    if (stageNumber === undefined) continue;
    const identity = resolveResultIdentity({
      rosterId: row.race_roster_id,
      editionId: edition.id,
      rosterById,
      registrationById,
      teamSeasonById,
      riderById,
    });
    if (!identity) continue;

    const existing = participantByRiderId.get(identity.riderId);
    participantByRiderId.set(identity.riderId, {
      ...identity,
      participationType:
        existing?.participationType === "breakaway" ||
        row.participation_type === "breakaway"
          ? "breakaway"
          : "chase",
      stageNumbers: [...new Set([...(existing?.stageNumbers ?? []), stageNumber])]
        .sort((left, right) => left - right),
    });
  }

  return [...participantByRiderId.values()].sort(
    (left, right) =>
      (left.stageNumbers[0] ?? 0) - (right.stageNumbers[0] ?? 0) ||
      left.riderName.localeCompare(right.riderName, "fr")
  );
}

function buildOfficialSecondaryClassifications({
  rows,
  editionId,
  rosterById,
  registrationById,
  teamSeasonById,
  riderById,
}: {
  rows: SecondaryResultRow[];
  editionId: string;
  rosterById: Map<string, RaceRosterRow>;
  registrationById: Map<string, RaceRegistrationRow>;
  teamSeasonById: Map<string, TeamSeasonRow>;
  riderById: Map<string, RaceCalendarEdition["engagedRiders"][number]>;
}): OfficialSecondaryClassification[] {
  const classifications: OfficialSecondaryClassification[] = [];

  for (const type of ["mountain", "sprint", "youth", "team"] as const) {
      const classificationRows = rows
        .filter((row) => row.classification_type === type)
        .sort((first, second) => first.rank - second.rank);
      if (classificationRows.length === 0) continue;

      if (type === "team") {
        classifications.push({
          type,
          riders: [],
          teams: classificationRows.flatMap((row) => {
            const team = row.team_season_id
              ? teamSeasonById.get(row.team_season_id)
              : null;
            return team && row.total_time_ms !== null
              ? [
                  {
                    teamId: team.team_id,
                    teamName: team.display_name,
                    rank: row.rank,
                    totalTimeMs: row.total_time_ms,
                  },
                ]
              : [];
          }),
        });
        continue;
      }

      const winnerTime = classificationRows[0]?.total_time_ms ?? 0;
      classifications.push({
        type,
        teams: [],
        riders: classificationRows.flatMap((row) => {
          if (!row.race_roster_id) return [];
          const identity = resolveResultIdentity({
            rosterId: row.race_roster_id,
            editionId,
            rosterById,
            registrationById,
            teamSeasonById,
            riderById,
          });
          if (!identity) return [];
          return [
            {
              ...identity,
              rank: row.rank,
              status: "finished" as const,
              elapsedTimeMs: row.total_time_ms,
              gapToWinnerMs:
                row.total_time_ms === null
                  ? null
                  : Math.max(0, row.total_time_ms - winnerTime),
              mountainPoints: type === "mountain" ? row.points ?? 0 : 0,
              sprintPoints: type === "sprint" ? row.points ?? 0 : 0,
              abandonmentReason: null,
            },
          ];
        }),
      });
  }

  return classifications;
}

function toPersistedGeneralInput(
  result: OfficialRiderResult
): PersistedStageResultForGeneral {
  return {
    riderId: result.riderId,
    riderName: result.riderName,
    teamId: result.teamId,
    teamName: result.teamName,
    status: result.status,
    elapsedTimeMs: result.elapsedTimeMs,
    abandonmentReason: result.abandonmentReason,
  };
}

function countPrimeWins(
  simulations: StageSimulationResult[],
  riderId: string,
  primeType: "mountain" | "intermediate_sprint"
) {
  return simulations.reduce(
    (total, simulation) =>
      total +
      simulation.primes.filter(
        (prime) =>
          prime.prime.type === primeType &&
          prime.classification[0]?.riderId === riderId
      ).length,
    0
  );
}

function describeCashRewardBreakdown(
  breakdown: ReturnType<typeof calculateRaceRewardBreakdown>
) {
  const labels = {
    general: "classement général",
    mountain_classification: "classement montagne",
    sprint_classification: "classement par points",
    youth_classification: "classement des jeunes",
    team_classification: "classement par équipes",
    mountain_prime: "prime GPM",
    intermediate_sprint: "sprint intermédiaire",
  } as const;

  const details = breakdown.components
    .filter((component) => component.cashPrize > 0)
    .map((component) => {
      const count = component.count > 1 ? `${component.count} × ` : "";
      return `${count}${labels[component.type]} : ${component.cashPrize.toLocaleString("fr-FR")} €`;
    });

  return details.length > 0 ? `détail ${details.join(" + ")}` : null;
}

function getRewardScope(edition: RaceCalendarEdition): RaceRewardScope {
  if (edition.raceFormat === "one_day") return "one_day";
  return edition.categoryCode === "elite" && edition.stages.length >= 7
    ? "grand_tour"
    : "tour";
}

function requireRoster(
  rosterByRiderId: Map<string, RosterContext>,
  riderId: string
) {
  const roster = rosterByRiderId.get(riderId);
  if (!roster) {
    throw new Error(`Le coureur ${riderId} est absent de la startlist officielle.`);
  }
  return roster;
}

function compareOfficialResults(
  first: OfficialRiderResult,
  second: OfficialRiderResult
) {
  if (first.rank === null && second.rank !== null) return 1;
  if (first.rank !== null && second.rank === null) return -1;
  return (
    (first.rank ?? Number.MAX_SAFE_INTEGER) -
      (second.rank ?? Number.MAX_SAFE_INTEGER) ||
    first.riderName.localeCompare(second.riderName, "fr")
  );
}

function assertQuery(error: { message: string } | null, context: string) {
  if (error) throw new Error(`Impossible de charger ${context} : ${error.message}`);
}
