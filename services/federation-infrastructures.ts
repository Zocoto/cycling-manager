import "server-only";

import {
  FEDERATION_INFRASTRUCTURE_CODES,
  type FederationConstructionPriority,
  type FederationInfrastructureCode,
} from "@/lib/game/federation-infrastructures";
import {
  getSchoolCyclingPlanDeliveryGameYear,
  getSchoolCyclingPlanTransferPoints,
  type SchoolCyclingPlanTransferPoints,
} from "@/lib/game/federation-school-cycling-plan";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { YouthArchetype } from "@/lib/game/youth-development";
import type { InfrastructureSpecializationSelection } from "@/lib/game/infrastructure-specializations";

export type FederationProjectArchitect = {
  contractId: string;
  name: string;
  level: number;
  specialty: string;
  teamId: string;
  teamName: string;
  costRefund: number;
  savedDays: number;
};

export type FederationInfrastructureProjectState = {
  id: string;
  code: FederationInfrastructureCode;
  targetLevel: number;
  priority: FederationConstructionPriority;
  baseCost: number;
  finalCost: number;
  baseDurationDays: number;
  finalDurationDays: number;
  startsGameDayIndex: number;
  completesGameDayIndex: number;
  remainingDays: number;
  architectCount: number;
  architects: FederationProjectArchitect[];
  viewerTeamHasContributed: boolean;
};

export type FederationArchitectOption = {
  contractId: string;
  firstName: string;
  lastName: string;
  level: number;
  specialty: string;
};

export type FederationInfrastructureState = {
  levels: Partial<Record<FederationInfrastructureCode, number>>;
  activeProjects: FederationInfrastructureProjectState[];
  availableArchitects: FederationArchitectOption[];
  canLaunch: boolean;
  canContribute: boolean;
  canManageSpecializations: boolean;
  gameYear: number;
  balance: number | null;
  specializations: Partial<
    Record<FederationInfrastructureCode, InfrastructureSpecializationSelection>
  >;
  schoolCyclingPlan: FederationSchoolCyclingPlanState | null;
  sponsorCreationJobs: FederationSponsorCreationJob[];
};

export type FederationSponsorCreationJobStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed";

export type FederationSponsorCreationJob = {
  id: string;
  gameYear: number;
  status: FederationSponsorCreationJobStatus;
  sponsorCatalogKey: string | null;
  sponsorName: string | null;
  failureReason: string | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type FederationSchoolCyclingPlanState = {
  id: string;
  historicalArchetype: YouthArchetype;
  targetArchetype: YouthArchetype;
  status: "deploying" | "active";
  cost: number;
  startsGameDayIndex: number;
  completesGameDayIndex: number;
  deliveryGameYear: number;
  remainingDays: number;
  transferPoints: SchoolCyclingPlanTransferPoints;
};

type InfrastructureRow = {
  infrastructure_code: string;
  level: number;
};
type InfrastructureSpecializationRow = {
  infrastructure_code: string;
  active_specialization_code: string;
  pending_specialization_code: string | null;
  effective_game_day_index: number;
  last_selected_season_id: string;
};
type ProjectRow = {
  id: string;
  infrastructure_code: string;
  target_level: number;
  priority: string;
  base_cost: number | string;
  final_cost: number | string;
  base_duration_days: number;
  final_duration_days: number;
  starts_game_day_index: number;
  completes_game_day_index: number;
};
type ContributionRow = {
  project_id: string;
  team_id: string;
  staff_contract_id: string;
  cost_refund: number | string;
  saved_days: number;
};
type AssignmentRow = { sporting_director_id: string };
type TermRow = { president_director_id: string | null };
type AccountRow = { balance: number | string };
type ContractRow = { id: string; staff_member_id: string };
type StaffMemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  level: number;
  architect_specialty: string | null;
};
type TeamSeasonRow = { team_id: string; display_name: string };
type SchoolCyclingPlanRow = {
  id: string;
  historical_archetype: YouthArchetype;
  target_archetype: YouthArchetype;
  cost: number | string;
  starts_game_day_index: number;
  completes_game_day_index: number;
  status: "deploying" | "active";
};
type SponsorCreationJobRow = {
  id: string;
  requested_game_year: number;
  status: string;
  sponsor_catalog_key: string | null;
  sponsor_name: string | null;
  failure_reason: string | null;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
};

const infrastructureCodeSet = new Set<string>(
  FEDERATION_INFRASTRUCTURE_CODES,
);

