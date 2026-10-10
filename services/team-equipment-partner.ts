import "server-only";

import {
  canSignEquipmentPartnerContract,
  EQUIPMENT_PARTNER_REPUTATION_THRESHOLD,
} from "@/lib/game/equipment-partner";
import type { EquipmentEffects, EquipmentSlot } from "@/lib/game/equipment";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getCurrentTeamEquipmentOverview,
  type TeamEquipmentCatalogItem,
} from "@/services/team-equipment";

type DirectorRow = {
  reputation_points: number;
};

type ContractRow = {
  id: string;
  supplier_key: string;
  start_season_id: string;
  end_season_id: string;
  status: "active" | "completed";
  signed_at: string;
  completed_at: string | null;
  reputation_extra_cost: number;
  reputation_extra_item_id: string | null;
  reputation_extra_purchased_at: string | null;
};

type SeasonRow = {
  id: string;
  game_year: number;
  name: string;
};

type ContractSupplierRow = {
  supplier_key: string;
};

type ProductRow = {
  supplier_key: string;
  equipment_item_id: string;
  display_order: number;
  offer_type: "core" | "rare";
};

export type EquipmentPartnerProduct = {
  id: string;
  name: string;
  slot: EquipmentSlot;
  imagePath: string;
  baseEffectSummary: string;
  effects: EquipmentEffects;
  isAvailable: boolean;
  offerType: ProductRow["offer_type"];
};

export type EquipmentPartnerSupplierOption = {
  key: string;
  name: string;
  positioning: string;
  logoPath: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  strengths: string[];
  isPreviousPartner: boolean;
  products: EquipmentPartnerProduct[];
};

export type EquipmentPartnerContract = {
  id: string;
  supplierKey: string;
  supplierName: string;
  startSeasonName: string;
  startGameYear: number;
  endSeasonName: string;
  endGameYear: number;
  status: ContractRow["status"];
  signedAt: string;
  completedAt: string | null;
  reputationExtraCost: number;
  reputationExtraItemId: string | null;
  reputationExtraPurchasedAt: string | null;
};

export type TeamEquipmentPartnerOverview = {
  teamName: string;
  seasonName: string;
  gameYear: number;
  reputationPoints: number;
  reputationThreshold: number;
  unlocked: boolean;
  canSign: boolean;
  activeContract: EquipmentPartnerContract | null;
  contractHistory: EquipmentPartnerContract[];
  suppliers: EquipmentPartnerSupplierOption[];
  activeProducts: EquipmentPartnerProduct[];
};

export async function getCurrentTeamEquipmentPartnerOverview(
  authUserId: string,
): Promise<TeamEquipmentPartnerOverview | null> {
  const equipment = await getCurrentTeamEquipmentOverview(authUserId);
  if (!equipment) return null;

  const admin = createSupabaseAdminClient();
  const [
    directorResult,
    contractsResult,
    seasonsResult,
    contractSuppliersResult,
    productsResult,
  ] = await Promise.all([
    admin
      .from("sporting_directors")
      .select("reputation_points")
      .eq("auth_user_id", authUserId)
      .eq("status", "active")
      .maybeSingle<DirectorRow>(),
    admin
      .from("equipment_partner_contracts")
      .select(
        "id, supplier_key, start_season_id, end_season_id, status, signed_at, completed_at, reputation_extra_cost, reputation_extra_item_id, reputation_extra_purchased_at",
      )
      .eq("team_id", equipment.teamId)
      .order("signed_at", { ascending: false })
      .order("id", { ascending: false })
      .returns<ContractRow[]>(),
    admin
      .from("seasons")
      .select("id, game_year, name")
      .order("game_year", { ascending: true })
      .returns<SeasonRow[]>(),
    admin
      .from("equipment_suppliers")
      .select("supplier_key")
      .eq("status", "active")
      .eq("supports_team_contract", true)
      .returns<ContractSupplierRow[]>(),
    admin
      .from("equipment_partner_products")
      .select("supplier_key, equipment_item_id, display_order, offer_type")
      .order("display_order", { ascending: true })
      .returns<ProductRow[]>(),
  ]);

  assertQuery(directorResult.error, "la réputation du Directeur Sportif");
  assertQuery(contractsResult.error, "les contrats équipementiers");
  assertQuery(seasonsResult.error, "les saisons du contrat");
  assertQuery(contractSuppliersResult.error, "les équipementiers disponibles");
  assertQuery(productsResult.error, "les gammes partenaires");
  if (!directorResult.data) return null;

  const seasons = seasonsResult.data ?? [];
  const seasonById = new Map(seasons.map((season) => [season.id, season]));
  const supplierByKey = new Map(
    equipment.suppliers.map((supplier) => [supplier.key, supplier]),
  );
  const itemById = new Map(
    equipment.catalog
      .filter((item) => item.channel === "equipment_partner")
      .map((item) => [item.id, item]),
  );
  const productsBySupplier = groupProductsBySupplier(
    productsResult.data ?? [],
    itemById,
  );
  const contracts = (contractsResult.data ?? []).map((contract) =>
    mapContract(contract, seasonById, supplierByKey),
  );
  const activeContract =
    contracts.find((contract) => contract.status === "active") ?? null;
  const previousSupplierKey = contracts[0]?.supplierKey ?? null;
  const supplierKeys = new Set(
    (contractSuppliersResult.data ?? []).map((supplier) => supplier.supplier_key),
  );
  if (activeContract) supplierKeys.add(activeContract.supplierKey);
  const suppliers = equipment.suppliers
    .filter((supplier) => supplierKeys.has(supplier.key))
    .map((supplier) => {
      const products = productsBySupplier.get(supplier.key) ?? [];
      return {
        ...supplier,
        strengths: getSupplierStrengths(products),
        isPreviousPartner: supplier.key === previousSupplierKey,
        products,
      } satisfies EquipmentPartnerSupplierOption;
    });

  const activeProducts = activeContract
    ? productsBySupplier.get(activeContract.supplierKey) ?? []
    : [];
  const reputationPoints = Number(directorResult.data.reputation_points ?? 0);
  const unlocked = canSignEquipmentPartnerContract(reputationPoints);

  return {
    teamName: equipment.teamName,
    seasonName: equipment.seasonName,
    gameYear: equipment.gameYear,
    reputationPoints,
    reputationThreshold: EQUIPMENT_PARTNER_REPUTATION_THRESHOLD,
    unlocked,
    canSign: !activeContract && unlocked,
    activeContract,
    contractHistory: contracts,
    suppliers,
    activeProducts,
  };
}

