"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function placeTransferBidAction(formData: FormData) {
  const listingId = readValue(formData, "listingId");
  const amount = Number(readValue(formData, "amount"));
  const returnPath = safeReturnPath(readValue(formData, "returnPath"));
  if (!isUuid(listingId) || !Number.isFinite(amount) || amount < 500) {
    redirectWithMessage(returnPath, "erreur", "L’offre transmise est invalide.");
  }
  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("place_transfer_bid", {
    p_listing_id: listingId,
    p_amount: amount,
  });
  if (error) redirectWithMessage(returnPath, "erreur", error.message);
  revalidateTransferPaths();
  redirectWithMessage(returnPath, "succes", "Votre offre est désormais enregistrée.");
}

export async function createDirectorListingAction(formData: FormData) {
  const riderId = readValue(formData, "riderId");
  const minimumBid = Number(readValue(formData, "minimumBid"));
  const returnPath = "/jeu/transferts?onglet=directeurs";
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
  const returnPath = safeReturnPath(readValue(formData, "returnPath"));
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
  const returnPath = safeReturnPath(readValue(formData, "returnPath"));
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

function redirectWithMessage(path: string, key: "succes" | "erreur", message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(message.slice(0, 280))}`);
}

function safeReturnPath(value: string) {
  return value.startsWith("/jeu/") && !value.startsWith("//")
    ? value
    : "/jeu/transferts";
}

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
