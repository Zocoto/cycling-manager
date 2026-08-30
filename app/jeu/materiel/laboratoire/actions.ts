"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import {
  EQUIPMENT_PROTOTYPE_NAME_MAX_LENGTH,
  EQUIPMENT_PROTOTYPE_NAME_MIN_LENGTH,
  isEquipmentPrototypeNameValid,
  normalizeEquipmentPrototypeName,
} from "@/lib/game/equipment-rnd";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function startEquipmentRndAction(formData: FormData) {
  const equipmentItemId = String(formData.get("equipmentItemId") ?? "").trim();
  const engineerContractId = String(
    formData.get("engineerContractId") ?? "",
  ).trim();
  const prototypeName = normalizeEquipmentPrototypeName(
    formData.get("prototypeName"),
  );
  if (!UUID_PATTERN.test(equipmentItemId)) {
    redirect("/jeu/materiel/laboratoire?erreur=Équipement%20invalide.");
  }
  if (!UUID_PATTERN.test(engineerContractId)) {
    redirect(
      "/jeu/materiel/laboratoire?erreur=Sélectionnez%20un%20ingénieur%20R%26D%20disponible.",
    );
  }
  if (!isEquipmentPrototypeNameValid(prototypeName)) {
    redirect(
      `/jeu/materiel/laboratoire?erreur=${encodeURIComponent(
        `Le nom du prototype doit contenir entre ${EQUIPMENT_PROTOTYPE_NAME_MIN_LENGTH} et ${EQUIPMENT_PROTOTYPE_NAME_MAX_LENGTH} caractères.`,
      )}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);
  if (authenticationError || !user) redirect("/connexion");

  const { error } = await supabase.rpc("start_current_team_equipment_rnd", {
    p_equipment_item_id: equipmentItemId,
    p_engineer_contract_id: engineerContractId,
    p_prototype_name: prototypeName,
  });
  if (error) {
    redirect(
      `/jeu/materiel/laboratoire?erreur=${encodeURIComponent(error.message.slice(0, 300))}`,
    );
  }

  revalidatePath("/jeu/materiel");
  revalidatePath("/jeu/materiel/equiper");
  revalidatePath("/jeu/materiel/laboratoire");
  redirect("/jeu/materiel/laboratoire?recherche=lancee");
}
