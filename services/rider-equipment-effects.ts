import "server-only";

import {
  combineEquipmentEffects,
  normalizeEquipmentEffects,
  type EquipmentEffects,
} from "@/lib/game/equipment";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AssignmentRow = {
  rider_id: string;
  equipment_item_id: string;
};

type CatalogRow = {
  id: string;
  effect_payload: unknown;
  acquisition_channel: "commercial" | "equipment_partner";
};

type RiderContractRow = {
  rider_id: string;
  team_id: string;
};

type PartnerContractRow = {
  id: string;
  team_id: string;
  signed_at: string;
};

type PartnerEffectRow = {
  contract_id: string;
  equipment_item_id: string;
  effect_payload: unknown;
};

export async function getRiderEquipmentEffectsByRiderId(
  riderIds: readonly string[],
): Promise<Map<string, EquipmentEffects>> {
  const normalizedRiderIds = [
    ...new Set(
      riderIds
        .map((riderId) => riderId.trim().toLowerCase())
        .filter(isUuid),
    ),
  ];

  if (!normalizedRiderIds.length) return new Map();

  const admin = createSupabaseAdminClient();
  const [assignmentsResult, contractsResult] = await Promise.all([
    admin
      .from("rider_equipment_assignments")
      .select("rider_id, equipment_item_id")
      .in("rider_id", normalizedRiderIds)
      .returns<AssignmentRow[]>(),
    admin
      .from("rider_contracts")
      .select("rider_id, team_id")
      .in("rider_id", normalizedRiderIds)
      .eq("status", "active")
      .returns<RiderContractRow[]>(),
  ]);

  assertQuery(assignmentsResult.error, "les équipements des coureurs");
  assertQuery(contractsResult.error, "les équipes des coureurs équipés");

  const assignments = assignmentsResult.data ?? [];
  if (!assignments.length) {
    return new Map(
      normalizedRiderIds.map((riderId) => [
        riderId,
        combineEquipmentEffects([]),
      ]),
    );
  }

  const itemIds = [
    ...new Set(assignments.map((assignment) => assignment.equipment_item_id)),
  ];
  const teamByRiderId = new Map(
    (contractsResult.data ?? []).map((contract) => [
      contract.rider_id,
      contract.team_id,
    ]),
  );
  const teamIds = [...new Set(teamByRiderId.values())];
  const [catalogResult, partnerContractsResult] = await Promise.all([
    admin
      .from("equipment_catalog_items")
      .select("id, effect_payload, acquisition_channel")
      .in("id", itemIds)
      .eq("status", "active")
      .returns<CatalogRow[]>(),
    teamIds.length
      ? admin
          .from("equipment_partner_contracts")
          .select("id, team_id, signed_at")
          .in("team_id", teamIds)
          .eq("status", "active")
          .order("signed_at", { ascending: false })
          .returns<PartnerContractRow[]>()
      : Promise.resolve({
          data: [] as PartnerContractRow[],
          error: null,
        }),
  ]);

  assertQuery(catalogResult.error, "les effets du matériel");
  assertQuery(partnerContractsResult.error, "les contrats équipementiers");

  const partnerContractByTeamId = new Map<string, PartnerContractRow>();
  for (const contract of partnerContractsResult.data ?? []) {
    if (!partnerContractByTeamId.has(contract.team_id)) {
      partnerContractByTeamId.set(contract.team_id, contract);
    }
  }

  const partnerContractIds = [
    ...new Set(
      [...partnerContractByTeamId.values()].map((contract) => contract.id),
    ),
  ];
  const partnerEffectsResult = partnerContractIds.length
    ? await admin
        .from("equipment_partner_item_effects")
        .select("contract_id, equipment_item_id, effect_payload")
        .in("contract_id", partnerContractIds)
        .in("equipment_item_id", itemIds)
        .returns<PartnerEffectRow[]>()
    : {
        data: [] as PartnerEffectRow[],
        error: null,
      };

  assertQuery(partnerEffectsResult.error, "les effets R&D du matériel");

  const itemById = new Map(
    (catalogResult.data ?? []).map((item) => [item.id, item]),
  );
  const partnerEffectByContractAndItem = new Map(
    (partnerEffectsResult.data ?? []).map((effect) => [
      `${effect.contract_id}:${effect.equipment_item_id}`,
      effect.effect_payload,
    ]),
  );
  const effectsByRiderId = new Map<string, EquipmentEffects[]>();

  for (const assignment of assignments) {
    const item = itemById.get(assignment.equipment_item_id);
    if (!item) continue;

    let payload = item.effect_payload;
    if (item.acquisition_channel === "equipment_partner") {
      const teamId = teamByRiderId.get(assignment.rider_id);
      const partnerContract = teamId
        ? partnerContractByTeamId.get(teamId)
        : null;
      payload = partnerContract
        ? partnerEffectByContractAndItem.get(
            `${partnerContract.id}:${item.id}`,
          )
        : null;
    }

    const riderEffects = effectsByRiderId.get(assignment.rider_id) ?? [];
    riderEffects.push(normalizeEquipmentEffects(payload));
    effectsByRiderId.set(assignment.rider_id, riderEffects);
  }

  return new Map(
    normalizedRiderIds.map((riderId) => [
      riderId,
      combineEquipmentEffects(effectsByRiderId.get(riderId) ?? []),
    ]),
  );
}

function assertQuery(
  error: { message: string } | null,
  resourceName: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${resourceName} : ${error.message}`);
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}