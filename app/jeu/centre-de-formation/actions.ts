"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  isYouthTrainingDomain,
  isYouthTrainingMode,
} from "@/lib/game/youth-training";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CENTER_PATH = "/jeu/centre-de-formation";

export async function startYouthScoutingAction(formData: FormData) {
  const scoutContractId = readValue(formData, "scoutContractId");
  const countryId = readValue(formData, "countryId");
  const durationDays = Number(readValue(formData, "durationDays"));
  if (!isUuid(scoutContractId) || !isUuid(countryId) || !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 7) {
    redirectWithMessage("scouting", "erreur", "Le pays, le scout ou la durée de mission est invalide.");
  }
  const supabase = await authenticatedClient();
  const result = await supabase.rpc("start_current_team_youth_scouting", {
    p_scout_contract_id: scoutContractId,
    p_country_id: countryId,
    p_duration_days: durationDays,
  });
  if (result.error) redirectWithMessage("scouting", "erreur", result.error.message);
  revalidateCenter();
  redirectWithMessage("scouting", "succes", "Le scout est en route. Son rapport sera disponible à la fin de la mission.");
}

export async function markYouthScoutingReportViewedAction(formData: FormData) {
  const missionId = readValue(formData, "missionId");
  if (!isUuid(missionId)) redirectWithMessage("scouting", "erreur", "Le rapport transmis est invalide.");
  const supabase = await authenticatedClient();
  const result = await supabase.rpc("mark_current_team_scouting_report_viewed", { p_mission_id: missionId });
  if (result.error) redirectWithMessage("scouting", "erreur", result.error.message);
  revalidateCenter();
  redirectWithMessage("scouting", "succes", "Le rapport a été marqué comme consulté.");
}

export async function signYouthCandidateAction(formData: FormData) {
  const candidateId = readValue(formData, "candidateId");
  if (!isUuid(candidateId)) redirectWithMessage("scouting", "erreur", "Le jeune transmis est invalide.");
  const supabase = await authenticatedClient();
  const result = await supabase.rpc("sign_current_team_youth_candidate", { p_candidate_id: candidateId });
  if (result.error) redirectWithMessage("scouting", "erreur", result.error.message);
  revalidateCenter();
  redirectWithMessage("ecole", "succes", "Le jeune rejoint votre école de cyclisme.");
}

export async function saveYouthTrainingSettingsAction(formData: FormData) {
  const academyRiderId = readValue(formData, "academyRiderId");
  const trainingPriority = readValue(formData, "trainingPriority");
  const trainingMode = readValue(formData, "trainingMode");
  if (
    !isUuid(academyRiderId) ||
    !isYouthTrainingDomain(trainingPriority) ||
    !isYouthTrainingMode(trainingMode)
  ) {
    redirectWithMessage(
      "ecole",
      "erreur",
      "La programmation d’entraînement junior est invalide.",
    );
  }
  const supabase = await authenticatedClient();
  const result = await supabase.rpc(
    "save_current_youth_training_settings",
    {
      p_academy_rider_id: academyRiderId,
      p_training_priority: trainingPriority,
      p_training_mode: trainingMode,
    },
  );
  if (result.error) {
    redirectWithMessage("ecole", "erreur", result.error.message);
  }
  revalidateCenter();
  redirectWithMessage(
    "ecole",
    "succes",
    "La programmation d’entraînement a été mise à jour.",
  );
}

export async function startYouthManualTrainingAction(input: {
  academyRiderId: string;
}) {
  if (!isUuid(input.academyRiderId)) {
    return { ok: false as const, error: "Ce junior est invalide." };
  }

  const supabase = await authenticatedClient();
  const result = await supabase.rpc(
    "start_current_youth_training_attempt",
    { p_academy_rider_id: input.academyRiderId },
  );
  if (result.error) {
    return {
      ok: false as const,
      error: result.error.message.slice(0, 280),
    };
  }

  const attempt = result.data as {
    attemptId: string;
    gameType: "rhythm" | "reflex" | "speed";
    slot: "manual_am" | "manual_pm";
    durationSeconds: number;
    startedAt: string;
  } | null;
  if (!attempt || !isUuid(attempt.attemptId)) {
    return {
      ok: false as const,
      error: "La tentative ne peut pas être initialisée.",
    };
  }

  return { ok: true as const, attempt };
}

