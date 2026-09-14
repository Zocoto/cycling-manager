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
  accountBalance: number;
  viewerReputation: number;
  targetGameYear: number;
  calendar: FederationRaceCalendarDay[];
};

type ProjectRow = {
  id: string; name: string; short_name: string; race_format: string;
  category_code: string; start_day_number: number; start_day_slot: string;
  activation_game_year: number; status: string; stage_blueprint: unknown;
  created_at: string; vote_closes_at: string | null; approved_at: string | null;
  creation_cost: number | string | null; reputation_cost: number | string | null;
  annual_maintenance_cost: number | string | null;
};
type InfrastructureRow = { level: number };
type AssignmentRow = { sporting_director_id: string };
type TermRow = { president_director_id: string | null };
type DirectorRow = { reputation_points: number | string };
type AccountRow = { balance: number | string };
type SeasonRow = { id: string; game_year: number };
type SeasonDayRow = { id: string; day_number: number; calendar_date: string };
type EditionRow = { id: string; display_name: string; race_id: string };
type RaceRow = { id: string; competition_type: string; status: string };
type StageRow = { season_day_id: string; day_slot: string; race_edition_id: string };
type DevelopmentEditionRow = {
  name: string; start_day_number: number; end_day_number: number;
  competition_type: string;
};
type VoteRow = { project_id: string; team_id: string; choice: string };
type ElectorateRow = { project_id: string };
type ReservedProjectRow = {
  name: string;
  start_day_number: number;
  start_day_slot: string;
  stage_blueprint: unknown;
};

const PROJECT_SELECT =
  "id, name, short_name, race_format, category_code, start_day_number, start_day_slot, activation_game_year, status, stage_blueprint, created_at, vote_closes_at, approved_at, creation_cost, reputation_cost, annual_maintenance_cost";

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
    managedRaces: [], accountBalance: 0, viewerReputation: 0,
    targetGameYear: gameYear + 1, calendar: [],
  };

  try {
    const admin = createSupabaseAdminClient();
    await admin.rpc("settle_due_national_federation_race_votes");
    const [races, office, currentProject, managedProjects, assignment, term, scoreResult, account, targetSeason] =
      await Promise.all([
        admin.from("races").select("id", { count: "exact", head: true })
          .eq("country_id", countryId).eq("competition_type", "standard").eq("status", "active"),
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
          .eq("country_id", countryId).lte("start_game_year", gameYear)
          .gte("end_game_year", gameYear).maybeSingle<TermRow>(),
        admin.rpc("get_national_federation_race_creation_score", {
          p_country_id: countryId, p_season_id: seasonId,
        }),
        admin.from("national_federation_accounts").select("balance")
          .eq("country_id", countryId).eq("season_id", seasonId).maybeSingle<AccountRow>(),
        admin.from("seasons").select("id, game_year").eq("game_year", gameYear + 1)
          .maybeSingle<SeasonRow>(),
      ]);

    for (const [result, label] of [
      [races, "les courses nationales"], [office, "le Bureau d’organisation"],
      [currentProject, "le projet de course"], [managedProjects, "les courses permanentes"],
      [assignment, "le mandat du DS"], [term, "la présidence fédérale"],
      [scoreResult, "l’indice d’homologation"], [account, "le compte fédéral"],
      [targetSeason, "la saison suivante"],
    ] as const) {
      if (result.error) throw new Error(`${label} : ${result.error.message}`);
    }

    const director = assignment.data?.sporting_director_id
      ? await admin.from("sporting_directors").select("reputation_points")
          .eq("id", assignment.data.sporting_director_id).maybeSingle<DirectorRow>()
      : { data: null, error: null };
    if (director.error) throw new Error(`la réputation du DS : ${director.error.message}`);

    const score = parseScore(scoreResult.data, buildFederationRaceCreationScore({
      nationRank, completedObjectiveCount, existingRaceCount: races.count ?? 0,
    }));
    const officeLevel = office.data?.level ?? 0;
    const viewerIsPresident = Boolean(
      assignment.data?.sporting_director_id &&
      assignment.data.sporting_director_id === term.data?.president_director_id,
    );
    const rows = [...(currentProject.data ? [currentProject.data] : []), ...(managedProjects.data ?? [])];
    const uniqueRows = [...new Map(rows.map((row) => [row.id, row])).values()];
    const voteState = await loadVoteState(admin, uniqueRows.map((row) => row.id), viewerTeamId);
    const projects = uniqueRows.map((row) => toProject(row, voteState.get(row.id)))
      .filter((project): project is FederationRaceProject => project !== null);
    const project = currentProject.data
      ? projects.find((item) => item.id === currentProject.data?.id) ?? null : null;
    const managedRaces = projects.filter((item) => ["scheduled", "active"].includes(item.status));
    const calendar = targetSeason.data ? await loadTargetCalendar(admin, targetSeason.data) : [];
    const workflowOpen = !project || ["draft", "rejected"].includes(project.status);

    return {
      score, officeLevel, viewerIsPresident, viewerTeamId,
      canCreate: gameYear >= FEDERATION_RACE_CREATION_START_GAME_YEAR && officeLevel >= 1 &&
        viewerIsPresident && score.eligible && workflowOpen,
      canVote: Boolean(viewerTeamId && project?.status === "voting" && project.voteClosesAt &&
        new Date(project.voteClosesAt).getTime() > Date.now()),
      canCancel: viewerIsPresident, project, managedRaces,
      accountBalance: Number(account.data?.balance ?? 0),
      viewerReputation: Number(director.data?.reputation_points ?? 0),
      targetGameYear: targetSeason.data?.game_year ?? gameYear + 1, calendar,
    };
  } catch (error) {
    console.error("Impossible de charger l’atelier de création de course :", error);
    return fallback;
  }
}

