"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  FORM_CAMP_TYPES,
  MEDICAL_PROTOCOLS,
  NUTRITION_INTERVENTIONS,
  type FormCampType,
  type MedicalProtocolCode,
  type NutritionInterventionCode,
} from "@/lib/game/health-center";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function applyInjuryProtocolAction(formData: FormData) {
  const injuryId = readValue(formData, "injuryId");
  const protocolCode = readValue(formData, "protocolCode");

  if (!isUuid(injuryId) || !isMedicalProtocol(protocolCode)) {
    redirectWithError("blessures", "Le protocole médical demandé est invalide.");
  }

  const supabase = await requireAuthenticatedClient();
  const { error } = await supabase.rpc(
    "apply_current_team_injury_protocol",
    {
      p_injury_id: injuryId,
      p_protocol_code: protocolCode,
    }
  );

  if (error) redirectWithError("blessures", error.message);

  revalidateHealthPaths();
  redirect("/jeu/centre-de-soin?onglet=blessures&soin=confirme");
}

export async function bookFormCampAction(formData: FormData) {
  const riderId = readValue(formData, "riderId");
  const campType = readValue(formData, "campType");
  const durationDays = Number(readValue(formData, "durationDays"));

  if (
    !isUuid(riderId) ||
    !isFormCampType(campType) ||
    !Number.isInteger(durationDays) ||
    durationDays < 1 ||
    durationDays > 3
  ) {
    redirectWithError("forme", "La demande de stage est invalide.");
  }

  const supabase = await requireAuthenticatedClient();
  const { error } = await supabase.rpc("book_current_team_form_camp", {
    p_rider_id: riderId,
    p_camp_type: campType,
    p_duration_days: durationDays,
  });

  if (error) redirectWithError("forme", error.message);

  revalidateHealthPaths();
  redirect("/jeu/centre-de-soin?onglet=forme&stage=confirme");
}

export async function assignPhysiotherapistAction(formData: FormData) {
  const staffContractId = readValue(formData, "staffContractId");
  const riderIds = formData
    .getAll("riderIds")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim());

  if (
    !isUuid(staffContractId) ||
    riderIds.length > 50 ||
    riderIds.some((riderId) => !isUuid(riderId))
  ) {
    redirectWithError("kines", "L’affectation du kiné est invalide.");
  }

  const supabase = await requireAuthenticatedClient();
  const { error } = await supabase.rpc(
    "assign_current_team_physiotherapist",
    {
      p_staff_contract_id: staffContractId,
      p_rider_ids: riderIds,
    },
  );

  if (error) redirectWithError("kines", error.message);

  revalidateHealthPaths();
  revalidatePath("/jeu/staff");
  redirect("/jeu/centre-de-soin?onglet=kines&affectation=confirmee");
}

export async function applyNutritionInterventionAction(formData: FormData) {
  const riderId = readValue(formData, "riderId");
  const interventionCode = readValue(formData, "interventionCode");

  if (!isUuid(riderId) || !isNutritionIntervention(interventionCode)) {
    redirectWithError("nutrition", "L’intervention nutritionnelle est invalide.");
  }

  const supabase = await requireAuthenticatedClient();
  const { error } = await supabase.rpc(
    "apply_current_team_nutrition_intervention",
    {
      p_rider_id: riderId,
      p_intervention_code: interventionCode,
    },
  );

  if (error) redirectWithError("nutrition", error.message);

  revalidateHealthPaths();
  revalidatePath("/jeu/entrainement");
  redirect("/jeu/centre-de-soin?onglet=nutrition&nutrition=confirmee");
}

async function requireAuthenticatedClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/connexion");
  return supabase;
}

function revalidateHealthPaths() {
  revalidatePath("/jeu/centre-de-soin");
  revalidatePath("/jeu/effectif");
  revalidatePath("/jeu/calendrier");
  revalidatePath("/jeu/finances");
  revalidatePath("/jeu");
}

function redirectWithError(tab: string, message: string): never {
  redirect(
    `/jeu/centre-de-soin?onglet=${tab}&erreur=${encodeURIComponent(
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

function isMedicalProtocol(value: string): value is MedicalProtocolCode {
  return value in MEDICAL_PROTOCOLS;
}

function isFormCampType(value: string): value is FormCampType {
  return value in FORM_CAMP_TYPES;
}

function isNutritionIntervention(
  value: string,
): value is NutritionInterventionCode {
  return value in NUTRITION_INTERVENTIONS;
}
