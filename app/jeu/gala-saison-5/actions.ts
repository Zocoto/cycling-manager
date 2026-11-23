"use server";

import { revalidatePath } from "next/cache";

import { SEASON_FIVE_GALA } from "@/lib/game/season-five-gala";
import {
  seasonFiveGalaRegistrationSchema,
  type GalaS5RegistrationState,
} from "@/lib/game/season-five-gala-registration";
import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type MutationResult = { error: { code?: string; message?: string } | null };
const confirmationMessage = "Confirmation indisponible. Rechargez la page pour vérifier votre inscription avant de réessayer.";

function registrationError(error: NonNullable<MutationResult["error"]>): string {
  const message = error.message ?? "";
  if (/inscriptions.*closes/i.test(message)) return "Les inscriptions du gala sont closes.";
  if (/catégorie a changé|programme a changé/i.test(message)) return "Votre programme a changé. Rechargez la page avant de continuer.";
  if (error.code === "40001" || /inscription est déjà en cours/i.test(message)) {
    return "Une inscription est déjà en cours. Rechargez la page avant de réessayer.";
  }
  if (/hors effectif|inéligible/i.test(message)) {
    return "Vérifiez votre effectif de saison 5 et le plafond Continental de 75 dans chaque note primaire native.";
  }
  if (/coureur.*déjà inscrit.*autre équipe/i.test(message)) {
    return "Un coureur est déjà inscrit par une autre équipe pour ce gala. Contactez l’organisation.";
  }
  if (/Aucune équipe de saison 5/i.test(message)) return "Aucune équipe de saison 5 à inscrire.";
  if (/autre équipe|autre DS|Plusieurs équipes/i.test(message)) {
    return "Cette inscription nécessite une vérification par l’organisation du gala.";
  }
  return confirmationMessage;
}

async function executeGalaMutation(
  operation: (client: Client) => PromiseLike<MutationResult>,
  successMessage: string,
): Promise<GalaS5RegistrationState> {
  try {
    const client = await createSupabaseServerClient();
    const { data: { user }, error } = await getAuthenticatedUser(client);
    if (error || !user) return { status: "error", message: "Reconnectez-vous pour gérer votre inscription." };
    const result = await operation(client);
    if (result.error) return { status: "error", message: registrationError(result.error) };
    revalidatePath(SEASON_FIVE_GALA.route);
    return { status: "success", message: successMessage };
  } catch {
    return { status: "error", message: confirmationMessage };
  }
}

export async function saveSeasonFiveGalaRegistrationAction(
  _previous: GalaS5RegistrationState,
  form: FormData,
): Promise<GalaS5RegistrationState> {
  const rawSelections = form.get("selections");
  if (typeof rawSelections !== "string" || rawSelections.length > 16384) {
    return { status: "error", message: "Compositions du gala invalides." };
  }
  let selections: unknown;
  try { selections = JSON.parse(rawSelections); }
  catch { return { status: "error", message: "Compositions du gala invalides." }; }
  const parsed = seasonFiveGalaRegistrationSchema.safeParse({
    program: form.get("program"),
    selections,
    previousProgram: form.get("previousProgram") || null,
  });
  if (!parsed.success) {
    return { status: "error", message: "Choisissez au moins une course, avec 7 à 8 coureurs distincts par course retenue, dans un seul programme." };
  }
  return executeGalaMutation((client) => client
    .rpc("save_current_season_five_gala_registration", {
      p_program: parsed.data.program,
      p_selections: parsed.data.selections,
      p_previous_program: parsed.data.previousProgram,
    })
    .abortSignal(AbortSignal.timeout(8000)),
  "Vos compositions sont enregistrées. Vous pourrez les modifier jusqu’à la clôture.");
}

export async function withdrawSeasonFiveGalaRegistrationAction(
  _previous: GalaS5RegistrationState,
  _form: FormData,
): Promise<GalaS5RegistrationState> {
  void _previous;
  void _form;
  return executeGalaMutation((client) => client
    .rpc("withdraw_current_season_five_gala_registration")
    .abortSignal(AbortSignal.timeout(8000)),
  "Votre inscription au gala a été retirée.");
}
