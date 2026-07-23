import "server-only";

import { COUNTRY_MAP_COORDINATES } from "@/data/country-map-coordinates";
import {
  ARCHITECT_SPECIALTY_LABELS,
  INFRASTRUCTURE_UNLOCK_LEVEL,
  TEAM_INFRASTRUCTURE_DEFINITIONS,
  getInternationalCenterBonusPercentage,
  getInternationalCenterLevelDefinition,
  getTeamInfrastructureLevelDefinition,
  isArchitectSpecialty,
  type ArchitectSpecialty,
  type TeamInfrastructureCode,
} from "@/lib/game/infrastructure";
import { calculateSportingDirectorProgression } from "@/lib/game/sporting-director-progression";
import {
  calculateConstructionWithArchitect,
  getArchitectConstructionBonuses,
} from "@/lib/game/staff";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
  is_active: boolean;
};

type CenterRow = {
  id: string;
  team_id: string;
  country_id: string;
  quality_level: number;
  completed_at: string;
};

type ProjectRow = {
  id: string;
  team_id: string;
  infrastructure_code:
    | TeamInfrastructureCode
    | "international_youth_center";
  country_id: string | null;
  target_level: number;
  architect_specialty: string | null;
  architect_level: number | null;
  base_cost: number | string;
  final_cost: number | string;
  base_duration_days: number;
  final_duration_days: number;
  cost_reduction_percentage: number;
  duration_reduction_percentage: number;
  started_day_number: number;
  starts_game_day_index: number;
  completes_game_day_index: number;
  status: "active" | "completed" | "cancelled";
  completed_at: string | null;
  created_at: string;
};

export type InfrastructureArchitect = {
  contractId: string;
  firstName: string;
  lastName: string;
  level: number;
  specialty: ArchitectSpecialty;
  specialtyLabel: string;
  costReductionPercentage: number;
  durationReductionPercentage: number;
};

export type InternationalCenterOwner = {
  id: string;
  qualityLevel: number;
  teamId: string;
  teamName: string;
  directorName: string;
  directorIdentifier: string | null;
  completedAt: string;
  isCurrentTeam: boolean;
};

export type InfrastructureCountry = {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  totalQualityStars: number;
  globalBonusPercentage: number;
  currentTeamLevel: number;
  centers: InternationalCenterOwner[];
};

export type InfrastructureProject = {
  id: string;
  code: ProjectRow["infrastructure_code"];
  name: string;
  countryName: string | null;
  targetLevel: number;
  finalCost: number;
  finalDurationDays: number;
  costReductionPercentage: number;
  durationReductionPercentage: number;
  architectSpecialtyLabel: string | null;
  startedDayNumber: number;
  remainingDays: number;
  completionGameYear: number;
  completionDayNumber: number;
  status: ProjectRow["status"];
  completedAt: string | null;
};

export type InfrastructureNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  unread: boolean;
};

export type TeamInfrastructureOverview = {
  teamId: string;
  teamName: string;
  seasonName: string;
  gameYear: number;
  currentDayNumber: number;
  directorLevel: number;
  isUnlocked: boolean;
  balance: number;
  currency: string;
  dataRoomLevel: number;
  dataRoomNextLevel: ReturnType<
    typeof getTeamInfrastructureLevelDefinition
  >;
  architects: InfrastructureArchitect[];
  activeProject: InfrastructureProject | null;
  recentProjects: InfrastructureProject[];
  countries: InfrastructureCountry[];
  notifications: InfrastructureNotification[];
};

