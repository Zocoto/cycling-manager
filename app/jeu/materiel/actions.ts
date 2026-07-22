"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { EQUIPMENT_SLOTS, type EquipmentSlot } from "@/lib/game/equipment";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function purchaseEquipmentAction(formData: FormData) {
  const equipmentItemId = readValue(formData, "equipmentItemId");
  const category = readValue(formData, "category");
  const returnPath = buildMaterialPath(category);

  if (!isUuid(equipmentItemId)) {
    redirectWithError(returnPath, "La référence de matériel est invalide.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  const { error } = await supabase.rpc("purchase_current_team_equipment", {
    p_equipment_item_id: equipmentItemId,
  });

  if (error) redirectWithError(returnPath, error.message);

  revalidatePath("/jeu/materiel");
  revalidatePath("/jeu/finances");
  revalidatePath("/jeu");
  redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}achat=confirme`);
}

export async function equipRiderAction(formData: FormData) {
  const riderId = readValue(formData, "riderId");
  const slot = readValue(formData, "slot");
  const equipmentItemId = readValue(formData, "equipmentItemId");
  const origin = readValue(formData, "origin");
  const errorPath =
    origin === "inventory"
      ? "/jeu/inventaire?categorie=equipment"
      : isUuid(riderId)
        ? `/jeu/coureurs/${riderId}`
        : "/jeu/effectif";

  if (!isUuid(riderId) || !isUuid(equipmentItemId) || !isEquipmentSlot(slot)) {
    redirectWithError(
      errorPath,
      "La demande d’équipement est invalide."
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  const { error } = await supabase.rpc(
    "equip_current_team_rider",
    {
      p_rider_id: riderId,
      p_slot_type: slot,
      p_equipment_item_id: equipmentItemId,
    }
  );

  if (error) redirectWithError(errorPath, error.message);

  revalidatePath(`/jeu/coureurs/${riderId}`);
  revalidatePath("/jeu/inventaire");
  revalidatePath("/jeu/materiel");
  redirect(`/jeu/coureurs/${riderId}?equipement=confirme`);
}

function buildMaterialPath(category: string) {
  return isEquipmentSlot(category)
    ? `/jeu/materiel?categorie=${encodeURIComponent(category)}`
    : "/jeu/materiel";
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

function isEquipmentSlot(value: string): value is EquipmentSlot {
  return EQUIPMENT_SLOTS.includes(value as EquipmentSlot);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
