import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  BASE_TEAM_ROSTER_SIZE,
  getTeamRosterBaseLimit,
  getTeamRosterTotalLimit,
  getTeamRosterYouthReserveSlots,
  type RosterManagementSpecialization,
} from "@/lib/game/team-roster-capacity";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type TeamRosterCapacitySummary = {
  buildingLevel: number;
  specialization: RosterManagementSpecialization;
  baseLimit: number;
  youthReserveSlots: number;
  totalLimit: number;
  commitmentCount: number;
  nonHomegrownCommitmentCount: number;
  availableGeneralSlots: number;
  availableYouthSlots: number;
};

type CapacityRpcPayload = {
  buildingLevel?: unknown;
  specialization?: unknown;
  baseLimit?: unknown;
  youthReserveSlots?: unknown;
  totalLimit?: unknown;
  commitmentCount?: unknown;
  nonHomegrownCommitmentCount?: unknown;
};

export async function loadTeamRosterCapacitySummary({
  admin,
  teamId,
  gameYear,
}: {
  admin: AdminClient;
  teamId: string;
  gameYear: number;
}): Promise<TeamRosterCapacitySummary> {
  const result = await admin.rpc("get_team_roster_capacity_summary", {
    p_team_id: teamId,
    p_game_year: gameYear,
  });

  if (result.error) {
    throw new Error(
      `Impossible de charger la capacité de l’effectif : ${result.error.message}`,
    );
  }

  return normalizeTeamRosterCapacitySummary(result.data);
}

export function normalizeTeamRosterCapacitySummary(
  value: unknown,
): TeamRosterCapacitySummary {
  const payload = isRecord(value) ? (value as CapacityRpcPayload) : {};
  const buildingLevel = integer(payload.buildingLevel, 0);
  const specialization = normalizeSpecialization(payload.specialization);
  const baseLimit = integer(
    payload.baseLimit,
    getTeamRosterBaseLimit(buildingLevel),
  );
  const youthReserveSlots = integer(
    payload.youthReserveSlots,
    getTeamRosterYouthReserveSlots({ buildingLevel, specialization }),
  );
  const totalLimit = integer(
    payload.totalLimit,
    getTeamRosterTotalLimit({ buildingLevel, specialization }),
  );
  const commitmentCount = integer(payload.commitmentCount, 0);
  const nonHomegrownCommitmentCount = integer(
    payload.nonHomegrownCommitmentCount,
    commitmentCount,
  );
  const normalizedBaseLimit = Math.max(BASE_TEAM_ROSTER_SIZE, baseLimit);
  const normalizedYouthReserveSlots = Math.max(0, youthReserveSlots);
  const normalizedTotalLimit = Math.max(
    normalizedBaseLimit,
    totalLimit,
  );
  const normalizedCommitmentCount = Math.max(0, commitmentCount);
  const normalizedNonHomegrownCommitmentCount = Math.max(
    0,
    nonHomegrownCommitmentCount,
  );

  return {
    buildingLevel,
    specialization,
    baseLimit: normalizedBaseLimit,
    youthReserveSlots: normalizedYouthReserveSlots,
    totalLimit: normalizedTotalLimit,
    commitmentCount: normalizedCommitmentCount,
    nonHomegrownCommitmentCount: normalizedNonHomegrownCommitmentCount,
    availableGeneralSlots: Math.max(
      0,
      Math.min(
        normalizedBaseLimit - normalizedNonHomegrownCommitmentCount,
        normalizedTotalLimit - normalizedCommitmentCount,
      ),
    ),
    availableYouthSlots: Math.max(
      0,
      normalizedTotalLimit - normalizedCommitmentCount,
    ),
  };
}

function normalizeSpecialization(
  value: unknown,
): RosterManagementSpecialization {
  return value === "retention_cell" ||
    value === "rotation_management" ||
    value === "youth_pathway"
    ? value
    : null;
}

function integer(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.floor(numeric) : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
