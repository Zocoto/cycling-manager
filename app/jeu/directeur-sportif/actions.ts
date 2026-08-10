"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isAccountDeletionConfirmed } from "../../../lib/account-deletion";
import {
  AMATEUR_JERSEY_PATTERNS,
  hasDistinctJerseyColors,
  normalizeHexColor,
  type AmateurJerseyConfig,
} from "../../../lib/amateur-team";
import { generateInitialRiderIdentities } from "../../../lib/rider-names/generate-rider-identities";
import { ALPHA_TESTER_TROPHY_KEY } from "../../../lib/game/trophy-gallery";
import {
  ASSIDU_AVATAR_GLASSES_KEY,
  decodeCustomSportingDirectorAvatar,
  isSportingDirectorAvatarKey,
} from "../../../lib/sporting-director-avatar";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import type { AmateurTeamCreationState } from "./amateur-team-state";
import type { SportingDirectorProfileState } from "./profile-state";
import {
  setTutorialStepAction,
} from "../tutorial-actions";
import { ONBOARDING_TUTORIAL_KEY } from "@/lib/tutorial/onboarding";

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
    .max(512, "La configuration de l’avatar est trop longue.")
    .refine(isSportingDirectorAvatarKey, {
      message:
        "La configuration de l’avatar est invalide. Ouvre l’éditeur pour la recréer.",
    }),

  hideEmail: z.boolean(),
  alphaTesterFrameEnabled: z.boolean(),
});

type CurrentSportingDirectorProfile = {
  id: string;
  country_id: string | null;
  avatar_key: string | null;
};

type AmateurTeamDirectorProfile = {
  country_id: string | null;
  avatar_key: string | null;
};

type RiderGenerationProfile = {
  name_profile_code: string;
  avatar_profile_key: string;
};

type CareerGenerationResult = {
  status?:
    | "created"
    | "configured_existing"
    | "already_created";
  team_id?: string;
  season_id?: string;
  rider_count?: number;
  generation_version?: number;
};

