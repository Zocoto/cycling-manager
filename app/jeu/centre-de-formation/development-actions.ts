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
    `${payload?.displayName ?? "La Development Team"} est créée avec ${payload?.rosterCount ?? riderIds.length} junior${(payload?.rosterCount ?? riderIds.length) > 1 ? "s" : ""}.`,
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
  redirectWithMessage("maillot", "succes", "Le maillot de la Development Team est enregistré.");
}

export async function registerDevelopmentRaceAction(formData: FormData) {
  const raceEditionId = readValue(formData, "raceEditionId");
  const riderIds = readRiderIds(formData);
  if (!isUuid(raceEditionId) || !riderIds?.length || riderIds.length > 6) {
    redirectWithMessage(
      "calendrier",
      "erreur",
      "La course ou la sélection transmise est invalide.",
    );
  }

  const supabase = await authenticatedClient();
  const result = await supabase.rpc("register_current_development_race", {
    p_race_edition_id: raceEditionId,
    p_academy_rider_ids: riderIds,
  });
  if (result.error) {
    redirectWithMessage("calendrier", "erreur", result.error.message);
  }

  revalidateDevelopmentTeam();
  const payload = result.data as { raceName?: string; riderCount?: number } | null;
  redirectWithMessage(
    "calendrier",
    "succes",
    `${payload?.riderCount ?? riderIds.length} junior${(payload?.riderCount ?? riderIds.length) > 1 ? "s" : ""} engagé${(payload?.riderCount ?? riderIds.length) > 1 ? "s" : ""} sur ${payload?.raceName ?? "l’épreuve"}.`,
  );
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
