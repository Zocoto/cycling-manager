import "server-only";

import {
  buildFederationRaceCreationScore,
  FEDERATION_RACE_CREATION_START_GAME_YEAR,
  getFederationRaceCost,
  type FederationRaceCategoryCode,
  type FederationRaceCost,
  type FederationRaceCreationScore,
  type FederationRaceDaySlot,
  type FederationRaceFormat,
  type FederationRaceStageBlueprint,
} from "@/lib/game/federation-race-creation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FederationRaceProjectStatus =
  | "draft" | "voting" | "scheduled" | "active" | "rejected" | "cancelled";

export type FederationRaceProject = {
  id: string;
  name: string;
  shortName: string;
  raceFormat: FederationRaceFormat;
  categoryCode: FederationRaceCategoryCode;
  startDay: number;
  startSlot: FederationRaceDaySlot;
  activationGameYear: number;
  status: FederationRaceProjectStatus;
  stages: FederationRaceStageBlueprint[];
  submittedAt: string;
  voteClosesAt: string | null;
  decisionError: string | null;
  approvedAt: string | null;
  cost: FederationRaceCost;
  electorateCount: number;
  approveVotes: number;
  rejectVotes: number;
  viewerVote: "approve" | "reject" | null;
};

export type FederationRaceCalendarSlot = {
  existingRaceCount: number;
  labels: string[];
  unavailable: boolean;
};

export type FederationRaceCalendarDay = {
  dayNumber: number;
  calendarDate: string;
  forbiddenLabel: string | null;
  early: FederationRaceCalendarSlot;
  late: FederationRaceCalendarSlot;
};

export type FederationRaceCreationState = {
  score: FederationRaceCreationScore;
  officeLevel: number;
  viewerIsPresident: boolean;
  viewerTeamId: string | null;
  canCreate: boolean;
  canVote: boolean;
  canCancel: boolean;
  project: FederationRaceProject | null;
  managedRaces: FederationRaceProject[];
  availableBalance: number;
  viewerReputation: number;
  voteDeadline: string | null;
  voteWindowOpen: boolean;
  targetGameYear: number;
  calendarStatus: "pending" | "ready" | "unavailable";
  calendar: FederationRaceCalendarDay[];
};

type ProjectRow = {
  id: string; name: string; short_name: string; race_format: string;
  category_code: string; start_day_number: number; start_day_slot: string;
  activation_game_year: number; status: string; stage_blueprint: unknown;
  created_at: string; vote_closes_at: string | null; approved_at: string | null;
  decision_error: string | null;
  creation_cost: number | string | null; reputation_cost: number | string | null;
  annual_maintenance_cost: number | string | null;
};
type InfrastructureRow = { level: number };
type AssignmentRow = { sporting_director_id: string };
type TermRow = { president_director_id: string | null };
type DirectorRow = { reputation_points: number | string };
type WorkshopContextRow = {
  available_balance: number | string;
  vote_deadline: string | null;
  vote_window_open: boolean;
};
type SeasonRow = { id: string; game_year: number };
type WorkshopSlotRow = {
  day_number: number;
  calendar_date: string;
  protected_label: string | null;
  day_slot: FederationRaceDaySlot;
  existing_race_count: number;
  labels: string[];
  unavailable: boolean;
};
type VoteRow = { team_id: string; choice: string };
type ElectorateRow = { team_id: string; sporting_director_id: string };

const PROJECT_SELECT =
  "id, name, short_name, race_format, category_code, start_day_number, start_day_slot, activation_game_year, status, stage_blueprint, created_at, vote_closes_at, approved_at, creation_cost, reputation_cost, annual_maintenance_cost, decision_error";

