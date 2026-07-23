"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isTrainingDomain } from "@/lib/game/training";
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
  redirect(`/jeu/entrainement?seuil=confirme&effet=J${Number(data)}`);
}

export async function saveRiderTrainingPlanAction(formData: FormData) {
  const riderId = readValue(formData, "riderId");
  const intensity = Number(readValue(formData, "intensity"));
  const domain = readValue(formData, "domain");
  const trainerContractId = readValue(formData, "trainerContractId") || null;

  if (
    !isUuid(riderId) ||
    !Number.isInteger(intensity) ||
    intensity < 0 ||
    intensity > 100 ||
    !isTrainingDomain(domain) ||
    (trainerContractId !== null && !isUuid(trainerContractId))
  ) {
    redirectWithError("Le programme d’entraînement est invalide.");
  }

  const supabase = await requireAuthenticatedClient();
  const { data, error } = await supabase.rpc(
    "save_current_rider_training_plan",
    {
      p_rider_id: riderId,
      p_intensity: intensity,
      p_domain: domain,
      p_trainer_contract_id: trainerContractId,
    },
  );
  if (error) redirectWithError(error.message);

  revalidateTrainingPaths();
  redirect(`/jeu/entrainement?programme=confirme&effet=J${Number(data)}`);
}

export async function bookRaceReconnaissanceAction(formData: FormData) {
  const stageId = readValue(formData, "stageId");
  const startDayNumber = Number(readValue(formData, "startDayNumber"));
  const preparerContractId =
    readValue(formData, "preparerContractId") || null;
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
  redirect(
    "/jeu/entrainement?onglet=reconnaissance&reconnaissance=confirmee",
  );
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

function redirectWithError(message: string): never {
  redirect(`/jeu/entrainement?erreur=${encodeURIComponent(message.slice(0, 300))}`);
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
