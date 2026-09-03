"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FederationFinanceActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialFederationFinanceActionState: FederationFinanceActionState = {
  status: "idle",
  message: "",
};

const countryCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/);
const donationSchema = z.coerce.number().min(25_000).max(5_000_000);
const thresholdSchema = z.coerce.number().int().min(0).max(500);
const solidarityAmountSchema = z.coerce.number().min(0).max(500_000);

export async function donateToFederationAction(
  _previousState: FederationFinanceActionState,
  formData: FormData,
): Promise<FederationFinanceActionState> {
  const countryCode = countryCodeSchema.safeParse(formData.get("countryCode"));
  const amount = donationSchema.safeParse(formData.get("amount"));
  if (!countryCode.success || !amount.success) {
    return { status: "error", message: "Le montant du don est invalide." };
  }
  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc("donate_to_current_national_federation", {
    p_country_code: countryCode.data,
    p_amount: amount.data,
  });
  if (result.error) return failure(result.error.message);
  revalidate(countryCode.data);
  return {
    status: "success",
    message: `${formatMoney(Number(result.data ?? amount.data))} versés à la fédération.`,
  };
}

export async function executeFederationSolidarityAction(
  _previousState: FederationFinanceActionState,
  formData: FormData,
): Promise<FederationFinanceActionState> {
  const countryCode = countryCodeSchema.safeParse(formData.get("countryCode"));
  const threshold = thresholdSchema.safeParse(formData.get("reputationThreshold"));
  const amount = solidarityAmountSchema.safeParse(formData.get("amountPerTeam"));
  if (!countryCode.success || !threshold.success || !amount.success) {
    return { status: "error", message: "Les paramètres du fonds sont invalides." };
  }
  const supabase = await createSupabaseServerClient();
  const result = await supabase.rpc("execute_national_federation_solidarity", {
    p_country_code: countryCode.data,
    p_reputation_threshold: threshold.data,
    p_amount_per_team: amount.data,
  });
  if (result.error) return failure(result.error.message);
  revalidate(countryCode.data);
  return { status: "success", message: "Le fonds de solidarité a été versé." };
}

function revalidate(countryCode: string) {
  revalidatePath(`/jeu/federations/${countryCode.toLowerCase()}`);
  revalidatePath("/jeu");
  revalidatePath("/jeu/finances");
}

function failure(message: string): FederationFinanceActionState {
  console.error("Échec d’opération financière fédérale :", message);
  return { status: "error", message: message || "L’opération a échoué." };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}