export async function getFederationRaceCreationState({
  countryId, seasonId, gameYear, viewerTeamId, nationRank, completedObjectiveCount,
}: {
  countryId: string; seasonId: string; gameYear: number; viewerTeamId: string | null;
  nationRank: number | null; completedObjectiveCount: number;
}): Promise<FederationRaceCreationState> {
  const fallbackScore = buildFederationRaceCreationScore({
    nationRank, completedObjectiveCount, existingRaceCount: 0,
  });
  const fallback: FederationRaceCreationState = {
    score: fallbackScore, officeLevel: 0, viewerIsPresident: false, viewerTeamId,
    canCreate: false, canVote: false, canCancel: false, project: null,
    managedRaces: [], availableBalance: 0, viewerReputation: 0,
    voteDeadline: null, voteWindowOpen: false,
    targetGameYear: gameYear + 1, calendarStatus: "unavailable", calendar: [],
  };

  try {
    const admin = createSupabaseAdminClient();
    const [office, currentProject, managedProjects, assignment, term, scoreResult, context, targetSeason] =
      await Promise.all([
        admin.from("national_federation_infrastructures").select("level")
          .eq("country_id", countryId).eq("infrastructure_code", "race_organization_office")
          .maybeSingle<InfrastructureRow>(),
        admin.from("national_federation_race_projects").select(PROJECT_SELECT)
          .eq("country_id", countryId).eq("submitted_season_id", seasonId)
          .maybeSingle<ProjectRow>(),
        admin.from("national_federation_race_projects").select(PROJECT_SELECT)
          .eq("country_id", countryId).in("status", ["scheduled", "active"])
          .order("activation_game_year", { ascending: true }).returns<ProjectRow[]>(),
        viewerTeamId
          ? admin.from("team_manager_assignments").select("sporting_director_id")
              .eq("team_id", viewerTeamId).eq("role", "general_manager").eq("status", "active")
              .maybeSingle<AssignmentRow>()
          : Promise.resolve({ data: null, error: null }),
        admin.from("national_federation_terms").select("president_director_id")
          .eq("country_id", countryId).eq("governance_mode", "elected").lte("start_game_year", gameYear)
          .gte("end_game_year", gameYear).maybeSingle<TermRow>(),
        admin.rpc("get_national_federation_race_creation_score", {
          p_country_id: countryId, p_season_id: seasonId,
        }),
        admin.rpc("get_national_federation_race_workshop_context", {
          p_country_id: countryId, p_season_id: seasonId,
        }).maybeSingle<WorkshopContextRow>(),
        admin.from("seasons").select("id, game_year").eq("game_year", gameYear + 1).eq("status", "planned")
          .maybeSingle<SeasonRow>(),
      ]);

    for (const [result, label] of [
      [office, "le Bureau d’organisation"],
      [currentProject, "le projet de course"], [managedProjects, "les courses permanentes"],
      [assignment, "le mandat du DS"], [term, "la présidence fédérale"],
      [scoreResult, "l’indice d’homologation"], [context, "le budget disponible et la date limite"],
      [targetSeason, "la saison suivante"],
    ] as const) {
      if (result.error) throw new Error(`${label} : ${result.error.message}`);
    }

    const score = parseScore(scoreResult.data, fallbackScore);
    const officeLevel = office.data?.level ?? 0;
    const viewerIsPresident = Boolean(
      assignment.data?.sporting_director_id &&
      assignment.data.sporting_director_id === term.data?.president_director_id,
    );
    const projectRow = currentProject.data;
    const workflowOpen = !projectRow || ["draft", "rejected"].includes(projectRow.status);
    const voteWindowOpen = context.data?.vote_window_open ?? false;
    const canCreate = gameYear >= FEDERATION_RACE_CREATION_START_GAME_YEAR && officeLevel >= 1 &&
      viewerIsPresident && score.eligible && workflowOpen && voteWindowOpen;
    const [director, voteState, calendar] = await Promise.all([
      canCreate && assignment.data
        ? admin.from("sporting_directors").select("reputation_points")
          .eq("id", assignment.data.sporting_director_id).maybeSingle<DirectorRow>()
        : Promise.resolve({ data: null, error: null }),
      loadVoteState(admin, projectRow?.status === "voting" ? projectRow.id : null,
        viewerTeamId, assignment.data?.sporting_director_id ?? null),
      canCreate && targetSeason.data ? loadTargetCalendar(admin, targetSeason.data.id) : Promise.resolve([]),
    ]);
    if (director.error) throw new Error(`la réputation du DS : ${director.error.message}`);

    const rows = [...(projectRow ? [projectRow] : []), ...(managedProjects.data ?? [])];
    const uniqueRows = [...new Map(rows.map((row) => [row.id, row])).values()];
    const projects = uniqueRows.map((row) => toProject(row, row.id === projectRow?.id ? voteState : undefined))
      .filter((project): project is FederationRaceProject => project !== null);
    const project = currentProject.data
      ? projects.find((item) => item.id === currentProject.data?.id) ?? null : null;
    const managedRaces = projects.filter((item) => ["scheduled", "active"].includes(item.status));

    return {
      score, officeLevel, viewerIsPresident, viewerTeamId,
      canCreate,
      canVote: Boolean(voteState?.viewerCanVote && project?.voteClosesAt &&
        new Date(project.voteClosesAt).getTime() > Date.now()),
      canCancel: viewerIsPresident, project, managedRaces,
      availableBalance: Number(context.data?.available_balance ?? 0),
      viewerReputation: Number(director.data?.reputation_points ?? 0),
      voteDeadline: context.data?.vote_deadline ?? null,
      voteWindowOpen,
      targetGameYear: targetSeason.data?.game_year ?? gameYear + 1,
      calendarStatus: !targetSeason.data ? "pending" : calendar.length === 28 ? "ready" : "unavailable",
      calendar,
    };
  } catch (error) {
    console.error("Impossible de charger l’atelier de création de course :", error);
    return fallback;
  }
}

