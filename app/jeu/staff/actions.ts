"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function hireStaffMemberAction(formData: FormData) {
  const listingId = readValue(formData, "listingId");
  const returnPath = safeReturnPath(readValue(formData, "returnPath"));

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
    "/jeu/staff?onglet=equipe",
    "succes",
    "Le nouveau membre du staff a rejoint votre équipe.",
  );
}

function safeReturnPath(value: string) {
  return value.startsWith("/jeu/staff") && !value.startsWith("//")
    ? value
    : "/jeu/staff";
}

function redirectWithMessage(
  path: string,
  key: "succes" | "erreur",
  message: string,
): never {
  redirect(
    `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(
      message.slice(0, 280),
    )}`,
  );
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