async function loadVoteState(
  admin: ReturnType<typeof createSupabaseAdminClient>, projectIds: string[], viewerTeamId: string | null,
) {
  const result = new Map<string, { electorateCount: number; approveVotes: number; rejectVotes: number; viewerVote: "approve" | "reject" | null }>();
  if (!projectIds.length) return result;
  const [votes, electorate] = await Promise.all([
    admin.from("national_federation_race_votes").select("project_id, team_id, choice")
      .in("project_id", projectIds).returns<VoteRow[]>(),
    admin.from("national_federation_race_electorate").select("project_id")
      .in("project_id", projectIds).returns<ElectorateRow[]>(),
  ]);
  if (votes.error || electorate.error) return result;
  for (const projectId of projectIds) {
    const projectVotes = (votes.data ?? []).filter((vote) => vote.project_id === projectId);
    const viewerChoice = projectVotes.find((vote) => vote.team_id === viewerTeamId)?.choice;
    result.set(projectId, {
      electorateCount: (electorate.data ?? []).filter((member) => member.project_id === projectId).length,
      approveVotes: projectVotes.filter((vote) => vote.choice === "approve").length,
      rejectVotes: projectVotes.filter((vote) => vote.choice === "reject").length,
      viewerVote: viewerChoice === "approve" || viewerChoice === "reject" ? viewerChoice : null,
    });
  }
  return result;
}

