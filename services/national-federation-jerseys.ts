import "server-only";

import { unstable_cache } from "next/cache";

import {
  normalizeNationalJerseyDraft,
  type NationalJerseyDraft,
  type PublishedNationalJersey,
  type NationalJerseyKind,
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
  active_from_game_year: number | null;
  pending_design: unknown | null;
  pending_version: number | null;
  pending_published_at: string | null;
  pending_activation_game_year: number | null;
};

type ActiveJerseyRow = Pick<NationalFederationJerseyRow, "country_id" | "design" | "active_from_game_year"> & { country: { iso_alpha2: string } | null };

export async function getNationalFederationJersey(
  supabase: SupabaseServerClient,
  countryId: string,
  kind: NationalJerseyKind = "national_team",
): Promise<PublishedNationalJersey | null> {
  const result = await supabase
    .from(jerseyTable(kind))
    .select("country_id, design, version, published_at, active_from_game_year, pending_design, pending_version, pending_published_at, pending_activation_game_year")
    .eq("country_id", countryId)
    .maybeSingle<NationalFederationJerseyRow>();

  if (result.error) {
    throw new Error(
      `Impossible de charger le maillot national : ${result.error.message}`,
    );
  }

  if (!result.data) return null;
  if (
    result.data.pending_design &&
    result.data.pending_version &&
    result.data.pending_published_at &&
    result.data.pending_activation_game_year
  ) {
    return {
      design: normalizeNationalJerseyDraft(
        result.data.pending_design as Partial<NationalJerseyDraft>,
      ),
      version: result.data.pending_version,
      publishedAt: result.data.pending_published_at,
      activationGameYear: result.data.pending_activation_game_year,
      isActive: false,
    };
  }
  return mapPublishedNationalJersey(result.data);
}

export async function loadNationalFederationJerseyDesigns(
  countryIds: string[],
  kind: NationalJerseyKind = "national_team",
): Promise<Map<string, NationalJerseyDraft>> {
  if (countryIds.length === 0) return new Map();

  const rows = await getCachedNationalFederationJerseys(kind);
  const requestedCountryIds = new Set(countryIds);

  return new Map(
    rows
      .filter(
        (row) =>
          requestedCountryIds.has(row.country_id) &&
          row.active_from_game_year != null,
      )
      .map((row) => [
        row.country_id,
        normalizeNationalJerseyDraft(
          row.design as Partial<NationalJerseyDraft> | null,
        ),
      ]),
  );
}

/** Same cached published designs, indexed by ISO code for junior/fast RPC titles. */
export async function loadNationalFederationJerseyDesignsByCountryCode(
  countryCodes: readonly string[],
  kind: NationalJerseyKind = "national_team",
): Promise<Map<string, NationalJerseyDraft>> {
  if (countryCodes.length === 0) return new Map();
  const requested = new Set(countryCodes.map((code) => code.trim().toUpperCase()));
  const rows = await getCachedNationalFederationJerseys(kind);
  return new Map(rows.flatMap((row) => {
    const code = row.country?.iso_alpha2.trim().toUpperCase();
    return code && requested.has(code) && row.active_from_game_year != null
      ? [[code, normalizeNationalJerseyDraft(row.design as Partial<NationalJerseyDraft> | null)] as const]
      : [];
  }));
}

const getCachedNationalFederationJerseys = unstable_cache(
  async (kind: NationalJerseyKind): Promise<ActiveJerseyRow[]> => {
    const admin = createSupabaseAdminClient();
    const result = await admin
      .from(jerseyTable(kind))
      .select("country_id, design, active_from_game_year, country:countries(iso_alpha2)")
      .returns<ActiveJerseyRow[]>();

    if (result.error) {
      console.error(
        "Maillots fédéraux indisponibles, repli sur les drapeaux :",
        { code: result.error.code, message: result.error.message },
      );
      return [];
    }
    return result.data ?? [];
  },
  ["national-federation-jerseys-by-role-v3"],
  { revalidate: 300, tags: ["national-federation-jerseys"] },
);

function jerseyTable(kind: NationalJerseyKind) {
  return kind === "national_champion" ? "national_federation_champion_jerseys" : "national_federation_jerseys";
}

function mapPublishedNationalJersey(
  row: NationalFederationJerseyRow,
): PublishedNationalJersey {
  return {
    design: normalizeNationalJerseyDraft(
      row.design as Partial<NationalJerseyDraft> | null,
    ),
    version: Math.max(1, Math.trunc(Number(row.version) || 1)),
    publishedAt: row.published_at,
    activationGameYear: row.active_from_game_year ?? 1,
    isActive: row.active_from_game_year != null,
  };
}
