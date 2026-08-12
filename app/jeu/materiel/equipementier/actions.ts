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
