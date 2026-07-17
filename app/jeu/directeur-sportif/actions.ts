"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "../../../lib/supabase/server";
import type { SportingDirectorProfileState } from "./profile-state";

const sportingDirectorAvatarKeys = [
  "director_m_01",
  "director_m_02",
  "director_m_03",
  "director_m_04",
  "director_m_05",
  "director_m_06",
  "director_f_01",
  "director_f_02",
  "director_f_03",
  "director_f_04",
  "director_f_05",
  "director_f_06",
] as const;

const sportingDirectorProfileSchema = z.object({
  displayName: z
    .string()
    .min(3, "Le nom doit contenir au moins 3 caractères.")
    .max(30, "Le nom ne peut pas dépasser 30 caractères.")
    .regex(
      /^[\p{L}\p{M}\p{N} .'-]+$/u,
      "Utilise uniquement des lettres, chiffres, espaces, apostrophes, points ou traits d’union."
    ),

  countryId: z
    .string()
    .uuid("Sélectionne une nationalité valide."),

  avatarKey: z
    .string()
    .refine(
      (value) =>
        sportingDirectorAvatarKeys.some(
          (avatarKey) => avatarKey === value
        ),
      {
        message:
          "Sélectionne un avatar dans la galerie proposée.",
      }
    ),

  hideEmail: z.boolean(),
});

export async function updateSportingDirectorProfile(
  _previousState: SportingDirectorProfileState,
  formData: FormData
): Promise<SportingDirectorProfileState> {
  const displayName = normalizeDisplayName(
    getFormValue(formData, "displayName")
  );

  const countryId = getFormValue(
    formData,
    "countryId"
  ).trim();

  const avatarKey = getFormValue(
    formData,
    "avatarKey"
  ).trim();

  const hideEmail =
    getFormValue(formData, "hideEmail") === "true";

  const validationResult =
    sportingDirectorProfileSchema.safeParse({
      displayName,
      countryId,
      avatarKey,
      hideEmail,
    });

  if (!validationResult.success) {
    return {
      status: "error",
      message: "Certains champs doivent être corrigés.",
      fieldErrors:
        validationResult.error.flatten().fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    return {
      status: "error",
      message:
        "Votre session a expiré. Reconnectez-vous avant de modifier votre profil.",
      fieldErrors: {},
    };
  }

  const {
    data: currentProfile,
    error: currentProfileError,
  } = await supabase
    .from("sporting_directors")
    .select("country_id")
    .eq("auth_user_id", user.id)
    .maybeSingle<{ country_id: string | null }>();

  if (currentProfileError || !currentProfile) {
    console.error(
      "Impossible de récupérer le profil du Directeur Sportif :",
      currentProfileError
    );

    return {
      status: "error",
      message:
        "Votre profil de Directeur Sportif est actuellement indisponible.",
      fieldErrors: {},
    };
  }

  if (
    currentProfile.country_id &&
    currentProfile.country_id !==
      validationResult.data.countryId
  ) {
    return {
      status: "error",
      message:
        "La nationalité ne peut plus être modifiée après la création de votre carrière.",
      fieldErrors: {
        countryId: [
          "Votre nationalité a déjà été validée définitivement.",
        ],
      },
    };
  }

  const { data: selectedCountry, error: countryError } =
    await supabase
      .from("countries")
      .select("id")
      .eq("id", validationResult.data.countryId)
      .eq("is_active", true)
      .maybeSingle<{ id: string }>();

  if (countryError || !selectedCountry) {
    return {
      status: "error",
      message: "La nationalité sélectionnée est invalide.",
      fieldErrors: {
        countryId: [
          "Sélectionne un pays disponible dans la liste.",
        ],
      },
    };
  }

  const { error: updateError } = await supabase
    .from("sporting_directors")
    .update({
      display_name: validationResult.data.displayName,
      country_id: validationResult.data.countryId,
      avatar_key: validationResult.data.avatarKey,
      is_email_visible:
        !validationResult.data.hideEmail,
    })
    .eq("auth_user_id", user.id);

  if (updateError) {
    console.error(
      "Échec de la mise à jour du Directeur Sportif :",
      {
        code: updateError.code,
        message: updateError.message,
      }
    );

    return {
      status: "error",
      message:
        "Impossible d’enregistrer votre profil. Réessayez dans quelques instants.",
      fieldErrors: {},
    };
  }

  revalidatePath("/jeu");
  revalidatePath("/jeu/directeur-sportif");

  return {
    status: "success",
    message:
      "Votre profil de Directeur Sportif a bien été enregistré.",
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

function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}