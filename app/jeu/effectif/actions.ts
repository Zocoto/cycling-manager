"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { withPageFeedback } from "@/lib/game/filtered-page-paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type BulkRenewalResult = {
  renewed_count: number;
  total_salary: number | string;
};

const CONTRACTS_PATH = "/jeu/effectif?vue=contrats";

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
