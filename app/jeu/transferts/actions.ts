"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import {
  buildRiderReturnPath,
  sanitizeTransferMarketReturnPath,
  withPageFeedback,
} from "@/lib/game/filtered-page-paths";
import {
  DIRECT_TRANSFER_OFFER_MESSAGE_MAX_LENGTH,
  normalizeDirectMessage,
} from "@/lib/game/direct-messages";
import { hasForbiddenGlobalChatLink } from "@/lib/game/global-chat";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dispatchDuePushNotifications } from "@/services/push-notifications";
import { getCurrentTeamDirectTransferTradeCandidates } from "@/services/transfer-market";

export async function loadDirectTransferTradeCandidatesAction() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/connexion");
  try {
    return { candidates: await getCurrentTeamDirectTransferTradeCandidates(user.id), error: null };
  } catch (error) {
    console.error("direct_transfer_trade_candidates_failed", error);
    return { candidates: [], error: "Impossible de charger vos coureurs échangeables. Vous pouvez réessayer sans modifier votre offre en argent." };
  }
}

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
  const requestedReturnPath = readValue(formData, "returnPath");
  const returnPath = isUuid(riderId)
    ? (buildRiderReturnPath(requestedReturnPath, riderId) ??
      sanitizeTransferMarketReturnPath(requestedReturnPath))
    : sanitizeTransferMarketReturnPath(requestedReturnPath);
  if (!isUuid(riderId) || !Number.isFinite(minimumBid)) {
    redirectWithMessage(returnPath, "erreur", "La mise en vente est invalide.");
  }
  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("create_director_transfer_listing", {
    p_rider_id: riderId,
    p_minimum_bid: minimumBid,
  });
  if (error) {
    redirectWithMessage(
      returnPath,
      "erreur",
      normalizeSeasonTransferRuleError(error.message),
    );
  }
  revalidateTransferPaths();
  revalidatePath(`/jeu/coureurs/${riderId}`);
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
  const requestedReturnPath = readValue(formData, "returnPath");
  const returnPath = requestedReturnPath === "/jeu/effectif?vue=contrats"
    ? requestedReturnPath
    : isUuid(riderId)
      ? (buildRiderReturnPath(requestedReturnPath, riderId) ??
        `/jeu/coureurs/${riderId}`)
      : sanitizeTransferMarketReturnPath(requestedReturnPath);
  if (!isUuid(riderId)) redirectWithMessage(returnPath, "erreur", "Ce coureur est invalide.");
  const targetEndSeasonYear = Number(readValue(formData, "targetEndSeasonYear"));
  if (!Number.isInteger(targetEndSeasonYear) || targetEndSeasonYear < 1) {
    redirectWithMessage(returnPath, "erreur", "L’échéance demandée est invalide.");
  }
  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("renew_current_team_rider_until", {
    p_rider_id: riderId,
    p_target_end_game_year: targetEndSeasonYear,
  });
  if (error) redirectWithMessage(returnPath, "erreur", error.message);
  revalidateTransferPaths();
  revalidatePath(`/jeu/coureurs/${riderId}`);
  redirectWithMessage(returnPath, "succes", `Le contrat est prolongé jusqu’à fin de S${targetEndSeasonYear}.`);
}

export async function submitDirectTransferOfferAction(formData: FormData) {
  const riderId = readValue(formData, "riderId");
  const offeredRiderId = readValue(formData, "offeredRiderId");
  const amount = Number(readValue(formData, "amount"));
  const message = normalizeDirectMessage(readValue(formData, "message"));
  const returnPath = isUuid(riderId)
    ? (buildRiderReturnPath(readValue(formData, "returnPath"), riderId) ??
      `/jeu/coureurs/${riderId}`)
    : "/jeu/transferts?onglet=offres";
  if (
    !isUuid(riderId) ||
    (offeredRiderId !== "" && (!isUuid(offeredRiderId) || offeredRiderId === riderId)) ||
    !Number.isFinite(amount) ||
    amount < (offeredRiderId ? 0 : 500) ||
    amount > 100_000_000
  ) {
    redirectWithMessage(returnPath, "erreur", "Le montant de l'offre est invalide.");
  }
  if (message.length > DIRECT_TRANSFER_OFFER_MESSAGE_MAX_LENGTH) {
    redirectWithMessage(
      returnPath,
      "erreur",
      `Le message ne peut pas dépasser ${DIRECT_TRANSFER_OFFER_MESSAGE_MAX_LENGTH} caractères.`,
    );
  }
  if (hasForbiddenGlobalChatLink(message)) {
    redirectWithMessage(
      returnPath,
      "erreur",
      "Seuls les liens Cyclo Stratège sont autorisés dans le message.",
    );
  }

  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc(
    offeredRiderId
      ? "submit_direct_transfer_trade_offer"
      : "submit_direct_transfer_offer_with_message",
    {
      p_rider_id: riderId,
      p_amount: amount,
      p_message: message || null,
      ...(offeredRiderId ? { p_offered_rider_id: offeredRiderId } : {}),
    },
  );
  if (error) {
    redirectWithMessage(
      returnPath,
      "erreur",
      normalizeSeasonTransferRuleError(error.message),
    );
  }

  schedulePushDispatch();
  revalidateTransferPaths();
  revalidatePath(`/jeu/coureurs/${riderId}`);
  if (offeredRiderId) revalidatePath(`/jeu/coureurs/${offeredRiderId}`);
  if (offeredRiderId) revalidatePath("/jeu/courses", "layout");
  revalidatePath("/jeu/messagerie");
  revalidatePath("/jeu/chat");
  redirectWithMessage(
    returnPath,
    "succes",
    offeredRiderId
      ? "Votre offre a été transmise. Votre coureur a été désinscrit de ses courses à venir ; l’offre et votre message sont disponibles dans votre conversation privée."
      : "Votre offre a été transmise et ajoutée à votre conversation privée avec le Directeur Sportif.",
  );
}