export async function getTeamInfrastructureOverview(
  supabase: ServerClient,
  authUserId: string,
): Promise<TeamInfrastructureOverview | null> {
  const [financeSettlement, projectSettlement] = await Promise.all([
    supabase.rpc("settle_current_team_finances"),
    supabase.rpc("settle_due_infrastructure_projects"),
  ]);
  assertQuery(financeSettlement.error, "l’actualisation des finances");
  assertQuery(projectSettlement.error, "l’achèvement des chantiers");

  const admin = createSupabaseAdminClient();
  const context = await loadContext(admin, authUserId);
  if (!context) return null;

  const [
    infrastructureResult,
    projectsResult,
    contractsResult,
    countriesResult,
    centersResult,
    teamSeasonsResult,
    assignmentsResult,
    notificationsResult,
  ] = await Promise.all([
    admin
      .from("team_infrastructures")
      .select("infrastructure_code, level")
      .eq("team_id", context.teamId)
      .returns<Array<{ infrastructure_code: string; level: number }>>(),
    admin
      .from("infrastructure_projects")
      .select(
        "id, team_id, infrastructure_code, country_id, target_level, architect_specialty, architect_level, base_cost, final_cost, base_duration_days, final_duration_days, cost_reduction_percentage, duration_reduction_percentage, started_day_number, starts_game_day_index, completes_game_day_index, status, completed_at, created_at",
      )
      .eq("team_id", context.teamId)
      .order("created_at", { ascending: false })
      .limit(12)
      .returns<ProjectRow[]>(),
    admin
      .from("staff_contracts")
      .select("id, staff_member_id")
      .eq("team_id", context.teamId)
      .eq("status", "active")
      .returns<Array<{ id: string; staff_member_id: string }>>(),
    admin
      .from("countries")
      .select("id, name, iso_alpha2, is_active")
      .eq("is_active", true)
      .order("name")
      .returns<CountryRow[]>(),
    admin
      .from("international_youth_centers")
      .select("id, team_id, country_id, quality_level, completed_at")
      .order("completed_at", { ascending: true })
      .returns<CenterRow[]>(),
    admin
      .from("team_seasons")
      .select("team_id, display_name")
      .eq("season_id", context.seasonId)
      .returns<Array<{ team_id: string; display_name: string }>>(),
    admin
      .from("team_manager_assignments")
      .select("team_id, sporting_director_id")
      .eq("role", "general_manager")
      .eq("status", "active")
      .returns<
        Array<{ team_id: string; sporting_director_id: string }>
      >(),
    admin
      .from("infrastructure_notifications")
      .select("id, title, message, read_at, created_at")
      .eq("team_id", context.teamId)
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<
        Array<{
          id: string;
          title: string;
          message: string;
          read_at: string | null;
          created_at: string;
        }>
      >(),
  ]);

  for (const [result, label] of [
    [infrastructureResult, "les infrastructures de l’équipe"],
    [projectsResult, "les chantiers"],
    [contractsResult, "les architectes"],
    [countriesResult, "les pays"],
    [centersResult, "les centres internationaux"],
    [teamSeasonsResult, "les équipes propriétaires"],
    [assignmentsResult, "les Directeurs Sportifs propriétaires"],
    [notificationsResult, "les notifications d’infrastructure"],
  ] as const) {
    assertQuery(result.error, label);
  }

  const contracts = contractsResult.data ?? [];
  const memberIds = contracts.map((contract) => contract.staff_member_id);
  const membersResult = memberIds.length
    ? await admin
        .from("staff_members")
        .select(
          "id, first_name, last_name, role, level, architect_specialty",
        )
        .in("id", memberIds)
        .eq("role", "architect")
        .returns<
          Array<{
            id: string;
            first_name: string;
            last_name: string;
            role: string;
            level: number;
            architect_specialty: string | null;
          }>
        >()
    : { data: [], error: null };
  assertQuery(membersResult.error, "les profils des architectes");

  const directorIds = [
    ...new Set(
      (assignmentsResult.data ?? []).map(
        (assignment) => assignment.sporting_director_id,
      ),
    ),
  ];
  const directorsResult = directorIds.length
    ? await admin
        .from("sporting_directors")
        .select("id, display_name, username")
        .in("id", directorIds)
        .returns<
          Array<{ id: string; display_name: string; username: string }>
        >()
    : { data: [], error: null };
  assertQuery(directorsResult.error, "les identités des Directeurs Sportifs");

  const memberById = new Map(
    (membersResult.data ?? []).map((member) => [member.id, member]),
  );
  const architects = contracts.flatMap(
    (contract): InfrastructureArchitect[] => {
      const member = memberById.get(contract.staff_member_id);
      if (!member) return [];
      const rawSpecialty = member.architect_specialty ?? "";
      const specialty: ArchitectSpecialty = isArchitectSpecialty(
        rawSpecialty,
      )
        ? rawSpecialty
        : "balanced";
      const bonuses = getArchitectConstructionBonuses(
        member.level,
        specialty,
      );
      return [
        {
          contractId: contract.id,
          firstName: member.first_name,
          lastName: member.last_name,
          level: member.level,
          specialty,
          specialtyLabel: ARCHITECT_SPECIALTY_LABELS[specialty],
          ...bonuses,
        },
      ];
    },
  );

  const countryById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country]),
  );
  const teamNameById = new Map(
    (teamSeasonsResult.data ?? []).map((team) => [
      team.team_id,
      team.display_name,
    ]),
  );
  const directorById = new Map(
    (directorsResult.data ?? []).map((director) => [
      director.id,
      director,
    ]),
  );
  const directorByTeamId = new Map(
    (assignmentsResult.data ?? []).flatMap((assignment) => {
      const director = directorById.get(assignment.sporting_director_id);
      return director ? [[assignment.team_id, director] as const] : [];
    }),
  );
  const centersByCountryId = groupBy(
    centersResult.data ?? [],
    (center) => center.country_id,
  );
  const countries = (countriesResult.data ?? []).flatMap(
    (country): InfrastructureCountry[] => {
      const coordinate =
        COUNTRY_MAP_COORDINATES[country.iso_alpha2.toUpperCase()];
      if (!coordinate) return [];
      const centers = (centersByCountryId.get(country.id) ?? []).map(
        (center): InternationalCenterOwner => {
          const director = directorByTeamId.get(center.team_id);
          return {
            id: center.id,
            qualityLevel: center.quality_level,
            teamId: center.team_id,
            teamName:
              teamNameById.get(center.team_id) ?? "Équipe cycliste",
            directorName: director?.display_name ?? "Directeur Sportif",
            directorIdentifier: director?.username ?? null,
            completedAt: center.completed_at,
            isCurrentTeam: center.team_id === context.teamId,
          };
        },
      );
      const totalQualityStars = centers.reduce(
        (total, center) => total + center.qualityLevel,
        0,
      );
      return [
        {
          id: country.id,
          name: country.name,
          code: country.iso_alpha2,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          totalQualityStars,
          globalBonusPercentage:
            getInternationalCenterBonusPercentage(totalQualityStars),
          currentTeamLevel:
            centers.find((center) => center.isCurrentTeam)?.qualityLevel ?? 0,
          centers,
        },
      ];
    },
  );

  const currentGameDay =
    context.gameYear * 28 + context.currentDayNumber - 1;
  const projects = (projectsResult.data ?? []).map((project) =>
    toProject(project, currentGameDay, countryById),
  );
  const dataRoomLevel =
    (infrastructureResult.data ?? []).find(
      (infrastructure) =>
        infrastructure.infrastructure_code === "recruitment_data_room",
    )?.level ?? 0;
  const directorLevel = calculateSportingDirectorProgression(
    context.experiencePoints,
  ).level;

  return {
    teamId: context.teamId,
    teamName: context.teamName,
    seasonName: context.seasonName,
    gameYear: context.gameYear,
    currentDayNumber: context.currentDayNumber,
    directorLevel,
    isUnlocked: directorLevel >= INFRASTRUCTURE_UNLOCK_LEVEL,
    balance: context.balance,
    currency: context.currency,
    dataRoomLevel,
    dataRoomNextLevel: getTeamInfrastructureLevelDefinition(
      TEAM_INFRASTRUCTURE_DEFINITIONS.recruitment_data_room.code,
      dataRoomLevel + 1,
    ),
    architects,
    activeProject:
      projects.find((project) => project.status === "active") ?? null,
    recentProjects: projects.filter(
      (project) => project.status !== "active",
    ),
    countries,
    notifications: (notificationsResult.data ?? []).map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      createdAt: notification.created_at,
      unread: !notification.read_at,
    })),
  };
}

