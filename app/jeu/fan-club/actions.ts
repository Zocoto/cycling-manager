"use server";

import { revalidatePath } from "next/cache";

import { FAN_CLUB_CAR_MODELS, FAN_CLUB_PRODUCTS } from "@/lib/game/fan-club-pilot";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FanClubActionResult = {
  ok: boolean;
  message: string;
};

const CAR_MODEL_IDS = new Set(FAN_CLUB_CAR_MODELS.map((model) => model.id));
const PRODUCT_IDS = new Set(FAN_CLUB_PRODUCTS.map((product) => product.id));

export async function purchaseFanClubCarAction(
  modelId: string,
): Promise<FanClubActionResult> {
  if (!CAR_MODEL_IDS.has(modelId)) return invalidRequest();
  return runRpc("purchase_current_team_fan_club_car", {
    p_model_code: modelId,
  }, "Le car a été acheté et ajouté au parc.");
}

export async function sellFanClubCarAction(
  modelId: string,
): Promise<FanClubActionResult> {
  if (!CAR_MODEL_IDS.has(modelId)) return invalidRequest();
  return runRpc("sell_current_team_fan_club_car", {
    p_model_code: modelId,
  }, "Le car a été revendu et la trésorerie créditée.");
}

export async function charterFanClubCarsAction({
  raceId,
  modelId,
  carCount,
}: {
  raceId: string;
  modelId: string;
  carCount: number;
}): Promise<FanClubActionResult> {
  if (
    !isUuid(raceId) ||
    !CAR_MODEL_IDS.has(modelId) ||
    !Number.isInteger(carCount) ||
    carCount < 1 ||
    carCount > 30
  ) {
    return invalidRequest();
  }
  return runRpc("charter_current_team_fan_club_cars", {
    p_race_edition_id: raceId,
    p_model_code: modelId,
    p_car_count: carCount,
  }, "Le déplacement est confirmé et les cars sont affectés à cette course.");
}

export async function purchaseFanClubStockAction({
  productId,
  quantity,
}: {
  productId: string;
  quantity: number;
}): Promise<FanClubActionResult> {
  if (
    !PRODUCT_IDS.has(productId) ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 5_000
  ) {
    return invalidRequest();
  }
  return runRpc("purchase_current_team_fan_club_stock", {
    p_product_code: productId,
    p_quantity: quantity,
  }, "Le stock a été acheté et ajouté au magasin.");
}

export async function updateFanClubSalePriceAction({
  productId,
  salePrice,
}: {
  productId: string;
  salePrice: number;
}): Promise<FanClubActionResult> {
  if (
    !PRODUCT_IDS.has(productId) ||
    !Number.isFinite(salePrice) ||
    salePrice < 0.5 ||
    salePrice > 999
  ) {
    return invalidRequest();
  }
  return runRpc("set_current_team_fan_club_sale_price", {
    p_product_code: productId,
    p_sale_price: salePrice,
  }, "Le prix de vente a été enregistré. Il influencera les prochaines ventes.");
}

async function runRpc(
  functionName: string,
  parameters: Record<string, string | number>,
  successMessage: string,
): Promise<FanClubActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();
  if (authenticationError || !user) {
    return { ok: false, message: "Votre session a expiré. Reconnectez-vous." };
  }

  const result = await supabase.rpc(functionName, parameters);
  if (result.error) return { ok: false, message: result.error.message };

  revalidatePath("/jeu/fan-club");
  revalidatePath("/jeu/finances");
  revalidatePath("/jeu");
  return { ok: true, message: successMessage };
}

function invalidRequest(): FanClubActionResult {
  return { ok: false, message: "La demande transmise est invalide." };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
