"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import {
  buildRiderReturnPath,
  sanitizeTransferMarketReturnPath,
  withPageFeedback,
} from "@/lib/game/filtered-page-paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dispatchDuePushNotifications } from "@/services/push-notifications";

export async function placeTransferBidAction(formData: FormData) {
  const listingId = readValue(formData, "listingId");
  const amount = Number(readValue(formData, "amount"));
  const returnPath = sanitizeTransferMarketReturnPath(
    readValue(formData, "returnPath"),
  );
  if (!isUuid(listingId) || !Number.isFinite(amount) || amount < 500) {
    redirectWithMessage(returnPath, "erreur", "L’offre transmise est invalide.");
  }
  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("place_transfer_bid", {
    p_listing_id: listingId,
    p_amount: amount,
  });
  if (error) redirectWithMessage(returnPath, "erreur", error.message);
  schedulePushDispatch();
  revalidateTransferPaths();
  revalidatePath("/jeu/messagerie");
  redirectWithMessage(returnPath, "succes", "Votre offre est désormais enregistrée.");
}

export async function createDirectorListingAction(formData: FormData) {
  const riderId = readValue(formData, "riderId");
  const minimumBid = Number(readValue(formData, "minimumBid"));
  const returnPath = sanitizeTransferMarketReturnPath(
    readValue(formData, "returnPath"),
  );
  if (!isUuid(riderId) || !Number.isFinite(minimumBid)) {
    redirectWithMessage(returnPath, "erreur", "La mise en vente est invalide.");
  }
  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("create_director_transfer_listing", {
    p_rider_id: riderId,
    p_minimum_bid: minimumBid,
  });
  if (error) redirectWithMessage(returnPath, "erreur", error.message);
  revalidateTransferPaths();
  redirectWithMessage(returnPath, "succes", "Le coureur est proposé pendant 24 heures.");
}

export async function signFreeAgentAction(formData: FormData) {
  const riderId = readValue(formData, "riderId");
  const returnPath = resolveTransferOrRiderReturnPath(
    readValue(formData, "returnPath"),
    riderId,
  );
  if (!isUuid(riderId)) redirectWithMessage(returnPath, "erreur", "Ce coureur est invalide.");
  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("sign_current_team_free_agent", {
    p_rider_id: riderId,
  });
  if (error) redirectWithMessage(returnPath, "erreur", error.message);
  revalidateTransferPaths();
  revalidatePath(`/jeu/coureurs/${riderId}`);
  redirectWithMessage(returnPath, "succes", "Le coureur a signé un contrat de deux saisons.");
}

export async function renewRiderContractAction(formData: FormData) {
  const riderId = readValue(formData, "riderId");
  const returnPath = isUuid(riderId)
    ? (buildRiderReturnPath(readValue(formData, "returnPath"), riderId) ??
      `/jeu/coureurs/${riderId}`)
    : sanitizeTransferMarketReturnPath(readValue(formData, "returnPath"));
  if (!isUuid(riderId)) redirectWithMessage(returnPath, "erreur", "Ce coureur est invalide.");
  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("renew_current_team_rider", {
    p_rider_id: riderId,
  });
  if (error) redirectWithMessage(returnPath, "erreur", error.message);
  revalidateTransferPaths();
  revalidatePath(`/jeu/coureurs/${riderId}`);
  redirectWithMessage(returnPath, "succes", "Le contrat est renouvelé pour la saison suivante.");
}

export async function submitDirectTransferOfferAction(formData: FormData) {
  const riderId = readValue(formData, "riderId");
  const amount = Number(readValue(formData, "amount"));
  const returnPath = isUuid(riderId)
    ? (buildRiderReturnPath(readValue(formData, "returnPath"), riderId) ??
      `/jeu/coureurs/${riderId}`)
    : "/jeu/transferts?onglet=offres";
  if (
    !isUuid(riderId) ||
    !Number.isFinite(amount) ||
    amount < 500 ||
    amount > 100_000_000
  ) {
    redirectWithMessage(returnPath, "erreur", "Le montant de l'offre est invalide.");
  }

  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("submit_direct_transfer_offer", {
    p_rider_id: riderId,
    p_amount: amount,
  });
  if (error) redirectWithMessage(returnPath, "erreur", error.message);

  schedulePushDispatch();
  revalidateTransferPaths();
  revalidatePath(`/jeu/coureurs/${riderId}`);
  revalidatePath("/jeu/messagerie");
  redirectWithMessage(
    returnPath,
    "succes",
    "Votre offre a été transmise au Directeur Sportif de l'équipe concernée.",
  );
}

