import "server-only";

import {
  EQUIPMENT_SLOTS,
  normalizeEquipmentEffects,
  type EquipmentEffects,
  type EquipmentSlot,
} from "@/lib/game/equipment";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type DirectorRow = { id: string };
type AssignmentRow = { team_id: string };
type SeasonRow = {
  id: string;
  name: string;
  game_year: number;
  current_day_number: number | null;
};
type TeamSeasonRow = {
  id: string;
  team_id: string;
  display_name: string;
  cash_balance: number | string;
  currency: string;
};
type CatalogRow = {
  id: string;
  catalog_key: string;
  name: string;
  slot_type: EquipmentSlot;
  supplier_key: string;
  supplier_name: string;
  description: string;
  price: number | string;
  rarity: "common" | "performance" | "premium";
  image_path: string;
  effect_summary: string;
  effect_payload: unknown;
  acquisition_channel: "commercial" | "equipment_partner";
};
type SupplierRow = {
  supplier_key: string;
  name: string;
  positioning: string;
  logo_path: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
};
type InventoryRow = { equipment_item_id: string; quantity: number };
type ContractRow = { rider_id: string };
type EquippedRow = {
  rider_id: string;
  slot_type: EquipmentSlot;
  equipment_item_id: string;
};
type PendingRow = EquippedRow & { effective_at: string };
type PartnerContractRow = {
  id: string;
  start_season_id: string;
  end_season_id: string;
};
type PartnerEffectRow = {
  equipment_item_id: string;
  effect_payload: unknown;
};

export type TeamEquipmentCatalogItem = {
  id: string;
  catalogKey: string;
  name: string;
  slot: EquipmentSlot;
  supplierKey: string;
  supplierName: string;
  supplierLogoPath: string;
  supplierPrimaryColor: string;
  supplierSecondaryColor: string;
  supplierPositioning: string;
  description: string;
  price: number;
  rarity: CatalogRow["rarity"];
  imagePath: string;
  effectSummary: string;
  effects: EquipmentEffects;
  ownedQuantity: number;
  channel: CatalogRow["acquisition_channel"];
  equippedQuantity: number;
  pendingQuantity: number;
  availableQuantity: number;
};

export type TeamEquipmentAssignment = {
  riderId: string;
  slot: EquipmentSlot;
  equipmentItemId: string;
};

export type TeamEquipmentPendingAssignment =
  TeamEquipmentAssignment & {
    effectiveAt: string;
  };

export type TeamEquipmentSupplier = {
  key: string;
  name: string;
  positioning: string;
  logoPath: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  referenceCount: number;
};

export type TeamEquipmentOverview = {
  teamId: string;
  teamSeasonId: string;
  teamName: string;
  seasonName: string;
  currentDayNumber: number;
  balance: number;
  currency: string;
  suppliers: TeamEquipmentSupplier[];
  catalog: TeamEquipmentCatalogItem[];
  assignments: TeamEquipmentAssignment[];
  pendingAssignments: TeamEquipmentPendingAssignment[];
};

export type RiderEquipmentManagement = {
  current: Partial<Record<EquipmentSlot, TeamEquipmentCatalogItem>>;
  pending: Partial<
    Record<EquipmentSlot, { item: TeamEquipmentCatalogItem; effectiveAt: string }>
  >;
  availableBySlot: Record<EquipmentSlot, TeamEquipmentCatalogItem[]>;
};

export async function getCurrentTeamEquipmentOverview(
  authUserId: string
): Promise<TeamEquipmentOverview | null> {
  const context = await loadEquipmentContext(authUserId);

  if (!context) return null;

  return {
    teamId: context.teamSeason.team_id,
    teamSeasonId: context.teamSeason.id,
    teamName: context.teamSeason.display_name,
    seasonName: context.season.name,
    currentDayNumber: context.season.current_day_number ?? 1,
    balance: toNumber(context.teamSeason.cash_balance),
    currency: context.teamSeason.currency,
    suppliers: context.suppliers,
    catalog: context.catalog,
    assignments: context.equipped.map(
      (assignment) => ({
        riderId: assignment.rider_id,
        slot: assignment.slot_type,
        equipmentItemId:
          assignment.equipment_item_id,
      }),
    ),
    pendingAssignments: context.pending.map(
      (assignment) => ({
        riderId: assignment.rider_id,
        slot: assignment.slot_type,
        equipmentItemId:
          assignment.equipment_item_id,
        effectiveAt: assignment.effective_at,
      }),
    ),
  };
}

