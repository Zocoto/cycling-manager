import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type TeamSeasonRow = {
  team_id: string;
  registration_country_id: string;
};

type WelcomeCenterRow = { team_id: string; level: number };
type CountryContinentRow = { id: string; continent_code: string | null };
type CountryAdjacencyRow = { country_id: string; adjacent_country_id: string };

type ContractRow = {
  id: string;
  team_id: string;
  staff_member_id: string;
};

type MemberRow = {
  id: string;
  country_id: string;
  role: string;
  level: number;
};

type TalentRow = {
  staff_member_id: string;
  talent_code: string;
};

type AssignmentRow = {
  staff_contract_id: string;
  rider_id: string;
};

export type TeamRaceStaffEffects = {
  incidentTimeReductionPercentage: number;
  wheelEfficiencyPercentage: number;
  frameEfficiencyPercentage: number;
};

export type RaceStaffEffects = {
  byTeamId: Map<string, TeamRaceStaffEffects>;
  injuryPreventionByRiderId: Map<string, number>;
};

const EMPTY_TEAM_EFFECTS: TeamRaceStaffEffects = {
  incidentTimeReductionPercentage: 0,
  wheelEfficiencyPercentage: 0,
  frameEfficiencyPercentage: 0,
};

export async function loadRaceStaffEffects(
  admin: AdminClient,
  {
    seasonId,
    teamIds,
    riderIds,
  }: {
    seasonId: string;
    teamIds: string[];
    riderIds: string[];
  },
): Promise<RaceStaffEffects> {
  if (teamIds.length === 0) {
    return {
      byTeamId: new Map(),
      injuryPreventionByRiderId: new Map(),
    };
  }

  const [teamSeasonsResult, contractsResult] = await Promise.all([
    admin
      .from("team_seasons")
      .select("team_id, registration_country_id")
      .eq("season_id", seasonId)
      .in("team_id", teamIds)
      .returns<TeamSeasonRow[]>(),
    admin
      .from("staff_contracts")
      .select("id, team_id, staff_member_id")
      .eq("status", "active")
      .in("team_id", teamIds)
      .returns<ContractRow[]>(),
  ]);

  assertQuery(teamSeasonsResult.error, "les nationalités des équipes");
  assertQuery(contractsResult.error, "les contrats du staff de course");

  const contracts = contractsResult.data ?? [];
  const memberIds = unique(
    contracts.map((contract) => contract.staff_member_id),
  );
  if (memberIds.length === 0) {
    return {
      byTeamId: new Map(),
      injuryPreventionByRiderId: new Map(),
    };
  }

  const [membersResult, talentsResult] = await Promise.all([
    admin
      .from("staff_members")
      .select("id, country_id, role, level")
      .in("id", memberIds)
      .in("role", ["mechanic", "physiotherapist"])
      .returns<MemberRow[]>(),
    admin
      .from("staff_member_talents")
      .select("staff_member_id, talent_code")
      .in("staff_member_id", memberIds)
      .returns<TalentRow[]>(),
  ]);

  assertQuery(membersResult.error, "les membres du staff de course");
  assertQuery(talentsResult.error, "les talents du staff de course");

  const membersById = new Map(
    (membersResult.data ?? []).map((member) => [member.id, member]),
  );
  const talentCodesByMemberId = groupToSet(
    talentsResult.data ?? [],
    (talent) => talent.staff_member_id,
    (talent) => talent.talent_code,
  );
  const teamCountryById = new Map(
    (teamSeasonsResult.data ?? []).map((team) => [
      team.team_id,
      team.registration_country_id,
    ]),
  );
  const relevantContracts = contracts.filter((contract) =>
    membersById.has(contract.staff_member_id),
  );
  const relevantCountryIds = unique([
    ...(membersResult.data ?? []).map((member) => member.country_id),
    ...(teamSeasonsResult.data ?? []).map(
      (team) => team.registration_country_id,
    ),
  ]);
  const [welcomeCentersResult, countriesResult, adjacenciesResult] =
    await Promise.all([
      admin
        .from("team_infrastructures")
        .select("team_id, level")
        .eq("infrastructure_code", "international_welcome_center")
        .in("team_id", teamIds)
        .returns<WelcomeCenterRow[]>(),
      relevantCountryIds.length
        ? admin
            .from("countries")
            .select("id, continent_code")
            .in("id", relevantCountryIds)
            .returns<CountryContinentRow[]>()
        : Promise.resolve({ data: [] as CountryContinentRow[], error: null }),
      relevantCountryIds.length
        ? admin
            .from("country_adjacencies")
            .select("country_id, adjacent_country_id")
            .in("country_id", relevantCountryIds)
            .returns<CountryAdjacencyRow[]>()
        : Promise.resolve({ data: [] as CountryAdjacencyRow[], error: null }),
    ]);
  assertQuery(
    welcomeCentersResult.error,
    "les Centres d’accueil internationaux",
  );
  assertQuery(countriesResult.error, "les continents du staff");
  assertQuery(adjacenciesResult.error, "les pays adjacents du staff");
  const welcomeLevelByTeamId = new Map(
    (welcomeCentersResult.data ?? []).map((row) => [
      row.team_id,
      Number(row.level),
    ]),
  );
  const continentByCountryId = new Map(
    (countriesResult.data ?? []).map((row) => [row.id, row.continent_code]),
  );
  const adjacentPairs = new Set(
    (adjacenciesResult.data ?? []).map(
      (row) => `${row.country_id}:${row.adjacent_country_id}`,
    ),
  );
  const affinityByContractId = new Map(
    relevantContracts.map((contract) => {
      const member = membersById.get(contract.staff_member_id)!;
      const teamCountryId = teamCountryById.get(contract.team_id);
      const welcomeLevel = welcomeLevelByTeamId.get(contract.team_id) ?? 0;
      const sameCountry = member.country_id === teamCountryId;
      const adjacentCountry =
        welcomeLevel >= 3 &&
        Boolean(teamCountryId) &&
        adjacentPairs.has(`${member.country_id}:${teamCountryId}`);
      const memberContinent = continentByCountryId.get(member.country_id);
      const sameContinent =
        welcomeLevel >= 4 &&
        Boolean(teamCountryId) &&
        Boolean(memberContinent) &&
        memberContinent === continentByCountryId.get(teamCountryId!);
      return [
        contract.id,
        sameCountry || adjacentCountry || sameContinent ? 1.1 : 1,
      ] as const;
    }),
  );
  const byTeamId = new Map<string, TeamRaceStaffEffects>();

  for (const contract of contracts) {
    const member = membersById.get(contract.staff_member_id);
    if (!member || member.role !== "mechanic") continue;
    const affinity =
      affinityByContractId.get(contract.id) ??
      (member.country_id === teamCountryById.get(contract.team_id) ? 1.1 : 1);
    const talentCodes =
      talentCodesByMemberId.get(contract.staff_member_id) ?? new Set();
    const current = byTeamId.get(contract.team_id) ?? {
      ...EMPTY_TEAM_EFFECTS,
    };

    current.incidentTimeReductionPercentage += member.level * 8 * affinity;
    if (talentCodes.has("mechanic_incident_time")) {
      current.incidentTimeReductionPercentage += member.level * 3 * affinity;
    }
    if (talentCodes.has("mechanic_wheel_efficiency")) {
      current.wheelEfficiencyPercentage += member.level * 4 * affinity;
    }
    if (talentCodes.has("mechanic_frame_efficiency")) {
      current.frameEfficiencyPercentage += member.level * 4 * affinity;
    }
    byTeamId.set(contract.team_id, current);
  }

  for (const [teamId, effects] of byTeamId) {
    byTeamId.set(teamId, {
      incidentTimeReductionPercentage: clamp(
        effects.incidentTimeReductionPercentage,
        0,
        80,
      ),
      wheelEfficiencyPercentage: clamp(
        effects.wheelEfficiencyPercentage,
        0,
        50,
      ),
      frameEfficiencyPercentage: clamp(
        effects.frameEfficiencyPercentage,
        0,
        50,
      ),
    });
  }

  const physiotherapistContracts = contracts.filter(
    (contract) =>
      membersById.get(contract.staff_member_id)?.role === "physiotherapist",
  );
  const assignmentsResult =
    physiotherapistContracts.length > 0 && riderIds.length > 0
      ? await admin
          .from("staff_rider_assignments")
          .select("staff_contract_id, rider_id")
          .eq("status", "active")
          .in(
            "staff_contract_id",
            physiotherapistContracts.map((contract) => contract.id),
          )
          .in("rider_id", riderIds)
          .returns<AssignmentRow[]>()
      : { data: [] as AssignmentRow[], error: null };

  assertQuery(assignmentsResult.error, "les affectations des kinés");
  const contractsById = new Map(
    physiotherapistContracts.map((contract) => [contract.id, contract]),
  );
  const injuryPreventionByRiderId = new Map<string, number>();

  for (const assignment of assignmentsResult.data ?? []) {
    const contract = contractsById.get(assignment.staff_contract_id);
    const member = contract
      ? membersById.get(contract.staff_member_id)
      : undefined;
    if (!contract || !member) continue;
    const talentCodes =
      talentCodesByMemberId.get(member.id) ?? new Set<string>();
    if (!talentCodes.has("physio_injury_prevention")) continue;
    const affinity =
      affinityByContractId.get(contract.id) ??
      (member.country_id === teamCountryById.get(contract.team_id) ? 1.1 : 1);
    const prevention = clamp(member.level * 3 * affinity, 0, 30);
    injuryPreventionByRiderId.set(
      assignment.rider_id,
      Math.max(
        injuryPreventionByRiderId.get(assignment.rider_id) ?? 0,
        prevention,
      ),
    );
  }

  return { byTeamId, injuryPreventionByRiderId };
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function groupToSet<T>(
  values: readonly T[],
  groupKey: (value: T) => string,
  itemValue: (value: T) => string,
) {
  const grouped = new Map<string, Set<string>>();
  for (const value of values) {
    const key = groupKey(value);
    const entries = grouped.get(key) ?? new Set<string>();
    entries.add(itemValue(value));
    grouped.set(key, entries);
  }
  return grouped;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function assertQuery(
  error: { message: string } | null | undefined,
  resource: string,
) {
  if (error) {
    throw new Error(`Impossible de charger ${resource} : ${error.message}`);
  }
}
