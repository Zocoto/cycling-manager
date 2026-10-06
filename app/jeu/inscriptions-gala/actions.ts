"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  PCM_GALA_ROSTER_SIZE,
  isPcmGalaRaceKey,
} from "@/lib/game/pcm-gala-races";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SEASON_FINALE_GALA_EVENT_KEY, SEASON_FINALE_GALA_ROUTE } from "@/lib/game/season-finale-gala";

const GALA_ROUTE = "/jeu/inscriptions-gala";

export async function savePcmGalaRegistrationAction(
  formData: FormData,
): Promise<never> {
  return saveRegistration(formData, GALA_ROUTE);
}

export async function saveSeasonFinaleGalaRegistrationAction(formData: FormData): Promise<never> {
  if (formData.get("eventKey") !== SEASON_FINALE_GALA_EVENT_KEY) {
    redirectWithMessage("erreur", "Seul le profil vallonné est ouvert pour ce gala.", SEASON_FINALE_GALA_ROUTE);
  }
  return saveRegistration(formData, SEASON_FINALE_GALA_ROUTE);
}

async function saveRegistration(formData: FormData, route: string): Promise<never> {
  const eventKey = String(formData.get("eventKey") ?? "");
  const riderIds = formData
    .getAll("riderIds")
    .filter((value): value is string => typeof value === "string")
    .filter(isUuid);

  if (!isPcmGalaRaceKey(eventKey)) {
    redirectWithMessage("erreur", "Choisissez une course de gala valide.", route);
  }

  if (
    riderIds.length !== PCM_GALA_ROSTER_SIZE ||
    new Set(riderIds).size !== PCM_GALA_ROSTER_SIZE
  ) {
    redirectWithMessage(
      "erreur",
      `Sélectionnez exactement ${PCM_GALA_ROSTER_SIZE} coureurs différents.`,
      route,
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  const { error } = await supabase.rpc(
    "save_current_team_pcm_gala_registration",
    {
      p_event_key: eventKey,
      p_rider_ids: riderIds,
    },
  );

  if (error) {
    redirectWithMessage("erreur", normalizeRegistrationError(error.message), route);
  }

  revalidatePath(GALA_ROUTE);
  revalidatePath(SEASON_FINALE_GALA_ROUTE);
  redirectWithMessage(
    "inscription",
    "Votre course et vos 7 coureurs sont enregistrés.",
    route,
  );
}

export async function withdrawPcmGalaRegistrationAction(): Promise<never> {
  return withdrawRegistration(GALA_ROUTE);
}

export async function withdrawSeasonFinaleGalaRegistrationAction(): Promise<never> {
  return withdrawRegistration(SEASON_FINALE_GALA_ROUTE);
}

async function withdrawRegistration(route: string): Promise<never> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await getAuthenticatedUser(supabase);

  if (authenticationError || !user) redirect("/connexion");

  const { error } = await supabase.rpc(
    "withdraw_current_team_pcm_gala_registration",
  );

  if (error) {
    redirectWithMessage(
      "erreur",
      "L’inscription n’a pas pu être retirée. Réessayez dans un instant.",
      route,
    );
  }

  revalidatePath(GALA_ROUTE);
  revalidatePath(SEASON_FINALE_GALA_ROUTE);
  redirectWithMessage("inscription", "Votre inscription gala a été retirée.", route);
}

function normalizeRegistrationError(message: string) {
  const normalized = message.toLocaleLowerCase("fr-FR");

  if (normalized.includes("fermee") || normalized.includes("fermée")) {
    return "Les inscriptions à cette course sont closes.";
  }
  if (normalized.includes("effectif")) {
    return "Un coureur sélectionné n’appartient plus à votre effectif actif.";
  }
  if (normalized.includes("exactement")) {
    return `Sélectionnez exactement ${PCM_GALA_ROSTER_SIZE} coureurs différents.`;
  }

  return "L’inscription n’a pas pu être enregistrée. Réessayez dans un instant.";
}

function redirectWithMessage(
  key: "inscription" | "erreur",
  message: string,
  route = GALA_ROUTE,
): never {
  redirect(`${route}?${key}=${encodeURIComponent(message)}`);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
