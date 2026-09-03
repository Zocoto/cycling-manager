"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FederationGovernanceActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialFederationGovernanceActionState: FederationGovernanceActionState = {
  status: "idle",
  message: "",
};

const countryCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/);
const manifestoSchema = z.string().trim().min(40).max(800);
const candidateIdSchema = z.string().uuid();

export async function submitFederationCandidacyAction(
  _previousState: FederationGovernanceActionState,
  formData: FormData,
): Promise<FederationGovernanceActionState> {
  const countryCode = countryCodeSchema.safeParse(formData.get("countryCode"));
  const manifesto = manifestoSchema.safeParse(formData.get("manifesto"));
  if (!countryCode.success || !manifesto.success) {
    return {
      status: "error",
      message: "La profession de foi doit contenir entre 40 et 800 caractères.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();
  if (authenticationError || !user) {
    return { status: "error", message: "Votre session a expiré." };
  }

  const result = await supabase.rpc(
    "submit_national_federation_candidacy",
    {
      p_country_code: countryCode.data,
      p_manifesto: manifesto.data.replace(/\s+/g, " "),
    },
  );
  if (result.error) {
    console.error("Échec de candidature fédérale :", {
      code: result.error.code,
      message: result.error.message,
    });
    return {
      status: "error",
      message: result.error.message || "La candidature n’a pas été enregistrée.",
    };
  }

  revalidatePath(`/jeu/federations/${countryCode.data.toLowerCase()}`);
  return {
    status: "success",
    message: "Votre candidature est enregistrée dans le journal fédéral.",
  };
}

export async function voteFederationPresidentAction(
  _previousState: FederationGovernanceActionState,
  formData: FormData,
): Promise<FederationGovernanceActionState> {
  const countryCode = countryCodeSchema.safeParse(formData.get("countryCode"));
  const candidateId = candidateIdSchema.safeParse(formData.get("candidateId"));
  if (!countryCode.success || !candidateId.success) {
    return { status: "error", message: "Sélectionnez une candidature valide." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();
  if (authenticationError || !user) {
    return { status: "error", message: "Votre session a expiré." };
  }

  const result = await supabase.rpc("vote_national_federation_president", {
    p_country_code: countryCode.data,
    p_candidate_id: candidateId.data,
  });
  if (result.error) {
    console.error("Échec de vote fédéral :", {
      code: result.error.code,
      message: result.error.message,
    });
    return {
      status: "error",
      message: result.error.message || "Votre vote n’a pas été enregistré.",
    };
  }

  revalidatePath(`/jeu/federations/${countryCode.data.toLowerCase()}`);
  return {
    status: "success",
    message: "Votre voix est enregistrée. Vous pouvez la modifier jusqu’à J28.",
  };
}
