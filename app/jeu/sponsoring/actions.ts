"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SponsorJerseyStyle } from "@/services/sponsoring-workflow";

const JERSEY_STYLES: readonly SponsorJerseyStyle[] = [
  "classic",
  "modern",
  "bold",
];

const SPONSORING_REVALIDATION_PATHS = [
  "/jeu",
  "/jeu/sponsoring",
  "/jeu/directeur-sportif",
  "/jeu/effectif",
] as const;

export async function signSponsorOfferAction(
  formData: FormData
) {
  const offerId = readRequiredValue(
    formData,
    "offerId"
  );

  if (!isUuid(offerId)) {
    redirectWithError(
      "L’offre sélectionnée est invalide."
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc(
    "sign_sponsor_offer",
    {
      p_offer_id: offerId,
    }
  );

  if (error) {
    redirectWithError(error.message);
  }

  revalidateSponsoringPaths();

  redirect("/jeu/sponsoring");
}

export async function validateSponsorJerseyAction(
  formData: FormData
) {
  const contractId = readRequiredValue(
    formData,
    "contractId"
  );

  const jerseyId = readRequiredValue(
    formData,
    "jerseyId"
  );

  const jerseyStyleValue = readRequiredValue(
    formData,
    "jerseyStyle"
  );

  if (!isUuid(contractId)) {
    redirectWithError(
      "Le contrat sélectionné est invalide."
    );
  }

  if (!jerseyId) {
    redirectWithError(
      "Vous devez sélectionner un maillot."
    );
  }

  if (
    !isSponsorJerseyStyle(jerseyStyleValue)
  ) {
    redirectWithError(
      "Le style de maillot sélectionné est invalide."
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc(
    "validate_sponsor_jersey",
    {
      p_contract_id: contractId,
      p_jersey_id: jerseyId,
      p_jersey_style: jerseyStyleValue,
    }
  );

  if (error) {
    redirectWithError(error.message);
  }

  revalidateSponsoringPaths();

  redirect("/jeu/sponsoring");
}

export async function terminateSponsorContractAction(
  formData: FormData
) {
  const contractId = readRequiredValue(
    formData,
    "contractId"
  );

  if (!isUuid(contractId)) {
    redirectWithError(
      "Le contrat sélectionné est invalide."
    );
  }

  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc(
    "terminate_active_sponsor_contract",
    {
      p_contract_id: contractId,
    }
  );

  if (error) {
    redirectWithError(error.message);
  }

  revalidateSponsoringPaths();

  redirect(
    "/jeu/sponsoring?succes=rupture"
  );
}

function revalidateSponsoringPaths() {
  for (const path of
    SPONSORING_REVALIDATION_PATHS) {
    revalidatePath(path);
  }
}

function readRequiredValue(
  formData: FormData,
  key: string
): string {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function isSponsorJerseyStyle(
  value: string
): value is SponsorJerseyStyle {
  return JERSEY_STYLES.includes(
    value as SponsorJerseyStyle
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function redirectWithError(
  message: string
): never {
  const normalizedMessage =
    message.trim() ||
    "Une erreur est survenue pendant l’opération.";

  redirect(
    `/jeu/sponsoring?erreur=${encodeURIComponent(
      normalizedMessage
    )}`
  );
}
