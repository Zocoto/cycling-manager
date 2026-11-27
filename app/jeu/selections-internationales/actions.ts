"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getInternationalSelectionsHref } from "@/lib/game/international-championship-navigation";
import { parseAnsweredInternationalSelectionDecisions } from "@/lib/game/international-selection-batch";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { respondToInternationalChampionshipSelections } from "@/services/international-championship-selections";

const raceEditionFilter = z.string().uuid().optional();

const federationCallupInput = z.object({
  memberId: z.string().uuid(),
  audience: z.enum(["professional", "junior"]).default("professional"),
  epreuve: raceEditionFilter,
});

function federationCallupHref({
  audience,
  epreuve,
  erreur,
  decision,
}: {
  audience: "professional" | "junior";
  epreuve?: string;
  erreur?: string;
  decision?: "retiree";
}) {
  const href = getInternationalSelectionsHref({ audience, raceEditionId: epreuve });
  const separator = href.includes("?") ? "&" : "?";
  if (erreur) return `${href}${separator}erreur=${encodeURIComponent(erreur.slice(0, 240))}`;
  if (decision) return `${href}${separator}decision=${decision}`;
  return href;
}

export async function answerFederationCallupAction(formData: FormData) {
  const input = federationCallupInput.extend({ decision: z.enum(["confirm", "decline"]) }).safeParse({
    memberId: formData.get("memberId"),
    decision: formData.get("decision"),
    audience: formData.get("audience") ?? undefined,
    epreuve: formData.get("epreuve") || undefined,
  });
  if (!input.success) redirect("/jeu/selections-internationales?erreur=Décision%20invalide");
  const { audience, epreuve } = input.data;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const { data, error } = await supabase.rpc("respond_to_national_federation_preselection", {
    p_member_id: input.data.memberId, p_accept: input.data.decision === "confirm",
  });
  if (error) redirect(federationCallupHref({ audience, epreuve, erreur: error.message }));
  revalidateFederationCallupViews();
  if (data === "ineligible") redirect(federationCallupHref({
    audience, epreuve, erreur: "Cette convocation n’est plus valable : le coureur n’est plus éligible.",
  }));
  redirect(federationCallupHref({ audience, epreuve }));
}

export async function withdrawFederationCallupAction(formData: FormData) {
  const input = federationCallupInput.safeParse({
    memberId: formData.get("memberId"),
    audience: formData.get("audience") ?? undefined,
    epreuve: formData.get("epreuve") || undefined,
  });
  if (!input.success) redirect("/jeu/selections-internationales?erreur=Retrait%20invalide");

  const { audience, epreuve, memberId } = input.data;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const { data, error } = await supabase.rpc("withdraw_confirmed_national_federation_callup", { p_member_id: memberId });
  if (error || data !== "withdrawn") redirect(federationCallupHref({
    audience, epreuve, erreur: error?.message ?? "Le retrait n’a pas pu être enregistré.",
  }));
  revalidateFederationCallupViews();
  redirect(federationCallupHref({ audience, epreuve, decision: "retiree" }));
}

function revalidateFederationCallupViews() {
  revalidatePath("/jeu");
  revalidatePath("/jeu/selections-internationales");
  revalidatePath("/jeu/federations/[codePays]", "page");
  revalidatePath("/jeu/championnats-internationaux");
  revalidatePath("/jeu/championnats-internationaux/juniors");
  revalidatePath("/jeu/nations-cup");
  revalidatePath("/jeu/calendrier");
  revalidatePath("/jeu/courses/[slug]", "page");
  revalidatePath("/jeu/resultats-juniors/[slug]", "page");
  revalidatePath("/jeu/boite-mail");
  revalidatePath("/jeu/effectif");
  revalidatePath("/jeu/centre-de-soin");
  revalidatePath("/jeu/coureurs/[identifiant]", "page");
  revalidatePath("/jeu/centre-de-formation");
  revalidatePath("/jeu/centre-de-formation/development/[academyRiderId]", "page");
}

export async function answerInternationalSelectionsAction(formData: FormData) {
  const { data: epreuve } = raceEditionFilter.safeParse(formData.get("epreuve") || undefined);
  const candidateIds = formData
    .getAll("candidateId")
    .filter((value): value is string => typeof value === "string");
  const parsed = parseAnsweredInternationalSelectionDecisions(
    candidateIds.map((candidateId) => ({
      candidateId,
      decision: formData.get(`decision:${candidateId}`),
      acknowledgedConflicts: formData
        .getAll(`acknowledgedConflict:${candidateId}`)
        .filter((value): value is string => typeof value === "string"),
    })),
  );

  if (!parsed.success) {
    const message =
      parsed.reason === "empty"
        ? "Choisissez au moins une convocation à valider ou à refuser."
        : "La décision transmise est invalide.";
    redirect(federationCallupHref({ audience: "professional", epreuve, erreur: message }));
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  try {
    await respondToInternationalChampionshipSelections({
      supabase,
      decisions: parsed.decisions.map((decision) => ({
        candidateId: decision.candidateId,
        accept: decision.decision === "confirm",
        acknowledgedConflicts: decision.acknowledgedConflicts,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "La décision n’a pas pu être enregistrée.";
    redirect(federationCallupHref({ audience: "professional", epreuve, erreur: message }));
  }

  revalidatePath("/jeu");
  revalidatePath("/jeu/selections-internationales");
  revalidatePath("/jeu/championnats-internationaux");
  revalidatePath("/jeu/calendrier");
  revalidatePath("/jeu/boite-mail");
  revalidatePath("/jeu/effectif");
  revalidatePath("/jeu/centre-de-soin");
  revalidatePath("/jeu/coureurs/[identifiant]", "page");
  redirect(getInternationalSelectionsHref({ raceEditionId: epreuve }));
}
