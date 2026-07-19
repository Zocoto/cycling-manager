import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  groupGlobalSearchResults,
  type GlobalSearchResult,
  type GroupedGlobalSearchResults,
} from "@/lib/game/global-search";
import { searchGameDirectory } from "@/services/global-search";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type PublicCountryDirectory = {
  country: GlobalSearchResult;
  members: GroupedGlobalSearchResults;
};

export async function getPublicSportingDirector(
  supabase: SupabaseServerClient,
  publicIdentifier: string
): Promise<GlobalSearchResult | null> {
  const normalizedIdentifier = publicIdentifier.trim().toLowerCase();

  if (normalizedIdentifier.length < 2) {
    return null;
  }

  const results = await searchGameDirectory(
    supabase,
    normalizedIdentifier
  );

  return (
    results.find(
      (result) =>
        result.result_type === "sporting_director" &&
        result.public_identifier.toLowerCase() ===
          normalizedIdentifier
    ) ?? null
  );
}

export async function getPublicTeam(
  supabase: SupabaseServerClient,
  publicIdentifier: string
): Promise<GlobalSearchResult | null> {
  const normalizedIdentifier = publicIdentifier.trim().toLowerCase();

  if (!isUuid(normalizedIdentifier)) {
    return null;
  }

  const results = await searchGameDirectory(
    supabase,
    normalizedIdentifier
  );

  return (
    results.find(
      (result) =>
        result.result_type === "team" &&
        result.public_identifier.toLowerCase() ===
          normalizedIdentifier
    ) ?? null
  );
}

export async function getPublicCountryDirectory(
  supabase: SupabaseServerClient,
  countryCode: string
): Promise<PublicCountryDirectory | null> {
  const normalizedCode = countryCode.trim().toLowerCase();

  if (!/^[a-z]{2,3}$/.test(normalizedCode)) {
    return null;
  }

  const results = await searchGameDirectory(
    supabase,
    normalizedCode,
    20
  );
  const country = results.find(
    (result) =>
      result.result_type === "country" &&
      result.public_identifier.toLowerCase() === normalizedCode
  );

  if (!country) {
    return null;
  }

  const countryResults = results.filter(
    (result) =>
      result.country_code.toLowerCase() ===
      country.country_code.toLowerCase()
  );

  return {
    country,
    members: groupGlobalSearchResults(countryResults),
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
