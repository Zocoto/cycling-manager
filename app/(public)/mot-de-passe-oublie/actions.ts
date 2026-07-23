"use server";

import { z } from "zod";

import { createSupabaseServerClient } from "../../../lib/supabase/server";
import type { ResetRequestState } from "./reset-request-state";

const resetRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Saisis une adresse e-mail valide."),
});

export async function requestPasswordReset(
  _previousState: ResetRequestState,
  formData: FormData
): Promise<ResetRequestState> {
  const email = getFormValue(formData, "email")
    .trim()
    .toLowerCase();

  const validationResult = resetRequestSchema.safeParse({
    email,
  });

  if (!validationResult.success) {
    return {
      status: "error",
      message: "Le formulaire doit être corrigé.",
      fieldErrors: validationResult.error.flatten().fieldErrors,
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(
    /\/+$/,
    ""
  );

  if (!siteUrl) {
    console.error(
      "La variable NEXT_PUBLIC_SITE_URL est manquante."
    );

    return {
      status: "error",
      message:
        "La récupération du mot de passe est temporairement indisponible.",
      fieldErrors: {},
    };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.resetPasswordForEmail(
    validationResult.data.email,
    {
      redirectTo: `${siteUrl}/auth/reset-password`,
    }
  );

  if (error) {
    if (error.code === "over_email_send_rate_limit") {
      return {
        status: "error",
        message:
          "Trop de demandes ont été effectuées. Attends quelques minutes avant de réessayer.",
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

    console.error(
      "Échec de la demande de réinitialisation Supabase :",
      {
        code: error.code,
        status: error.status,
        message: error.message,
      }
    );

    return {
      status: "error",
      message:
        "La récupération du mot de passe est temporairement indisponible. Réessaie dans quelques instants.",
      fieldErrors: {},
    };
  }

  return {
    status: "success",
    message:
      "Si un compte correspond à cette adresse, un e-mail de réinitialisation vient d’être envoyé.",
    fieldErrors: {},
  };
}

function getFormValue(
  formData: FormData,
  fieldName: string
): string {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value : "";
}