async function loadTargetCalendar(
  admin: ReturnType<typeof createSupabaseAdminClient>, targetSeason: SeasonRow,
): Promise<FederationRaceCalendarDay[]> {
  const [days, editions, developmentEditions, reservedProjects] = await Promise.all([
    admin.from("season_days").select("id, day_number, calendar_date")
      .eq("season_id", targetSeason.id).order("day_number").returns<SeasonDayRow[]>(),
    admin.from("race_editions").select("id, display_name, race_id")
      .eq("season_id", targetSeason.id).returns<EditionRow[]>(),
    admin.from("development_race_editions")
      .select("name, start_day_number, end_day_number, competition_type")
      .eq("season_id", targetSeason.id).neq("status", "cancelled").returns<DevelopmentEditionRow[]>(),
    admin.from("national_federation_race_projects")
      .select("name, start_day_number, start_day_slot, stage_blueprint")
      .eq("activation_game_year", targetSeason.game_year).eq("status", "voting")
      .returns<ReservedProjectRow[]>(),
  ]);
  if (days.error || editions.error || developmentEditions.error || reservedProjects.error) return [];
  const raceIds = [...new Set((editions.data ?? []).map((edition) => edition.race_id))];
  const editionIds = (editions.data ?? []).map((edition) => edition.id);
  const [races, stages] = await Promise.all([
    raceIds.length ? admin.from("races").select("id, competition_type, status").in("id", raceIds).returns<RaceRow[]>()
      : Promise.resolve({ data: [] as RaceRow[], error: null }),
    editionIds.length ? admin.from("stages").select("season_day_id, day_slot, race_edition_id")
      .in("race_edition_id", editionIds).returns<StageRow[]>()
      : Promise.resolve({ data: [] as StageRow[], error: null }),
  ]);
  if (races.error || stages.error) return [];
  const editionsById = new Map((editions.data ?? []).map((edition) => [edition.id, edition]));
  const racesById = new Map((races.data ?? []).map((race) => [race.id, race]));

  return (days.data ?? []).map((day) => {
    const dayStages = (stages.data ?? []).filter((stage) => stage.season_day_id === day.id);
    const forbidden = dayStages.flatMap((stage) => {
      const edition = editionsById.get(stage.race_edition_id);
      const race = edition ? racesById.get(edition.race_id) : null;
      const label = race ? forbiddenCompetitionLabel(race.competition_type, targetSeason.game_year) : null;
      return label ? [label] : [];
    });
    for (const edition of developmentEditions.data ?? []) {
      if (day.day_number >= edition.start_day_number && day.day_number <= edition.end_day_number) {
        const label = forbiddenCompetitionLabel(edition.competition_type, targetSeason.game_year);
        if (label) forbidden.push(label);
      }
    }
    const forbiddenLabel = [...new Set(forbidden)].join(" · ") || null;
    const buildSlot = (daySlot: FederationRaceDaySlot): FederationRaceCalendarSlot => {
      const absoluteSlot = (day.day_number - 1) * 2 + (daySlot === "late" ? 1 : 0);
      const reservations = (reservedProjects.data ?? []).filter((project) => {
        const firstSlot = (project.start_day_number - 1) * 2 +
          (project.start_day_slot === "late" ? 1 : 0);
        const stageCount = Array.isArray(project.stage_blueprint)
          ? project.stage_blueprint.length
          : 1;
        return absoluteSlot >= firstSlot && absoluteSlot < firstSlot + stageCount;
      });
      const standardStages = dayStages.filter((stage) => {
        const edition = editionsById.get(stage.race_edition_id);
        return stage.day_slot === daySlot && edition &&
          racesById.get(edition.race_id)?.competition_type === "standard" &&
          racesById.get(edition.race_id)?.status === "active";
      });
      return {
        existingRaceCount: standardStages.length,
        labels: [...standardStages.flatMap((stage) => {
          const edition = editionsById.get(stage.race_edition_id);
          return edition ? [edition.display_name] : [];
        }), ...reservations.map((project) => `Vote : ${project.name}`)],
        unavailable: Boolean(forbiddenLabel) || standardStages.length >= 2 || reservations.length > 0,
      };
    };
    return { dayNumber: day.day_number, calendarDate: day.calendar_date,
      forbiddenLabel, early: buildSlot("early"), late: buildSlot("late") };
  });
}

function forbiddenCompetitionLabel(competitionType: string, gameYear: number): string | null {
  if (["national_road", "national_time_trial"].includes(competitionType)) return "CN";
  if (["continental_championship", "continental_road", "continental_time_trial"].includes(competitionType)) return "CC";
  if (["world_championship", "world_road", "world_time_trial"].includes(competitionType)) return "CM";
  if (["nations_cup", "nations_cup_junior"].includes(competitionType)) return gameYear % 4 === 0 ? "JQ" : "NC";
  return null;
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
    const segments = candidate.segments.flatMap((segment) => {
      if (!segment || typeof segment !== "object") return [];
      const item = segment as Record<string, unknown>;
      if (typeof item.distanceKm !== "number" || !isTerrainType(item.terrainType) ||
          !isSurfaceType(item.surfaceType) || typeof item.averageGradientPct !== "number") return [];
      return [{ distanceKm: item.distanceKm, terrainType: item.terrainType,
        surfaceType: item.surfaceType, averageGradientPct: item.averageGradientPct }];
    });
    return [{ ...candidate, segments } as FederationRaceStageBlueprint];
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
