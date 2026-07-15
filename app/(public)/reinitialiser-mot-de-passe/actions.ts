"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "../../../lib/supabase/server";
import type { PasswordUpdateState } from "./password-update-state";

const passwordUpdateSchema = z
  .object({
    password: z
      .string()
      .min(
        12,
        "Le mot de passe doit contenir au moins 12 caractères."
      )
      .max(
        72,
        "Le mot de passe ne peut pas dépasser 72 caractères."
      ),

    passwordConfirmation: z.string(),
  })
  .refine(
    ({ password, passwordConfirmation }) =>
      password === passwordConfirmation,
    {
      message: "Les deux mots de passe ne correspondent pas.",
      path: ["passwordConfirmation"],
    }
  );

export async function updatePassword(
  _previousState: PasswordUpdateState,
  formData: FormData
): Promise<PasswordUpdateState> {
  const password = getFormValue(formData, "password");

  const passwordConfirmation = getFormValue(
    formData,
    "passwordConfirmation"
  );

  const validationResult = passwordUpdateSchema.safeParse({
    password,
    passwordConfirmation,
  });

  if (!validationResult.success) {
    return {
      status: "error",
      message: "Certains champs doivent être corrigés.",
      fieldErrors: validationResult.error.flatten().fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return {
      status: "error",
      message:
        "Le lien de récupération est invalide ou a expiré. Demande un nouveau lien.",
      fieldErrors: {},
    };
  }

  const { error: updateError } =
    await supabase.auth.updateUser({
      password: validationResult.data.password,
    });

  if (updateError) {
    if (updateError.code === "weak_password") {
      return {
        status: "error",
        message:
          "Le nouveau mot de passe n’est pas suffisamment sécurisé.",
        fieldErrors: {
          password: [
            "Choisis un mot de passe plus difficile à deviner.",
          ],
        },
      };
    }

    if (updateError.code === "same_password") {
      return {
        status: "error",
        message:
          "Le nouveau mot de passe doit être différent de l’ancien.",
        fieldErrors: {
          password: [
            "Choisis un mot de passe différent de celui utilisé actuellement.",
          ],
        },
      };
    }

    if (updateError.code === "session_not_found") {
      return {
        status: "error",
        message:
          "La session de récupération a expiré. Demande un nouveau lien.",
        fieldErrors: {},
      };
    }

    console.error(
      "Échec de la modification du mot de passe Supabase :",
      {
        code: updateError.code,
        status: updateError.status,
        message: updateError.message,
      }
    );

    return {
      status: "error",
      message:
        "Le mot de passe n’a pas pu être modifié. Réessaie dans quelques instants.",
      fieldErrors: {},
    };
  }

  const { error: signOutError } = await supabase.auth.signOut({
    scope: "local",
  });

  if (signOutError) {
    console.error(
      "Le mot de passe a été modifié, mais la session de récupération n’a pas pu être fermée :",
      {
        code: signOutError.code,
        status: signOutError.status,
        message: signOutError.message,
      }
    );
  }

  redirect("/connexion?status=password-updated");
}

function getFormValue(
  formData: FormData,
  fieldName: string
): string {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value : "";
}