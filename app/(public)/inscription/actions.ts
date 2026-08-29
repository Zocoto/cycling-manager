"use server";

import { z } from "zod";

import { getPublicSiteUrl } from "../../../lib/auth/public-site-url";
import { legalConfig } from "../../../lib/legal-config";
import { readMarketingAttributionFromFormData } from "../../../lib/marketing/attribution";

import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import type { RegistrationState } from "./registration-state";

const registrationSchema = z
  .object({
    managerName: z
      .string()
      .min(3, "Le nom doit contenir au moins 3 caractères.")
      .max(30, "Le nom ne peut pas dépasser 30 caractères.")
      .regex(
        /^[\p{L}\p{M}\p{N} .'-]+$/u,
        "Utilise uniquement des lettres, chiffres, espaces, apostrophes, points ou traits d’union."
      ),

    email: z.string().email("Saisis une adresse e-mail valide."),

    password: z
      .string()
      .min(12, "Le mot de passe doit contenir au moins 12 caractères.")
      .max(72, "Le mot de passe ne peut pas dépasser 72 caractères."),

    passwordConfirmation: z.string(),

    legalAcceptance: z.string().refine(
      (value) => value === "accepted",
      "Vous devez accepter les conditions d’utilisation et prendre connaissance de la politique de confidentialité.",
    ),

    referralCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^DS-[A-F0-9]{12}$/, "Le lien de parrainage est invalide.")
      .or(z.literal("")),
  })
  .refine(
    ({ password, passwordConfirmation }) =>
      password === passwordConfirmation,
    {
      message: "Les deux mots de passe ne correspondent pas.",
      path: ["passwordConfirmation"],
    }
  );

export async function registerAccount(
  _previousState: RegistrationState,
  formData: FormData
): Promise<RegistrationState> {
  const managerName = normalizeManagerName(
    getFormValue(formData, "managerName")
  );

  const email = getFormValue(formData, "email")
    .trim()
    .toLowerCase();

  const password = getFormValue(formData, "password");

  const passwordConfirmation = getFormValue(
    formData,
    "passwordConfirmation"
  );

  const referralCode = getFormValue(formData, "referralCode");

  const legalAcceptance = getFormValue(
    formData,
    "legalAcceptance",
  );

  const marketingAttribution =
    readMarketingAttributionFromFormData(formData);

  const validationResult = registrationSchema.safeParse({
    managerName,
    email,
    password,
    passwordConfirmation,
    legalAcceptance,
    referralCode,
  });

  if (!validationResult.success) {
    return {
      status: "error",
      message: "Certains champs doivent être corrigés.",
      fieldErrors: validationResult.error.flatten().fieldErrors,
    };
  }

  const siteUrl = getPublicSiteUrl();

  if (!siteUrl) {
    console.error(
      "La variable NEXT_PUBLIC_SITE_URL est absente ou invalide."
    );

    return {
      status: "error",
      message:
        "La création de compte est temporairement indisponible.",
      fieldErrors: {},
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signUp({
    email: validationResult.data.email,
    password: validationResult.data.password,
    options: {
      emailRedirectTo: `${siteUrl}/inscription/confirmer`,
      data: {
        manager_name: validationResult.data.managerName,
        referral_code: validationResult.data.referralCode || null,
        legal_acceptance: "accepted",
        terms_version: legalConfig.termsVersion,
        privacy_notice_version: legalConfig.privacyNoticeVersion,
        ...(Object.keys(marketingAttribution).length > 0
          ? {
              marketing_attribution: marketingAttribution,
            }
          : {}),
      },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return {
        status: "error",
        message:
          "Le mot de passe choisi n’est pas suffisamment sécurisé.",
        fieldErrors: {
          password: [
            "Choisis un mot de passe plus difficile à deviner.",
          ],
        },
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

    if (error.code === "email_address_not_authorized") {
      return {
        status: "error",
        message:
          "L’e-mail de confirmation n’a pas pu être envoyé à cette adresse. Réessaie dans quelques instants ou contacte l’assistance.",
        fieldErrors: {},
      };
    }

    if (error.code === "over_email_send_rate_limit") {
      return {
        status: "error",
        message:
          "Trop de demandes ont été effectuées. Attends quelques minutes avant de réessayer.",
        fieldErrors: {},
      };
    }

    if (error.code === "signup_disabled") {
      return {
        status: "error",
        message:
          "La création de compte est temporairement indisponible.",
        fieldErrors: {},
      };
    }

    console.error("Échec de l’inscription Supabase :", {
      code: error.code,
      status: error.status,
      message: error.message,
    });

    return {
      status: "error",
      message:
        "Impossible de créer ce compte. Vérifie le nom choisi et réessaie.",
      fieldErrors: {},
    };
  }

  if (!data.user) {
    return {
      status: "error",
      message: "La création du compte n’a pas pu être finalisée.",
      fieldErrors: {},
    };
  }

  const admin = createSupabaseAdminClient();
  const { error: legalAcceptanceError } = await admin
    .from("user_legal_acceptances")
    .insert({
      user_id: data.user.id,
      terms_version: legalConfig.termsVersion,
      privacy_notice_version: legalConfig.privacyNoticeVersion,
    });

  if (legalAcceptanceError) {
    console.error(
      "Échec de l’enregistrement de l’acceptation légale :",
      legalAcceptanceError,
    );
    await admin.auth.admin.deleteUser(data.user.id);

    return {
      status: "error",
      message:
        "La création du compte n’a pas pu être finalisée. Réessaie dans quelques instants.",
      fieldErrors: {},
    };
  }

  const confirmationRequired = data.session === null;

  if (data.session) {
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      console.error(
        "Le compte a été créé, mais la session locale n’a pas pu être fermée :",
        signOutError
      );
    }
  }

  return {
    status: "success",
    message: confirmationRequired
      ? "Ton compte a été créé. Consulte ta boîte e-mail et confirme ton adresse avant de te connecter."
      : "Ton compte a été créé, mais la vérification e-mail n’est pas active. Contacte l’assistance avant de commencer ta carrière.",
    fieldErrors: {},
    email: validationResult.data.email,
  };
}

function getFormValue(
  formData: FormData,
  fieldName: string
): string {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value : "";
}

function normalizeManagerName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
