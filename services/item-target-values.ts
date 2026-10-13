import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ITEM_TARGET_RATING_KEYS,
  type ItemTargetRatingKey,
  type ItemTargetRider,
} from "@/lib/game/item-target-values";

export async function getCurrentTeamItemTargetRiders(
  supabase: SupabaseClient,
  halloween = false,
): Promise<ItemTargetRider[]> {
  const result = await supabase.rpc(halloween ? "get_current_halloween_item_target_values" : "get_current_team_item_target_values");

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
  const rawInjury = readObject(row.injury);
  const injuryId = readString(rawInjury.id);
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
      form: row.weightKg !== undefined ? Math.max(0, Math.min(100, readOptionalNumber(row.form) ?? 75)) : readBoundedInteger(row.form, 75, 0, 100),
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
      ...(row.weightKg !== undefined ? {
        weightKg: readOptionalNumber(row.weightKg),
        heightCm: readOptionalNumber(row.heightCm),
        age: readOptionalNumber(row.age),
        protectionExpiresAt: readNullableString(row.protectionExpiresAt),
      } : {}),
      injury: injuryId
        ? {
            id: injuryId,
            diagnosisCode: readString(rawInjury.diagnosisCode),
            label: readString(rawInjury.label) || "Blessure en cours",
            remainingHours: readBoundedInteger(
              rawInjury.remainingHours,
              1,
              1,
              24 * 365,
            ),
            expectedRecoveryAt: readString(rawInjury.expectedRecoveryAt),
            canShorten: readBoolean(rawInjury.canShorten),
          }
        : null,
    },
  ];
}

function readOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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

function readBoolean(value: unknown) {
  return value === true || value === "true";
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
