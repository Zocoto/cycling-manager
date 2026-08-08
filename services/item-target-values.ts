import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ITEM_TARGET_RATING_KEYS,
  type ItemTargetRatingKey,
  type ItemTargetRider,
} from "@/lib/game/item-target-values";

export async function getCurrentTeamItemTargetRiders(
  supabase: SupabaseClient
): Promise<ItemTargetRider[]> {
  const result = await supabase.rpc("get_current_team_item_target_values");

  if (result.error) {
    throw new Error(
      `Impossible de charger les valeurs des coureurs : ${result.error.message}`
    );
  }

  return readArray(result.data).flatMap(normalizeItemTargetRider);
}

function normalizeItemTargetRider(value: unknown): ItemTargetRider[] {
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  const id = readString(row.id);
  const firstName = readString(row.firstName);
  const lastName = readString(row.lastName);
  if (!id || !firstName || !lastName) return [];

  const rawRatings = readObject(row.ratings);
  const ratings = Object.fromEntries(
    ITEM_TARGET_RATING_KEYS.map((key) => [key, readRating(rawRatings[key])])
  ) as Record<ItemTargetRatingKey, number>;

  return [
    {
      id,
      firstName,
      lastName,
      name: readString(row.name) || `${firstName} ${lastName}`,
      countryName: readNullableString(row.countryName),
      form: readBoundedInteger(row.form, 75, 0, 100),
      experienceDays: readBoundedInteger(
        row.experienceDays,
        0,
        0,
        Number.MAX_SAFE_INTEGER
      ),
      potentialSteps: readBoundedInteger(row.potentialSteps, 1, 0, 8),
      ratings,
      abilityCodes: readArray(row.abilityCodes)
        .map(readString)
        .filter(Boolean),
    },
  ];
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNullableString(value: unknown) {
  return readString(value) || null;
}

function readRating(value: unknown) {
  return readBoundedInteger(value, 1, 1, 100);
}

function readBoundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(parsed)));
}
