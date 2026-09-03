"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isTrainingDomain } from "@/lib/game/training";
import type { TrainingPlanDraft } from "@/lib/game/training-plan-drafts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveTeamTrainingSettingsAction(formData: FormData) {
  const minimumForm = Number(readValue(formData, "minimumForm"));
  if (!Number.isInteger(minimumForm) || minimumForm < 0 || minimumForm > 100) {
    redirectWithError("La forme minimale doit être comprise entre 0 et 100.");
  }

  const supabase = await requireAuthenticatedClient();
  const { data, error } = await supabase.rpc(
    "save_current_team_training_settings",
    { p_minimum_form: minimumForm },
  );
  if (error) redirectWithError(error.message);

  revalidateTrainingPaths();
  redirect(
    `/jeu/entrainement?seuil=confirme&effet=${encodeURIComponent(formatTrainingEffect(Number(data)))}`,
  );
}

export async function saveRiderTrainingPlansAction(formData: FormData) {
  const plans = parseTrainingPlans(readValue(formData, "plans"));
  const supabase = await requireAuthenticatedClient();
  const { data, error } = await supabase.rpc(
    "save_current_rider_training_plans",
    {
      p_plans: plans.map((plan) => ({
        rider_id: plan.riderId,
        intensity: plan.intensity,
        domain: plan.domain,
        trainer_contract_id: plan.trainerContractId,
      })),
    },
  );
  if (error) redirectWithError(error.message);

  revalidateTrainingPaths();
  redirect(
    `/jeu/entrainement?programme=confirme&nombre=${plans.length}&effet=${encodeURIComponent(formatTrainingEffect(Number(data)))}`,
  );
}

export async function bookRaceReconnaissanceAction(formData: FormData) {
  const stageId = readValue(formData, "stageId");
  const startDayNumber = Number(readValue(formData, "startDayNumber"));
  const preparerContractId = readValue(formData, "preparerContractId") || null;
  const riderIds = formData
    .getAll("riderIds")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  if (
    !isUuid(stageId) ||
    !Number.isInteger(startDayNumber) ||
    startDayNumber < 1 ||
    startDayNumber > 27 ||
    riderIds.length === 0 ||
    riderIds.some((riderId) => !isUuid(riderId)) ||
    (preparerContractId !== null && !isUuid(preparerContractId))
  ) {
    redirectWithRecognitionError(
      "Sélectionnez une période, une course et au moins un coureur disponible.",
    );
  }

  const supabase = await requireAuthenticatedClient();
  const { error } = await supabase.rpc(
    "book_current_team_stage_reconnaissance",
    {
      p_stage_id: stageId,
      p_rider_ids: [...new Set(riderIds)],
      p_start_day_number: startDayNumber,
      p_preparer_contract_id: preparerContractId,
    },
  );
  if (error) redirectWithRecognitionError(error.message);

  revalidateTrainingPaths();
  revalidatePath("/jeu/calendrier");
  revalidatePath("/jeu/inscriptions");
  revalidatePath("/jeu/finances");
  revalidatePath("/jeu/selections-internationales");
  revalidatePath("/jeu/boite-mail");
  redirect("/jeu/entrainement?onglet=reconnaissance&reconnaissance=confirmee");
}

export async function requestRaceReconnaissanceInterruptionAction(
  formData: FormData,
) {
  const reconnaissanceId = readValue(formData, "reconnaissanceId");
  if (!isUuid(reconnaissanceId)) {
    redirectWithRecognitionError(
      "La reconnaissance à interrompre est invalide.",
    );
  }

  const supabase = await requireAuthenticatedClient();
  const { data, error } = await supabase.rpc(
    "request_current_team_reconnaissance_interruption",
    { p_reconnaissance_id: reconnaissanceId },
  );
  if (error) redirectWithRecognitionError(error.message);

  const effectiveDayNumber = Number(data);
  revalidateTrainingPaths();
  revalidatePath("/jeu/calendrier");
  revalidatePath("/jeu/inscriptions");
  revalidatePath("/jeu/preparation-course");
  revalidatePath("/jeu/selections-internationales");
  revalidatePath("/jeu/boite-mail");
  redirect(
    `/jeu/entrainement?onglet=reconnaissance&interruption=confirmee&effet=${effectiveDayNumber}`,
  );
}