const amateurTeamSchema = z
  .object({
    teamName: z
      .string()
      .min(3, "Le nom doit contenir au moins 3 caractères.")
      .max(40, "Le nom ne peut pas dépasser 40 caractères.")
      .regex(
        /^[\p{L}\p{M}\p{N} .&'’-]+$/u,
        "Utilise uniquement des lettres, chiffres, espaces et signes simples."
      ),
    countryId: z.string().uuid("Sélectionne un pays valide."),
    jerseyPattern: z.enum(AMATEUR_JERSEY_PATTERNS),
    primaryColor: z.string().regex(/^#[0-9A-F]{6}$/),
    secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/),
    accentColor: z.string().regex(/^#[0-9A-F]{6}$/),
  })
  .superRefine((value, context) => {
    if (!hasDistinctJerseyColors(toJerseyConfig(value))) {
      context.addIssue({
        code: "custom",
        path: ["secondaryColor"],
        message: "Choisis au moins deux couleurs différentes.",
      });
    }
  });

export type AccountDeletionState = {
  status: "idle" | "error";
  message: string | null;
};

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

  const alphaTesterFrameEnabled =
    getFormValue(formData, "alphaTesterFrameEnabled") === "true";

  const validationResult =
    sportingDirectorProfileSchema.safeParse({
      displayName,
      countryId,
      avatarKey,
      hideEmail,
      alphaTesterFrameEnabled,
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
    .select("id, country_id, avatar_key")
    .eq("auth_user_id", user.id)
    .maybeSingle<CurrentSportingDirectorProfile>();

  if (currentProfileError || !currentProfile) {
    console.error(
      "Impossible de récupérer le profil du Directeur Sportif :",
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

  const selectedAvatar = decodeCustomSportingDirectorAvatar(
    validationResult.data.avatarKey,
  );

  if (selectedAvatar?.outfit === "patron") {
    const referralCountResult = await supabase
      .from("sporting_director_referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_director_id", currentProfile.id)
      .eq("status", "qualified");

    if (referralCountResult.error) {
      return {
        status: "error",
        message: "Le déblocage de cette tenue n’a pas pu être vérifié.",
        fieldErrors: {},
      };
    }

    if ((referralCountResult.count ?? 0) < 5) {
      return {
        status: "error",
        message: "La tenue du Parrain nécessite 5 filleuls qualifiés.",
        fieldErrors: {
          avatarKey: [
            "Terminez le palier « Le Parrain » avant de choisir cette tenue.",
          ],
        },
      };
    }
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

  const avatarConfig = decodeCustomSportingDirectorAvatar(
    validationResult.data.avatarKey,
  );

  if (avatarConfig?.glasses === ASSIDU_AVATAR_GLASSES_KEY) {
    const { data: assiduTrophy, error: assiduTrophyError } = await supabase
      .from("sporting_director_attendance_trophies")
      .select("id")
      .eq("sporting_director_id", currentProfile.id)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (assiduTrophyError || !assiduTrophy) {
      return {
        status: "error",
        message: "Les lunettes Premier de la classe ne sont pas encore disponibles.",
        fieldErrors: {
          avatarKey: [
            "Terminez une saison en vous connectant chaque jour pour débloquer cet accessoire.",
          ],
        },
      };
    }
  }

  if (validationResult.data.alphaTesterFrameEnabled) {
    const { data: alphaTesterTrophy, error: alphaTesterTrophyError } =
      await supabase
        .from("sporting_director_trophies")
        .select("id")
        .eq("sporting_director_id", currentProfile.id)
        .eq("trophy_key", ALPHA_TESTER_TROPHY_KEY)
        .not("claimed_at", "is", null)
        .maybeSingle<{ id: string }>();

    if (alphaTesterTrophyError || !alphaTesterTrophy) {
      return {
        status: "error",
        message: "Le liseré Alphatesteur n’est pas encore disponible.",
        fieldErrors: {
          alphaTesterFrameEnabled: [
            "Ouvrez d’abord le trophée Alphatesteur dans votre galerie.",
          ],
        },
      };
    }
  }

  const { error: updateError } = await supabase
    .from("sporting_directors")
    .update({
      display_name: validationResult.data.displayName,
      country_id: validationResult.data.countryId,
      avatar_key: validationResult.data.avatarKey,
      avatar_frame_key: validationResult.data.alphaTesterFrameEnabled
        ? "alpha_tester"
        : null,
      is_email_visible:
        !validationResult.data.hideEmail,
    })
    .eq("auth_user_id", user.id);

  if (updateError) {
    console.error(
      "Échec de la mise à jour du Directeur Sportif :",
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

  revalidateSportingDirectorPages();

  const wasProfileComplete =
    Boolean(
      currentProfile.country_id &&
        currentProfile.avatar_key,
    );

  if (!wasProfileComplete) {
    const result = await setTutorialStepAction({
      tutorialKey: ONBOARDING_TUTORIAL_KEY,
      stepKey: "team-foundation",
      route: "/jeu/directeur-sportif",
    });

    if (!result.ok) {
      // Ignorer silencieusement : le didacticiel peut
      // ne pas être démarré pour ce compte.
    }
  }

  return {
    status: "success",
    message:
      currentProfile.country_id
        ? "Votre profil de Directeur Sportif a bien été enregistré."
        : "Votre profil est enregistré. Vous pouvez maintenant fonder votre équipe amateur.",
    fieldErrors: {},
  };
}

export async function createAmateurTeam(
  _previousState: AmateurTeamCreationState,
  formData: FormData
): Promise<AmateurTeamCreationState> {
  const teamName = normalizeDisplayName(
    getFormValue(formData, "teamName")
  );
  const countryId = getFormValue(formData, "countryId").trim();
  const jerseyPattern = getFormValue(
    formData,
    "jerseyPattern"
  ).trim();
  const primaryColor = normalizeHexColor(
    getFormValue(formData, "primaryColor")
  );
  const secondaryColor = normalizeHexColor(
    getFormValue(formData, "secondaryColor")
  );
  const accentColor = normalizeHexColor(
    getFormValue(formData, "accentColor")
  );

  const validationResult = amateurTeamSchema.safeParse({
    teamName,
    countryId,
    jerseyPattern,
    primaryColor: primaryColor ?? "",
    secondaryColor: secondaryColor ?? "",
    accentColor: accentColor ?? "",
  });

  if (!validationResult.success) {
    return {
      status: "error",
      message: "Certains éléments de l’équipe doivent être corrigés.",
      fieldErrors: validationResult.error.flatten().fieldErrors,
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
        "Votre session a expiré. Reconnectez-vous avant de fonder votre équipe.",
      fieldErrors: {},
    };
  }

  const { data: director, error: directorError } = await supabase
    .from("sporting_directors")
    .select("country_id, avatar_key")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle<AmateurTeamDirectorProfile>();

  if (directorError || !director) {
    return {
      status: "error",
      message: "Votre profil de Directeur Sportif est indisponible.",
      fieldErrors: {},
    };
  }

  if (!director.country_id || !director.avatar_key) {
    return {
      status: "error",
      message:
        "Validez d’abord la nationalité et l’avatar de votre Directeur Sportif.",
      fieldErrors: {},
    };
  }

  const { data: selectedCountry, error: countryError } = await supabase
    .from("countries")
    .select("id")
    .eq("id", validationResult.data.countryId)
    .eq("is_active", true)
    .maybeSingle<{ id: string }>();

  if (countryError || !selectedCountry) {
    return {
      status: "error",
      message: "Le pays d’affiliation sélectionné est invalide.",
      fieldErrors: {
        countryId: ["Sélectionne un pays disponible dans la liste."],
      },
    };
  }

  const { data: generationProfile, error: generationProfileError } =
    await supabase
      .rpc("get_rider_generation_profile_for_country", {
        p_country_id: validationResult.data.countryId,
      })
      .maybeSingle<RiderGenerationProfile>();

  if (generationProfileError || !generationProfile) {
    console.error(
      "Impossible de récupérer le profil de génération du pays de l’équipe :",
      generationProfileError
    );

    return {
      status: "error",
      message:
        "Ce pays ne dispose pas encore d’un profil de génération de coureurs.",
      fieldErrors: { countryId: ["Choisis un autre pays pour le moment."] },
    };
  }

  let riderIdentities;

  try {
    riderIdentities = generateInitialRiderIdentities(
      generationProfile.name_profile_code
    );
  } catch (error) {
    console.error(
      "Impossible de générer les identités des coureurs :",
      error
    );

    return {
      status: "error",
      message:
        "Les identités des coureurs n’ont pas pu être préparées. Réessayez dans quelques instants.",
      fieldErrors: {},
    };
  }

  const { data: careerGenerationData, error: careerGenerationError } =
    await supabase.rpc("initialize_sporting_director_career_v2", {
      p_rider_identities: riderIdentities,
      p_team_name: validationResult.data.teamName,
      p_team_country_id: validationResult.data.countryId,
      p_jersey_pattern: validationResult.data.jerseyPattern,
      p_jersey_primary_color: validationResult.data.primaryColor,
      p_jersey_secondary_color: validationResult.data.secondaryColor,
      p_jersey_accent_color: validationResult.data.accentColor,
    });

  if (careerGenerationError) {
    console.error("Échec de la fondation de l’équipe amateur :", {
      code: careerGenerationError.code,
      message: careerGenerationError.message,
      details: careerGenerationError.details,
      hint: careerGenerationError.hint,
    });

    return {
      status: "error",
      message:
        careerGenerationError.message ||
        "Votre équipe n’a pas pu être créée. Réessayez dans quelques instants.",
      fieldErrors: {},
    };
  }

  const result = careerGenerationData as CareerGenerationResult | null;

  revalidateSportingDirectorPages();
  revalidatePath("/jeu/effectif");
  revalidatePath("/jeu/sponsoring");

  return {
    status: "success",
    message:
      result?.status === "configured_existing"
        ? "L’identité fondatrice de votre équipe a bien été enregistrée."
        : result?.status === "already_created"
          ? "L’identité amateur de votre équipe était déjà configurée."
          : "Votre équipe amateur et ses 7 premiers coureurs ont bien été créés.",
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

function toJerseyConfig(value: {
  jerseyPattern: (typeof AMATEUR_JERSEY_PATTERNS)[number];
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}): AmateurJerseyConfig {
  return {
    pattern: value.jerseyPattern,
    primaryColor: value.primaryColor,
    secondaryColor: value.secondaryColor,
    accentColor: value.accentColor,
  };
}

function revalidateSportingDirectorPages(): void {
  revalidatePath("/jeu");
  revalidatePath("/jeu/directeur-sportif");
  revalidatePath("/jeu/recherche");
  revalidatePath("/jeu/nations/[codePays]", "page");
  revalidatePath("/jeu/directeurs-sportifs/[identifiantPublic]", "page");
}

export async function deleteSportingDirectorAccount(
  _previousState: AccountDeletionState,
  formData: FormData
): Promise<AccountDeletionState> {
  const confirmation = getFormValue(
    formData,
    "confirmation"
  );

  if (!isAccountDeletionConfirmed(confirmation)) {
    return {
      status: "error",
      message:
        "Saisissez exactement SUPPRIMER pour confirmer cette action définitive.",
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
        "Votre session a expiré. Reconnectez-vous avant de supprimer votre compte.",
    };
  }

  const { error: careerDeletionError } =
    await supabase.rpc(
      "delete_current_sporting_director_account"
    );

  if (careerDeletionError) {
    console.error(
      "Échec de la suppression de la carrière du Directeur Sportif :",
      {
        code: careerDeletionError.code,
        message: careerDeletionError.message,
      }
    );

    return {
      status: "error",
      message:
        careerDeletionError.message.includes(
          "résultats officiels"
        )
          ? careerDeletionError.message
          : "La carrière n’a pas pu être supprimée. Aucune suppression partielle n’a été effectuée.",
    };
  }

  const adminSupabase = createSupabaseAdminClient();
  const { error: authDeletionError } =
    await adminSupabase.auth.admin.deleteUser(user.id);

  if (authDeletionError) {
    console.error(
      "La carrière a été supprimée mais le compte Auth doit être supprimé de nouveau :",
      {
        code: authDeletionError.code,
        message: authDeletionError.message,
      }
    );

    return {
      status: "error",
      message:
        "La carrière a été supprimée, mais la fermeture du compte de connexion doit être relancée. Cliquez de nouveau sur Supprimer mon compte.",
    };
  }

  const { error: signOutError } =
    await supabase.auth.signOut({ scope: "local" });

  if (signOutError) {
    console.warn(
      "Le compte a été supprimé mais la session locale n’a pas pu être révoquée explicitement :",
      signOutError.message
    );
  }

  redirect("/connexion?status=account-deleted");
}