function groupProductsBySupplier(
  rows: ProductRow[],
  itemById: Map<string, TeamEquipmentCatalogItem>,
) {
  const grouped = new Map<string, EquipmentPartnerProduct[]>();

  for (const row of rows) {
    const item = itemById.get(row.equipment_item_id);
    if (!item) continue;
    const products = grouped.get(row.supplier_key) ?? [];
    products.push({
      id: item.id,
      name: item.name,
      slot: item.slot,
      imagePath: item.imagePath,
      baseEffectSummary: item.effectSummary,
      effects: item.effects,
      isAvailable: item.isUnlimited,
      offerType: row.offer_type,
    });
    grouped.set(row.supplier_key, products);
  }

  return grouped;
}

function getSupplierStrengths(products: EquipmentPartnerProduct[]) {
  const scores = new Map<string, number>();

  for (const product of products) {
    for (const [key, rawValue] of Object.entries(product.effects.ratingBonuses)) {
      const value = Number(rawValue);
      if (value > 0) scores.set(key, (scores.get(key) ?? 0) + value);
    }
    for (const [key, rawValue] of Object.entries(
      product.effects.timeTrialRatingBonuses,
    )) {
      const value = Number(rawValue);
      if (value > 0) scores.set(key, (scores.get(key) ?? 0) + value);
    }
  }

  const strengths = [...scores.entries()]
    .sort(([leftKey, left], [rightKey, right]) =>
      right - left || leftKey.localeCompare(rightKey, "fr"),
    )
    .slice(0, 3)
    .map(([key]) => ratingLabel(key));

  return strengths.length ? strengths : ["Polyvalence"];
}

function ratingLabel(key: string) {
  const labels: Record<string, string> = {
    mountain: "Montagne",
    hills: "Vallons",
    flat: "Plaine",
    timeTrial: "Contre-la-montre",
    cobbles: "Pavés",
    sprint: "Sprint",
    acceleration: "Accélération",
    downhill: "Descente",
    endurance: "Endurance",
    resistance: "Résistance",
    recovery: "Récupération",
    breakaway: "Baroudeur",
    prologue: "Prologue",
  };
  return labels[key] ?? key;
}

function mapContract(
  contract: ContractRow,
  seasonById: Map<string, SeasonRow>,
  supplierByKey: Map<string, { name: string }>,
): EquipmentPartnerContract {
  const start = seasonById.get(contract.start_season_id);
  const end = seasonById.get(contract.end_season_id);

  return {
    id: contract.id,
    supplierKey: contract.supplier_key,
    supplierName:
      supplierByKey.get(contract.supplier_key)?.name ?? contract.supplier_key,
    startSeasonName: start?.name ?? "Saison inconnue",
    startGameYear: start?.game_year ?? 0,
    endSeasonName: end?.name ?? "Saison inconnue",
    endGameYear: end?.game_year ?? 0,
    status: contract.status,
    signedAt: contract.signed_at,
    completedAt: contract.completed_at,
    reputationExtraCost: Number(contract.reputation_extra_cost ?? 0),
    reputationExtraItemId: contract.reputation_extra_item_id,
    reputationExtraPurchasedAt: contract.reputation_extra_purchased_at,
  };
}

function assertQuery(
  error: { message: string } | null,
  resourceName: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${resourceName} : ${error.message}`);
  }
}
