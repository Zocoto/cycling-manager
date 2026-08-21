"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  sanitizeStaffMarketReturnPath,
  withPageFeedback,
} from "@/lib/game/filtered-page-paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function hireStaffMemberAction(formData: FormData) {
  const listingId = readValue(formData, "listingId");
  const returnPath = sanitizeStaffMarketReturnPath(
    readValue(formData, "returnPath"),
  );

  if (!isUuid(listingId)) {
    redirectWithMessage(
      returnPath,
      "erreur",
      "Le profil de staff transmis est invalide.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc("hire_current_team_staff", {
    p_listing_id: listingId,
  });

  if (error) {
    redirectWithMessage(returnPath, "erreur", error.message);
  }

  revalidatePath("/jeu/staff");
  revalidatePath("/jeu/finances");
  revalidatePath("/jeu");
  redirectWithMessage(
    returnPath,
    "succes",
    "Le nouveau membre du staff a rejoint votre équipe.",
  );
}

export async function dismissStaffMemberAction(formData: FormData) {
  const contractId = readValue(formData, "contractId");
  const returnPath = "/jeu/staff?onglet=equipe";

  if (!isUuid(contractId)) {
    redirectWithMessage(
      returnPath,
      "erreur",
      "Le contrat de staff transmis est invalide.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc("dismiss_current_team_staff", {
    p_contract_id: contractId,
  });

  if (error) {
    redirectWithMessage(returnPath, "erreur", error.message);
  }

  revalidatePath("/jeu");
  revalidatePath("/jeu/staff");
  revalidatePath("/jeu/finances");
  revalidatePath("/jeu/entrainement");
  revalidatePath("/jeu/centre-de-formation");
  revalidatePath("/jeu/centre-de-soin");
  revalidatePath("/jeu/infrastructures");
  redirectWithMessage(
    returnPath,
    "succes",
    "Le membre du staff a été licencié et son indemnité a été débitée.",
  );
}

export async function naturalizeStaffMemberAction(formData: FormData) {
  const contractId = readValue(formData, "contractId");
  const returnPath = "/jeu/staff?onglet=equipe";

  if (!isUuid(contractId)) {
    redirectWithMessage(
      returnPath,
      "erreur",
      "Le contrat de staff transmis est invalide.",
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    redirect("/connexion");
  }

  const { error } = await supabase.rpc("naturalize_current_team_staff", {
    p_contract_id: contractId,
  });

  if (error) {
    redirectWithMessage(returnPath, "erreur", error.message);
  }

  revalidatePath("/jeu");
  revalidatePath("/jeu/staff");
  revalidatePath("/jeu/entrainement");
  revalidatePath("/jeu/infrastructures");
  redirectWithMessage(
    returnPath,
    "succes",
    "Le membre du staff a obtenu la nationalité sportive de votre équipe.",
  );
}
function redirectWithMessage(
  path: string,
  key: "succes" | "erreur",
  message: string,
): never {
  redirect(withPageFeedback(path, key, message));
}

function readValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