async function loadVoteState(
  admin: ReturnType<typeof createSupabaseAdminClient>, projectId: string | null,
  viewerTeamId: string | null, viewerDirectorId: string | null,
) {
  if (!projectId) return undefined;
  const [votes, electorate] = await Promise.all([
    admin.from("national_federation_race_votes").select("team_id, choice")
      .eq("project_id", projectId).returns<VoteRow[]>(),
    admin.from("national_federation_race_electorate").select("team_id, sporting_director_id")
      .eq("project_id", projectId).returns<ElectorateRow[]>(),
  ]);
  if (votes.error || electorate.error) return undefined;
  const projectVotes = votes.data ?? [];
  const projectElectorate = electorate.data ?? [];
  const viewerChoice = projectVotes.find((vote) => vote.team_id === viewerTeamId)?.choice;
  const viewerVote: FederationRaceProject["viewerVote"] =
    viewerChoice === "approve" || viewerChoice === "reject" ? viewerChoice : null;
  return {
    electorateCount: projectElectorate.length,
    approveVotes: projectVotes.filter((vote) => vote.choice === "approve").length,
    rejectVotes: projectVotes.filter((vote) => vote.choice === "reject").length,
    viewerVote,
    viewerCanVote: projectElectorate.some((member) => member.team_id === viewerTeamId && member.sporting_director_id === viewerDirectorId),
  };
}

async function loadTargetCalendar(
  admin: ReturnType<typeof createSupabaseAdminClient>, targetSeasonId: string,
): Promise<FederationRaceCalendarDay[]> {
  const { data, error } = await admin.rpc("get_national_federation_race_workshop_slots", {
    p_target_season_id: targetSeasonId,
  });
  if (error || !Array.isArray(data)) return [];
  const slots: WorkshopSlotRow[] = data;

  const lateSlots = new Map(slots.filter((slot) => slot.day_slot === "late").map((slot) => [slot.day_number, slot]));
  const toSlot = (slot: WorkshopSlotRow): FederationRaceCalendarSlot => ({
    existingRaceCount: slot.existing_race_count,
    labels: slot.labels,
    unavailable: slot.unavailable,
  });
  return slots.filter((slot) => slot.day_slot === "early").flatMap((early) => {
    const late = lateSlots.get(early.day_number);
    if (!late) return [];
    return [{
      dayNumber: early.day_number,
      calendarDate: early.calendar_date,
      forbiddenLabel: early.day_number === 1 ? "Préparation de la saison" : early.protected_label,
      early: toSlot(early),
      late: toSlot(late),
    }];
  });
}

function parseScore(value: unknown, fallback: FederationRaceCreationScore): FederationRaceCreationScore {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const score = value as Record<string, unknown>;
  const number = (key: string) => typeof score[key] === "number" && Number.isFinite(score[key]) ? score[key] as number : null;
  const total = number("total"); const threshold = number("threshold");
  if (total == null || threshold == null) return fallback;
  return {
    nationRank: number("nationRank"), rankingPoints: number("rankingPoints") ?? fallback.rankingPoints,
    completedObjectiveCount: number("completedObjectiveCount") ?? fallback.completedObjectiveCount,
    objectivePoints: number("objectivePoints") ?? fallback.objectivePoints,
    existingRaceCount: number("existingRaceCount") ?? fallback.existingRaceCount,
    calendarPenaltyPerRace: number("calendarPenaltyPerRace") ?? fallback.calendarPenaltyPerRace,
    calendarPenalty: number("calendarPenalty") ?? fallback.calendarPenalty, total, threshold,
    continentalThreshold: number("continentalThreshold") ?? fallback.continentalThreshold,
    eligible: typeof score.eligible === "boolean" ? score.eligible : total >= threshold,
  };
}

