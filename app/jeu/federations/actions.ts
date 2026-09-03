"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import {
  NATIONAL_JERSEY_ELEMENT_KINDS,
  NATIONAL_JERSEY_ELEMENT_SHAPES,
  NATIONAL_JERSEY_MAX_ELEMENTS,
  normalizeNationalJerseyDraft,
  type NationalJerseyDraft,
} from "@/lib/game/national-jersey-preview";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type NationalJerseyPublishState = {
  status: "idle" | "success" | "error";
  message: string;
  publishedDesign: NationalJerseyDraft | null;
  version: number | null;
};

export const initialNationalJerseyPublishState: NationalJerseyPublishState = {
  status: "idle",
  message: "",
  publishedDesign: null,
  version: null,
};

const colorSchema = z.string().regex(/^#[0-9A-F]{6}$/);
const nationalJerseyElementSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,48}$/),
  kind: z.enum(NATIONAL_JERSEY_ELEMENT_KINDS),
  shape: z.enum(NATIONAL_JERSEY_ELEMENT_SHAPES),
  color: colorSchema,
  secondaryColor: colorSchema,
  x: z.number().finite().min(-60).max(180),
  y: z.number().finite().min(-60).max(190),
  width: z.number().finite().min(4).max(220),
  height: z.number().finite().min(4).max(220),
  rotation: z.number().finite().min(-180).max(180),
  opacity: z.number().finite().min(0.15).max(1),
});
const nationalJerseySchema = z.object({
  schemaVersion: z.literal(2),
  baseColor: colorSchema,
  elements: z
    .array(nationalJerseyElementSchema)
    .max(NATIONAL_JERSEY_MAX_ELEMENTS),
});

export async function publishNationalFederationJersey(
  _previousState: NationalJerseyPublishState,
  formData: FormData,
): Promise<NationalJerseyPublishState> {
  const countryCode = readFormValue(formData, "countryCode")
    .trim()
    .toUpperCase();
  const rawDesign = readFormValue(formData, "design");

  if (!/^[A-Z]{2}$/.test(countryCode) || rawDesign.length > 20_000) {
    return failure("Le maillot transmis est invalide.");
  }

  let parsedDesign: unknown;
  try {
    parsedDesign = JSON.parse(rawDesign);
  } catch {
    return failure("Le maillot transmis est illisible.");
  }

  const validation = nationalJerseySchema.safeParse(parsedDesign);
  if (!validation.success) {
    return failure(
      `Le maillot contient un élément invalide ou dépasse ${NATIONAL_JERSEY_MAX_ELEMENTS} éléments.`,
    );
  }

  const design = normalizeNationalJerseyDraft(validation.data);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authenticationError,
  } = await supabase.auth.getUser();

  if (authenticationError || !user) {
    return failure("Votre session a expiré. Reconnectez-vous puis réessayez.");
  }

  const { data, error } = await supabase.rpc(
    "publish_national_federation_jersey",
    {
      p_country_code: countryCode,
      p_design: design,
    },
  );

  if (error) {
    console.error("Échec de publication du maillot fédéral :", {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return failure(
      error.message || "Le maillot n’a pas pu être publié pour le moment.",
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  const version = readPublishedVersion(row);

  revalidatePath(`/jeu/federations/${countryCode.toLowerCase()}`);
  updateTag("national-federation-jerseys");
  revalidatePath("/jeu/calendrier");
  revalidatePath("/jeu/resultats");
  revalidatePath("/jeu/courses/[slug]", "page");

  return {
    status: "success",
    message: `Maillot national publié${version ? ` · version ${version}` : ""}. Il sera utilisé par la sélection sur les courses internationales.`,
    publishedDesign: design,
    version,
  };
}

function readFormValue(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}

function readPublishedVersion(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const rawVersion = (value as { version?: unknown }).version;
  return typeof rawVersion === "number" && Number.isInteger(rawVersion)
    ? rawVersion
    : null;
}

function failure(message: string): NationalJerseyPublishState {
  return {
    status: "error",
    message,
    publishedDesign: null,
    version: null,
  };
}
