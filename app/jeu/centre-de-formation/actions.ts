"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  isYouthTrainingDomain,
  isYouthTrainingMode,
  type YouthTrainingGameType,
} from "@/lib/game/youth-training";
import type { YouthTrainingSettingsValue } from "@/lib/game/youth-training-bulk";
import { isValidYouthScoutingDuration } from "@/lib/game/youth-scouting-duration";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CENTER_PATH = "/jeu/centre-de-formation";

export async function startYouthScoutingAction(formData: FormData) {
  const scoutContractId = readValue(formData, "scoutContractId");
  const countryId = readValue(formData, "countryId");
  const durationDays = Number(readValue(formData, "durationDays"));
  if (!isUuid(scoutContractId) || !isUuid(countryId)) {
    redirectWithMessage(
      "scouting",
      "erreur",
      "Le pays ou le scout sélectionné est invalide.",
    );
  }
  if (!isValidYouthScoutingDuration(durationDays)) {
    redirectWithMessage(
      "scouting",
      "erreur",
      "La durée du scouting doit être comprise entre 3 et 7 jours.",
    );
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
  redirectWithMessage("scouting", "succes", "Le jeune rejoint votre école de cyclisme.");
}

export async function saveYouthTrainingSettingsBulkAction(formData: FormData) {
  const settings = readYouthTrainingSettings(formData);
  if (!settings?.length) {
    redirectWithMessage(
      "ecole",
      "erreur",
      "Les modifications d’entraînement junior sont invalides.",
    );
  }

  const supabase = await authenticatedClient();
  const result = await supabase.rpc(
    "save_current_youth_training_settings_bulk",
    { p_changes: settings },
  );
  if (result.error) {
    redirectWithMessage("ecole", "erreur", result.error.message);
  }

  const savedCount = Number(result.data ?? settings.length);
  const safeCount = Number.isInteger(savedCount) ? savedCount : settings.length;
  revalidateCenter();
  redirectWithMessage(
    "ecole",
    "succes",
    `${safeCount} programmation${safeCount > 1 ? "s" : ""} enregistrée${safeCount > 1 ? "s" : ""} pour les prochaines séances.`,
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
    gameType: YouthTrainingGameType;
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

export async function dismissYouthRiderAction(formData: FormData) {
  const academyRiderId = readValue(formData, "academyRiderId");
  if (!isUuid(academyRiderId)) {
    redirectWithMessage(
      "ecole",
      "erreur",
      "Le junior transmis est invalide.",
    );
  }

  const supabase = await authenticatedClient();
  const result = await supabase.rpc("dismiss_current_team_youth_rider", {
    p_academy_rider_id: academyRiderId,
  });
  if (result.error) {
    redirectWithMessage("ecole", "erreur", result.error.message);
  }

  const release = readYouthDismissalResult(result.data);
  revalidateCenter();
  revalidatePath("/jeu/transferts");
  revalidatePath(
    "/jeu/centre-de-formation/development/[academyRiderId]",
    "page",
  );
  redirectWithMessage(
    "ecole",
    "succes",
    release.mutualAgreement
      ? release.freeAgent
        ? `${release.riderName} a quitté l’école à l’amiable, sans frais, et rejoint les agents libres.`
        : `${release.riderName} a quitté l’école à l’amiable, sans frais. Comme il a moins de 16 ans, il ne rejoint pas les agents libres.`
      : release.freeAgent
      ? `${release.riderName} a quitté l’école et rejoint les agents libres. ${formatMoney(release.tuitionCost, release.currency)} ont été débités immédiatement.`
      : `${release.riderName} a quitté l’école. Comme il a moins de 16 ans, il ne rejoint pas les agents libres. ${formatMoney(release.tuitionCost, release.currency)} ont été débités immédiatement.`,
  );
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

function readYouthDismissalResult(data: unknown) {
  const result = data && typeof data === "object" ? data : null;
  const riderName =
    result &&
    "riderName" in result &&
    typeof result.riderName === "string"
      ? result.riderName.slice(0, 120)
      : "Le junior";
  const tuitionCost =
    result && "tuitionCost" in result
      ? Number(result.tuitionCost)
      : 0;
  const currency =
    result && "currency" in result && typeof result.currency === "string"
      ? result.currency.slice(0, 3).toUpperCase()
      : "EUR";
  const freeAgent = Boolean(
    result && "freeAgent" in result && result.freeAgent,
  );
  const mutualAgreement = Boolean(
    result && "mutualAgreement" in result && result.mutualAgreement,
  );
  return {
    riderName,
    tuitionCost: Number.isFinite(tuitionCost) ? tuitionCost : 0,
    currency,
    freeAgent,
    mutualAgreement,
  };
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
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

function readYouthTrainingSettings(
  formData: FormData,
): YouthTrainingSettingsValue[] | null {
  const serialized = readValue(formData, "settings");
  if (!serialized || serialized.length > 20_000) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 100) {
    return null;
  }

  const seenRiderIds = new Set<string>();
  const settings: YouthTrainingSettingsValue[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") return null;

    const academyRiderId =
      "academyRiderId" in entry && typeof entry.academyRiderId === "string"
        ? entry.academyRiderId.trim()
        : "";
    const trainingPriority =
      "trainingPriority" in entry && typeof entry.trainingPriority === "string"
        ? entry.trainingPriority.trim()
        : "";
    const trainingMode =
      "trainingMode" in entry && typeof entry.trainingMode === "string"
        ? entry.trainingMode.trim()
        : "";

    if (
      !isUuid(academyRiderId) ||
      seenRiderIds.has(academyRiderId) ||
      !isYouthTrainingDomain(trainingPriority) ||
      !isYouthTrainingMode(trainingMode)
    ) {
      return null;
    }

    seenRiderIds.add(academyRiderId);
    settings.push({ academyRiderId, trainingPriority, trainingMode });
  }

  return settings;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
