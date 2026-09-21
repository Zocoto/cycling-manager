import "server-only";

import {
  combineEquipmentEffects,
  getEquipmentRatingBonusTotals,
  normalizeEquipmentEffects,
  type EquipmentEffects,
} from "@/lib/game/equipment";
import {
  RIDER_RATING_AXES,
  type RiderRatingKey,
} from "@/lib/game/rider-profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FederationEquipmentItem = {
  slotType: string;
  name: string;
  effectSummary: string;
  effectPayload: unknown;
};

export type FederationEquipmentOffer = {
  key: string;
  name: string;
  description: string;
  seasonPrice: number;
  supplier: {
    key: string;
    name: string;
    logoPath: string | null;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  items: FederationEquipmentItem[];
  ratingBonusTotal: number;
  coveredRatingCount: number;
  ratingBonusSummary: Array<{
    key: RiderRatingKey;
    shortLabel: string;
    label: string;
    amount: number;
    contextualAmount: number;
  }>;
  injuryRiskReductionPct: number;
};

export type FederationEquipmentContract = {
  id: string;
  offerKey: string;
  offerName: string;
  supplierKey: string;
  pricePaid: number;
  signedAt: string;
  items: FederationEquipmentItem[];
};

export type FederationEquipmentState = {
  balance: number | null;
  canManage: boolean;
  offers: FederationEquipmentOffer[];
  contract: FederationEquipmentContract | null;
};

type OfferRow = {
  offer_key: string;
  supplier_key: string;
  name: string;
  description: string;
  season_price: number | string;
  display_order: number;
};
type OfferItemRow = {
  offer_key: string;
  slot_type: string;
  equipment_name: string;
  effect_summary: string;
  effect_payload: unknown;
  display_order: number;
};
type SupplierRow = {
  supplier_key: string;
  name: string;
  logo_path: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
};
type ContractRow = {
  id: string;
  offer_key: string;
  supplier_key: string;
  offer_name: string;
  price_paid: number | string;
  signed_at: string;
};
type ContractItemRow = {
  contract_id: string;
  slot_type: string;
  equipment_name: string;
  effect_summary: string;
  effect_payload: unknown;
  display_order: number;
};
type AssignmentRow = { sporting_director_id: string };
type TermRow = { president_director_id: string | null };
type AccountRow = { balance: number | string };

export async function getFederationEquipmentState({
  countryId,
  seasonId,
  gameYear,
  viewerTeamId,
}: {
  countryId: string;
  seasonId: string;
  gameYear: number;
  viewerTeamId: string | null;
}): Promise<FederationEquipmentState> {
  const admin = createSupabaseAdminClient();
  const [
    offersResult,
    offerItemsResult,
    suppliersResult,
    contractResult,
    assignmentResult,
    termResult,
    accountResult,
  ] = await Promise.all([
    admin
      .from("national_federation_equipment_offers")
      .select("offer_key, supplier_key, name, description, season_price, display_order")
      .eq("status", "active")
      .order("display_order")
      .returns<OfferRow[]>(),
    admin
      .from("national_federation_equipment_offer_items")
      .select("offer_key, slot_type, equipment_name, effect_summary, effect_payload, display_order")
      .order("display_order")
      .returns<OfferItemRow[]>(),
    admin
      .from("equipment_suppliers")
      .select("supplier_key, name, logo_path, primary_color, secondary_color, accent_color")
      .eq("status", "active")
      .returns<SupplierRow[]>(),
    admin
      .from("national_federation_equipment_contracts")
      .select("id, offer_key, supplier_key, offer_name, price_paid, signed_at")
      .eq("country_id", countryId)
      .eq("season_id", seasonId)
      .maybeSingle<ContractRow>(),
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
  ]);

  for (const result of [
    offersResult,
    offerItemsResult,
    suppliersResult,
    contractResult,
    assignmentResult,
    termResult,
    accountResult,
  ]) {
    if (result.error) throw result.error;
  }

  const supplierByKey = new Map(
    (suppliersResult.data ?? []).map((supplier) => [supplier.supplier_key, supplier]),
  );
  const itemsByOffer = new Map<string, FederationEquipmentItem[]>();
  for (const item of offerItemsResult.data ?? []) {
    const entries = itemsByOffer.get(item.offer_key) ?? [];
    entries.push(mapItem(item));
    itemsByOffer.set(item.offer_key, entries);
  }

  const offers = (offersResult.data ?? []).flatMap((offer) => {
    const supplier = supplierByKey.get(offer.supplier_key);
    if (!supplier) return [];
    const items = itemsByOffer.get(offer.offer_key) ?? [];
    const summary = summarizeFederationEquipmentItems(items);
    return [{
      key: offer.offer_key,
      name: offer.name,
      description: offer.description,
      seasonPrice: Number(offer.season_price),
      supplier: {
        key: supplier.supplier_key,
        name: supplier.name,
        logoPath: supplier.logo_path,
        primaryColor: supplier.primary_color,
        secondaryColor: supplier.secondary_color,
        accentColor: supplier.accent_color,
      },
      items,
      ...summary,
    }];
  });

  let contract: FederationEquipmentContract | null = null;
  if (contractResult.data) {
    const contractItemsResult = await admin
      .from("national_federation_equipment_contract_items")
      .select("contract_id, slot_type, equipment_name, effect_summary, effect_payload, display_order")
      .eq("contract_id", contractResult.data.id)
      .order("display_order")
      .returns<ContractItemRow[]>();
    if (contractItemsResult.error) throw contractItemsResult.error;
    contract = {
      id: contractResult.data.id,
      offerKey: contractResult.data.offer_key,
      offerName: contractResult.data.offer_name,
      supplierKey: contractResult.data.supplier_key,
      pricePaid: Number(contractResult.data.price_paid),
      signedAt: contractResult.data.signed_at,
      items: (contractItemsResult.data ?? []).map(mapItem),
    };
  }

  return {
    balance: accountResult.data ? Number(accountResult.data.balance) : null,
    canManage:
      gameYear >= 3 &&
      Boolean(assignmentResult.data?.sporting_director_id) &&
      assignmentResult.data?.sporting_director_id ===
        termResult.data?.president_director_id,
    offers,
    contract,
  };
}

export async function loadFederationEquipmentEffectsByCountry({
  seasonId,
  countryIds,
}: {
  seasonId: string;
  countryIds: string[];
}): Promise<Map<string, EquipmentEffects>> {
  if (countryIds.length === 0) return new Map();

  const admin = createSupabaseAdminClient();
  const contractsResult = await admin
    .from("national_federation_equipment_contracts")
    .select("id, country_id")
    .eq("season_id", seasonId)
    .in("country_id", [...new Set(countryIds)])
    .returns<Array<{ id: string; country_id: string }>>();
  if (contractsResult.error) throw contractsResult.error;
  const contracts = contractsResult.data ?? [];
  if (contracts.length === 0) return new Map();

  const itemsResult = await admin
    .from("national_federation_equipment_contract_items")
    .select("contract_id, effect_payload")
    .in("contract_id", contracts.map((contract) => contract.id))
    .returns<Array<{ contract_id: string; effect_payload: unknown }>>();
  if (itemsResult.error) throw itemsResult.error;

  const countryByContractId = new Map(
    contracts.map((contract) => [contract.id, contract.country_id]),
  );
  const effectsByCountry = new Map<string, EquipmentEffects[]>();
  for (const item of itemsResult.data ?? []) {
    const countryId = countryByContractId.get(item.contract_id);
    if (!countryId) continue;
    const effects = effectsByCountry.get(countryId) ?? [];
    effects.push(normalizeEquipmentEffects(item.effect_payload));
    effectsByCountry.set(countryId, effects);
  }

  return new Map(
    [...effectsByCountry].map(([countryId, effects]) => [
      countryId,
      combineEquipmentEffects(effects),
    ]),
  );
}

function mapItem(item: OfferItemRow | ContractItemRow): FederationEquipmentItem {
  return {
    slotType: item.slot_type,
    name: item.equipment_name,
    effectSummary: item.effect_summary,
    effectPayload: item.effect_payload,
  };
}

function summarizeFederationEquipmentItems(
  items: readonly FederationEquipmentItem[],
) {
  const effects = combineEquipmentEffects(
    items.map((item) => normalizeEquipmentEffects(item.effectPayload)),
  );
  const ratingTotals = getEquipmentRatingBonusTotals(effects);
  const activeBonuses = Object.values(ratingTotals).filter(
    (value): value is number => Number.isFinite(value) && value > 0,
  );

  return {
    ratingBonusTotal: activeBonuses.reduce((total, value) => total + value, 0),
    coveredRatingCount: activeBonuses.length,
    ratingBonusSummary: RIDER_RATING_AXES.flatMap((axis) => {
      const amount = ratingTotals[axis.key] ?? 0;
      if (amount <= 0) return [];
      return [{
        key: axis.key,
        shortLabel: axis.shortLabel,
        label: axis.label,
        amount,
        contextualAmount: effects.timeTrialRatingBonuses[axis.key] ?? 0,
      }];
    }),
    injuryRiskReductionPct: effects.injuryRiskReductionPct,
  };
}