export async function respondToDirectTransferOfferAction(formData: FormData) {
  const offerId = readValue(formData, "offerId");
  const riderId = readValue(formData, "riderId");
  const decision = readValue(formData, "decision");
  const returnPath = sanitizeTransferMarketReturnPath(
    readValue(formData, "returnPath") || "/jeu/transferts?onglet=offres",
  );
  if (!isUuid(offerId) || !["accept", "reject"].includes(decision)) {
    redirectWithMessage(returnPath, "erreur", "La réponse à l'offre est invalide.");
  }

  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("respond_to_direct_transfer_offer", {
    p_offer_id: offerId,
    p_accept: decision === "accept",
  });
  if (error) redirectWithMessage(returnPath, "erreur", error.message);

  schedulePushDispatch();
  revalidateTransferPaths();
  revalidatePath("/jeu/messagerie");
  if (isUuid(riderId)) revalidatePath(`/jeu/coureurs/${riderId}`);
  redirectWithMessage(
    returnPath,
    "succes",
    decision === "accept"
      ? "L'offre est acceptée : le transfert et les écritures financières sont enregistrés."
      : "L'offre a été refusée et le Directeur Sportif demandeur a été prévenu.",
  );
}

export async function dismissRiderAction(formData: FormData) {
  const riderId = readValue(formData, "riderId");
  const returnPath = isUuid(riderId)
    ? (buildRiderReturnPath(readValue(formData, "returnPath"), riderId) ??
      `/jeu/coureurs/${riderId}`)
    : "/jeu/effectif";
  if (!isUuid(riderId)) {
    redirectWithMessage(returnPath, "erreur", "Ce coureur est invalide.");
  }

  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("dismiss_current_team_rider", {
    p_rider_id: riderId,
  });
  if (error) redirectWithMessage(returnPath, "erreur", error.message);

  const result = data && typeof data === "object" ? data : null;
  const compensation = result && "compensation" in result
    ? Number(result.compensation)
    : 0;
  const currency = result && "currency" in result && typeof result.currency === "string"
    ? result.currency
    : "EUR";
  const mutualAgreement = Boolean(
    result && "mutualAgreement" in result && result.mutualAgreement,
  );

  revalidateTransferPaths();
  revalidatePath(`/jeu/coureurs/${riderId}`);
  revalidatePath("/jeu/messagerie");
  redirectWithMessage(
    returnPath,
    "succes",
    mutualAgreement
      ? "Le contrat a été rompu gratuitement dans le cadre d’un licenciement à l’amiable."
      : `Le contrat a été rompu. ${formatMoney(compensation, currency)} ont été réglés immédiatement.`,
  );
}

async function authenticatedClient() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/connexion");
  return supabase;
}

function revalidateTransferPaths() {
  revalidatePath("/jeu/transferts");
  revalidatePath("/jeu/effectif");
  revalidatePath("/jeu/finances");
  revalidatePath("/jeu");
}

function schedulePushDispatch() {
  after(async () => {
    try {
      await dispatchDuePushNotifications({
        limit: 5,
        enqueueRaceLives: false,
      });
    } catch (error) {
      console.error(
        "Impossible de distribuer immédiatement la notification de transfert.",
        error,
      );
    }
  });
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function redirectWithMessage(path: string, key: "succes" | "erreur", message: string): never {
  redirect(withPageFeedback(path, key, message));
}

function resolveTransferOrRiderReturnPath(value: string, riderId: string) {
  return (
    buildRiderReturnPath(value, riderId) ??
    sanitizeTransferMarketReturnPath(value)
  );
}

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