export async function cancelDirectTransferOfferAction(formData: FormData) {
  const offerId = readValue(formData, "offerId");
  if (!isUuid(offerId)) {
    redirectWithMessage("/jeu/transferts?onglet=offres", "erreur", "Cette offre est invalide.");
  }
  const supabase = await authenticatedClient();
  const { data: offer, error: offerError } = await supabase
    .from("direct_transfer_offers")
    .select("rider_id, offered_rider_id")
    .eq("id", offerId)
    .maybeSingle<{ rider_id: string; offered_rider_id: string | null }>();
  if (offerError || !offer) {
    redirectWithMessage("/jeu/transferts?onglet=offres", "erreur", "Cette offre n’est plus accessible.");
  }
  const returnPath = resolveTransferOrRiderReturnPath(readValue(formData, "returnPath"), offer.rider_id);
  const { error } = await supabase.rpc("cancel_current_direct_transfer_offer", { p_offer_id: offerId });
  if (error) redirectWithMessage(returnPath, "erreur", error.message);
  revalidateTransferPaths();
  revalidatePath("/jeu/messagerie");
  for (const riderId of [offer.rider_id, offer.offered_rider_id]) {
    if (riderId && isUuid(riderId)) revalidatePath(`/jeu/coureurs/${riderId}`);
  }
  redirectWithMessage(returnPath, "succes", offer.offered_rider_id
    ? "Votre offre a été retirée. Le coureur proposé et la somme réservée sont libérés."
    : "Votre offre a été retirée. La somme réservée est libérée.");
}

export async function respondToDirectTransferOfferAction(formData: FormData) {
  const offerId = readValue(formData, "offerId");
  const decision = readValue(formData, "decision");
  const returnPath = sanitizeTransferMarketReturnPath(
    readValue(formData, "returnPath") || "/jeu/transferts?onglet=offres",
  );
  if (!isUuid(offerId) || !["accept", "reject"].includes(decision)) {
    redirectWithMessage(returnPath, "erreur", "La réponse à l'offre est invalide.");
  }

  const supabase = await authenticatedClient();
  // Never trust hidden rider IDs when invalidating both sides of an exchange.
  // RLS limits this read to the teams participating in the offer.
  const { data: offer, error: offerError } = await supabase
    .from("direct_transfer_offers")
    .select("rider_id, offered_rider_id")
    .eq("id", offerId)
    .maybeSingle<{ rider_id: string; offered_rider_id: string | null }>();
  if (offerError || !offer) {
    redirectWithMessage(returnPath, "erreur", "Cette offre n’est plus accessible.");
  }
  const { error } = await supabase.rpc("respond_to_direct_transfer_offer", {
    p_offer_id: offerId,
    p_accept: decision === "accept",
  });
  if (error) {
    redirectWithMessage(
      returnPath,
      "erreur",
      normalizeSeasonTransferRuleError(error.message),
    );
  }

  schedulePushDispatch();
  revalidateTransferPaths();
  revalidatePath("/jeu/messagerie");
  for (const riderId of [offer.rider_id, offer.offered_rider_id]) {
    if (riderId && isUuid(riderId)) revalidatePath(`/jeu/coureurs/${riderId}`);
  }
  if (offer.offered_rider_id && decision === "accept") revalidatePath("/jeu/courses", "layout");
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

function normalizeSeasonTransferRuleError(message: string) {
  return /recruté cette saison/i.test(message)
    ? "Transfert impossible : ce coureur a déjà changé d’équipe cette saison."
    : message;
}

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
