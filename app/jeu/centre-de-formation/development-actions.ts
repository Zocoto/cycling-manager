"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  hasDistinctJerseyColors,
  isAmateurJerseyPattern,
  normalizeHexColor,
  type AmateurJerseyConfig,
} from "@/lib/amateur-team";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CENTER_PATH = "/jeu/centre-de-formation";

export async function createDevelopmentTeamAction(formData: FormData) {
  const riderIds = readRiderIds(formData);
  const jersey = readJersey(formData);
  if (!riderIds || riderIds.length < 1 || riderIds.length > 11) {
    redirectWithMessage(
      "effectif",
      "erreur",
      "Sélectionnez entre 1 et 11 juniors pour constituer l’équipe.",
    );
  }
  if (!jersey) {
    redirectWithMessage("effectif", "erreur", "Le maillot choisi est invalide.");
  }

  const supabase = await authenticatedClient();
  const result = await supabase.rpc("create_current_development_team", {
    p_academy_rider_ids: riderIds,
    p_jersey_pattern: jersey.pattern,
    p_jersey_primary_color: jersey.primaryColor,
    p_jersey_secondary_color: jersey.secondaryColor,
    p_jersey_accent_color: jersey.accentColor,
  });
  if (result.error) {
    redirectWithMessage("effectif", "erreur", result.error.message);
  }

  revalidateDevelopmentTeam();
  const payload = result.data as { displayName?: string; rosterCount?: number } | null;
  redirectWithMessage(
    "effectif",
    "succes",
    `${payload?.displayName ?? "L’équipe de développement"} est créée avec ${payload?.rosterCount ?? riderIds.length} junior${(payload?.rosterCount ?? riderIds.length) > 1 ? "s" : ""}.`,
  );
}

export async function updateDevelopmentTeamRosterAction(formData: FormData) {
  const riderIds = readRiderIds(formData);
  if (!riderIds || riderIds.length < 1 || riderIds.length > 11) {
    redirectWithMessage(
      "effectif",
      "erreur",
      "Sélectionnez entre 1 et 11 juniors pour constituer l’équipe.",
    );
  }

  const supabase = await authenticatedClient();
  const result = await supabase.rpc("update_current_development_team_roster", {
    p_academy_rider_ids: riderIds,
  });
  if (result.error) {
    redirectWithMessage("effectif", "erreur", result.error.message);
  }

  revalidateDevelopmentTeam();
  const payload = result.data as {
    rosterCount?: number;
    withdrawnRegistrationCount?: number;
  } | null;
  const rosterCount = payload?.rosterCount ?? riderIds.length;
  const withdrawnCount = payload?.withdrawnRegistrationCount ?? 0;
  const registrationDetail = withdrawnCount
    ? ` ${withdrawnCount} inscription${withdrawnCount > 1 ? "s ont" : " a"} dû être retirée${withdrawnCount > 1 ? "s" : ""} et ${withdrawnCount > 1 ? "devront" : "devra"} être recomposée${withdrawnCount > 1 ? "s" : ""}.`
    : "";
  redirectWithMessage(
    "effectif",
    "succes",
    `L’effectif est enregistré avec ${rosterCount} junior${rosterCount > 1 ? "s" : ""}.${registrationDetail}`,
  );
}

export async function updateDevelopmentTeamJerseyAction(formData: FormData) {
  const jersey = readJersey(formData);
  if (!jersey) {
    redirectWithMessage("maillot", "erreur", "Le maillot choisi est invalide.");
  }

  const supabase = await authenticatedClient();
  const result = await supabase.rpc("update_current_development_team_jersey", {
    p_jersey_pattern: jersey.pattern,
    p_jersey_primary_color: jersey.primaryColor,
    p_jersey_secondary_color: jersey.secondaryColor,
    p_jersey_accent_color: jersey.accentColor,
  });
  if (result.error) {
    redirectWithMessage("maillot", "erreur", result.error.message);
  }

  revalidateDevelopmentTeam();
  redirectWithMessage("maillot", "succes", "Le maillot de l’équipe de développement est enregistré.");
}

export async function registerDevelopmentRacesAction(
  updates: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const invalidSelection = {
    ok: false,
    message: "La liste des inscriptions juniors est invalide.",
  } as const;
  if (!Array.isArray(updates) || updates.length < 1 || updates.length > 100) {
    return invalidSelection;
  }

  const selections: Array<{ raceEditionId: string; riderIds: string[] }> = [];
  const raceIds = new Set<string>();
  for (const update of updates) {
    if (
      !update ||
      typeof update !== "object" ||
      typeof update.raceEditionId !== "string" ||
      !isUuid(update.raceEditionId) ||
      !Array.isArray(update.riderIds) ||
      update.riderIds.length < 1 ||
      update.riderIds.length > 6 ||
      update.riderIds.some((id: unknown) => typeof id !== "string" || !isUuid(id))
    ) {
      return invalidSelection;
    }

    const raceEditionId = update.raceEditionId.toLowerCase();
    const riderIds = update.riderIds.map((id: string) => id.toLowerCase());
    if (raceIds.has(raceEditionId) || new Set(riderIds).size !== riderIds.length) {
      return invalidSelection;
    }
    raceIds.add(raceEditionId);
    selections.push({ raceEditionId, riderIds });
  }

  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("register_current_development_races", {
    p_updates: selections,
  });
  if (error) {
    return { ok: false, message: error.message.slice(0, 280) };
  }

  revalidateDevelopmentTeam();
  return { ok: true };
}

async function authenticatedClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/connexion");
  return supabase;
}

function readRiderIds(formData: FormData) {
  const values = formData
    .getAll("riderIds")
    .flatMap((value) => (typeof value === "string" ? [value.trim()] : []));
  if (!values.length || values.some((value) => !isUuid(value))) return null;
  const uniqueValues = [...new Set(values)];
  return uniqueValues.length === values.length ? uniqueValues : null;
}

function readJersey(formData: FormData): AmateurJerseyConfig | null {
  const pattern = readValue(formData, "jerseyPattern");
  const primaryColor = normalizeHexColor(readValue(formData, "primaryColor"));
  const secondaryColor = normalizeHexColor(readValue(formData, "secondaryColor"));
  const accentColor = normalizeHexColor(readValue(formData, "accentColor"));
  if (
    !isAmateurJerseyPattern(pattern) ||
    !primaryColor ||
    !secondaryColor ||
    !accentColor
  ) {
    return null;
  }
  const jersey = { pattern, primaryColor, secondaryColor, accentColor };
  return hasDistinctJerseyColors(jersey) ? jersey : null;
}

function revalidateDevelopmentTeam() {
  revalidatePath(CENTER_PATH);
  revalidatePath(`${CENTER_PATH}/development/[academyRiderId]`, "page");
  revalidatePath("/jeu/objectifs");
  revalidatePath("/jeu");
}

function redirectWithMessage(
  view: "effectif" | "calendrier" | "resultats" | "maillot",
  key: "succes" | "erreur",
  message: string,
): never {
  redirect(
    `${CENTER_PATH}?onglet=development&dev=${view}&${key}=${encodeURIComponent(message.slice(0, 280))}`,
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