export async function completeYouthManualTrainingAction(input: {
  attemptId: string;
  score: number;
}) {
  if (
    !isUuid(input.attemptId) ||
    !Number.isInteger(input.score) ||
    input.score < 0 ||
    input.score > 1_000
  ) {
    return { ok: false as const, error: "Le score transmis est invalide." };
  }

  const supabase = await authenticatedClient();
  const result = await supabase.rpc(
    "complete_current_youth_training_attempt",
    {
      p_attempt_id: input.attemptId,
      p_score: input.score,
    },
  );
  if (result.error) {
    return {
      ok: false as const,
      error: result.error.message.slice(0, 280),
    };
  }

  revalidateCenter();
  const report = result.data as {
    score: number;
    slot: "manual_am" | "manual_pm";
    trainingPriority: string;
    ratingChanges: Record<string, number>;
  } | null;
  if (!report) {
    return {
      ok: false as const,
      error: "Le rapport de la séance est indisponible.",
    };
  }

  return { ok: true as const, report };
}

export async function recruitYouthRiderAction(formData: FormData) {
  const academyRiderId = readValue(formData, "academyRiderId");
  if (!isUuid(academyRiderId)) redirectWithMessage("ecole", "erreur", "Le jeune transmis est invalide.");
  const supabase = await authenticatedClient();
  const result = await supabase.rpc("recruit_current_youth_rider", { p_academy_rider_id: academyRiderId });
  if (result.error) redirectWithMessage("ecole", "erreur", result.error.message);
  revalidateCenter();
  redirectWithMessage("ecole", "succes", `Recrutement validé : arrivée dans l’équipe première en ${result.data}.`);
}

export async function naturalizeYouthRiderAction(formData: FormData) {
  const academyRiderId = readValue(formData, "academyRiderId");
  if (!isUuid(academyRiderId)) {
    redirectWithMessage(
      "ecole",
      "erreur",
      "Le junior transmis est invalide.",
    );
  }
  const supabase = await authenticatedClient();
  const result = await supabase.rpc("naturalize_current_team_youth_rider", {
    p_academy_rider_id: academyRiderId,
  });
  if (result.error) {
    redirectWithMessage("ecole", "erreur", result.error.message);
  }
  revalidateCenter();
  redirectWithMessage(
    "ecole",
    "succes",
    `Naturalisation validée : le junior représente désormais ${readCountryName(result.data)}.`,
  );
}
export async function markYouthNotificationsReadAction() {
  const supabase = await authenticatedClient();
  const result = await supabase.rpc("mark_current_youth_notifications_read");
  if (result.error) redirectWithMessage("ecole", "erreur", result.error.message);
  revalidateCenter();
  redirectWithMessage("ecole", "succes", "Les notifications ont été marquées comme lues.");
}

function readCountryName(data: unknown) {
  if (
    data &&
    typeof data === "object" &&
    "countryName" in data &&
    typeof data.countryName === "string"
  ) {
    return data.countryName.slice(0, 100);
  }
  return "le pays de l’équipe";
}
async function authenticatedClient() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/connexion");
  return supabase;
}

function revalidateCenter() {
  revalidatePath(CENTER_PATH);
  revalidatePath("/jeu");
  revalidatePath("/jeu/finances");
}

function redirectWithMessage(tab: "scouting" | "ecole", key: "succes" | "erreur", message: string): never {
  redirect(`${CENTER_PATH}?onglet=${tab}&${key}=${encodeURIComponent(message.slice(0, 280))}`);
}

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
