import "server-only";

import {
  EQUIPMENT_SLOTS,
  normalizeEquipmentEffects,
  type EquipmentEffects,
  type EquipmentSlot,
} from "@/lib/game/equipment";
import type { RiderRatings } from "@/lib/game/rider-profile";
import { calculateEquipmentResalePrice } from "@/lib/game/equipment-resale";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

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
  acquisition_channel:
    "commercial" | "equipment_partner" | "research_prototype";
  owner_team_id: string | null;
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
type RiderRow = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_profile_key: string | null;
  avatar_seed: number | string | null;
};
type RatingRow = {
  rider_id: string;
  mountain: number;
  hills: number;
  flat: number;
  time_trial: number;
  cobbles: number;
  sprint: number;
  acceleration: number;
  downhill: number;
  endurance: number;
  resistance: number;
  recovery: number;
  breakaway: number;
  prologue: number;
};
type EquippedRow = {
  rider_id: string;
  slot_type: EquipmentSlot;
  equipment_item_id: string;
};
type PendingRow = EquippedRow & { effective_at: string };
type PartnerContractRow = {
  id: string;
  supplier_key: string;
  start_season_id: string;
  end_season_id: string;
};
type PartnerEffectRow = {
  equipment_item_id: string;
  effect_payload: unknown;
};
type PartnerProductRow = {
  equipment_item_id: string;
  offer_type: "core" | "rare";
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
  resalePrice: number;
  rarity: CatalogRow["rarity"];
  imagePath: string;
  effectSummary: string;
  effects: EquipmentEffects;
  ownedQuantity: number;
  channel: CatalogRow["acquisition_channel"];
  equippedQuantity: number;
  pendingQuantity: number;
  availableQuantity: number;
  isUnlimited: boolean;
};

export type TeamEquipmentAssignment = {
  riderId: string;
  slot: EquipmentSlot;
  equipmentItemId: string;
};

export type TeamEquipmentPendingAssignment = TeamEquipmentAssignment & {
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

export type TeamEquipmentRider = {
  id: string;
  firstName: string;
  lastName: string;
  avatarProfileKey: string | null;
  avatarSeed: number | string | null;
  ratings: RiderRatings | null;
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
  riders: TeamEquipmentRider[];
  assignments: TeamEquipmentAssignment[];
  pendingAssignments: TeamEquipmentPendingAssignment[];
};

export type RiderEquipmentManagement = {
  current: Partial<Record<EquipmentSlot, TeamEquipmentCatalogItem>>;
  pending: Partial<
    Record<
      EquipmentSlot,
      { item: TeamEquipmentCatalogItem; effectiveAt: string }
    >
  >;
  availableBySlot: Record<EquipmentSlot, TeamEquipmentCatalogItem[]>;
};

export async function getCurrentTeamEquipmentOverview(
  authUserId: string,
  authenticatedClient?: SupabaseServerClient,
): Promise<TeamEquipmentOverview | null> {
  const context = await loadEquipmentContext(authUserId, authenticatedClient);

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
    riders: context.riders,
    assignments: context.equipped.map((assignment) => ({
      riderId: assignment.rider_id,
      slot: assignment.slot_type,
      equipmentItemId: assignment.equipment_item_id,
    })),
    pendingAssignments: context.pending.map((assignment) => ({
      riderId: assignment.rider_id,
      slot: assignment.slot_type,
      equipmentItemId: assignment.equipment_item_id,
      effectiveAt: assignment.effective_at,
    })),
  };
}

export async function getRiderEquipmentManagement(
  authUserId: string,
  riderId: string,
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
        if (
          item.slot !== slot ||
          (!item.isUnlimited && item.ownedQuantity === 0)
        ) {
          return false;
        }

        const usedByOthers = context.equipped.filter(
          (assignment) =>
            assignment.equipment_item_id === item.id &&
            assignment.rider_id !== riderId,
        ).length;
        const reservedByOthers = context.pending.filter(
          (assignment) =>
            assignment.equipment_item_id === item.id &&
            assignment.rider_id !== riderId,
        ).length;

        return (
          item.isUnlimited ||
          item.ownedQuantity > usedByOthers + reservedByOthers
        );
      }),
    ]),
  ) as Record<EquipmentSlot, TeamEquipmentCatalogItem[]>;

  return {
    current,
    pending,
    availableBySlot,
  };
}

