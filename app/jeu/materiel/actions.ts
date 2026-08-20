"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  sanitizeInventoryReturnPath,
  withPageFeedback,
} from "@/lib/game/filtered-page-paths";
import {
  EQUIPMENT_SLOTS,
  type EquipmentSlot,
} from "@/lib/game/equipment";
import { parseEquipmentCartLines } from "@/lib/game/equipment-cart";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PurchaseEquipmentCartState = {
  status: "idle" | "success" | "error";
  message: string;
  receiptId: string | null;
};

export async function purchaseEquipmentCartAction(
  _previousState: PurchaseEquipmentCartState,
  formData: FormData,
): Promise<PurchaseEquipmentCartState> {
  const serializedLines = readValue(formData, "cartLines");
  let payload: unknown;

  try {
    payload = JSON.parse(serializedLines);
  } catch {
    return equipmentCartError("Le contenu du panier est invalide.");
  }

  const lines = parseEquipmentCartLines(payload);
  if (!lines) {
    return equipmentCartError(
      "Sélectionnez au moins un matériel avec une quantité valide.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  const { error } = await supabase.rpc(
    "purchase_current_team_equipment_cart",
    { p_items: lines },
  );

  if (error) return equipmentCartError(error.message);

  revalidatePath("/jeu/materiel");
  revalidatePath("/jeu/materiel/equiper");
  revalidatePath("/jeu/finances");
  revalidatePath("/jeu");

  const purchasedQuantity = lines.reduce(
    (total, line) => total + line.quantity,
    0,
  );

  return {
    status: "success",
    message: `${purchasedQuantity} pièce${purchasedQuantity > 1 ? "s" : ""} ajoutée${purchasedQuantity > 1 ? "s" : ""} à l’inventaire.`,
    receiptId: crypto.randomUUID(),
  };
}

function equipmentCartError(message: string): PurchaseEquipmentCartState {
  return {
    status: "error",
    message: message.slice(0, 300),
    receiptId: crypto.randomUUID(),
  };
}

export async function saveTeamEquipmentAssignmentsAction(formData: FormData) {
  const rawAssignments = readValue(formData, "assignments");
  let payload: unknown;

  try {
    payload = JSON.parse(rawAssignments);
  } catch {
    redirectWithError(
      "/jeu/materiel/equiper",
      "Les affectations de matériel sont invalides.",
    );
  }

  if (!Array.isArray(payload) || payload.length < 1 || payload.length > 280) {
    redirectWithError(
      "/jeu/materiel/equiper",
      "Sélectionnez entre 1 et 280 emplacements à modifier.",
    );
  }

  const assignments = payload.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      redirectWithError(
        "/jeu/materiel/equiper",
        "Une affectation de matériel est invalide.",
      );
    }

    const candidate = entry as Record<string, unknown>;
    const riderId = candidate.riderId;
    const slot = candidate.slot;
    const equipmentItemId = candidate.equipmentItemId;

    if (
      typeof riderId !== "string" ||
      !isUuid(riderId) ||
      typeof slot !== "string" ||
      !isEquipmentSlot(slot) ||
      (equipmentItemId !== null &&
        (typeof equipmentItemId !== "string" ||
          !isUuid(equipmentItemId)))
    ) {
      redirectWithError(
        "/jeu/materiel/equiper",
        "Une affectation de matériel est invalide.",
      );
    }

    return { riderId, slot, equipmentItemId };
  });
  const assignmentKeys = assignments.map(
    (assignment) => `${assignment.riderId}:${assignment.slot}`,
  );

  if (new Set(assignmentKeys).size !== assignmentKeys.length) {
    redirectWithError(
      "/jeu/materiel/equiper",
      "Un emplacement ne peut être modifié qu’une seule fois.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) redirect("/connexion");

  const { error } = await supabase.rpc(
    "save_current_team_equipment_assignments",
    { p_assignments: assignments },
  );

  if (error) redirectWithError("/jeu/materiel/equiper", error.message);

  for (const riderId of new Set(
    assignments.map((assignment) => assignment.riderId),
  )) {
    revalidatePath(`/jeu/coureurs/${riderId}`);
  }
  revalidatePath("/jeu/inventaire");
  revalidatePath("/jeu/materiel");
  revalidatePath("/jeu/materiel/equiper");
  redirect(
    `/jeu/materiel/equiper?affectations=confirmees&nombre=${assignments.length}`,
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
