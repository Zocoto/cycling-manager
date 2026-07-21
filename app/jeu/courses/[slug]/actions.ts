"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function registerRaceRosterAction(
  formData: FormData
) {
  const editionId = readFormValue(
    formData,
    "editionId"
  );
  const slug = readFormValue(formData, "slug");
  const riderIds = formData
    .getAll("riderIds")
    .filter(
      (value): value is string =>
        typeof value === "string" && isUuid(value)
    );
  const roster = riderIds.map((riderId) => ({
    riderId,
    role: "auto",
  }));

  if (!isUuid(editionId) || !isSlug(slug)) {
    redirectWithError(
      "/jeu/calendrier",
      "La course sélectionnée est invalide."
    );
  }

  const supabase =
    await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc(
    "save_current_team_race_roster_with_roles",
    {
      p_race_edition_id: editionId,
      p_roster: roster,
    }
  );

  if (error) {
    redirectWithError(`/jeu/courses/${slug}`, error.message);
  }

  revalidateRacePaths(slug);
  redirect(
    `/jeu/calendrier?inscription=confirmee&course=${encodeURIComponent(
      slug
    )}`
  );
}

export async function withdrawRaceRosterAction(
  formData: FormData
) {
  const editionId = readFormValue(
    formData,
    "editionId"
  );
  const slug = readFormValue(formData, "slug");

  if (!isUuid(editionId) || !isSlug(slug)) {
    redirectWithError(
      "/jeu/calendrier",
      "La course sélectionnée est invalide."
    );
  }

  const supabase =
    await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc(
    "withdraw_current_team_from_race",
    { p_race_edition_id: editionId }
  );

  if (error) {
    redirectWithError(`/jeu/courses/${slug}`, error.message);
  }

  revalidateRacePaths(slug);
  redirect(
    `/jeu/calendrier?desinscription=confirmee&course=${encodeURIComponent(
      slug
    )}`
  );
}

function revalidateRacePaths(slug: string) {
  revalidatePath("/jeu/calendrier");
  revalidatePath(`/jeu/courses/${slug}`);
  revalidatePath("/jeu");
}

function redirectWithError(path: string, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(
    `${path}${separator}erreur=${encodeURIComponent(
      message.slice(0, 300)
    )}`
  );
}

function readFormValue(
  formData: FormData,
  key: string
) {
  const value = formData.get(key);
  return typeof value === "string"
    ? value.trim()
    : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
    value
  );
}
