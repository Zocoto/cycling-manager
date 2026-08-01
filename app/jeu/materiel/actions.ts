"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  sanitizeInventoryReturnPath,
  withPageFeedback,
} from "@/lib/game/filtered-page-paths";
import {
  EQUIPMENT_SLOTS,
  isEquipmentEffectFilterKey,
  type EquipmentSlot,
} from "@/lib/game/equipment";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function purchaseEquipmentAction(formData: FormData) {
  const equipmentItemId = readValue(formData, "equipmentItemId");
  const category = readValue(formData, "category");
  const supplier = readValue(formData, "supplier");
  const effect = readValue(formData, "effect");
  const returnPath = buildMaterialPath(category, supplier, effect);

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
  redirect(
    `${returnPath}${returnPath.includes("?") ? "&" : "?"}achat=confirme`,
  );
}

export async function equipRiderAction(formData: FormData) {
  const riderId = readValue(formData, "riderId");
  const slot = readValue(formData, "slot");
  const equipmentItemId = readValue(formData, "equipmentItemId");
  const origin = readValue(formData, "origin");
  const inventoryReturnPath = sanitizeInventoryReturnPath(
    readValue(formData, "returnPath"),
  );
  const teamEquipmentReturnPath = buildTeamEquipmentPath(riderId, slot);
  const errorPath =
    origin === "inventory"
      ? inventoryReturnPath
      : origin === "team-equipment"
        ? teamEquipmentReturnPath
        : isUuid(riderId)
          ? `/jeu/coureurs/${riderId}`
          : "/jeu/effectif";

  if (!isUuid(riderId) || !isUuid(equipmentItemId) || !isEquipmentSlot(slot)) {
    redirectWithError(errorPath, "La demande d’équipement est invalide.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  const { error } = await supabase.rpc("equip_current_team_rider", {
    p_rider_id: riderId,
    p_slot_type: slot,
    p_equipment_item_id: equipmentItemId,
  });

  if (error) redirectWithError(errorPath, error.message);

  revalidatePath(`/jeu/coureurs/${riderId}`);
  revalidatePath("/jeu/inventaire");
  revalidatePath("/jeu/materiel");
  revalidatePath("/jeu/materiel/equiper");
  redirect(
    origin === "inventory"
      ? withPageFeedback(
          inventoryReturnPath,
          "succes",
          "Le matériel a bien été attribué au coureur.",
        )
      : origin === "team-equipment"
        ? withPageFeedback(
            teamEquipmentReturnPath,
            "succes",
            "Le matériel a bien été attribué au coureur.",
          )
        : `/jeu/coureurs/${riderId}?equipement=confirme`,
  );
}

export async function unequipRiderAction(formData: FormData) {
  const riderId = readValue(formData, "riderId");
  const slot = readValue(formData, "slot");
  const origin = readValue(formData, "origin");
  const returnPath =
    origin === "team-equipment"
      ? buildTeamEquipmentPath(riderId, slot)
      : isUuid(riderId)
        ? `/jeu/coureurs/${riderId}`
        : "/jeu/effectif";

  if (!isUuid(riderId) || !isEquipmentSlot(slot)) {
    redirectWithError(returnPath, "La demande de retrait est invalide.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  const { error } = await supabase.rpc("unequip_current_team_rider", {
    p_rider_id: riderId,
    p_slot_type: slot,
  });

  if (error) redirectWithError(returnPath, error.message);

  revalidatePath(`/jeu/coureurs/${riderId}`);
  revalidatePath("/jeu/inventaire");
  revalidatePath("/jeu/materiel");
  revalidatePath("/jeu/materiel/equiper");
  redirect(
    origin === "team-equipment"
      ? withPageFeedback(
          returnPath,
          "succes",
          "Le matériel a bien été replacé dans la réserve.",
        )
      : `/jeu/coureurs/${riderId}?equipement=retire`,
  );
}

function buildTeamEquipmentPath(riderId: string, slot: string) {
  const params = new URLSearchParams();
  if (isUuid(riderId)) params.set("coureur", riderId);
  if (isEquipmentSlot(slot)) params.set("slot", slot);
  const query = params.toString();
  return query ? `/jeu/materiel/equiper?${query}` : "/jeu/materiel/equiper";
}

function buildMaterialPath(category: string, supplier: string, effect: string) {
  const params = new URLSearchParams();
  if (isEquipmentSlot(category)) params.set("categorie", category);
  if (/^[a-z0-9-]{1,64}$/.test(supplier)) params.set("marque", supplier);
  if (isEquipmentEffectFilterKey(effect)) params.set("effet", effect);
  const query = params.toString();
  return query ? `/jeu/materiel?${query}` : "/jeu/materiel";
}

function redirectWithError(path: string, message: string): never {
  redirect(
    `${path}${path.includes("?") ? "&" : "?"}erreur=${encodeURIComponent(
      message.slice(0, 300),
    )}`,
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
    value,
  );
}
