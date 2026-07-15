"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "../../lib/supabase/server";

export async function logoutAccount(): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signOut({
    scope: "local",
  });

  if (error) {
    console.error("Échec de la déconnexion Supabase :", {
      code: error.code,
      status: error.status,
      message: error.message,
    });
  }

  redirect("/connexion");
}