import "server-only";

import {
  RIDER_INJURY_DIAGNOSES,
  type RiderInjuryDiagnosisCode,
} from "@/lib/game/health-center";
import {
  buildContractRenewalReminderEvents,
  type DashboardContractReminderRider,
  type DashboardEvent,
} from "@/lib/game/dashboard-events";
import { getRaceResultsHref } from "@/lib/game/race-live";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getCurrentDirectorInternationalSelections,
  type InternationalChampionshipSelection,
} from "@/services/international-championship-selections";
import { getYouthDevelopmentAlertCount } from "@/services/youth-development";

type InjuryRow = {
  id: string;
  rider_id: string;
  diagnosis_code: string;
  started_at: string;
  expected_recovery_at: string;
  source_stage_id: string | null;
  riders: {
    first_name: string;
    last_name: string;
  } | null;
  stages: {
    race_editions: {
      display_name: string;
      races: { slug: string } | null;
    } | null;
  } | null;
};

type TrainingSessionRow = {
  status:
    | "completed"
    | "skipped_low_form"
    | "skipped_injury"
    | "skipped_form_camp";
  processed_at: string;
  season_days: { day_number: number } | null;
};

type ScoutingMissionRow = {
  id: string;
  report_ready_at: string | null;
  countries: { name: string } | null;
};

type YouthNotificationRow = {
  id: string;
  title: string;
  message: string;
  created_at: string;
};

type InfrastructureNotificationRow = {
  id: string;
  title: string;
  message: string;
  created_at: string;
};

type RaceEditionEventRow = {
  id: string;
  display_name: string;
  status: string;
  races: { slug: string } | null;
  stages: Array<{
    status: string;
    season_days: { day_number: number } | null;
  }>;
};

type TeamSeasonEventRow = {
  id: string;
  race_registrations: Array<{
    status: string;
    race_editions: RaceEditionEventRow | null;
  }>;
};

type SeasonContractEventRow = {
  id: string;
  game_year: number;
};

type RiderContractEventRow = {
  rider_id: string;
  start_season_id: string;
  end_season_id: string;
  status: "active" | "planned";
  riders: {
    first_name: string;
    last_name: string;
  } | null;
};

export type DashboardOperationalEvents = {
  events: DashboardEvent[];
  youthDevelopmentAlertCount: number;
};

