import "server-only";

import {
  buildJuniorDailyTrainingRiders,
  buildSeniorDailyTrainingRiders,
  resolveTrainingReportDay,
  summarizeDailyTrainingReport,
  type DailyTrainingReport,
  type JuniorTrainingSessionSource,
  type SeniorTrainingSessionSource,
  type TrainingReportRiderSource,
} from "@/lib/game/daily-training-report";
import type { TrainingSessionStatus } from "@/lib/game/training";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DirectorRow = { id: string };
type AssignmentRow = { team_id: string };
type SeasonRow = {
  id: string;
  name: string;
  current_day_number: number | null;
};
type TeamSeasonRow = { display_name: string };
type DayRow = { id: string; day_number: number; calendar_date: string };
type ContractRow = { rider_id: string };
type RiderRow = { id: string; first_name: string; last_name: string };
type SeniorSessionRow = {
  rider_id: string;
  status: string;
  rating_changes: Record<string, number> | null;
  form_before: number;
  form_delta: number;
  form_after: number;
};
type AcademyRow = {
  id: string;
  first_name: string;
  last_name: string;
};
type JuniorSessionRow = {
  academy_rider_id: string;
  training_mode: string;
  slot: string;
  game_type: string | null;
  rating_changes: Record<string, number> | null;
};

type TrainingReportContext = {
  teamId: string;
  teamName: string;
  seasonId: string;
  seasonName: string;
  currentDayNumber: number;
};

export async function getDailySeniorTrainingReport(
  authUserId: string,
  requestedDay?: string | string[],
): Promise<DailyTrainingReport | null> {
  const admin = createSupabaseAdminClient();
  const context = await loadContext(admin, authUserId);
  if (!context) return null;

  const dayNumber = resolveTrainingReportDay(
    requestedDay,
    context.currentDayNumber,
  );
  const day = await loadSeasonDay(admin, context.seasonId, dayNumber);
  if (!day) return null;

  const [contractsResult, sessionsResult] = await Promise.all([
    admin
      .from("rider_contracts")
      .select("rider_id")
      .eq("team_id", context.teamId)
      .eq("status", "active")
      .returns<ContractRow[]>(),
    admin
      .from("rider_training_sessions")
      .select(
        "rider_id, status, rating_changes, form_before, form_delta, form_after",
      )
      .eq("team_id", context.teamId)
      .eq("season_id", context.seasonId)
      .eq("season_day_id", day.id)
      .returns<SeniorSessionRow[]>(),
  ]);
  assertQuery(contractsResult.error, "les coureurs sous contrat");
  assertQuery(sessionsResult.error, "les séances senior de la journée");

  const sessionRows = sessionsResult.data ?? [];
  const riderIds = [
    ...new Set([
      ...(contractsResult.data ?? []).map((contract) => contract.rider_id),
      ...sessionRows.map((session) => session.rider_id),
    ]),
  ];
  const riders = await loadRiders(admin, riderIds);
  const sessions: SeniorTrainingSessionSource[] = sessionRows.map((session) => ({
    riderId: session.rider_id,
    status: session.status as TrainingSessionStatus,
    ratingChanges: session.rating_changes ?? {},
    formBefore: session.form_before,
    formDelta: session.form_delta,
    formAfter: session.form_after,
  }));
  const reportRiders = buildSeniorDailyTrainingRiders({ riders, sessions });

  return buildReport({
    context,
    day,
    audience: "senior",
    riders: reportRiders,
  });
}