function toProject(row: ProjectRow, vote?: { electorateCount: number; approveVotes: number; rejectVotes: number; viewerVote: "approve" | "reject" | null }): FederationRaceProject | null {
  if (!isRaceFormat(row.race_format) || !isCategoryCode(row.category_code) ||
      !isDaySlot(row.start_day_slot) || !isProjectStatus(row.status)) return null;
  const stages = parseStages(row.stage_blueprint);
  const fallback = getFederationRaceCost({ categoryCode: row.category_code, stageCount: stages.length });
  return {
    id: row.id, name: row.name, shortName: row.short_name, raceFormat: row.race_format,
    categoryCode: row.category_code, startDay: row.start_day_number, startSlot: row.start_day_slot,
    activationGameYear: row.activation_game_year, status: row.status, stages,
    submittedAt: row.created_at, voteClosesAt: row.vote_closes_at, approvedAt: row.approved_at,
    decisionError: row.decision_error,
    cost: { creationMoney: Number(row.creation_cost ?? fallback.creationMoney),
      creationReputation: Number(row.reputation_cost ?? fallback.creationReputation),
      annualMaintenance: Number(row.annual_maintenance_cost ?? fallback.annualMaintenance) },
    electorateCount: vote?.electorateCount ?? 0, approveVotes: vote?.approveVotes ?? 0,
    rejectVotes: vote?.rejectVotes ?? 0, viewerVote: vote?.viewerVote ?? null,
  };
}

function parseStages(value: unknown): FederationRaceStageBlueprint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((stage): FederationRaceStageBlueprint[] => {
    if (!stage || typeof stage !== "object") return [];
    const candidate = stage as Partial<FederationRaceStageBlueprint>;
    if (typeof candidate.name !== "string" || !isStageType(candidate.stageType) ||
        !isProfileType(candidate.profileType) || !Array.isArray(candidate.segments)) return [];
    const profileType = candidate.profileType === "sprint"
      ? "flat"
      : candidate.profileType;
    const segments = candidate.segments.flatMap((segment) => {
      if (!segment || typeof segment !== "object") return [];
      const item = segment as Record<string, unknown>;
      if (typeof item.distanceKm !== "number" || !isTerrainType(item.terrainType) ||
          !isSurfaceType(item.surfaceType) || typeof item.averageGradientPct !== "number") return [];
      return [{ distanceKm: item.distanceKm, terrainType: item.terrainType,
        surfaceType: item.surfaceType, averageGradientPct: item.averageGradientPct }];
    });
    return [{ ...candidate, profileType, segments } as FederationRaceStageBlueprint];
  });
}

function isRaceFormat(value: string): value is FederationRaceFormat { return value === "one_day" || value === "stage_race"; }
function isCategoryCode(value: string): value is FederationRaceCategoryCode { return ["continental", "national", "regional"].includes(value); }
function isDaySlot(value: string): value is FederationRaceDaySlot { return value === "early" || value === "late"; }
function isProjectStatus(value: string): value is FederationRaceProjectStatus { return ["draft", "voting", "scheduled", "active", "rejected", "cancelled"].includes(value); }
function isStageType(value: unknown): value is FederationRaceStageBlueprint["stageType"] { return ["road", "individual_time_trial", "team_time_trial", "prologue"].includes(String(value)); }
function isProfileType(value: unknown): value is FederationRaceStageBlueprint["profileType"] { return ["flat", "sprint", "hilly", "mountain", "cobbles", "time_trial", "mixed"].includes(String(value)); }
function isTerrainType(value: unknown): value is FederationRaceStageBlueprint["segments"][number]["terrainType"] { return ["flat", "climb", "descent"].includes(String(value)); }
function isSurfaceType(value: unknown): value is FederationRaceStageBlueprint["segments"][number]["surfaceType"] { return ["asphalt", "cobbles"].includes(String(value)); }