async function loadEquipmentContext(
  authUserId: string,
  authenticatedClient?: SupabaseServerClient,
) {
  const admin = createSupabaseAdminClient();
  const authenticated =
    authenticatedClient ?? (await createSupabaseServerClient());
  const { data: director, error: directorError } = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<DirectorRow>();

  assertQuery(directorError, "le Directeur Sportif");
  if (!director) return null;

  const [
    { data: assignment, error: assignmentError },
    { data: season, error: seasonError },
  ] = await Promise.all([
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
    await Promise.all([
      admin.rpc("settle_due_equipment_assignments", {
        p_team_season_id: teamSeason.id,
      }),
      authenticated.rpc("sync_current_team_equipment_partner"),
    ]);
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
        "id, catalog_key, name, slot_type, supplier_key, supplier_name, description, price, rarity, image_path, effect_summary, effect_payload, acquisition_channel, owner_team_id",
      )
      .eq("status", "active")
      .or(`owner_team_id.is.null,owner_team_id.eq.${teamSeason.team_id}`)
      .order("price", { ascending: true })
      .returns<CatalogRow[]>(),
    admin
      .from("equipment_suppliers")
      .select(
        "supplier_key, name, positioning, logo_path, primary_color, secondary_color, accent_color",
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
      .select("id, supplier_key, start_season_id, end_season_id")
      .eq("team_id", teamSeason.team_id)
      .eq("status", "active")
      .maybeSingle<PartnerContractRow>(),
  ]);

  assertQuery(catalogResult.error, "le catalogue de matériel");
  assertQuery(suppliersResult.error, "les équipementiers");
  assertQuery(inventoryResult.error, "l’inventaire de l’équipe");
  assertQuery(contractsResult.error, "l’effectif de l’équipe");
  assertQuery(pendingResult.error, "les équipements programmés");

  const rosterRiderIds = (contractsResult.data ?? []).map(
    (row) => row.rider_id,
  );
  assertQuery(partnerContractResult.error, "le partenariat matériel");

  const [partnerEffectsResult, partnerProductsResult] = partnerContractResult.data
    ? await Promise.all([
        admin
          .from("equipment_partner_item_effects")
          .select("equipment_item_id, effect_payload")
          .eq("contract_id", partnerContractResult.data.id)
          .returns<PartnerEffectRow[]>(),
        admin
          .from("equipment_partner_products")
          .select("equipment_item_id, offer_type")
          .eq("supplier_key", partnerContractResult.data.supplier_key)
          .returns<PartnerProductRow[]>(),
      ])
    : [
        { data: [] as PartnerEffectRow[], error: null },
        { data: [] as PartnerProductRow[], error: null },
      ];
  assertQuery(partnerEffectsResult.error, "les effets de la dotation partenaire");
  assertQuery(partnerProductsResult.error, "la gamme du partenaire");
  const [equippedResult, ridersResult, ratingsResult] = rosterRiderIds.length
    ? await Promise.all([
        admin
          .from("rider_equipment_assignments")
          .select("rider_id, slot_type, equipment_item_id")
          .in("rider_id", rosterRiderIds)
          .returns<EquippedRow[]>(),
        admin
          .from("riders")
          .select("id, first_name, last_name, avatar_profile_key, avatar_seed")
          .in("id", rosterRiderIds)
          .order("last_name", { ascending: true })
          .order("first_name", { ascending: true })
          .returns<RiderRow[]>(),
        admin
          .from("rider_season_ratings")
          .select(
            "rider_id, mountain, hills, flat, time_trial, cobbles, sprint, acceleration, downhill, endurance, resistance, recovery, breakaway, prologue",
          )
          .eq("season_id", season.id)
          .in("rider_id", rosterRiderIds)
          .returns<RatingRow[]>(),
      ])
    : [
        { data: [] as EquippedRow[], error: null },
        { data: [] as RiderRow[], error: null },
        { data: [] as RatingRow[], error: null },
      ];

  assertQuery(equippedResult.error, "les équipements attribués");
  assertQuery(ridersResult.error, "les coureurs de l’effectif");
  assertQuery(ratingsResult.error, "les notes des coureurs de l’effectif");

  const inventoryByItem = new Map(
    (inventoryResult.data ?? []).map((row) => [
      row.equipment_item_id,
      row.quantity,
    ]),
  );
  const ratingsByRiderId = new Map(
    (ratingsResult.data ?? []).map((rating) => [rating.rider_id, rating]),
  );
  const pendingRows = pendingResult.data ?? [];
  const equippedRows = equippedResult.data ?? [];
  const riders = (ridersResult.data ?? []).map((rider) => {
    const rating = ratingsByRiderId.get(rider.id);
    return {
      id: rider.id,
      firstName: rider.first_name,
      lastName: rider.last_name,
      avatarProfileKey: rider.avatar_profile_key,
      avatarSeed: rider.avatar_seed,
      ratings: rating ? toRiderRatings(rating) : null,
    };
  }) satisfies TeamEquipmentRider[];
  const supplierByKey = new Map(
    (suppliersResult.data ?? []).map((supplier) => [
      supplier.supplier_key,
      supplier,
    ]),
  );
  const partnerEffectByItemId = new Map(
    (partnerEffectsResult.data ?? []).map((effect) => [
      effect.equipment_item_id,
      effect.effect_payload,
    ]),
  );
  const partnerAvailableItemIds = new Set(
    (partnerProductsResult.data ?? [])
      .filter((product) => product.offer_type === "core")
      .map((product) => product.equipment_item_id),
  );
  const catalog = (catalogResult.data ?? []).map((row) => {
    const isUnlimited =
      row.acquisition_channel === "equipment_partner" &&
      partnerAvailableItemIds.has(row.id);
    const ownedQuantity =
      row.acquisition_channel !== "equipment_partner"
        ? (inventoryByItem.get(row.id) ?? 0)
        : 0;
    const equippedQuantity = equippedRows.filter(
      (assignment) => assignment.equipment_item_id === row.id,
    ).length;
    const pendingQuantity = pendingRows.filter(
      (assignment) => assignment.equipment_item_id === row.id,
    ).length;
    const supplier = supplierByKey.get(row.supplier_key);
    const effects = normalizeEquipmentEffects(
      row.acquisition_channel === "equipment_partner"
        ? (partnerEffectByItemId.get(row.id) ?? row.effect_payload)
        : row.effect_payload,
    );

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
      resalePrice:
        row.acquisition_channel === "commercial"
          ? calculateEquipmentResalePrice({
              purchasePrice: toNumber(row.price),
              rarity: row.rarity,
              effects,
            })
          : 0,
      rarity: row.rarity,
      imagePath: row.image_path,
      effectSummary: row.effect_summary,
      effects,
      channel: row.acquisition_channel,
      ownedQuantity,
      equippedQuantity,
      pendingQuantity,
      availableQuantity: isUnlimited
        ? Math.max(1, rosterRiderIds.length)
        : Math.max(0, ownedQuantity - equippedQuantity - pendingQuantity),
      isUnlimited,
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
    riders,
    rosterRiderIds,
    equipped: equippedRows,
    pending: pendingRows,
  };
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toRiderRatings(row: RatingRow): RiderRatings {
  return {
    mountain: row.mountain,
    hills: row.hills,
    recovery: row.recovery,
    endurance: row.endurance,
    resistance: row.resistance,
    breakaway: row.breakaway,
    downhill: row.downhill,
    acceleration: row.acceleration,
    sprint: row.sprint,
    flat: row.flat,
    cobbles: row.cobbles,
    prologue: row.prologue,
    timeTrial: row.time_trial,
  };
}

function assertQuery(
  error: { message: string } | null,
  resourceName: string,
): asserts error is null {
  if (error)
    throw new Error(`Impossible de charger ${resourceName} : ${error.message}`);
}
