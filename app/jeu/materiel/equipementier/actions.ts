"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const RETURN_PATH = "/jeu/materiel/equipementier";

export async function signEquipmentPartnerAction(formData: FormData) {
  const supplierKey = readValue(formData, "supplierKey");
  if (!/^[a-z0-9-]{1,64}$/.test(supplierKey)) {
    redirectWithError("Cet équipementier est invalide.");
  }

  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("sign_equipment_partner_contract", {
    p_supplier_key: supplierKey,
  });
  if (error) redirectWithError(error.message);

  revalidateEquipmentPaths();
  redirect(`${RETURN_PATH}?etat=contrat-signe`);
}

export async function startEquipmentPartnerRndAction(formData: FormData) {
  const equipmentItemId = readValue(formData, "equipmentItemId");
  if (!isUuid(equipmentItemId)) {
    redirectWithError("La référence de matériel est invalide.");
  }

  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("start_equipment_partner_rnd", {
    p_equipment_item_id: equipmentItemId,
  });
  if (error) redirectWithError(error.message);

  revalidateEquipmentPaths();
  redirect(`${RETURN_PATH}?etat=recherche-lancee`);
}

export async function claimEquipmentPartnerOfferAction(formData: FormData) {
  const offerId = readValue(formData, "offerId");
  if (!isUuid(offerId)) {
    redirectWithError("Cette proposition de matériel est invalide.");
  }

  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("claim_equipment_partner_offer", {
    p_offer_id: offerId,
  });
  if (error) redirectWithError(error.message);

  revalidateEquipmentPaths();
  redirect(`${RETURN_PATH}?etat=proposition-acceptee`);
}

async function authenticatedClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/connexion");
  return supabase;
}

function revalidateEquipmentPaths() {
  revalidatePath(RETURN_PATH);
  revalidatePath("/jeu/materiel");
  revalidatePath("/jeu/inventaire");
  revalidatePath("/jeu/effectif");
  revalidatePath("/jeu");
}

function redirectWithError(message: string): never {
  redirect(`${RETURN_PATH}?erreur=${encodeURIComponent(message.slice(0, 300))}`);
}

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