export async function getRiderEquipmentManagement(
  authUserId: string,
  riderId: string
): Promise<RiderEquipmentManagement | null> {
  const context = await loadEquipmentContext(authUserId);

  if (!context || !context.rosterRiderIds.includes(riderId)) return null;

  const itemById = new Map(context.catalog.map((item) => [item.id, item]));
  const current: RiderEquipmentManagement["current"] = {};
  const pending: RiderEquipmentManagement["pending"] = {};

  for (const assignment of context.equipped) {
    if (assignment.rider_id !== riderId) continue;
    const item = itemById.get(assignment.equipment_item_id);
    if (item) current[assignment.slot_type] = item;
  }

  for (const assignment of context.pending) {
    if (assignment.rider_id !== riderId) continue;
    const item = itemById.get(assignment.equipment_item_id);
    if (item) {
      pending[assignment.slot_type] = {
        item,
        effectiveAt: assignment.effective_at,
      };
    }
  }

  const availableBySlot = Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => [
      slot,
      context.catalog.filter((item) => {
        if (item.slot !== slot || item.ownedQuantity === 0) return false;

        const usedByOthers = context.equipped.filter(
          (assignment) =>
            assignment.equipment_item_id === item.id &&
            assignment.rider_id !== riderId
        ).length;
        const reservedByOthers = context.pending.filter(
          (assignment) =>
            assignment.equipment_item_id === item.id &&
            assignment.rider_id !== riderId
        ).length;

        return item.ownedQuantity > usedByOthers + reservedByOthers;
      }),
    ])
  ) as Record<EquipmentSlot, TeamEquipmentCatalogItem[]>;

  return {
    current,
    pending,
    availableBySlot,
  };
}

