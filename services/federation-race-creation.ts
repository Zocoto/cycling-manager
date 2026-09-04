import "server-only";

import {
  buildFederationRaceCreationScore,
  FEDERATION_RACE_CREATION_START_GAME_YEAR,
  type FederationRaceCategoryCode,
  type FederationRaceCreationScore,
  type FederationRaceDaySlot,
  type FederationRaceFormat,
  type FederationRaceStageBlueprint,
} from "@/lib/game/federation-race-creation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FederationRaceProject = {
  id: string;
  name: string;
  shortName: string;
  raceFormat: FederationRaceFormat;
  categoryCode: FederationRaceCategoryCode;
  startDay: number;
  startSlot: FederationRaceDaySlot;
  activationGameYear: number;
  status: "scheduled" | "active" | "cancelled";
  stages: FederationRaceStageBlueprint[];
  submittedAt: string;
};

export type FederationRaceCreationState = {
  score: FederationRaceCreationScore;
  officeLevel: number;
  viewerIsPresident: boolean;
  canCreate: boolean;
  project: FederationRaceProject | null;
};

type ProjectRow = {
  id: string;
  name: string;
  short_name: string;
  race_format: string;
  category_code: string;
  start_day_number: number;
  start_day_slot: string;
  activation_game_year: number;
  status: string;
  stage_blueprint: unknown;
  created_at: string;
};
type InfrastructureRow = { level: number };
type AssignmentRow = { sporting_director_id: string };
type TermRow = { president_director_id: string | null };

export async function getFederationRaceCreationState({
  countryId,
  seasonId,
  gameYear,
  viewerTeamId,
  nationRank,
  completedObjectiveCount,
}: {
  countryId: string;
  seasonId: string;
  gameYear: number;
  viewerTeamId: string | null;
  nationRank: number | null;
  completedObjectiveCount: number;
}): Promise<FederationRaceCreationState> {
  const fallbackScore = buildFederationRaceCreationScore({
    nationRank,
    completedObjectiveCount,
    existingRaceCount: 0,
  });
  const fallback: FederationRaceCreationState = {
    score: fallbackScore,
    officeLevel: 0,
    viewerIsPresident: false,
    canCreate: false,
    project: null,
  };

  try {
    const admin = createSupabaseAdminClient();
    const [races, office, project, assignment, term, authoritativeScore] =
      await Promise.all([
      admin
        .from("races")
        .select("id", { count: "exact", head: true })
        .eq("country_id", countryId)
        .eq("competition_type", "standard")
        .eq("status", "active"),
      admin
        .from("national_federation_infrastructures")
        .select("level")
        .eq("country_id", countryId)
        .eq("infrastructure_code", "race_organization_office")
        .maybeSingle<InfrastructureRow>(),
      admin
        .from("national_federation_race_projects")
        .select(
          "id, name, short_name, race_format, category_code, start_day_number, start_day_slot, activation_game_year, status, stage_blueprint, created_at",
        )
        .eq("country_id", countryId)
        .eq("submitted_season_id", seasonId)
        .maybeSingle<ProjectRow>(),
      viewerTeamId
        ? admin
            .from("team_manager_assignments")
            .select("sporting_director_id")
            .eq("team_id", viewerTeamId)
            .eq("role", "general_manager")
            .eq("status", "active")
            .maybeSingle<AssignmentRow>()
        : Promise.resolve({ data: null, error: null }),
      admin
        .from("national_federation_terms")
        .select("president_director_id")
        .eq("country_id", countryId)
        .lte("start_game_year", gameYear)
        .gte("end_game_year", gameYear)
        .maybeSingle<TermRow>(),
      admin.rpc("get_national_federation_race_creation_score", {
        p_country_id: countryId,
        p_season_id: seasonId,
      }),
    ]);

    for (const [result, label] of [
      [races, "les courses nationales"],
      [office, "le Bureau d’organisation"],
      [project, "le projet de course"],
      [assignment, "le mandat du DS"],
      [term, "la présidence fédérale"],
      [authoritativeScore, "l’indice d’homologation"],
    ] as const) {
      if (result.error) {
        throw new Error(`${label} : ${result.error.message}`);
      }
    }

    const localScore = buildFederationRaceCreationScore({
      nationRank,
      completedObjectiveCount,
      existingRaceCount: races.count ?? 0,
    });
    const score = parseScore(authoritativeScore.data, localScore);
    const officeLevel = office.data?.level ?? 0;
    const viewerIsPresident = Boolean(
      assignment.data?.sporting_director_id &&
        assignment.data.sporting_director_id ===
          term.data?.president_director_id,
    );
    const parsedProject = toProject(project.data);

    return {
      score,
      officeLevel,
      viewerIsPresident,
      canCreate:
        gameYear >= FEDERATION_RACE_CREATION_START_GAME_YEAR &&
        officeLevel >= 1 &&
        viewerIsPresident &&
        score.eligible &&
        !parsedProject,
      project: parsedProject,
    };
  } catch (error) {
    console.error("Impossible de charger l’atelier de création de course :", error);
    return fallback;
  }
}