export async function getFederationInfrastructureState({
  countryId,
  seasonId,
  gameYear,
  currentDayNumber,
  viewerTeamId,
}: {
  countryId: string;
  seasonId: string;
  gameYear: number;
  currentDayNumber: number;
  viewerTeamId: string | null;
}): Promise<FederationInfrastructureState> {
  const empty: FederationInfrastructureState = {
    levels: {},
    activeProjects: [],
    availableArchitects: [],
    canLaunch: false,
    canContribute: gameYear >= 3 && Boolean(viewerTeamId),
    canManageSpecializations: false,
    gameYear,
    balance: null,
    specializations: {},
    schoolCyclingPlan: null,
    sponsorCreationJobs: [],
  };

  try {
    const admin = createSupabaseAdminClient();
    const schoolPlanSettlement = await admin.rpc(
      "settle_due_national_federation_school_plans",
    );
    if (schoolPlanSettlement.error) {
      throw new Error(
        `le déploiement du Plan vélo scolaire : ${schoolPlanSettlement.error.message}`,
      );
    }
    const specializationSettlement = await admin.rpc(
      "settle_due_infrastructure_specializations",
    );
    if (specializationSettlement.error) {
      throw new Error(
        `les transitions de spécialisation : ${specializationSettlement.error.message}`,
      );
    }
    const [
      infrastructures,
      specializations,
      projects,
      assignment,
      term,
      account,
      contracts,
      schoolCyclingPlan,
      sponsorCreationJobs,
    ] = await Promise.all([
        admin
          .from("national_federation_infrastructures")
          .select("infrastructure_code, level")
          .eq("country_id", countryId)
          .returns<InfrastructureRow[]>(),
        admin
          .from("national_federation_infrastructure_specializations")
          .select(
            "infrastructure_code, active_specialization_code, pending_specialization_code, effective_game_day_index, last_selected_season_id",
          )
          .eq("country_id", countryId)
          .returns<InfrastructureSpecializationRow[]>(),
        admin
          .from("national_federation_infrastructure_projects")
          .select(
            "id, infrastructure_code, target_level, priority, base_cost, final_cost, base_duration_days, final_duration_days, starts_game_day_index, completes_game_day_index",
          )
          .eq("country_id", countryId)
          .eq("status", "active")
          .order("created_at", { ascending: true })
          .returns<ProjectRow[]>(),
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
        admin
          .from("national_federation_accounts")
          .select("balance")
          .eq("country_id", countryId)
          .eq("season_id", seasonId)
          .maybeSingle<AccountRow>(),
        viewerTeamId
          ? admin
              .from("staff_contracts")
              .select("id, staff_member_id")
              .eq("team_id", viewerTeamId)
              .eq("status", "active")
              .returns<ContractRow[]>()
          : Promise.resolve({ data: [], error: null }),
        admin
          .from("national_federation_school_cycling_plans")
          .select(
            "id, historical_archetype, target_archetype, cost, starts_game_day_index, completes_game_day_index, status",
          )
          .eq("country_id", countryId)
          .in("status", ["deploying", "active"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<SchoolCyclingPlanRow>(),
        admin
          .from("national_federation_sponsor_creation_jobs")
          .select(
            "id, requested_game_year, status, sponsor_catalog_key, sponsor_name, failure_reason, requested_at, started_at, completed_at",
          )
          .eq("country_id", countryId)
          .order("requested_at", { ascending: false })
          .limit(6)
          .returns<SponsorCreationJobRow[]>(),
      ]);

    for (const [result, label] of [
      [infrastructures, "les niveaux fédéraux"],
      [specializations, "les spécialisations fédérales"],
      [projects, "les chantiers fédéraux"],
      [assignment, "le mandat du DS"],
      [term, "la présidence fédérale"],
      [account, "la trésorerie fédérale"],
      [contracts, "les architectes du club"],
      [schoolCyclingPlan, "le Plan vélo scolaire"],
      [sponsorCreationJobs, "les prospections de sponsors"],
    ] as const) {
      if (result.error) {
        throw new Error(`${label} : ${result.error.message}`);
      }
    }

    const projectRows = projects.data ?? [];
    const projectIds = projectRows.map((project) => project.id);
    const contributions = projectIds.length
      ? await admin
          .from("national_federation_project_architects")
          .select(
            "project_id, team_id, staff_contract_id, cost_refund, saved_days",
          )
          .in("project_id", projectIds)
          .order("created_at", { ascending: true })
          .returns<ContributionRow[]>()
      : { data: [], error: null };
    if (contributions.error) {
      throw new Error(
        `les contributions d’architectes : ${contributions.error.message}`,
      );
    }

    const contributionRows = contributions.data ?? [];
    const contributionContractIds = [
      ...new Set(
        contributionRows.map((contribution) => contribution.staff_contract_id),
      ),
    ];
    const contributionContracts = contributionContractIds.length
      ? await admin
          .from("staff_contracts")
          .select("id, staff_member_id")
          .in("id", contributionContractIds)
          .returns<ContractRow[]>()
      : { data: [] as ContractRow[], error: null };
    if (contributionContracts.error) {
      throw new Error(
        `les contrats des architectes fédéraux : ${contributionContracts.error.message}`,
      );
    }
    const contributorTeamIds = [
      ...new Set(contributionRows.map((contribution) => contribution.team_id)),
    ];
    const teamSeasons = contributorTeamIds.length
      ? await admin
          .from("team_seasons")
          .select("team_id, display_name")
          .eq("season_id", seasonId)
          .in("team_id", contributorTeamIds)
          .returns<TeamSeasonRow[]>()
      : { data: [], error: null };
    if (teamSeasons.error) {
      throw new Error(`les équipes contributrices : ${teamSeasons.error.message}`);
    }
    const teamNameById = new Map(
      (teamSeasons.data ?? []).map((team) => [team.team_id, team.display_name]),
    );

    const contractRows = contracts.data ?? [];
    const allContractRows = [
      ...new Map(
        [...contractRows, ...(contributionContracts.data ?? [])].map(
          (contract) => [contract.id, contract],
        ),
      ).values(),
    ];
    const contractIds = contractRows.map((contract) => contract.id);
    const memberIds = allContractRows.map((contract) => contract.staff_member_id);
    const [members, activeTeamProjects, ownFederalContributions] =
      await Promise.all([
        memberIds.length
          ? admin
              .from("staff_members")
              .select(
                "id, first_name, last_name, level, architect_specialty",
              )
              .in("id", memberIds)
              .eq("role", "architect")
              .returns<StaffMemberRow[]>()
          : Promise.resolve({ data: [], error: null }),
        contractIds.length
          ? admin
              .from("infrastructure_projects")
              .select("architect_contract_id")
              .in("architect_contract_id", contractIds)
              .eq("status", "active")
              .returns<Array<{ architect_contract_id: string }>>()
          : Promise.resolve({ data: [], error: null }),
        contractIds.length
          ? admin
              .from("national_federation_project_architects")
              .select("staff_contract_id, project_id")
              .in("staff_contract_id", contractIds)
              .returns<Array<{ staff_contract_id: string; project_id: string }>>()
          : Promise.resolve({ data: [], error: null }),
      ]);
    for (const [result, label] of [
      [members, "les profils des architectes"],
      [activeTeamProjects, "les chantiers du club"],
      [ownFederalContributions, "les missions fédérales du club"],
    ] as const) {
      if (result.error) {
        throw new Error(`${label} : ${result.error.message}`);
      }
    }

    const activeProjectIds = new Set(projectIds);
    const busyContractIds = new Set(
      (activeTeamProjects.data ?? []).map(
        (project) => project.architect_contract_id,
      ),
    );
    for (const contribution of ownFederalContributions.data ?? []) {
      if (activeProjectIds.has(contribution.project_id)) {
        busyContractIds.add(contribution.staff_contract_id);
      }
    }
    const memberById = new Map(
      (members.data ?? []).map((member) => [member.id, member]),
    );
    const contractById = new Map(
      allContractRows.map((contract) => [contract.id, contract]),
    );
    const availableArchitects = contractRows.flatMap(
      (contract): FederationArchitectOption[] => {
        const member = memberById.get(contract.staff_member_id);
        if (!member || busyContractIds.has(contract.id)) return [];
        return [
          {
            contractId: contract.id,
            firstName: member.first_name,
            lastName: member.last_name,
            level: member.level,
            specialty: member.architect_specialty ?? "Équilibré",
          },
        ];
      },
    );

    const contributionsByProject = new Map<string, ContributionRow[]>();
    for (const contribution of contributionRows) {
      const current = contributionsByProject.get(contribution.project_id) ?? [];
      current.push(contribution);
      contributionsByProject.set(contribution.project_id, current);
    }
    const currentGameDayIndex = gameYear * 28 + currentDayNumber - 1;
    const viewerDirectorId = assignment.data?.sporting_director_id ?? null;
    const activeProjects = projectRows.flatMap(
      (project): FederationInfrastructureProjectState[] => {
        if (
          !infrastructureCodeSet.has(project.infrastructure_code) ||
          !isPriority(project.priority)
        ) {
          return [];
        }
        const projectContributions =
          contributionsByProject.get(project.id) ?? [];
        return [
          {
            id: project.id,
            code: project.infrastructure_code as FederationInfrastructureCode,
            targetLevel: project.target_level,
            priority: project.priority,
            baseCost: Number(project.base_cost),
            finalCost: Number(project.final_cost),
            baseDurationDays: project.base_duration_days,
            finalDurationDays: project.final_duration_days,
            startsGameDayIndex: project.starts_game_day_index,
            completesGameDayIndex: project.completes_game_day_index,
            remainingDays: Math.max(
              0,
              project.completes_game_day_index - currentGameDayIndex,
            ),
            architectCount: projectContributions.length,
            architects: projectContributions.map((contribution) => {
              const contract = contractById.get(
                contribution.staff_contract_id,
              );
              const member = contract
                ? memberById.get(contract.staff_member_id)
                : null;
              return {
                contractId: contribution.staff_contract_id,
                name: member
                  ? `${member.first_name} ${member.last_name}`.trim()
                  : "Architecte fédéral",
                level: member?.level ?? 1,
                specialty: member?.architect_specialty ?? "Équilibré",
                teamId: contribution.team_id,
                teamName:
                  teamNameById.get(contribution.team_id) ?? "Équipe affiliée",
                costRefund: Number(contribution.cost_refund),
                savedDays: contribution.saved_days,
              };
            }),
            viewerTeamHasContributed: projectContributions.some(
              (contribution) => contribution.team_id === viewerTeamId,
            ),
          },
        ];
      },
    );

    const levels = Object.fromEntries(
        (infrastructures.data ?? []).flatMap((infrastructure) =>
          infrastructureCodeSet.has(infrastructure.infrastructure_code)
            ? [[infrastructure.infrastructure_code, infrastructure.level]]
            : [],
        ),
      ) as Partial<Record<FederationInfrastructureCode, number>>;
    const specializationByCode = new Map(
      (specializations.data ?? []).map((specialization) => [
        specialization.infrastructure_code,
        specialization,
      ]),
    );
    const specializationState = Object.fromEntries(
      FEDERATION_INFRASTRUCTURE_CODES.map((code) => {
        const specialization = specializationByCode.get(code);
        return [
          code,
          {
            activeCode: specialization?.active_specialization_code ?? null,
            pendingCode: specialization?.pending_specialization_code ?? null,
            effectiveGameDayIndex:
              specialization?.effective_game_day_index ?? null,
            canSelectThisSeason:
              specialization?.last_selected_season_id !== seasonId,
            reorientationCost: (levels[code] ?? 0) * 250_000,
          } satisfies InfrastructureSpecializationSelection,
        ];
      }),
    ) as Record<
      FederationInfrastructureCode,
      InfrastructureSpecializationSelection
    >;
    const viewerIsPresident =
      Boolean(viewerDirectorId) &&
      viewerDirectorId === term.data?.president_director_id;

    return {
      levels,
      activeProjects,
      availableArchitects,
      canLaunch:
        gameYear >= 3 &&
        viewerIsPresident,
      canContribute: gameYear >= 3 && Boolean(viewerTeamId),
      canManageSpecializations: gameYear >= 3 && viewerIsPresident,
      gameYear,
      balance: account.data ? Number(account.data.balance) : null,
      specializations: specializationState,
      schoolCyclingPlan: schoolCyclingPlan.data
        ? {
            id: schoolCyclingPlan.data.id,
            historicalArchetype:
              schoolCyclingPlan.data.historical_archetype,
            targetArchetype: schoolCyclingPlan.data.target_archetype,
            status:
              currentGameDayIndex >=
              schoolCyclingPlan.data.completes_game_day_index
                ? "active"
                : "deploying",
            cost: Number(schoolCyclingPlan.data.cost),
            startsGameDayIndex:
              schoolCyclingPlan.data.starts_game_day_index,
            completesGameDayIndex:
              schoolCyclingPlan.data.completes_game_day_index,
            deliveryGameYear: getSchoolCyclingPlanDeliveryGameYear(
              schoolCyclingPlan.data.completes_game_day_index,
            ),
            remainingDays: Math.max(
              0,
              schoolCyclingPlan.data.completes_game_day_index -
                currentGameDayIndex,
            ),
            transferPoints: getSchoolCyclingPlanTransferPoints({
              completesGameDayIndex:
                schoolCyclingPlan.data.completes_game_day_index,
              currentGameDayIndex,
              currentGameYear: gameYear,
            }),
          }
        : null,
      sponsorCreationJobs: (sponsorCreationJobs.data ?? []).flatMap(
        (job): FederationSponsorCreationJob[] => {
          if (!isSponsorCreationJobStatus(job.status)) return [];
          return [
            {
              id: job.id,
              gameYear: job.requested_game_year,
              status: job.status,
              sponsorCatalogKey: job.sponsor_catalog_key,
              sponsorName: job.sponsor_name,
              failureReason: job.failure_reason,
              requestedAt: job.requested_at,
              startedAt: job.started_at,
              completedAt: job.completed_at,
            },
          ];
        },
      ),
    };
  } catch (error) {
    console.error("Impossible de charger les infrastructures fédérales :", error);
    return empty;
  }
}

function isSponsorCreationJobStatus(
  value: string,
): value is FederationSponsorCreationJobStatus {
  return (
    value === "pending" ||
    value === "in_progress" ||
    value === "completed" ||
    value === "failed"
  );
}

function isPriority(value: string): value is FederationConstructionPriority {
  return value === "balanced" || value === "cost" || value === "time";
}
