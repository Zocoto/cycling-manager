"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function confirmSignupEmailAction(
  formData: FormData,
): Promise<never> {
  const tokenHash = getFormValue(formData, "tokenHash").trim();

  if (tokenHash.length < 20 || tokenHash.length > 1024) {
    redirect("/inscription/confirmee?status=error");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });

  if (error) {
    console.error(
      "Échec de la confirmation explicite de l’adresse e-mail :",
      {
        code: error.code,
        status: error.status,
        message: error.message,
      },
    );
    redirect("/inscription/confirmee?status=error");
  }

  const { error: signOutError } =
    await supabase.auth.signOut();

  if (signOutError) {
    console.error(
      "L’adresse e-mail est confirmée, mais la session temporaire n’a pas pu être fermée :",
      {
        code: signOutError.code,
        status: signOutError.status,
        message: signOutError.message,
      },
    );
  }

  redirect("/inscription/confirmee?status=success");
}

function getFormValue(
  formData: FormData,
  fieldName: string,
): string {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value : "";
}