export async function getCurrentDashboardOperationalEvents({
  authUserId,
  teamId,
  seasonId,
  currentDayNumber,
  riderIds,
}: {
  authUserId: string;
  teamId: string;
  seasonId: string;
  currentDayNumber: number;
  riderIds: string[];
}): Promise<DashboardOperationalEvents> {
  const admin = createSupabaseAdminClient();
  const [
    trainingSettlement,
    infrastructureSettlement,
    youthDevelopmentAlertCount,
    internationalSelections,
  ] = await Promise.all([
    admin.rpc("settle_due_training_sessions"),
    admin.rpc("settle_due_infrastructure_projects"),
    getYouthDevelopmentAlertCount(authUserId, {
      settleInfrastructure: false,
    }),
    [21, 22, 25, 26].includes(currentDayNumber)
      ? getCurrentDirectorInternationalSelections({
          authUserId,
          processDue: false,
        })
      : Promise.resolve([] as InternationalChampionshipSelection[]),
  ]);

  assertQuery(
    trainingSettlement.error,
    "la mise à jour des entraînements du bureau"
  );
  assertQuery(
    infrastructureSettlement.error,
    "la mise à jour des chantiers du bureau",
  );

  const [
    teamSeasonResult,
    injuriesResult,
    trainingResult,
    scoutingResult,
    youthNotificationsResult,
    infrastructureNotificationsResult,
    contractSeasonsResult,
    riderContractsResult,
  ] = await Promise.all([
    admin
      .from("team_seasons")
      .select(
        `
          id,
          race_registrations (
            status,
            race_editions (
              id,
              display_name,
              status,
              races (slug),
              stages (
                status,
                season_days (day_number)
              )
            )
          )
        `
      )
      .eq("team_id", teamId)
      .eq("season_id", seasonId)
      .maybeSingle<TeamSeasonEventRow>(),
    riderIds.length > 0
      ? admin
          .from("rider_injuries")
          .select(
            `
              id,
              rider_id,
              diagnosis_code,
              started_at,
              expected_recovery_at,
              source_stage_id,
              riders (first_name, last_name),
              stages (
                race_editions (
                  display_name,
                  races (slug)
                )
              )
            `
          )
          .in("rider_id", riderIds)
          .eq("status", "active")
          .gt("expected_recovery_at", new Date().toISOString())
          .order("expected_recovery_at")
          .returns<InjuryRow[]>()
      : Promise.resolve({ data: [] as InjuryRow[], error: null }),
    admin
      .from("rider_training_sessions")
      .select(
        `
          status,
          processed_at,
          season_days!inner (day_number)
        `
      )
      .eq("team_id", teamId)
      .eq("season_id", seasonId)
      .eq("season_days.day_number", currentDayNumber)
      .order("processed_at", { ascending: false })
      .returns<TrainingSessionRow[]>(),
    admin
      .from("youth_scouting_missions")
      .select("id, report_ready_at, countries (name)")
      .eq("team_id", teamId)
      .eq("status", "completed")
      .is("report_viewed_at", null)
      .order("report_ready_at", { ascending: false })
      .returns<ScoutingMissionRow[]>(),
    admin
      .from("youth_development_notifications")
      .select("id, title, message, created_at")
      .eq("team_id", teamId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<YouthNotificationRow[]>(),
    admin
      .from("infrastructure_notifications")
      .select("id, title, message, created_at")
      .eq("team_id", teamId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<InfrastructureNotificationRow[]>(),
    currentDayNumber >= 21
      ? admin
          .from("seasons")
          .select("id, game_year")
          .returns<SeasonContractEventRow[]>()
      : Promise.resolve({
          data: [] as SeasonContractEventRow[],
          error: null,
        }),
    currentDayNumber >= 21 && riderIds.length > 0
      ? admin
          .from("rider_contracts")
          .select(
            "rider_id, start_season_id, end_season_id, status, riders (first_name, last_name)"
          )
          .in("rider_id", riderIds)
          .in("status", ["active", "planned"])
          .returns<RiderContractEventRow[]>()
      : Promise.resolve({
          data: [] as RiderContractEventRow[],
          error: null,
        }),
  ]);

  assertQuery(teamSeasonResult.error, "les courses de l’équipe");
  assertQuery(injuriesResult.error, "les blessures du bureau");
  assertQuery(trainingResult.error, "la séance d’entraînement du jour");
  assertQuery(scoutingResult.error, "les rapports de scouting");
  assertQuery(
    youthNotificationsResult.error,
    "les notifications du centre de formation"
  );
  assertQuery(
    infrastructureNotificationsResult.error,
    "les notifications des infrastructures",
  );
  assertQuery(contractSeasonsResult.error, "les saisons des contrats");
  assertQuery(riderContractsResult.error, "les contrats de l’effectif");

  const contractReminderRiders = buildContractReminderRiders({
    riderIds,
    currentSeasonId: seasonId,
    seasons: contractSeasonsResult.data ?? [],
    contracts: riderContractsResult.data ?? [],
  });

  return {
    events: [
      ...buildInternationalSelectionEvents(internationalSelections),
      ...buildInjuryEvents(injuriesResult.data ?? [], currentDayNumber),
      ...buildCompletedRaceEvents(
        teamSeasonResult.data?.race_registrations ?? [],
        currentDayNumber
      ),
      ...buildTrainingEvents(trainingResult.data ?? [], currentDayNumber, seasonId),
      ...(scoutingResult.data ?? []).map((mission) => ({
        id: `scouting:${mission.id}`,
        category: "scouting" as const,
        priority: "action" as const,
        title: "Rapport de scouting disponible",
        description: `La mission${
          mission.countries?.name ? ` en ${mission.countries.name}` : ""
        } est terminée. Les jeunes détectés attendent votre analyse.`,
        href: "/jeu/centre-de-formation",
        actionLabel: "Ouvrir le rapport",
        dayNumber: currentDayNumber,
        happenedAt: mission.report_ready_at,
      })),
      ...(youthNotificationsResult.data ?? []).map((notification) => ({
        id: `academy:${notification.id}`,
        category: "academy" as const,
        priority: "action" as const,
        title: notification.title,
        description: notification.message,
        href: "/jeu/centre-de-formation",
        actionLabel: "Voir le centre",
        dayNumber: currentDayNumber,
        happenedAt: notification.created_at,
      })),
      ...(infrastructureNotificationsResult.data ?? []).map(
        (notification) => ({
          id: `infrastructure:${notification.id}`,
          category: "infrastructure" as const,
          priority: "update" as const,
          title: notification.title,
          description: notification.message,
          href: "/jeu/infrastructures",
          actionLabel: "Voir les infrastructures",
          dayNumber: currentDayNumber,
          happenedAt: notification.created_at,
        }),
      ),
      ...buildContractRenewalReminderEvents({
        currentDayNumber,
        riders: contractReminderRiders,
      }),
    ],
    youthDevelopmentAlertCount,
  };
}

function buildInternationalSelectionEvents(
  selections: InternationalChampionshipSelection[]
): DashboardEvent[] {
  return selections
    .filter((selection) => selection.canRespond)
    .map((selection) => ({
      id: `international-selection:${selection.candidateId}`,
      category: "race",
      priority: "critical",
      title: `${selection.riderName} appelé en sélection`,
      description: `${selection.championshipName} · ${selection.countryName}. Sans refus avant le départ, sa participation sera automatique. Une validation donne la priorité au championnat sur ses autres engagements.`,
      href: `/jeu/selections-internationales#selection-${selection.candidateId}`,
      actionLabel: "Décider",
      badgeLabel: "Sélection",
      dayNumber: selection.dayNumber,
      happenedAt: null,
    }));
}

function buildContractReminderRiders({
  riderIds,
  currentSeasonId,
  seasons,
  contracts,
}: {
  riderIds: string[];
  currentSeasonId: string;
  seasons: SeasonContractEventRow[];
  contracts: RiderContractEventRow[];
}): DashboardContractReminderRider[] {
  const currentSeason = seasons.find((season) => season.id === currentSeasonId);
  if (!currentSeason) return [];

  const seasonYearById = new Map(
    seasons.map((season) => [season.id, season.game_year])
  );
  const nextGameYear = currentSeason.game_year + 1;

  return [...new Set(riderIds)].flatMap((riderId) => {
    const riderContracts = contracts.filter(
      (contract) => contract.rider_id === riderId
    );
    const identity = riderContracts.find((contract) => contract.riders)?.riders;
    if (!identity) return [];

    const hasNextSeasonContract = riderContracts.some((contract) => {
      const startYear = seasonYearById.get(contract.start_season_id);
      const endYear = seasonYearById.get(contract.end_season_id);

      return (
        startYear !== undefined &&
        endYear !== undefined &&
        startYear <= nextGameYear &&
        endYear >= nextGameYear
      );
    });

    return [
      {
        riderId,
        firstName: identity.first_name,
        lastName: identity.last_name,
        hasNextSeasonContract,
      },
    ];
  });
}

function buildInjuryEvents(
  rows: InjuryRow[],
  currentDayNumber: number
): DashboardEvent[] {
  return rows.map((injury) => {
    const riderName = injury.riders
      ? `${injury.riders.first_name} ${injury.riders.last_name}`
      : "Un coureur";
    const diagnosis = isDiagnosisCode(injury.diagnosis_code)
      ? RIDER_INJURY_DIAGNOSES[injury.diagnosis_code]
      : null;
    const raceName = injury.stages?.race_editions?.display_name;
    const origin =
      injury.diagnosis_code === "fatigue_exhaustion"
        ? "à la suite d’un épuisement lié à sa forme"
        : raceName
          ? `après une chute sur ${raceName}`
          : "après une chute en course";

    return {
      id: `injury:${injury.id}`,
      category: "health",
      priority: "critical",
      title: `${riderName} est blessé`,
      description: `${diagnosis?.label ?? "Blessure"} ${origin}. Retour estimé ${formatRecoveryDate(
        injury.expected_recovery_at
      )}.`,
      href: `/jeu/coureurs/${injury.rider_id}`,
      actionLabel: "Voir le coureur",
      dayNumber: currentDayNumber,
      happenedAt: injury.started_at,
    };
  });
}

function buildCompletedRaceEvents(
  registrations: TeamSeasonEventRow["race_registrations"],
  currentDayNumber: number
): DashboardEvent[] {
  return registrations.flatMap((registration) => {
    const edition = registration.race_editions;
    if (registration.status !== "accepted" || edition?.status !== "completed") {
      return [];
    }

    const endDay = Math.max(
      0,
      ...edition.stages.map((stage) => stage.season_days?.day_number ?? 0)
    );
    if (endDay < Math.max(1, currentDayNumber - 2) || endDay > currentDayNumber) {
      return [];
    }

    const slug = edition.races?.slug;
    if (!slug) return [];

    return [
      {
        id: `race-finished:${edition.id}`,
        category: "race" as const,
        priority: "update" as const,
        title: `${edition.display_name} est terminée`,
        description:
          "Les résultats sont homologués. Consultez le classement, les écarts et les performances de vos coureurs.",
        href: getRaceResultsHref(slug),
        actionLabel: "Voir les résultats",
        dayNumber: endDay,
        happenedAt: null,
      },
    ];
  });
}

function buildTrainingEvents(
  sessions: TrainingSessionRow[],
  currentDayNumber: number,
  seasonId: string
): DashboardEvent[] {
  if (sessions.length === 0) return [];

  const completedCount = sessions.filter(
    (session) => session.status === "completed"
  ).length;
  const skippedCount = sessions.length - completedCount;
  const details = [
    `${completedCount} coureur${completedCount > 1 ? "s" : ""} entraîné${
      completedCount > 1 ? "s" : ""
    }`,
    skippedCount > 0
      ? `${skippedCount} séance${skippedCount > 1 ? "s" : ""} non réalisée${
          skippedCount > 1 ? "s" : ""
        }`
      : null,
  ].filter(Boolean);

  return [
    {
      id: `training:${seasonId}:${currentDayNumber}`,
      category: "training",
      priority: "update",
      title: `Entraînement de J${currentDayNumber} terminé`,
      description: `${details.join(" · ")}. Les rapports individuels sont disponibles.`,
      href: "/jeu/entrainement",
      actionLabel: "Voir les rapports",
      dayNumber: currentDayNumber,
      happenedAt: sessions[0]?.processed_at ?? null,
    },
  ];
}

function isDiagnosisCode(value: string): value is RiderInjuryDiagnosisCode {
  return value in RIDER_INJURY_DIAGNOSES;
}

function formatRecoveryDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "prochainement";

  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function assertQuery(
  error: { message: string } | null,
  label: string
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${label} : ${error.message}`);
  }
}
