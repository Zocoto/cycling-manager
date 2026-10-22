"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { getCurrentGameStaffRole } from "@/services/game-staff-access";
import { SITE_RELEASE_CACHE_TAG, siteReleaseManagementSchema, siteReleaseUpdateSchema, type SiteReleaseActionState } from "@/lib/game/site-release";

export async function saveSiteReleaseAction(_previous: SiteReleaseActionState, form: FormData): Promise<SiteReleaseActionState> {
  let management: SiteReleaseActionState["management"];
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await getAuthenticatedUser(supabase);
    if (error || !user || await getCurrentGameStaffRole(supabase) !== "owner") {
      return { status: "error", message: "La version du site est réservée au compte fondateur." };
    }
    const parsed = siteReleaseUpdateSchema.safeParse({
      version: form.get("version"), note: form.get("note"), revision: Number(form.get("revision")),
    });
    if (!parsed.success) return { status: "error", message: "Indiquez une version comme 0.9.2 et un commentaire de 180 caractères maximum." };
    const result = await supabase.rpc("set_active_site_release", {
      p_version: parsed.data.version, p_note: parsed.data.note, p_expected_revision: parsed.data.revision,
    }).abortSignal(AbortSignal.timeout(5000));
    if (result.error) return result.error.code === "40001"
      ? { status: "conflict", message: "La version a changé ailleurs. Votre saisie est conservée ; rechargez la page avant de réessayer." }
      : { status: "error", message: "La modification de version a été refusée. Aucune annonce n’a été publiée." };
    management = siteReleaseManagementSchema.parse(result.data?.[0]);
    updateTag(SITE_RELEASE_CACHE_TAG);
    revalidatePath("/(public)", "layout");
    revalidatePath("/jeu/administration/actualites");
    return { status: "success", message: "Version affichée mise à jour. Aucune annonce n’a été publiée.", management };
  } catch {
    return {
      status: "error",
      message: management
        ? "Version enregistrée, mais son actualisation n’a pas pu être confirmée. Rechargez la page."
        : "La modification n’a pas pu être confirmée. Rechargez la page pour vérifier la version avant de réessayer.",
      ...(management ? { management } : {}),
    };
  }
}
