"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function registerForRaceAction(
  formData: FormData
) {
  const editionId = readFormValue(
    formData,
    "editionId"
  );
  const slug = readFormValue(formData, "slug");

  if (!isUuid(editionId) || !isSlug(slug)) {
    redirect(
      `/jeu/calendrier?erreur=${encodeURIComponent(
        "La course sélectionnée est invalide."
      )}`
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
    "register_current_team_for_race",
    {
      p_race_edition_id: editionId,
    }
  );

  if (error) {
    redirect(
      `/jeu/courses/${slug}?erreur=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath("/jeu/calendrier");
  revalidatePath(`/jeu/courses/${slug}`);
  revalidatePath("/jeu");

  redirect(
    `/jeu/courses/${slug}?inscription=confirmee`
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
