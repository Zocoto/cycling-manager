"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  isAssignableInventoryCategory,
  type AssignableInventoryCategory,
} from "@/lib/game/inventory";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InventoryApplicationResult = {
  category?: unknown;
  itemName?: unknown;
  effectSummary?: unknown;
};

export async function useInventoryItemAction(formData: FormData) {
  const riderId = readValue(formData, "riderId");
  const inventoryItemId = readValue(formData, "inventoryItemId");
  const category = readValue(formData, "category");
  const returnPath = isAssignableInventoryCategory(category)
    ? `/jeu/inventaire?categorie=${category}`
    : "/jeu/inventaire";

  if (
    !isUuid(riderId) ||
    !isUuid(inventoryItemId) ||
    !isAssignableInventoryCategory(category)
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
    "use_current_team_inventory_item",
    {
      p_rider_id: riderId,
      p_inventory_item_id: inventoryItemId,
    }
  );

  if (error) redirectWithError(returnPath, error.message);

  const result = normalizeApplicationResult(data, category);
  const successMessage = `${result.itemName} a été attribué : ${result.effectSummary} L’effet est permanent.`;

  revalidatePath("/jeu/inventaire");
  revalidatePath("/jeu/effectif");
  revalidatePath(`/jeu/coureurs/${riderId}`);
  revalidatePath("/jeu/resultats");

  redirect(
    `/jeu/coureurs/${riderId}?succes=${encodeURIComponent(successMessage)}`
  );
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
  };
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
