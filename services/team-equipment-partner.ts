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
  offer_type: "core" | "rare";
  research_rating_key: string;
  display_order: number;
};

type ProjectRow = {
  id: string;
  equipment_item_id: string;
  research_rating_key: string;
  status: "in_progress" | "completed";
  started_on: string;
  completes_on: string;
  outcome: "improvement" | "setback" | null;
  delta: number | null;
  started_at: string;
  completed_at: string | null;
};

type OfferRow = {
  id: string;
  equipment_item_id: string;
  offered_on: string;
  expires_on: string;
  status: "open" | "claimed" | "expired";
};

export type EquipmentPartnerProduct = {
  id: string;
  name: string;
  slot: EquipmentSlot;
  imagePath: string;
  baseEffectSummary: string;
  effects: EquipmentEffects;
  offerType: ProductRow["offer_type"];
  researchRatingKey: string;
  isAvailable: boolean;
};

export type EquipmentPartnerSupplierOption = {
  key: string;
  name: string;
  positioning: string;
  logoPath: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  alreadyUsed: boolean;
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
};

export type EquipmentPartnerProject = {
  id: string;
  itemId: string;
  itemName: string;
  itemSlot: EquipmentSlot;
  researchRatingKey: string;
  status: ProjectRow["status"];
  startedOn: string;
  completesOn: string;
  outcome: ProjectRow["outcome"];
  delta: number | null;
  completedAt: string | null;
};

export type EquipmentPartnerOffer = {
  id: string;
  item: EquipmentPartnerProduct;
  offeredOn: string;
  expiresOn: string;
};

export type TeamEquipmentPartnerOverview = {
  teamName: string;
  seasonName: string;
  reputationPoints: number;
  reputationThreshold: number;
  unlocked: boolean;
  canSign: boolean;
  activeContract: EquipmentPartnerContract | null;
  contractHistory: EquipmentPartnerContract[];
  suppliers: EquipmentPartnerSupplierOption[];
  activeProducts: EquipmentPartnerProduct[];
  activeProject: EquipmentPartnerProject | null;
  recentProjects: EquipmentPartnerProject[];
  openOffers: EquipmentPartnerOffer[];
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
        "id, supplier_key, start_season_id, end_season_id, status, signed_at, completed_at",
      )
      .eq("team_id", equipment.teamId)
      .order("signed_at", { ascending: false })
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
      .select(
        "supplier_key, equipment_item_id, offer_type, research_rating_key, display_order",
      )
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
  const usedSupplierKeys = new Set(contracts.map((contract) => contract.supplierKey));
  const supplierKeys = new Set(
    (contractSuppliersResult.data ?? []).map((supplier) => supplier.supplier_key),
  );
  const suppliers = equipment.suppliers
    .filter((supplier) => supplierKeys.has(supplier.key))
    .map(
      (supplier) =>
        ({
          ...supplier,
          alreadyUsed: usedSupplierKeys.has(supplier.key),
          products: productsBySupplier.get(supplier.key) ?? [],
        }) satisfies EquipmentPartnerSupplierOption,
    );

  const activeProducts = activeContract
    ? productsBySupplier.get(activeContract.supplierKey) ?? []
    : [];
  const currentContractRow = activeContract
    ? (contractsResult.data ?? []).find(
        (contract) => contract.id === activeContract.id,
      ) ?? null
    : null;

  const [projectsResult, offersResult] = currentContractRow
    ? await Promise.all([
        admin
          .from("equipment_partner_rnd_projects")
          .select(
            "id, equipment_item_id, research_rating_key, status, started_on, completes_on, outcome, delta, started_at, completed_at",
          )
          .eq("contract_id", currentContractRow.id)
          .order("started_at", { ascending: false })
          .limit(12)
          .returns<ProjectRow[]>(),
        admin
          .from("equipment_partner_offers")
          .select("id, equipment_item_id, offered_on, expires_on, status")
          .eq("contract_id", currentContractRow.id)
          .eq("status", "open")
          .order("offered_on", { ascending: false })
          .returns<OfferRow[]>(),
      ])
    : [
        { data: [] as ProjectRow[], error: null },
        { data: [] as OfferRow[], error: null },
      ];

  assertQuery(projectsResult.error, "les recherches R&D");
  assertQuery(offersResult.error, "les propositions de matériel");

  const projectRows = projectsResult.data ?? [];
  const projects = projectRows.flatMap((project) => {
    const item = itemById.get(project.equipment_item_id);
    return item ? [mapProject(project, item)] : [];
  });
  const productById = new Map(activeProducts.map((product) => [product.id, product]));
  const openOffers = (offersResult.data ?? []).flatMap((offer) => {
    const item = productById.get(offer.equipment_item_id);
    return item
      ? [
          {
            id: offer.id,
            item,
            offeredOn: offer.offered_on,
            expiresOn: offer.expires_on,
          } satisfies EquipmentPartnerOffer,
        ]
      : [];
  });
  const reputationPoints = Number(directorResult.data.reputation_points ?? 0);
  const unlocked = canSignEquipmentPartnerContract(reputationPoints);

  return {
    teamName: equipment.teamName,
    seasonName: equipment.seasonName,
    reputationPoints,
    reputationThreshold: EQUIPMENT_PARTNER_REPUTATION_THRESHOLD,
    unlocked,
    canSign: !activeContract && unlocked,
    activeContract,
    contractHistory: contracts,
    suppliers,
    activeProducts,
    activeProject:
      projects.find((project) => project.status === "in_progress") ?? null,
    recentProjects: projects.filter((project) => project.status === "completed"),
    openOffers,
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
      offerType: row.offer_type,
      researchRatingKey: row.research_rating_key,
      isAvailable: item.isUnlimited,
    });
    grouped.set(row.supplier_key, products);
  }

  return grouped;
}

function mapContract(
  contract: ContractRow,
  seasonById: Map<string, SeasonRow>,
  supplierByKey: Map<
    string,
    { name: string }
  >,
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
  };
}

function mapProject(
  project: ProjectRow,
  item: TeamEquipmentCatalogItem,
): EquipmentPartnerProject {
  return {
    id: project.id,
    itemId: item.id,
    itemName: item.name,
    itemSlot: item.slot,
    researchRatingKey: project.research_rating_key,
    status: project.status,
    startedOn: project.started_on,
    completesOn: project.completes_on,
    outcome: project.outcome,
    delta: project.delta,
    completedAt: project.completed_at,
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
