"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FederationSelectionActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialFederationSelectionActionState: FederationSelectionActionState = {
  status: "idle",
  message: "",
};

const countryCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/);
const slotKeySchema = z.string().trim().regex(/^[a-z0-9-]{3,60}$/);
const memberIdSchema = z.string().uuid();
const riderIdsSchema = z.array(z.string().uuid()).max(12);

export async function setFederationAutomaticSelectionAction(formData: FormData) {
  const countryCode = countryCodeSchema.safeParse(formData.get("countryCode"));
  if (!countryCode.success) return;

  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc("set_national_federation_selection_mode", {
    p_country_code: countryCode.data,
    p_automatic_selection: formData.get("automatic") === "on",
  });
  if (result.error) {
    console.error(
      "Échec de modification du mode de sélection fédéral :",
      result.error.message,
    );
    return;
  }

  revalidateFederation(countryCode.data);
}

export async function saveFederationPreselectionAction(
  _previousState: FederationSelectionActionState,
  formData: FormData,
): Promise<FederationSelectionActionState> {
  const countryCode = countryCodeSchema.safeParse(formData.get("countryCode"));
  const slotKey = slotKeySchema.safeParse(formData.get("slotKey"));
  const rawRiderIds = formData.get("riderIds");
  let parsedRiderIds: unknown = [];
  try {
    parsedRiderIds = JSON.parse(typeof rawRiderIds === "string" ? rawRiderIds : "[]");
  } catch {
    return { status: "error", message: "La liste de coureurs est invalide." };
  }
  const riderIds = riderIdsSchema.safeParse(parsedRiderIds);
  if (!countryCode.success || !slotKey.success || !riderIds.success) {
    return { status: "error", message: "La présélection est invalide." };
  }

  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc("save_national_federation_preselection", {
    p_country_code: countryCode.data,
    p_slot_key: slotKey.data,
    p_rider_ids: riderIds.data,
  });
  if (result.error) return actionError(result.error.message);

  revalidateFederation(countryCode.data);
  return { status: "success", message: "Présélection enregistrée." };
}

export async function publishFederationPreselectionAction(
  _previousState: FederationSelectionActionState,
  formData: FormData,
): Promise<FederationSelectionActionState> {
  const countryCode = countryCodeSchema.safeParse(formData.get("countryCode"));
  const slotKey = slotKeySchema.safeParse(formData.get("slotKey"));
  if (!countryCode.success || !slotKey.success) {
    return { status: "error", message: "Cette présélection est invalide." };
  }

  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc("publish_national_federation_preselection", {
    p_country_code: countryCode.data,
    p_slot_key: slotKey.data,
  });
  if (result.error) return actionError(result.error.message);

  await syncFederationChampionshipStartlists();

  revalidateFederation(countryCode.data);
  return {
    status: "success",
    message: `${Number(result.data ?? 0)} DS notifié(s).`,
  };
}

export async function respondFederationPreselectionAction(formData: FormData) {
  const memberId = memberIdSchema.safeParse(formData.get("memberId"));
  const decision = z.enum(["confirm", "decline"]).safeParse(formData.get("decision"));
  if (!memberId.success || !decision.success) return;

  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc(
    "respond_to_national_federation_preselection",
    {
      p_member_id: memberId.data,
      p_accept: decision.data === "confirm",
    },
  );
  if (result.error) {
    console.error("Échec de réponse à la présélection fédérale :", result.error.message);
    return;
  }
  await syncFederationChampionshipStartlists();
  revalidatePath("/jeu/federations/be");
  revalidatePath("/jeu");
}

async function syncFederationChampionshipStartlists() {
  const admin = createSupabaseAdminClient();
  const result = await admin.rpc(
    "sync_due_national_federation_championship_lineups",
    { p_now: new Date().toISOString(), p_force: true },
  );
  if (result.error) {
    console.error(
      "Échec de synchronisation de la startlist fédérale :",
      result.error.message,
    );
  }
  revalidatePath("/jeu/calendrier");
  revalidatePath("/jeu/courses/[slug]", "page");
}

function revalidateFederation(countryCode: string) {
  revalidatePath(`/jeu/federations/${countryCode.toLowerCase()}`);
  revalidatePath("/jeu");
}

function actionError(message: string): FederationSelectionActionState {
  console.error("Échec de présélection fédérale :", message);
  return { status: "error", message: message || "L’opération a échoué." };
}