export async function startRiderPerformancePreparationAction(
  formData: FormData,
) {
  const riderId = readValue(formData, "riderId");
  const preparationType = readValue(formData, "preparationType");
  if (
    !isUuid(riderId) ||
    !["indoor_track", "wind_tunnel"].includes(preparationType)
  ) {
    redirect(
      `/jeu/entrainement?onglet=preparation&erreur=${encodeURIComponent("Sélection de préparation invalide.")}`,
    );
  }
  const supabase = await requireAuthenticatedClient();
  const { error } = await supabase.rpc(
    "start_current_team_rider_performance_preparation",
    {
      p_rider_id: riderId,
      p_preparation_type: preparationType,
    },
  );
  if (error) {
    redirect(
      `/jeu/entrainement?onglet=preparation&erreur=${encodeURIComponent(error.message.slice(0, 300))}`,
    );
  }
  revalidateTrainingPaths();
  revalidatePath("/jeu/calendrier");
  revalidatePath("/jeu/inscriptions");
  revalidatePath("/jeu/selections-internationales");
  revalidatePath("/jeu/boite-mail");
  redirect("/jeu/entrainement?onglet=preparation&preparation=confirmee");
}

function parseTrainingPlans(rawPlans: string): TrainingPlanDraft[] {
  let payload: unknown;
  try {
    payload = JSON.parse(rawPlans);
  } catch {
    redirectWithError("Les programmes d’entraînement sont invalides.");
  }

  if (!Array.isArray(payload) || payload.length === 0 || payload.length > 35) {
    redirectWithError("Sélectionnez entre 1 et 35 programmes à modifier.");
  }

  const plans = payload.map((entry): TrainingPlanDraft => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      redirectWithError("Les programmes d’entraînement sont invalides.");
    }

    const candidate = entry as Record<string, unknown>;
    const riderId = candidate.riderId;
    const intensity = candidate.intensity;
    const domain = candidate.domain;
    const trainerContractId = candidate.trainerContractId;

    if (
      typeof riderId !== "string" ||
      !isUuid(riderId) ||
      !Number.isInteger(intensity) ||
      Number(intensity) < 0 ||
      Number(intensity) > 100 ||
      typeof domain !== "string" ||
      !isTrainingDomain(domain) ||
      (trainerContractId !== null &&
        (typeof trainerContractId !== "string" || !isUuid(trainerContractId)))
    ) {
      redirectWithError("Un des programmes d’entraînement est invalide.");
    }

    return {
      riderId,
      intensity: Number(intensity),
      domain,
      trainerContractId,
    };
  });

  if (new Set(plans.map((plan) => plan.riderId)).size !== plans.length) {
    redirectWithError("Un coureur ne peut être modifié qu’une seule fois.");
  }

  return plans;
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

function revalidateTrainingPaths() {
  revalidatePath("/jeu/entrainement");
  revalidatePath("/jeu/effectif");
  revalidatePath("/jeu");
}

function formatTrainingEffect(effectiveDayNumber: number) {
  return effectiveDayNumber === 29
    ? "\u00e0 la prochaine s\u00e9ance (demain \u00e0 8 h)"
    : `J${effectiveDayNumber}`;
}

function redirectWithError(message: string): never {
  redirect(
    `/jeu/entrainement?erreur=${encodeURIComponent(message.slice(0, 300))}`,
  );
}

function redirectWithRecognitionError(message: string): never {
  redirect(
    `/jeu/entrainement?onglet=reconnaissance&erreur=${encodeURIComponent(
      message.slice(0, 300),
    )}`,
  );
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
