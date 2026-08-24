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
import { getHealthCenterErrorMessage } from "@/lib/game/health-center-errors";
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

  if (error) {
    redirectWithError("blessures", getHealthCenterErrorMessage(error.message));
  }

  revalidateHealthPaths();
  redirect("/jeu/centre-de-soin?onglet=blessures&soin=confirme");
}

export async function bookFormCampsAction(formData: FormData) {
  const riderIds = [
    ...new Set(
      formData
        .getAll("riderIds")
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim()),
    ),
  ];
  const campType = readValue(formData, "campType");
  const startDayNumber = Number(readValue(formData, "startDayNumber"));
  const endDayNumber = Number(readValue(formData, "endDayNumber"));
  const durationDays = endDayNumber - startDayNumber + 1;

  if (
    riderIds.length < 1 ||
    riderIds.length > 50 ||
    riderIds.some((riderId) => !isUuid(riderId)) ||
    !isFormCampType(campType) ||
    !Number.isInteger(startDayNumber) ||
    !Number.isInteger(endDayNumber) ||
    startDayNumber < 1 ||
    endDayNumber > 28 ||
    durationDays < 1 ||
    durationDays > 3
  ) {
    redirectWithError("forme", "La sélection de stages est invalide.");
  }

  const supabase = await requireAuthenticatedClient();
  const { error } = await supabase.rpc("book_current_team_form_camps", {
    p_rider_ids: riderIds,
    p_camp_type: campType,
    p_start_day_number: startDayNumber,
    p_end_day_number: endDayNumber,
  });

  if (error) {
    redirectWithError("forme", getHealthCenterErrorMessage(error.message));
  }

  revalidateHealthPaths();
  for (const riderId of riderIds) {
    revalidatePath(`/jeu/coureurs/${riderId}`);
  }
  redirect(
    `/jeu/centre-de-soin?onglet=forme&stage=confirme&nombre=${riderIds.length}`,
  );
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

  if (error) {
    redirectWithError("kines", getHealthCenterErrorMessage(error.message));
  }

  revalidateHealthPaths();
  revalidatePath("/jeu/staff");
  redirect("/jeu/centre-de-soin?onglet=kines&affectation=confirmee");
}

export async function assignPhysiotherapistMatrixAction(formData: FormData) {
  const rawAssignments = readValue(formData, "assignments");
  let payload: unknown;

  try {
    payload = JSON.parse(rawAssignments);
  } catch {
    redirectWithError("kines", "Les affectations des kinés sont invalides.");
  }

  if (!Array.isArray(payload) || payload.length > 50) {
    redirectWithError("kines", "Les affectations des kinés sont invalides.");
  }

  const assignments = payload.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      redirectWithError("kines", "Une affectation de kiné est invalide.");
    }

    const candidate = entry as Record<string, unknown>;
    const riderId = candidate.riderId;
    const staffContractId = candidate.staffContractId;

    if (
      typeof riderId !== "string" ||
      !isUuid(riderId) ||
      typeof staffContractId !== "string" ||
      !isUuid(staffContractId)
    ) {
      redirectWithError("kines", "Une affectation de kiné est invalide.");
    }

    return {
      rider_id: riderId,
      staff_contract_id: staffContractId,
    };
  });

  if (
    new Set(assignments.map((assignment) => assignment.rider_id)).size !==
    assignments.length
  ) {
    redirectWithError(
      "kines",
      "Un coureur ne peut être suivi que par un seul kiné.",
    );
  }

  const supabase = await requireAuthenticatedClient();
  const { error } = await supabase.rpc(
    "assign_current_team_physiotherapist_matrix",
    { p_assignments: assignments },
  );

  if (error) {
    redirectWithError("kines", getHealthCenterErrorMessage(error.message));
  }

  revalidateHealthPaths();
  revalidatePath("/jeu/staff");
  redirect("/jeu/centre-de-soin?onglet=kines&affectation=confirmee");
}

export async function applyNutritionInterventionsAction(formData: FormData) {
  const rawInterventions = readValue(formData, "interventions");
  let payload: unknown;

  try {
    payload = JSON.parse(rawInterventions);
  } catch {
    redirectWithError("nutrition", "Les compléments sélectionnés sont invalides.");
  }

  if (!Array.isArray(payload) || payload.length < 1 || payload.length > 35) {
    redirectWithError(
      "nutrition",
      "Sélectionnez entre 1 et 35 compléments à appliquer.",
    );
  }

  const interventions = payload.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      redirectWithError(
        "nutrition",
        "Une intervention nutritionnelle est invalide.",
      );
    }

    const candidate = entry as Record<string, unknown>;
    const riderId = candidate.riderId;
    const nutritionistContractId = candidate.nutritionistContractId;
    const interventionCode = candidate.interventionCode;

    if (
      typeof riderId !== "string" ||
      !isUuid(riderId) ||
      typeof nutritionistContractId !== "string" ||
      !isUuid(nutritionistContractId) ||
      typeof interventionCode !== "string" ||
      !isNutritionIntervention(interventionCode)
    ) {
      redirectWithError(
        "nutrition",
        "Une intervention nutritionnelle est invalide.",
      );
    }

    return { riderId, nutritionistContractId, interventionCode };
  });

  if (
    new Set(interventions.map((intervention) => intervention.riderId)).size !==
    interventions.length
  ) {
    redirectWithError(
      "nutrition",
      "Un coureur ne peut recevoir qu’un complément par jour.",
    );
  }

  const supabase = await requireAuthenticatedClient();
  const { error } = await supabase.rpc(
    "apply_current_team_nutrition_interventions",
    {
      p_interventions: interventions,
    },
  );

  if (error) {
    redirectWithError("nutrition", getHealthCenterErrorMessage(error.message));
  }

  revalidateHealthPaths();
  revalidatePath("/jeu/entrainement");
  redirect(
    `/jeu/centre-de-soin?onglet=nutrition&nutrition=confirmee&nombre=${interventions.length}`,
  );
}

export async function applyNutritionInterventionAction(formData: FormData) {
  const riderId = readValue(formData, "riderId");
  const nutritionistContractId = readValue(
    formData,
    "nutritionistContractId",
  );
  const interventionCode = readValue(formData, "interventionCode");

  if (
    !isUuid(riderId) ||
    !isUuid(nutritionistContractId) ||
    !isNutritionIntervention(interventionCode)
  ) {
    redirectWithError("nutrition", "L’intervention nutritionnelle est invalide.");
  }

  const supabase = await requireAuthenticatedClient();
  const { error } = await supabase.rpc(
    "apply_current_team_nutrition_intervention",
    {
      p_rider_id: riderId,
      p_nutritionist_contract_id: nutritionistContractId,
      p_intervention_code: interventionCode,
    },
  );

  if (error) {
    redirectWithError("nutrition", getHealthCenterErrorMessage(error.message));
  }

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