function parseScore(
  value: unknown,
  fallback: FederationRaceCreationScore,
): FederationRaceCreationScore {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }
  const score = value as Record<string, unknown>;
  const number = (key: string): number | null =>
    typeof score[key] === "number" && Number.isFinite(score[key])
      ? score[key]
      : null;
  const total = number("total");
  const threshold = number("threshold");
  if (total == null || threshold == null) return fallback;

  return {
    nationRank: number("nationRank"),
    rankingPoints: number("rankingPoints") ?? fallback.rankingPoints,
    completedObjectiveCount:
      number("completedObjectiveCount") ?? fallback.completedObjectiveCount,
    objectivePoints: number("objectivePoints") ?? fallback.objectivePoints,
    existingRaceCount:
      number("existingRaceCount") ?? fallback.existingRaceCount,
    calendarPenalty:
      number("calendarPenalty") ?? fallback.calendarPenalty,
    total,
    threshold,
    eligible:
      typeof score.eligible === "boolean"
        ? score.eligible
        : total >= threshold,
  };
}

function toProject(row: ProjectRow | null): FederationRaceProject | null {
  if (
    !row ||
    !isRaceFormat(row.race_format) ||
    !isCategoryCode(row.category_code) ||
    !isDaySlot(row.start_day_slot) ||
    !isProjectStatus(row.status)
  ) {
    return null;
  }

  const stages = parseStages(row.stage_blueprint);
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    raceFormat: row.race_format,
    categoryCode: row.category_code,
    startDay: row.start_day_number,
    startSlot: row.start_day_slot,
    activationGameYear: row.activation_game_year,
    status: row.status,
    stages,
    submittedAt: row.created_at,
  };
}

function parseStages(value: unknown): FederationRaceStageBlueprint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((stage): FederationRaceStageBlueprint[] => {
    if (!stage || typeof stage !== "object") return [];
    const candidate = stage as Partial<FederationRaceStageBlueprint>;
    if (
      typeof candidate.name !== "string" ||
      !isStageType(candidate.stageType) ||
      !isProfileType(candidate.profileType) ||
      !Array.isArray(candidate.segments)
    ) {
      return [];
    }
    const segments = candidate.segments.flatMap((segment) => {
      if (!segment || typeof segment !== "object") return [];
      const item = segment as Record<string, unknown>;
      if (
        typeof item.distanceKm !== "number" ||
        !isTerrainType(item.terrainType) ||
        !isSurfaceType(item.surfaceType) ||
        typeof item.averageGradientPct !== "number"
      ) {
        return [];
      }
      return [
        {
          distanceKm: item.distanceKm,
          terrainType: item.terrainType,
          surfaceType: item.surfaceType,
          averageGradientPct: item.averageGradientPct,
        },
      ];
    });
    return [{ ...candidate, segments } as FederationRaceStageBlueprint];
  });
}

function isRaceFormat(value: string): value is FederationRaceFormat {
  return value === "one_day" || value === "stage_race";
}

function isCategoryCode(value: string): value is FederationRaceCategoryCode {
  return value === "continental" || value === "national" || value === "regional";
}

function isDaySlot(value: string): value is FederationRaceDaySlot {
  return value === "early" || value === "late";
}

function isProjectStatus(
  value: string,
): value is FederationRaceProject["status"] {
  return value === "scheduled" || value === "active" || value === "cancelled";
}

function isStageType(value: unknown): value is FederationRaceStageBlueprint["stageType"] {
  return (
    value === "road" ||
    value === "individual_time_trial" ||
    value === "team_time_trial" ||
    value === "prologue"
  );
}

function isProfileType(
  value: unknown,
): value is FederationRaceStageBlueprint["profileType"] {
  return (
    value === "flat" ||
    value === "sprint" ||
    value === "hilly" ||
    value === "mountain" ||
    value === "cobbles" ||
    value === "time_trial" ||
    value === "mixed"
  );
}

function isTerrainType(
  value: unknown,
): value is FederationRaceStageBlueprint["segments"][number]["terrainType"] {
  return value === "flat" || value === "climb" || value === "descent";
}

function isSurfaceType(
  value: unknown,
): value is FederationRaceStageBlueprint["segments"][number]["surfaceType"] {
  return value === "asphalt" || value === "cobbles";
}
