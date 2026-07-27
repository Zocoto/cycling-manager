"use server";

import { z } from "zod";

import { getPublicSiteUrl } from "@/lib/auth/public-site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { VerificationEmailState } from "./verification-email-state";

const verificationEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Saisis une adresse e-mail valide."),
});

export async function resendSignupConfirmation(
  _previousState: VerificationEmailState,
  formData: FormData,
): Promise<VerificationEmailState> {
  const email = getFormValue(formData, "email")
    .trim()
    .toLowerCase();
  const validationResult =
    verificationEmailSchema.safeParse({ email });

  if (!validationResult.success) {
    return {
      status: "error",
      message: "L’adresse e-mail doit être corrigée.",
      fieldErrors:
        validationResult.error.flatten().fieldErrors,
    };
  }

  const siteUrl = getPublicSiteUrl();

  if (!siteUrl) {
    console.error(
      "La variable NEXT_PUBLIC_SITE_URL est absente ou invalide.",
    );
    return {
      status: "error",
      message:
        "Le renvoi est temporairement indisponible. Réessaie dans quelques instants.",
      fieldErrors: {},
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: validationResult.data.email,
    options: {
      emailRedirectTo: `${siteUrl}/inscription/confirmer`,
    },
  });

  if (error) {
    if (
      error.code === "over_email_send_rate_limit" ||
      error.code === "over_request_rate_limit"
    ) {
      return {
        status: "error",
        message:
          "Un e-mail vient peut-être déjà d’être envoyé. Attends au moins une minute avant de réessayer.",
        fieldErrors: {},
      };
    }

    if (error.code === "email_address_invalid") {
      return {
        status: "error",
        message: "L’adresse e-mail indiquée n’est pas valide.",
        fieldErrors: {
          email: ["Saisis une adresse e-mail valide."],
        },
      };
    }

    if (error.code !== "user_not_found") {
      console.error(
        "Échec du renvoi de la confirmation Supabase :",
        {
          code: error.code,
          status: error.status,
          message: error.message,
        },
      );

      return {
        status: "error",
        message:
          "Le renvoi est temporairement indisponible. Réessaie dans quelques instants.",
        fieldErrors: {},
      };
    }
  }

  return {
    status: "success",
    message:
      "Si cette adresse correspond à un compte en attente, un nouvel e-mail de confirmation vient d’être envoyé. Vérifie aussi les courriers indésirables.",
    fieldErrors: {},
  };
}

function getFormValue(
  formData: FormData,
  fieldName: string,
): string {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value : "";
}
