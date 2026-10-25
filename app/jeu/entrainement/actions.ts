"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isTrainingDomain } from "@/lib/game/training";
import { isPerformancePreparationType } from "@/lib/game/performance-preparation";
import { getInteractiveActionErrorMessage } from "@/lib/game/interactive-action-errors";
import { getRaceReconnaissanceErrorMessage } from "@/lib/game/race-reconnaissance";
import type { TrainingPlanDraft } from "@/lib/game/training-plan-drafts";
import type { TrainingPlansSaveState } from "@/lib/game/training-plan-save-state";
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
  if (error) redirectWithError(getInteractiveActionErrorMessage(error.message));

  revalidateTrainingPaths();
  redirect(
    `/jeu/entrainement?seuil=confirme&effet=${encodeURIComponent(formatTrainingEffect(Number(data)))}`,
  );
}

const trainingBatchResultSchema = z.object({
  effective_day: z.number().int().min(1).max(29),
  results: z.array(z.object({
    rider_id: z.string().uuid(),
    status: z.enum(["saved", "error"]),
    code: z.string().nullish(),
    message: z.string().nullish(),
    trainer_reset: z.boolean().optional(),
    trainer_contract_id: z.string().uuid().nullable().optional(),
  })).max(35),
});

export async function saveRiderTrainingPlansAction(
  _previous: TrainingPlansSaveState,
  formData: FormData,
): Promise<TrainingPlansSaveState> {
  const parsed = parseTrainingPlans(readValue(formData, "plans"));
  if ("error" in parsed) return trainingSaveFailure(parsed.error);
  const { plans } = parsed;
  if (!plans.length) return trainingSaveFailure(
    "Aucun programme valide à enregistrer. Corrigez les coureurs signalés ; vos réglages sont conservés.",
    parsed.failures,
  );
  const supabase = await requireAuthenticatedClient();
  let result;
  try {
    result = await supabase.rpc("save_current_rider_training_plans_v2", {
      p_plans: plans.map((plan) => ({
        rider_id: plan.riderId,
        intensity: plan.intensity,
        domain: plan.domain,
        trainer_contract_id: plan.trainerContractId,
      })),
    });
  } catch {
    return trainingSaveFailure("La réponse de sauvegarde n’a pas été reçue. Vos réglages sont conservés : réessayez pour confirmer l’enregistrement.", parsed.failures, plans);
  }
  if (result.error) return trainingSaveFailure(getInteractiveActionErrorMessage(result.error.message), parsed.failures, plans);
  const response = trainingBatchResultSchema.safeParse(result.data);
  const requestedById = new Map(plans.map((plan) => [plan.riderId, plan]));
  if (!response.success || response.data.results.length !== plans.length ||
    new Set(response.data.results.map((row) => row.rider_id)).size !== plans.length ||
    response.data.results.some((row) => !requestedById.has(row.rider_id))) {
    return trainingSaveFailure("L’enregistrement n’a pas pu être confirmé. Vos réglages sont conservés : réessayez pour confirmer la sauvegarde.", parsed.failures, plans);
  }
  const savedPlans: TrainingPlanDraft[] = [];
  const failures = [...parsed.failures];
  for (const row of response.data.results) {
    const submitted = requestedById.get(row.rider_id)!;
    if (row.status === "saved") {
      savedPlans.push({ ...submitted, trainerContractId: row.trainer_reset ? null
        : row.trainer_contract_id === undefined ? submitted.trainerContractId : row.trainer_contract_id });
    } else {
      failures.push({ riderId: row.rider_id, code: row.code ?? undefined,
        message: row.message?.slice(0, 300) || "Ce programme n’a pas pu être enregistré. Vérifiez ses réglages puis réessayez." });
    }
  }
  if (savedPlans.length) revalidateTrainingPaths();
  const count = savedPlans.length;
  return {
    status: count ? failures.length ? "partial" : "success" : "error",
    message: `${count} programme${count > 1 ? "s" : ""} enregistré${count > 1 ? "s" : ""}${count ? ` · effet ${formatTrainingEffect(response.data.effective_day)}` : ""}.${failures.length ? ` ${failures.length} programme${failures.length > 1 ? "s restent" : " reste"} à corriger ; les réglages sont conservés.` : ""}`,
    savedPlans, failures, effectiveDay: response.data.effective_day, submittedPlans: plans,
  };
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
  if (error) {
    redirectWithRecognitionError(getRaceReconnaissanceErrorMessage(error));
  }

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
    !isPerformancePreparationType(preparationType)
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

function parseTrainingPlans(rawPlans: string):
  { plans: TrainingPlanDraft[]; failures: TrainingPlansSaveState["failures"] } | { error: string } {
  let payload: unknown;
  try {
    payload = JSON.parse(rawPlans);
  } catch {
    return { error: "Les programmes d’entraînement sont invalides. Vos réglages sont conservés." };
  }

  if (!Array.isArray(payload) || payload.length === 0 || payload.length > 35) {
    return { error: "Sélectionnez entre 1 et 35 programmes à modifier." };
  }

  const plans: TrainingPlanDraft[] = [];
  const failures: TrainingPlansSaveState["failures"] = [];
  const ids = payload.map((entry) => entry && typeof entry === "object" && !Array.isArray(entry)
    && typeof entry.riderId === "string" ? entry.riderId.toLowerCase() : "");
  const duplicateIds = new Set(ids.filter((id, index) => id && ids.indexOf(id) !== index));
  const reportedDuplicates = new Set<string>();
  for (const [index, entry] of payload.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      failures.push({ riderId: "", code: "invalid_plan", message: `Le programme ${index + 1} est invalide.` });
      continue;
    }

    const candidate = entry as Record<string, unknown>;
    const riderId = typeof candidate.riderId === "string" ? candidate.riderId.toLowerCase() : candidate.riderId;
    const intensity = candidate.intensity;
    const domain = candidate.domain;
    const trainerContractId = typeof candidate.trainerContractId === "string" ? candidate.trainerContractId.toLowerCase() : candidate.trainerContractId;
    if (typeof riderId === "string" && duplicateIds.has(riderId)) {
      if (!reportedDuplicates.has(riderId)) failures.push({ riderId, code: "duplicate_rider", message: "Ce coureur apparaît plusieurs fois dans le lot. Aucun de ses doublons n’a été appliqué." });
      reportedDuplicates.add(riderId);
      continue;
    }

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
      failures.push({ riderId: typeof riderId === "string" && isUuid(riderId) ? riderId : "", code: "invalid_plan",
        message: "Programme invalide : vérifiez le domaine, l’intensité et l’entraîneur." });
      continue;
    }

    plans.push({
      riderId,
      intensity: Number(intensity),
      domain,
      trainerContractId,
    });
  }

  return { plans, failures };
}

function trainingSaveFailure(message: string, failures: TrainingPlansSaveState["failures"] = [], submittedPlans: TrainingPlanDraft[] = []): TrainingPlansSaveState {
  return { status: "error", message, savedPlans: [], failures, submittedPlans };
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
