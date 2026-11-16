"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { withPageFeedback } from "@/lib/game/filtered-page-paths";
import { SQUAD_STATUS_OPTIONS } from "@/lib/game/squad-status";
import type { SquadStatus } from "@/lib/game/squad-status";
import type { SquadStatusesSaveState } from "@/lib/game/squad-status-editor";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recoverCurrentEmptyTeamRoster } from "@/services/empty-roster-recovery";

type BulkRenewalResult = {
  renewed_count: number;
  total_salary: number | string;
};

const CONTRACTS_PATH = "/jeu/effectif?vue=contrats";
const squadStatusValues = SQUAD_STATUS_OPTIONS.map((option) => option.value);
const squadStatusSchema = z.enum(squadStatusValues as [SquadStatus, ...SquadStatus[]]).nullable();
const protectedLeaderSchema = z.uuid().nullable();

function isSquadRoleTargetValid({
  riderId,
  squadStatus,
  protectedLeaderId,
}: {
  riderId: string;
  squadStatus: SquadStatus | null;
  protectedLeaderId?: string | null;
}) {
  return squadStatus === "close_guard"
    ? Boolean(protectedLeaderId && protectedLeaderId !== riderId)
    : protectedLeaderId == null;
}

export async function recoverEmptyTeamRosterAction() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/connexion");

  let status: string;
  try {
    status = await recoverCurrentEmptyTeamRoster(supabase);
  } catch (recoveryError) {
    const message = recoveryError instanceof Error
      ? recoveryError.message
      : "Votre effectif n’a pas pu être relancé. Réessayez dans un instant.";
    redirect(withPageFeedback("/jeu/effectif", "erreur", message));
  }

  revalidatePath("/jeu", "layout");
  redirect(withPageFeedback("/jeu/effectif", "succes", status === "created"
    ? "Vos 7 coureurs de départ ont été créés. Vous pouvez préparer leur entraînement et les inscrire en course."
    : "La relance a déjà été enregistrée. Retrouvez vos coureurs dans l’effectif."));
}

export async function updateRiderSquadStatusAction(formData: FormData) {
  const parsed = z
    .object({
      riderId: z.uuid(),
      squadStatus: squadStatusSchema.unwrap().or(z.literal("")).transform((status) => status || null),
      protectedLeaderId: protectedLeaderSchema,
      returnTo: z.string(),
    })
    .safeParse({
      riderId: formData.get("riderId"),
      squadStatus: formData.get("squadStatus"),
      protectedLeaderId: formData.get("protectedLeaderId") || null,
      returnTo: formData.get("returnTo"),
    });
  const fallbackPath = "/jeu/effectif?vue=statistiques";
  if (!parsed.success) {
    redirect(withPageFeedback(fallbackPath, "erreur", "Statut d’effectif invalide."));
  }

  const returnTo = sanitizeSquadStatusReturnPath(parsed.data.returnTo);
  if (!isSquadRoleTargetValid(parsed.data)) {
    redirect(withPageFeedback(returnTo, "erreur", "Choisissez le leader à protéger."));
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();
  if (authenticationError || !user) redirect("/connexion");

  const { error } = await supabase.rpc("set_current_team_rider_squad_status", {
    p_rider_id: parsed.data.riderId,
    p_squad_status: parsed.data.squadStatus,
    p_protected_leader_id: parsed.data.protectedLeaderId,
  });
  if (error) {
    redirect(withPageFeedback(returnTo, "erreur", error.message.slice(0, 220)));
  }

  revalidateSquadStatusPages();
  redirect(withPageFeedback(returnTo, "succes", "Statut dans l’effectif mis à jour."));
}

/** Save only changed roles together; the RPC derives ownership and checks the baseline atomically. */
export async function updateRiderSquadStatusesAction(
  previousState: SquadStatusesSaveState,
  formData: FormData,
): Promise<SquadStatusesSaveState> {
  void previousState;
  const invalid = (): SquadStatusesSaveState => ({ status: "error", message: "Sélection de statuts d’effectif invalide.", savedStatuses: [] });
  const raw = formData.get("updates");
  if (typeof raw !== "string" || raw.length > 50_000) return invalid();
  let values: unknown;
  try { values = JSON.parse(raw); } catch { return invalid(); }
  const parsed = z.array(z.strictObject({
    riderId: z.uuid(),
    squadStatus: squadStatusSchema,
    expectedStatus: squadStatusSchema,
    protectedLeaderId: protectedLeaderSchema.optional(),
    expectedProtectedLeaderId: protectedLeaderSchema.optional(),
  }).refine((row) =>
    (row.protectedLeaderId === undefined) === (row.expectedProtectedLeaderId === undefined) &&
    isSquadRoleTargetValid(row),
  )).min(1).max(200).safeParse(values);
  if (!parsed.success || new Set(parsed.data.map(row => row.riderId)).size !== parsed.data.length) return invalid();
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authenticationError } = await supabase.auth.getUser();
  if (authenticationError || !user) redirect("/connexion");
  const { error } = await supabase.rpc("set_current_team_rider_squad_statuses", { p_updates: parsed.data });
  if (error) return { status: "error", message: error.message.slice(0, 220), savedStatuses: [] };
  revalidateSquadStatusPages();
  return {
    status: "success", message: "Statuts dans l’effectif mis à jour.",
    savedStatuses: parsed.data.map(({ riderId, squadStatus, protectedLeaderId }) => ({
      riderId,
      squadStatus,
      ...(protectedLeaderId === undefined ? {} : { protectedLeaderId }),
    })),
  };
}

function revalidateSquadStatusPages() {
  revalidatePath("/jeu/effectif");
  revalidatePath("/jeu/entrainement");
  revalidatePath("/jeu/coureurs/[identifiant]", "page");
  revalidatePath("/jeu/courses/[slug]", "page");
  revalidatePath("/jeu/courses/criterium-de-la-decouverte");
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
      : "Aucun contrat n’a pu être prolongé.";

  redirect(withPageFeedback(CONTRACTS_PATH, "succes", message));
}
