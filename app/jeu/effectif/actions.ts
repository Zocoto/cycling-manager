"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { withPageFeedback } from "@/lib/game/filtered-page-paths";
import { SQUAD_STATUS_OPTIONS } from "@/lib/game/squad-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type BulkRenewalResult = {
  renewed_count: number;
  total_salary: number | string;
};

const CONTRACTS_PATH = "/jeu/effectif?vue=contrats";
const squadStatusValues = SQUAD_STATUS_OPTIONS.map((option) => option.value);

export async function updateRiderSquadStatusAction(formData: FormData) {
  const parsed = z
    .object({
      riderId: z.string().uuid(),
      squadStatus: z.enum(squadStatusValues as [string, ...string[]]).or(z.literal("")),
      returnTo: z.string(),
    })
    .safeParse({
      riderId: formData.get("riderId"),
      squadStatus: formData.get("squadStatus"),
      returnTo: formData.get("returnTo"),
    });
  const fallbackPath = "/jeu/effectif?vue=statistiques";
  if (!parsed.success) {
    redirect(withPageFeedback(fallbackPath, "erreur", "Statut d’effectif invalide."));
  }

  const returnTo = sanitizeSquadStatusReturnPath(parsed.data.returnTo);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();
  if (authenticationError || !user) redirect("/connexion");

  const { error } = await supabase.rpc("set_current_team_rider_squad_status", {
    p_rider_id: parsed.data.riderId,
    p_squad_status: parsed.data.squadStatus || null,
  });
  if (error) {
    redirect(withPageFeedback(returnTo, "erreur", error.message.slice(0, 220)));
  }

  revalidatePath("/jeu/effectif");
  revalidatePath("/jeu/entrainement");
  revalidatePath(`/jeu/coureurs/${parsed.data.riderId}`);
  revalidatePath("/jeu/courses/[slug]", "page");
  redirect(withPageFeedback(returnTo, "succes", "Statut dans l’effectif mis à jour."));
}

function sanitizeSquadStatusReturnPath(value: string): string {
  if (value === "/jeu/effectif" || value.startsWith("/jeu/effectif?")) {
    return value;
  }
  if (/^\/jeu\/coureurs\/[0-9a-f-]{36}$/i.test(value)) return value;
  return "/jeu/effectif?vue=statistiques";
}

export async function renewAllTeamRiderContractsAction() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const { data, error } = await supabase.rpc(
    "renew_all_current_team_riders",
  );

  if (error) {
    redirect(
      withPageFeedback(CONTRACTS_PATH, "erreur", error.message),
    );
  }

  const result = ((data as BulkRenewalResult[] | null) ?? [])[0];
  const renewedCount = Number(result?.renewed_count ?? 0);

  revalidatePath("/jeu/effectif");
  revalidatePath("/jeu/transferts");
  revalidatePath("/jeu/finances");
  revalidatePath("/jeu");

  const message =
    renewedCount > 0
      ? `${renewedCount} contrat${renewedCount > 1 ? "s ont" : " a"} été prolongé${renewedCount > 1 ? "s" : ""} pour la saison suivante.`
      : "Tous les contrats de l’effectif sont déjà à jour.";

  redirect(withPageFeedback(CONTRACTS_PATH, "succes", message));
}
