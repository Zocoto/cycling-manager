"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  AMATEUR_JERSEY_PATTERNS,
  hasDistinctJerseyColors,
  normalizeHexColor,
  type AmateurJerseyConfig,
} from "@/lib/amateur-team";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { JerseyEditorState } from "./state";

const jerseyEditorSchema = z
  .object({
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
        message: "Choisissez au moins deux couleurs différentes.",
      });
    }
  });

export async function updateAmateurTeamJersey(
  _previousState: JerseyEditorState,
  formData: FormData
): Promise<JerseyEditorState> {
  const primaryColor = normalizeHexColor(
    getFormValue(formData, "primaryColor")
  );
  const secondaryColor = normalizeHexColor(
    getFormValue(formData, "secondaryColor")
  );
  const accentColor = normalizeHexColor(
    getFormValue(formData, "accentColor")
  );
  const validationResult = jerseyEditorSchema.safeParse({
    jerseyPattern: getFormValue(formData, "jerseyPattern").trim(),
    primaryColor: primaryColor ?? "",
    secondaryColor: secondaryColor ?? "",
    accentColor: accentColor ?? "",
  });

  if (!validationResult.success) {
    return {
      status: "error",
      message: "Le maillot contient des choix invalides.",
      fieldErrors: validationResult.error.flatten().fieldErrors,
      savedJersey: null,
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
        "Votre session a expiré. Reconnectez-vous avant de modifier le maillot.",
      fieldErrors: {},
      savedJersey: null,
    };
  }

  const jersey = toJerseyConfig(validationResult.data);
  const { error } = await supabase.rpc(
    "update_current_team_amateur_jersey",
    {
      p_jersey_pattern: jersey.pattern,
      p_jersey_primary_color: jersey.primaryColor,
      p_jersey_secondary_color: jersey.secondaryColor,
      p_jersey_accent_color: jersey.accentColor,
    }
  );

  if (error) {
    console.error("Échec de la mise à jour du maillot amateur :", {
      code: error.code,
      message: error.message,
      details: error.details,
    });

    return {
      status: "error",
      message:
        error.message ||
        "Le maillot n’a pas pu être enregistré. Réessayez dans quelques instants.",
      fieldErrors: {},
      savedJersey: null,
    };
  }

  revalidatePath("/jeu");
  revalidatePath("/jeu/maillot");
  revalidatePath("/jeu/effectif");
  revalidatePath("/jeu/directeur-sportif");
  revalidatePath("/jeu/centre-de-soin");
  revalidatePath("/jeu/entrainement");
  revalidatePath("/jeu/transferts");
  revalidatePath("/jeu/coureurs/[identifiant]", "page");
  revalidatePath("/jeu/equipes/[identifiant]", "page");

  return {
    status: "success",
    message:
      "Le nouveau maillot amateur est enregistré sur toute l’identité de l’équipe.",
    fieldErrors: {},
    savedJersey: jersey,
  };
}

function getFormValue(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value : "";
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
