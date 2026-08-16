"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  sanitizeInventoryReturnPath,
  withPageFeedback,
} from "@/lib/game/filtered-page-paths";
import {
  isAssignableInventoryCategory,
  type AssignableInventoryCategory,
} from "@/lib/game/inventory";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InventoryApplicationResult = {
  category?: unknown;
  itemName?: unknown;
  effectSummary?: unknown;
  quantityApplied?: unknown;
};

type EquipmentSaleResult = {
  itemName?: unknown;
  resalePrice?: unknown;
  currency?: unknown;
};

export async function useInventoryItemAction(formData: FormData) {
  const riderId = readValue(formData, "riderId");
  const inventoryItemId = readValue(formData, "inventoryItemId");
  const category = readValue(formData, "category");
  const quantity = readPositiveInteger(formData, "quantity");
  const returnPath = sanitizeInventoryReturnPath(
    readValue(formData, "returnPath"),
  );

  if (
    !isUuid(riderId) ||
    !isUuid(inventoryItemId) ||
    !isAssignableInventoryCategory(category) ||
    quantity === null
  ) {
    redirectWithError(returnPath, "La demande d’attribution est invalide.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  const { data, error } = await supabase.rpc(
    "use_current_team_inventory_items",
    {
      p_rider_id: riderId,
      p_inventory_item_id: inventoryItemId,
      p_quantity: quantity,
    }
  );

  if (error) redirectWithError(returnPath, error.message);

  const result = normalizeApplicationResult(data, category);
  const successMessage = `${result.quantityApplied > 1 ? `${result.quantityApplied} × ` : ""}${result.itemName} ${result.quantityApplied > 1 ? "ont été attribués" : "a été attribué"} : ${result.effectSummary} L’effet est permanent.`;

  revalidatePath("/jeu/inventaire");
  revalidatePath("/jeu/effectif");
  revalidatePath(`/jeu/coureurs/${riderId}`);
  revalidatePath("/jeu/resultats");

  redirect(withPageFeedback(returnPath, "succes", successMessage));
}

export async function sellEquipmentAction(formData: FormData) {
  const equipmentItemId = readValue(formData, "equipmentItemId");
  const returnPath = sanitizeInventoryReturnPath(
    readValue(formData, "returnPath"),
  );

  if (!isUuid(equipmentItemId)) {
    redirectWithError(returnPath, "La demande de revente est invalide.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  const { data, error } = await supabase.rpc(
    "sell_current_team_equipment",
    {
      p_equipment_item_id: equipmentItemId,
    },
  );

  if (error) redirectWithError(returnPath, error.message);

  const result = normalizeEquipmentSaleResult(data);

  revalidatePath("/jeu/inventaire");
  revalidatePath("/jeu/materiel");
  revalidatePath("/jeu/finances");
  revalidatePath("/jeu");

  redirect(
    withPageFeedback(
      returnPath,
      "succes",
      result.itemName +
        " a été revendu pour " +
        formatCurrency(result.resalePrice, result.currency) +
        ".",
    ),
  );
}

function normalizeEquipmentSaleResult(value: unknown) {
  const result =
    value && typeof value === "object"
      ? (value as EquipmentSaleResult)
      : {};
  const resalePrice = Number(result.resalePrice);

  return {
    itemName:
      typeof result.itemName === "string" && result.itemName.trim()
        ? result.itemName.trim()
        : "Le matériel",
    resalePrice:
      Number.isFinite(resalePrice) && resalePrice > 0 ? resalePrice : 0,
    currency:
      typeof result.currency === "string" &&
      /^[A-Z]{3}$/.test(result.currency)
        ? result.currency
        : "EUR",
  };
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeApplicationResult(
  value: unknown,
  fallbackCategory: AssignableInventoryCategory
) {
  const result =
    value && typeof value === "object"
      ? (value as InventoryApplicationResult)
      : {};

  return {
    category:
      typeof result.category === "string" &&
      isAssignableInventoryCategory(result.category)
        ? result.category
        : fallbackCategory,
    itemName:
      typeof result.itemName === "string" && result.itemName.trim()
        ? result.itemName.trim()
        : "L’objet",
    effectSummary:
      typeof result.effectSummary === "string" && result.effectSummary.trim()
        ? result.effectSummary.trim()
        : "le bonus a été appliqué au coureur.",
    quantityApplied: readResultPositiveInteger(result.quantityApplied),
  };
}

function readPositiveInteger(formData: FormData, key: string) {
  const parsed = Number(readValue(formData, key));
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 1_000
    ? parsed
    : null;
}

function readResultPositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function redirectWithError(path: string, message: string): never {
  redirect(
    `${path}${path.includes("?") ? "&" : "?"}erreur=${encodeURIComponent(
      message.slice(0, 300)
    )}`
  );
}

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
