"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RiderProgressionHistory } from "@/lib/game/rider-progression";
import { getPublicRiderProfile } from "@/services/public-rider-profile";
import { getRiderProgressionHistories } from "@/services/rider-progression";

export async function loadRiderProgressionAction(
  riderId: string,
): Promise<RiderProgressionHistory | null> {
  if (!isUuid(riderId)) {
    throw new Error("Le coureur transmis est invalide.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    throw new Error(
      "Votre session a expiré. Rechargez la page pour continuer.",
    );
  }

  const profile = await getPublicRiderProfile({
    riderIdentifier: riderId,
    viewerAuthUserId: user.id,
  });

  if (
    !profile ||
    profile.archive ||
    !profile.canManage ||
    !profile.activeSeason
  ) {
    return null;
  }

  const histories = await getRiderProgressionHistories({
    riderIds: [profile.id],
    currentSeasonId: profile.activeSeason.id,
    includePreviousSeasons: false,
  });

  return histories[0] ?? { riderId: profile.id, seasons: [] };
}

export async function naturalizeProfessionalRiderAction(
  formData: FormData,
): Promise<void> {
  const riderId = readValue(formData, "riderId");
  if (!isUuid(riderId)) {
    redirect(
      `/jeu/effectif?erreur=${encodeURIComponent(
        "Le coureur transmis est invalide.",
      )}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();
  if (authenticationError || !user) redirect("/connexion");

  const result = await supabase.rpc(
    "naturalize_current_team_professional_rider",
    { p_rider_id: riderId },
  );
  if (result.error) {
    redirectWithMessage(riderId, "erreur", result.error.message);
  }

  revalidatePath(`/jeu/coureurs/${riderId}`);
  revalidatePath("/jeu/effectif");
  revalidatePath("/jeu/classements");
  revalidatePath("/jeu");
  redirectWithMessage(
    riderId,
    "succes",
    `Naturalisation validée : le coureur représente désormais ${readCountryName(result.data)}.`,
  );
}

function readCountryName(data: unknown): string {
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

function redirectWithMessage(
  riderId: string,
  key: "succes" | "erreur",
  message: string,
): never {
  redirect(
    `/jeu/coureurs/${riderId}?${key}=${encodeURIComponent(message.slice(0, 280))}`,
  );
}

function readValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
