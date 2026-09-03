import "server-only";

import {
  FEDERATION_INFRASTRUCTURE_CODES,
  type FederationConstructionPriority,
  type FederationInfrastructureCode,
} from "@/lib/game/federation-infrastructures";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FederationProjectArchitect = {
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
  balance: number | null;
};

type InfrastructureRow = {
  infrastructure_code: string;
  level: number;
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
    balance: null,
  };

  try {
    const admin = createSupabaseAdminClient();
    const [infrastructures, projects, assignment, term, account, contracts] =
      await Promise.all([
        admin
          .from("national_federation_infrastructures")
          .select("infrastructure_code, level")
          .eq("country_id", countryId)
          .returns<InfrastructureRow[]>(),
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
      ]);

    for (const [result, label] of [
      [infrastructures, "les niveaux fédéraux"],
      [projects, "les chantiers fédéraux"],
      [assignment, "le mandat du DS"],
      [term, "la présidence fédérale"],
      [account, "la trésorerie fédérale"],
      [contracts, "les architectes du club"],
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
    const contractIds = contractRows.map((contract) => contract.id);
    const memberIds = contractRows.map((contract) => contract.staff_member_id);
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
            architects: projectContributions.map((contribution) => ({
              teamId: contribution.team_id,
              teamName:
                teamNameById.get(contribution.team_id) ?? "Équipe affiliée",
              costRefund: Number(contribution.cost_refund),
              savedDays: contribution.saved_days,
            })),
            viewerTeamHasContributed: projectContributions.some(
              (contribution) => contribution.team_id === viewerTeamId,
            ),
          },
        ];
      },
    );

    return {
      levels: Object.fromEntries(
        (infrastructures.data ?? []).flatMap((infrastructure) =>
          infrastructureCodeSet.has(infrastructure.infrastructure_code)
            ? [[infrastructure.infrastructure_code, infrastructure.level]]
            : [],
        ),
      ),
      activeProjects,
      availableArchitects,
      canLaunch:
        gameYear >= 3 &&
        Boolean(viewerDirectorId) &&
        viewerDirectorId === term.data?.president_director_id,
      canContribute: gameYear >= 3 && Boolean(viewerTeamId),
      balance: account.data ? Number(account.data.balance) : null,
    };
  } catch (error) {
    console.error("Impossible de charger les infrastructures fédérales :", error);
    return empty;
  }
}

function isPriority(value: string): value is FederationConstructionPriority {
  return value === "balanced" || value === "cost" || value === "time";
}