export function quoteConstruction({
  baseCost,
  baseDurationDays,
  architect,
}: {
  baseCost: number;
  baseDurationDays: number;
  architect?: InfrastructureArchitect | null;
}) {
  return calculateConstructionWithArchitect({
    baseCost,
    baseDurationDays,
    architectLevel: architect?.level,
    architectSpecialty: architect?.specialty,
  });
}

export function getInternationalCenterNextLevel(level: number) {
  return getInternationalCenterLevelDefinition(level + 1);
}

async function loadContext(admin: AdminClient, authUserId: string) {
  const directorResult = await admin
    .from("sporting_directors")
    .select("id, experience_points")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<{ id: string; experience_points: number | string }>();
  assertQuery(directorResult.error, "le Directeur Sportif");
  if (!directorResult.data) return null;

  const [assignmentResult, seasonResult] = await Promise.all([
    admin
      .from("team_manager_assignments")
      .select("team_id")
      .eq("sporting_director_id", directorResult.data.id)
      .eq("role", "general_manager")
      .eq("status", "active")
      .maybeSingle<{ team_id: string }>(),
    admin
      .from("seasons")
      .select("id, name, game_year, current_day_number")
      .eq("status", "active")
      .maybeSingle<{
        id: string;
        name: string;
        game_year: number;
        current_day_number: number | null;
      }>(),
  ]);
  assertQuery(assignmentResult.error, "l’équipe du Directeur Sportif");
  assertQuery(seasonResult.error, "la saison active");
  if (!assignmentResult.data || !seasonResult.data) return null;

  const teamSeasonResult = await admin
    .from("team_seasons")
    .select("display_name, cash_balance, currency")
    .eq("team_id", assignmentResult.data.team_id)
    .eq("season_id", seasonResult.data.id)
    .maybeSingle<{
      display_name: string;
      cash_balance: number | string;
      currency: string;
    }>();
  assertQuery(teamSeasonResult.error, "la saison de l’équipe");
  if (!teamSeasonResult.data) return null;

  return {
    teamId: assignmentResult.data.team_id,
    teamName: teamSeasonResult.data.display_name,
    seasonId: seasonResult.data.id,
    seasonName: seasonResult.data.name,
    gameYear: seasonResult.data.game_year,
    currentDayNumber: seasonResult.data.current_day_number ?? 1,
    experiencePoints: toNumber(directorResult.data.experience_points),
    balance: toNumber(teamSeasonResult.data.cash_balance),
    currency: teamSeasonResult.data.currency,
  };
}

