import "server-only";

import { unstable_cache } from "next/cache";

import {
  normalizeNationalJerseyDraft,
  type NationalJerseyDraft,
  type PublishedNationalJersey,
} from "@/lib/game/national-jersey-preview";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type NationalFederationJerseyRow = {
  country_id: string;
  design: unknown;
  version: number;
  published_at: string;
};

export async function getNationalFederationJersey(
  supabase: SupabaseServerClient,
  countryId: string,
): Promise<PublishedNationalJersey | null> {
  const result = await supabase
    .from("national_federation_jerseys")
    .select("country_id, design, version, published_at")
    .eq("country_id", countryId)
    .maybeSingle<NationalFederationJerseyRow>();

  if (result.error) {
    throw new Error(
      `Impossible de charger le maillot national : ${result.error.message}`,
    );
  }

  return result.data ? mapPublishedNationalJersey(result.data) : null;
}

export async function loadNationalFederationJerseyDesigns(
  countryIds: string[],
): Promise<Map<string, NationalJerseyDraft>> {
  if (countryIds.length === 0) return new Map();

  const rows = await getCachedNationalFederationJerseys();
  const requestedCountryIds = new Set(countryIds);

  return new Map(
    rows
      .filter((row) => requestedCountryIds.has(row.country_id))
      .map((row) => [
        row.country_id,
        normalizeNationalJerseyDraft(
          row.design as Partial<NationalJerseyDraft> | null,
        ),
      ]),
  );
}

const getCachedNationalFederationJerseys = unstable_cache(
  async (): Promise<NationalFederationJerseyRow[]> => {
    const admin = createSupabaseAdminClient();
    const result = await admin
      .from("national_federation_jerseys")
      .select("country_id, design, version, published_at")
      .returns<NationalFederationJerseyRow[]>();

    if (result.error) {
      console.error(
        "Maillots fédéraux indisponibles, repli sur les drapeaux :",
        { code: result.error.code, message: result.error.message },
      );
      return [];
    }
    return result.data ?? [];
  },
  ["national-federation-jerseys"],
  { revalidate: 300, tags: ["national-federation-jerseys"] },
);

function mapPublishedNationalJersey(
  row: NationalFederationJerseyRow,
): PublishedNationalJersey {
  return {
    design: normalizeNationalJerseyDraft(
      row.design as Partial<NationalJerseyDraft> | null,
    ),
    version: Math.max(1, Math.trunc(Number(row.version) || 1)),
    publishedAt: row.published_at,
  };
}
