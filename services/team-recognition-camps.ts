import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DirectorRow = { id: string };
type AssignmentRow = { team_id: string };
type SeasonRow = {
  id: string;
  name: string;
  current_day_number: number | null;
};
type TeamSeasonRow = {
  id: string;
  display_name: string;
};
type SeasonDayRow = {
  id: string;
  day_number: number;
  calendar_date: string;
};
type RaceEditionRow = {
  id: string;
  display_name: string;
};
type StageRow = {
  id: string;
  race_edition_id: string;
  season_day_id: string;
  stage_number: number;
  name: string;
};
type RecognitionCampRow = {
  id: string;
  target_stage_id: string;
  start_day_number: number;
  end_day_number: number;
  status: "planned" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
};

export type RecognitionCampTarget = {
  stageId: string;
  editionId: string;
  editionName: string;
  stageNumber: number;
  stageName: string;
  stageDayNumber: number;
  stageCalendarDate: string;
  editionStartDayNumber: number;
  editionEndDayNumber: number;
};

export type ScheduledRecognitionCamp = {
  id: string;
  startDayNumber: number;
  endDayNumber: number;
  startCalendarDate: string;
  endCalendarDate: string;
  status: RecognitionCampRow["status"];
  createdAt: string;
  updatedAt: string;
  target: RecognitionCampTarget;
};

export type TeamRecognitionCampsOverview = {
  teamName: string;
  seasonName: string;
  currentDayNumber: number;
  seasonLastDayNumber: number;
  seasonDays: Array<{
    dayNumber: number;
    calendarDate: string;
  }>;
  targets: RecognitionCampTarget[];
  scheduledCamps: ScheduledRecognitionCamp[];
};

export async function getCurrentTeamRecognitionCampsOverview(
  authUserId: string,
): Promise<TeamRecognitionCampsOverview | null> {
  const admin = createSupabaseAdminClient();

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
    .select("id, display_name")
    .eq("team_id", assignmentResult.data.team_id)
    .eq("season_id", seasonResult.data.id)
    .maybeSingle<TeamSeasonRow>();
  assertQuery(teamSeasonError, "l’équipe de la saison");
  if (!teamSeason) return null;

  const [daysResult, editionsResult, campsResult] = await Promise.all([
    admin
      .from("season_days")
      .select("id, day_number, calendar_date")
      .eq("season_id", seasonResult.data.id)
      .order("day_number")
      .returns<SeasonDayRow[]>(),
    admin
      .from("race_editions")
      .select("id, display_name")
      .eq("season_id", seasonResult.data.id)
      .neq("status", "cancelled")
      .returns<RaceEditionRow[]>(),
    admin
      .from("team_race_recognition_camps")
      .select(
        "id, target_stage_id, start_day_number, end_day_number, status, created_at, updated_at",
      )
      .eq("team_season_id", teamSeason.id)
      .neq("status", "cancelled")
      .order("start_day_number")
      .returns<RecognitionCampRow[]>(),
  ]);
  assertQuery(daysResult.error, "les journées de saison");
  assertQuery(editionsResult.error, "les courses de la saison");
  assertQuery(campsResult.error, "les stages de reconnaissance programmés");

  const days = daysResult.data ?? [];
  const editions = editionsResult.data ?? [];
  const editionIds = editions.map((edition) => edition.id);
  const stagesResult = editionIds.length
    ? await admin
        .from("stages")
        .select("id, race_edition_id, season_day_id, stage_number, name")
        .in("race_edition_id", editionIds)
        .neq("status", "cancelled")
        .order("stage_number")
        .returns<StageRow[]>()
    : { data: [] as StageRow[], error: null };
  assertQuery(stagesResult.error, "les étapes de la saison");

  const currentDayNumber = seasonResult.data.current_day_number ?? 1;
  const dayById = new Map(days.map((day) => [day.id, day]));
  const dayByNumber = new Map(days.map((day) => [day.day_number, day]));
  const editionById = new Map(editions.map((edition) => [edition.id, edition]));
  const stageDaysByEditionId = new Map<string, number[]>();

  for (const stage of stagesResult.data ?? []) {
    const day = dayById.get(stage.season_day_id);
    if (!day) continue;
    const stageDays = stageDaysByEditionId.get(stage.race_edition_id) ?? [];
    stageDays.push(day.day_number);
    stageDaysByEditionId.set(stage.race_edition_id, stageDays);
  }

  const targets = (stagesResult.data ?? [])
    .flatMap((stage): RecognitionCampTarget[] => {
      const day = dayById.get(stage.season_day_id);
      const edition = editionById.get(stage.race_edition_id);
      const editionDays = stageDaysByEditionId.get(stage.race_edition_id) ?? [];
      if (!day || !edition || editionDays.length === 0) return [];

      return [
        {
          stageId: stage.id,
          editionId: edition.id,
          editionName: edition.display_name,
          stageNumber: stage.stage_number,
          stageName: stage.name,
          stageDayNumber: day.day_number,
          stageCalendarDate: day.calendar_date,
          editionStartDayNumber: Math.min(...editionDays),
          editionEndDayNumber: Math.max(...editionDays),
        },
      ];
    })
    .sort(
      (left, right) =>
        left.stageDayNumber - right.stageDayNumber ||
        left.editionName.localeCompare(right.editionName, "fr") ||
        left.stageNumber - right.stageNumber,
    );
  const targetByStageId = new Map(
    targets.map((target) => [target.stageId, target]),
  );

  return {
    teamName: teamSeason.display_name,
    seasonName: seasonResult.data.name,
    currentDayNumber,
    seasonLastDayNumber: Math.max(...days.map((day) => day.day_number), 28),
    seasonDays: days.map((day) => ({
      dayNumber: day.day_number,
      calendarDate: day.calendar_date,
    })),
    targets: targets.filter((target) => target.stageDayNumber > currentDayNumber),
    scheduledCamps: (campsResult.data ?? []).flatMap(
      (camp): ScheduledRecognitionCamp[] => {
        const target = targetByStageId.get(camp.target_stage_id);
        const startDay = dayByNumber.get(camp.start_day_number);
        const endDay = dayByNumber.get(camp.end_day_number);
        if (!target || !startDay || !endDay) return [];

        return [
          {
            id: camp.id,
            startDayNumber: camp.start_day_number,
            endDayNumber: camp.end_day_number,
            startCalendarDate: startDay.calendar_date,
            endCalendarDate: endDay.calendar_date,
            status: camp.status,
            createdAt: camp.created_at,
            updatedAt: camp.updated_at,
            target,
          },
        ];
      },
    ),
  };
}

function assertQuery(error: { message: string } | null, subject: string) {
  if (error) {
    throw new Error(`Impossible de charger ${subject} : ${error.message}`);
  }
}