function toProject(
  project: ProjectRow,
  currentGameDay: number,
  countryById: Map<string, CountryRow>,
): InfrastructureProject {
  const completionGameYear = Math.floor(
    project.completes_game_day_index / 28,
  );
  const completionDayNumber =
    (project.completes_game_day_index % 28) + 1;
  const specialty =
    project.architect_specialty &&
    isArchitectSpecialty(project.architect_specialty)
      ? project.architect_specialty
      : null;
  return {
    id: project.id,
    code: project.infrastructure_code,
    name:
      project.infrastructure_code === "recruitment_data_room"
        ? "Data Room du recrutement"
        : "École de cyclisme internationale",
    countryName: project.country_id
      ? countryById.get(project.country_id)?.name ?? "Pays"
      : null,
    targetLevel: project.target_level,
    finalCost: toNumber(project.final_cost),
    finalDurationDays: project.final_duration_days,
    costReductionPercentage: project.cost_reduction_percentage,
    durationReductionPercentage:
      project.duration_reduction_percentage,
    architectSpecialtyLabel: specialty
      ? ARCHITECT_SPECIALTY_LABELS[specialty]
      : null,
    startedDayNumber: project.started_day_number,
    remainingDays:
      project.status === "active"
        ? Math.max(
            0,
            project.completes_game_day_index - currentGameDay,
          )
        : 0,
    completionGameYear,
    completionDayNumber,
    status: project.status,
    completedAt: project.completed_at,
  };
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    grouped.set(key(row), [...(grouped.get(key(row)) ?? []), row]);
  }
  return grouped;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function assertQuery(
  error: { message: string } | null,
  label: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${label} : ${error.message}`);
  }
}
