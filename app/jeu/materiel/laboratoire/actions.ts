"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function startEquipmentRndAction(formData: FormData) {
  const equipmentItemId = String(formData.get("equipmentItemId") ?? "").trim();
  const engineerContractId = String(
    formData.get("engineerContractId") ?? "",
  ).trim();
  if (!UUID_PATTERN.test(equipmentItemId)) {
    redirect("/jeu/materiel/laboratoire?erreur=Équipement%20invalide.");
  }
  if (engineerContractId && !UUID_PATTERN.test(engineerContractId)) {
    redirect("/jeu/materiel/laboratoire?erreur=Ingénieur%20R%26D%20invalide.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("start_current_team_equipment_rnd", {
    p_equipment_item_id: equipmentItemId,
    p_engineer_contract_id: engineerContractId || null,
  });
  if (error) {
    redirect(
      `/jeu/materiel/laboratoire?erreur=${encodeURIComponent(error.message.slice(0, 300))}`,
    );
  }

  revalidatePath("/jeu/materiel");
  revalidatePath("/jeu/materiel/equiper");
  revalidatePath("/jeu/materiel/laboratoire");
  revalidatePath("/jeu/finances");
  redirect("/jeu/materiel/laboratoire?recherche=lancee");
}