export async function getDailyJuniorTrainingReport(
  authUserId: string,
  requestedDay?: string | string[],
): Promise<DailyTrainingReport | null> {
  const admin = createSupabaseAdminClient();
  const context = await loadContext(admin, authUserId);
  if (!context) return null;

  const dayNumber = resolveTrainingReportDay(
    requestedDay,
    context.currentDayNumber,
  );
  const day = await loadSeasonDay(admin, context.seasonId, dayNumber);
  if (!day) return null;

  const academyResult = await admin
    .from("youth_academy_riders")
    .select("id, first_name, last_name")
    .eq("team_id", context.teamId)
    .in("status", ["active", "recruited"])
    .returns<AcademyRow[]>();
  assertQuery(academyResult.error, "les juniors de l’école");

  const academyRows = academyResult.data ?? [];
  const academyIds = academyRows.map((rider) => rider.id);
  const sessionsResult = academyIds.length
    ? await admin
        .from("youth_academy_training_sessions")
        .select(
          "academy_rider_id, training_mode, slot, game_type, rating_changes",
        )
        .eq("season_id", context.seasonId)
        .eq("season_day_id", day.id)
        .in("academy_rider_id", academyIds)
        .returns<JuniorSessionRow[]>()
    : { data: [] as JuniorSessionRow[], error: null };
  assertQuery(sessionsResult.error, "les séances junior de la journée");

  const riders: TrainingReportRiderSource[] = academyRows.map((rider) => ({
    id: rider.id,
    firstName: rider.first_name,
    lastName: rider.last_name,
  }));
  const sessions: JuniorTrainingSessionSource[] = (
    sessionsResult.data ?? []
  ).map((session) => ({
    riderId: session.academy_rider_id,
    trainingMode: session.training_mode,
    slot: session.slot,
    gameType: session.game_type,
    ratingChanges: session.rating_changes ?? {},
  }));
  const reportRiders = buildJuniorDailyTrainingRiders({ riders, sessions });

  return buildReport({
    context,
    day,
    audience: "junior",
    riders: reportRiders,
  });
}

function buildReport({
  context,
  day,
  audience,
  riders,
}: {
  context: TrainingReportContext;
  day: DayRow;
  audience: DailyTrainingReport["audience"];
  riders: DailyTrainingReport["riders"];
}): DailyTrainingReport {
  return {
    audience,
    teamName: context.teamName,
    seasonName: context.seasonName,
    dayNumber: day.day_number,
    currentDayNumber: context.currentDayNumber,
    calendarDate: day.calendar_date,
    riders,
    ...summarizeDailyTrainingReport(riders),
  };
}

async function loadContext(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  authUserId: string,
): Promise<TrainingReportContext | null> {
  const { data: director, error: directorError } = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<DirectorRow>();
  assertQuery(directorError, "le Directeur Sportif");
  if (!director) return null;

  const [assignmentResult, seasonResult] = await Promise.all([
    admin
      .from("team_manager_assignments")
      .select("team_id")
      .eq("sporting_director_id", director.id)
      .eq("role", "general_manager")
      .eq("status", "active")
      .maybeSingle<AssignmentRow>(),
    admin
      .from("seasons")
      .select("id, name, current_day_number")
      .eq("status", "active")
      .maybeSingle<SeasonRow>(),
  ]);
  assertQuery(assignmentResult.error, "l’affectation à l’équipe");
  assertQuery(seasonResult.error, "la saison active");
  if (!assignmentResult.data || !seasonResult.data) return null;

  const { data: teamSeason, error: teamSeasonError } = await admin
    .from("team_seasons")
    .select("display_name")
    .eq("team_id", assignmentResult.data.team_id)
    .eq("season_id", seasonResult.data.id)
    .maybeSingle<TeamSeasonRow>();
  assertQuery(teamSeasonError, "l’équipe de la saison");
  if (!teamSeason) return null;

  return {
    teamId: assignmentResult.data.team_id,
    teamName: teamSeason.display_name,
    seasonId: seasonResult.data.id,
    seasonName: seasonResult.data.name,
    currentDayNumber: seasonResult.data.current_day_number ?? 1,
  };
}

async function loadSeasonDay(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  seasonId: string,
  dayNumber: number,
): Promise<DayRow | null> {
  const { data, error } = await admin
    .from("season_days")
    .select("id, day_number, calendar_date")
    .eq("season_id", seasonId)
    .eq("day_number", dayNumber)
    .maybeSingle<DayRow>();
  assertQuery(error, "la journée de saison");
  return data;
}

async function loadRiders(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  riderIds: string[],
): Promise<TrainingReportRiderSource[]> {
  if (!riderIds.length) return [];
  const { data, error } = await admin
    .from("riders")
    .select("id, first_name, last_name")
    .in("id", riderIds)
    .returns<RiderRow[]>();
  assertQuery(error, "l’identité des coureurs");
  return (data ?? []).map((rider) => ({
    id: rider.id,
    firstName: rider.first_name,
    lastName: rider.last_name,
  }));
}

function assertQuery(
  error: { message: string } | null,
  label: string,
): asserts error is null {
  if (error) throw new Error(`Impossible de charger ${label} : ${error.message}`);
}
