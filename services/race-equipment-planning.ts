import "server-only";

import type { EquipmentSlot } from "@/lib/game/equipment";
import {
  getRaceEquipmentAvailableQuantity,
  isRaceEquipmentStageEditable,
} from "@/lib/game/race-equipment-planning";
import type { RaceCalendarEdition } from "@/lib/game/race-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCurrentTeamEquipmentOverview,
  type TeamEquipmentCatalogItem,
  type TeamEquipmentOverview,
} from "@/services/team-equipment";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type PlannedAssignmentRow = {
  stage_id: string;
  rider_id: string;
  slot_type: EquipmentSlot;
  equipment_item_id: string | null;
};

export type RaceEquipmentPlannerItem = Pick<
  TeamEquipmentCatalogItem,
  | "id"
  | "name"
  | "slot"
  | "supplierName"
  | "effectSummary"
  | "ownedQuantity"
  | "availableQuantity"
> & {
  isUnlimited: boolean;
};

export type RaceEquipmentPlanningData = {
  teamSeasonId: string;
  canSwapWheelSlots: boolean;
  stages: Array<{
    id: string;
    stageNumber: number;
    name: string;
    profileType: RaceCalendarEdition["stages"][number]["profileType"];
    departureAt: string | null;
    isEditable: boolean;
  }>;
  catalog: RaceEquipmentPlannerItem[];
  permanentAssignments: Array<{
    riderId: string;
    slot: EquipmentSlot;
    equipmentItemId: string;
  }>;
  plannedAssignments: Array<{
    stageId: string;
    riderId: string;
    slot: EquipmentSlot;
    equipmentItemId: string | null;
  }>;
};

export async function getRaceEquipmentPlanningData({
  authUserId,
  edition,
  riderIds,
  authenticatedClient,
  now = new Date(),
}: {
  authUserId: string;
  edition: RaceCalendarEdition;
  riderIds: readonly string[];
  authenticatedClient: SupabaseServerClient;
  now?: Date;
}): Promise<RaceEquipmentPlanningData | null> {
  const planningByEditionId = await getRaceEquipmentPlanningDataBatch({
    authUserId,
    entries: [{ edition, riderIds }],
    authenticatedClient,
    now,
  });

  return planningByEditionId.get(edition.id) ?? null;
}

export async function getRaceEquipmentPlanningDataBatch({
  authUserId,
  entries,
  authenticatedClient,
  now = new Date(),
}: {
  authUserId: string;
  entries: readonly {
    edition: RaceCalendarEdition;
    riderIds: readonly string[];
  }[];
  authenticatedClient: SupabaseServerClient;
  now?: Date;
}): Promise<Map<string, RaceEquipmentPlanningData | null>> {
  if (entries.length === 0) return new Map();

  const equipment = await getCurrentTeamEquipmentOverview(
    authUserId,
    authenticatedClient,
  );
  if (!equipment) {
    return new Map(entries.map(({ edition }) => [edition.id, null]));
  }

  const stageIds = entries.flatMap(({ edition }) =>
    edition.stages.map((stage) => stage.id),
  );
  const editionIds = entries.map(({ edition }) => edition.id);
  const admin = createSupabaseAdminClient();
  const plannedResult =
    stageIds.length > 0
      ? await admin
          .from("race_stage_equipment_assignments")
          .select("stage_id, rider_id, slot_type, equipment_item_id")
          .eq("team_season_id", equipment.teamSeasonId)
          .in("race_edition_id", editionIds)
          .in("stage_id", stageIds)
          .returns<PlannedAssignmentRow[]>()
      : { data: [] as PlannedAssignmentRow[], error: null };

  if (plannedResult.error) {
    throw new Error(
      `Impossible de charger les montages de course : ${plannedResult.error.message}`,
    );
  }

  return new Map(
    entries.map(({ edition, riderIds }) => [
      edition.id,
      buildRaceEquipmentPlanningData({
        edition,
        riderIds,
        equipment,
        plannedRows: plannedResult.data ?? [],
        now,
      }),
    ]),
  );
}

function buildRaceEquipmentPlanningData({
  edition,
  riderIds,
  equipment,
  plannedRows,
  now,
}: {
  edition: RaceCalendarEdition;
  riderIds: readonly string[];
  equipment: TeamEquipmentOverview;
  plannedRows: PlannedAssignmentRow[];
  now: Date;
}): RaceEquipmentPlanningData {
  const normalizedRiderIds = new Set(riderIds);
  const stageIds = new Set(edition.stages.map((stage) => stage.id));
  const plannedAssignments = plannedRows
    .filter((assignment) => stageIds.has(assignment.stage_id))
    .filter((assignment) => normalizedRiderIds.has(assignment.rider_id))
    .map((assignment) => ({
      stageId: assignment.stage_id,
      riderId: assignment.rider_id,
      slot: assignment.slot_type,
      equipmentItemId: assignment.equipment_item_id,
    }));
  const permanentRosterQuantityByItemId = new Map<string, number>();
  for (const assignment of equipment.assignments) {
    if (!normalizedRiderIds.has(assignment.riderId)) continue;
    permanentRosterQuantityByItemId.set(
      assignment.equipmentItemId,
      (permanentRosterQuantityByItemId.get(assignment.equipmentItemId) ?? 0) +
        1,
    );
  }

  const referencedItemIds = new Set([
    ...equipment.assignments
      .filter((assignment) => normalizedRiderIds.has(assignment.riderId))
      .map((assignment) => assignment.equipmentItemId),
    ...plannedAssignments.flatMap((assignment) =>
      assignment.equipmentItemId ? [assignment.equipmentItemId] : [],
    ),
  ]);

  return {
    teamSeasonId: equipment.teamSeasonId,
    canSwapWheelSlots: equipment.canSwapWheelSlots,
    stages: [...edition.stages]
      .sort((left, right) => left.stageNumber - right.stageNumber)
      .map((stage) => ({
        id: stage.id,
        stageNumber: stage.stageNumber,
        name: stage.name,
        profileType: stage.profileType,
        departureAt: stage.departureAt,
        isEditable:
          stage.status !== "completed" &&
          stage.status !== "cancelled" &&
          isRaceEquipmentStageEditable({
            departureAt: stage.departureAt,
            now,
          }),
      })),
    catalog: equipment.catalog
      .filter(
        (item) =>
          item.isUnlimited ||
          item.ownedQuantity > 0 ||
          referencedItemIds.has(item.id),
      )
      .map((item) => ({
        id: item.id,
        name: item.name,
        slot: item.slot,
        supplierName: item.supplierName,
        effectSummary: item.effectSummary,
        ownedQuantity: item.ownedQuantity,
        availableQuantity: getRaceEquipmentAvailableQuantity({
          availableQuantity: item.availableQuantity,
          permanentRosterQuantity:
            permanentRosterQuantityByItemId.get(item.id) ?? 0,
          isUnlimited: item.isUnlimited,
        }),
        isUnlimited: item.isUnlimited,
      })),
    permanentAssignments: equipment.assignments.filter((assignment) =>
      normalizedRiderIds.has(assignment.riderId),
    ),
    plannedAssignments,
  };
}