async function loadEquipmentContext(authUserId: string) {
  const admin = createSupabaseAdminClient();
  const authenticated = await createSupabaseServerClient();
  const { data: director, error: directorError } = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<DirectorRow>();

  assertQuery(directorError, "le Directeur Sportif");
  if (!director) return null;

  const [{ data: assignment, error: assignmentError }, { data: season, error: seasonError }] =
    await Promise.all([
      admin
        .from("team_manager_assignments")
        .select("team_id")
        .eq("sporting_director_id", director.id)
        .eq("role", "general_manager")
        .eq("status", "active")
        .maybeSingle<AssignmentRow>(),
      admin
        .from("seasons")
        .select("id, name, game_year, current_day_number")
        .eq("status", "active")
        .maybeSingle<SeasonRow>(),
    ]);

  assertQuery(assignmentError, "l’affectation à l’équipe");
  assertQuery(seasonError, "la saison active");
  if (!assignment || !season) return null;

  const { data: teamSeason, error: teamSeasonError } = await admin
    .from("team_seasons")
    .select("id, team_id, display_name, cash_balance, currency")
    .eq("team_id", assignment.team_id)
    .eq("season_id", season.id)
    .maybeSingle<TeamSeasonRow>();

  assertQuery(teamSeasonError, "la saison de l’équipe");
  if (!teamSeason) return null;

  const [{ error: settlementError }, { error: partnerSettlementError }] =
    await Promise.all([admin.rpc(
    "settle_due_equipment_assignments",
    { p_team_season_id: teamSeason.id }
  ), authenticated.rpc("sync_current_team_equipment_partner")]);
  assertQuery(settlementError, "les changements de matériel programmés");

  assertQuery(partnerSettlementError, "le contrat équipementier");
  const [
    catalogResult,
    suppliersResult,
    inventoryResult,
    contractsResult,
    pendingResult,
    partnerContractResult,
  ] = await Promise.all([
      admin
        .from("equipment_catalog_items")
        .select(
          "id, catalog_key, name, slot_type, supplier_key, supplier_name, description, price, rarity, image_path, effect_summary, effect_payload, acquisition_channel"
        )
        .eq("status", "active")
        .order("price", { ascending: true })
        .returns<CatalogRow[]>(),
      admin
        .from("equipment_suppliers")
        .select(
          "supplier_key, name, positioning, logo_path, primary_color, secondary_color, accent_color"
        )
        .eq("status", "active")
        .order("display_order", { ascending: true })
        .returns<SupplierRow[]>(),
      admin
        .from("team_equipment_inventory")
        .select("equipment_item_id, quantity")
        .eq("team_season_id", teamSeason.id)
        .returns<InventoryRow[]>(),
      admin
        .from("rider_contracts")
        .select("rider_id")
        .eq("team_id", teamSeason.team_id)
        .eq("status", "active")
        .returns<ContractRow[]>(),
      admin
        .from("rider_equipment_pending_assignments")
        .select("rider_id, slot_type, equipment_item_id, effective_at")
        .eq("team_season_id", teamSeason.id)
        .returns<PendingRow[]>(),
      admin
        .from("equipment_partner_contracts")
        .select("id, start_season_id, end_season_id")
        .eq("team_id", teamSeason.team_id)
        .eq("status", "active")
        .maybeSingle<PartnerContractRow>(),
  ]);

  assertQuery(catalogResult.error, "le catalogue de matériel");
  assertQuery(suppliersResult.error, "les équipementiers");
  assertQuery(inventoryResult.error, "l’inventaire de l’équipe");
  assertQuery(contractsResult.error, "l’effectif de l’équipe");
  assertQuery(pendingResult.error, "les équipements programmés");

  const rosterRiderIds = (contractsResult.data ?? []).map((row) => row.rider_id);
  assertQuery(partnerContractResult.error, "le partenariat matériel");

  const { data: partnerEffects, error: partnerEffectsError } =
    partnerContractResult.data
      ? await admin
          .from("equipment_partner_item_effects")
          .select("equipment_item_id, effect_payload")
          .eq("contract_id", partnerContractResult.data.id)
          .returns<PartnerEffectRow[]>()
      : { data: [] as PartnerEffectRow[], error: null };
  assertQuery(partnerEffectsError, "les effets R&D du matériel");
  const { data: equipped, error: equippedError } = rosterRiderIds.length
    ? await admin
        .from("rider_equipment_assignments")
        .select("rider_id, slot_type, equipment_item_id")
        .in("rider_id", rosterRiderIds)
        .returns<EquippedRow[]>()
    : { data: [] as EquippedRow[], error: null };

  assertQuery(equippedError, "les équipements attribués");

  const inventoryByItem = new Map(
    (inventoryResult.data ?? []).map((row) => [row.equipment_item_id, row.quantity])
  );
  const pendingRows = pendingResult.data ?? [];
  const equippedRows = equipped ?? [];
  const supplierByKey = new Map(
    (suppliersResult.data ?? []).map((supplier) => [
      supplier.supplier_key,
      supplier,
    ])
  );
  const partnerEffectByItemId = new Map(
    (partnerEffects ?? []).map((effect) => [
      effect.equipment_item_id,
      effect.effect_payload,
    ]),
  );
  const catalog = (catalogResult.data ?? []).map((row) => {
    const ownedQuantity = inventoryByItem.get(row.id) ?? 0;
    const equippedQuantity = equippedRows.filter(
      (assignment) => assignment.equipment_item_id === row.id
    ).length;
    const pendingQuantity = pendingRows.filter(
      (assignment) => assignment.equipment_item_id === row.id
    ).length;
    const supplier = supplierByKey.get(row.supplier_key);

    return {
      id: row.id,
      catalogKey: row.catalog_key,
      name: row.name,
      slot: row.slot_type,
      supplierKey: row.supplier_key,
      supplierName: row.supplier_name,
      supplierLogoPath:
        supplier?.logo_path ??
        "/images/equipment/brands/echelon-cycles-logo.webp",
      supplierPrimaryColor: supplier?.primary_color ?? "#164B3B",
      supplierSecondaryColor: supplier?.secondary_color ?? "#B56E3E",
      supplierPositioning: supplier?.positioning ?? "",
      description: row.description,
      price: toNumber(row.price),
      rarity: row.rarity,
      imagePath: row.image_path,
      effectSummary: row.effect_summary,
      effects: normalizeEquipmentEffects(
        row.acquisition_channel === "equipment_partner"
          ? partnerEffectByItemId.get(row.id)
          : row.effect_payload,
      ),
      channel: row.acquisition_channel,
      ownedQuantity,
      equippedQuantity,
      pendingQuantity,
      availableQuantity: Math.max(
        0,
        ownedQuantity - equippedQuantity - pendingQuantity
      ),
    } satisfies TeamEquipmentCatalogItem;
  });
  const suppliers = (suppliersResult.data ?? []).map((supplier) => ({
    key: supplier.supplier_key,
    name: supplier.name,
    positioning: supplier.positioning,
    logoPath: supplier.logo_path,
    primaryColor: supplier.primary_color,
    secondaryColor: supplier.secondary_color,
    accentColor: supplier.accent_color,
    referenceCount: catalog.filter(
      (item) =>
        item.supplierKey === supplier.supplier_key &&
        item.channel === "commercial",
    ).length,
  })) satisfies TeamEquipmentSupplier[];

  return {
    teamSeason,
    season,
    catalog,
    suppliers,
    rosterRiderIds,
    equipped: equippedRows,
    pending: pendingRows,
  };
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function assertQuery(
  error: { message: string } | null,
  resourceName: string
): asserts error is null {
  if (error) throw new Error(`Impossible de charger ${resourceName} : ${error.message}`);
}
