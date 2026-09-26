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
import { getInteractiveActionErrorMessage } from "@/lib/game/interactive-action-errors";
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
  if (result.error) {
    redirectWithMessage(
      "scouting",
      "erreur",
      result.error.message.includes("après la fin de la saison")
        ? "Mission non lancée : la durée choisie dépasse le J28, dernier jour de la saison. Choisissez une durée plus courte."
        : result.error.message,
    );
  }
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
  const preserveFinalYearFilter = readFinalYearFilter(formData);
  if (!settings?.length) {
    redirectWithMessage(
      "ecole",
      "erreur",
      "Les modifications d’entraînement junior sont invalides.",
      preserveFinalYearFilter,
    );
  }

  const supabase = await authenticatedClient();
  const result = await supabase.rpc(
    "save_current_youth_training_settings_bulk",
    { p_changes: settings },
  );
  if (result.error) {
    redirectWithMessage(
      "ecole",
      "erreur",
      getInteractiveActionErrorMessage(result.error.message),
      preserveFinalYearFilter,
    );
  }

  const savedCount = Number(result.data ?? settings.length);
  const safeCount = Number.isInteger(savedCount) ? savedCount : settings.length;
  revalidateCenter();
  redirectWithMessage(
    "ecole",
    "succes",
    `${safeCount} programmation${safeCount > 1 ? "s" : ""} enregistrée${safeCount > 1 ? "s" : ""} pour les prochaines séances.`,
    preserveFinalYearFilter,
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
  const preserveFinalYearFilter = readFinalYearFilter(formData);
  if (!isUuid(academyRiderId)) {
    redirectWithMessage(
      "ecole",
      "erreur",
      "Le jeune transmis est invalide.",
      preserveFinalYearFilter,
    );
  }
  const supabase = await authenticatedClient();
  const result = await supabase.rpc("recruit_current_youth_rider", { p_academy_rider_id: academyRiderId });
  if (result.error) {
    redirectWithMessage(
      "ecole",
      "erreur",
      result.error.message,
      preserveFinalYearFilter,
    );
  }
  revalidateCenter();
  redirectWithMessage(
    "ecole",
    "succes",
    `Recrutement validé : arrivée dans l’équipe première en ${result.data}.`,
    preserveFinalYearFilter,
  );
}

export async function dismissYouthRiderAction(formData: FormData) {
  const academyRiderId = readValue(formData, "academyRiderId");
  const preserveFinalYearFilter = readFinalYearFilter(formData);
  if (!isUuid(academyRiderId)) {
    redirectWithMessage(
      "ecole",
      "erreur",
      "Le junior transmis est invalide.",
      preserveFinalYearFilter,
    );
  }

  const supabase = await authenticatedClient();
  const result = await supabase.rpc("dismiss_current_team_youth_rider", {
    p_academy_rider_id: academyRiderId,
  });
  if (result.error) {
    redirectWithMessage(
      "ecole",
      "erreur",
      result.error.message,
      preserveFinalYearFilter,
    );
  }

  const release = readYouthDismissalResult(result.data);
  revalidateCenter();
  revalidatePath(
    "/jeu/centre-de-formation/development/[academyRiderId]",
    "page",
  );
  redirectWithMessage(
    "ecole",
    "succes",
    `${release.riderName} reste dans l’école sans nouveaux frais ni entraînement et rejoindra les agents libres au passage en saison ${release.releaseGameYear}.`,
    preserveFinalYearFilter,
  );
}

export async function dismissYouthRidersBulkAction(formData: FormData) {
  const academyRiderIds = readYouthDismissalIds(formData);
  const preserveFinalYearFilter = readFinalYearFilter(formData);
  if (!academyRiderIds?.length) {
    redirectWithMessage(
      "ecole",
      "erreur",
      "La sélection de juniors à libérer est invalide.",
      preserveFinalYearFilter,
    );
  }

  const supabase = await authenticatedClient();
  const result = await supabase.rpc(
    "dismiss_current_team_youth_riders_bulk",
    { p_academy_rider_ids: academyRiderIds },
  );
  if (result.error) {
    redirectWithMessage(
      "ecole",
      "erreur",
      result.error.message,
      preserveFinalYearFilter,
    );
  }

  const dismissedCount = readDismissedYouthCount(
    result.data,
    academyRiderIds.length,
  );
  revalidateCenter();
  revalidatePath(
    "/jeu/centre-de-formation/development/[academyRiderId]",
    "page",
  );
  redirectWithMessage(
    "ecole",
    "succes",
    `${dismissedCount} départ${dismissedCount > 1 ? "s" : ""} programmé${dismissedCount > 1 ? "s" : ""} pour la fin de saison. Les juniors concernés restent visibles, sans nouveaux frais ni entraînement.`,
    preserveFinalYearFilter,
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
  const releaseGameYear =
    result && "releaseGameYear" in result
      ? Number(result.releaseGameYear)
      : Number.NaN;
  return {
    riderName,
    releaseGameYear: Number.isInteger(releaseGameYear)
      ? releaseGameYear
      : "suivante",
  };
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

function redirectWithMessage(
  tab: "scouting" | "ecole",
  key: "succes" | "erreur",
  message: string,
  preserveFinalYearFilter = false,
): never {
  const ageFilter = preserveFinalYearFilter ? "&age=18" : "";
  redirect(
    `${CENTER_PATH}?onglet=${tab}${ageFilter}&${key}=${encodeURIComponent(message.slice(0, 280))}`,
  );
}

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readFinalYearFilter(formData: FormData) {
  return readValue(formData, "age") === "18";
}

function readYouthDismissalIds(formData: FormData): string[] | null {
  const serialized = readValue(formData, "academyRiderIds");
  if (!serialized || serialized.length > 1_000) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 20) {
    return null;
  }

  const ids = parsed.map((value) =>
    typeof value === "string" ? value.trim() : "",
  );
  if (ids.some((value) => !isUuid(value)) || new Set(ids).size !== ids.length) {
    return null;
  }
  return ids;
}

function readDismissedYouthCount(data: unknown, fallback: number) {
  const value =
    data && typeof data === "object" && "dismissedCount" in data
      ? Number(data.dismissedCount)
      : Number.NaN;
  return Number.isInteger(value) && value > 0 ? value : fallback;
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
