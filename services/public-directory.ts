import "server-only";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  groupGlobalSearchResults,
  type GlobalSearchResult,
  type GroupedGlobalSearchResults,
} from "@/lib/game/global-search";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { searchGameDirectory } from "@/services/global-search";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type PublicCountryDirectory = {
  country: GlobalSearchResult;
  members: GroupedGlobalSearchResults;
};

type SportingDirectorRow = {
  id: string;
  country_id: string | null;
  username: string;
  display_name: string;
  avatar_key: string | null;
  reputation_points: number | null;
};

type CountryRow = {
  name: string;
  iso_alpha2: string;
};

type TeamAssignmentRow = {
  team_id: string;
};

type ActiveSeasonRow = {
  id: string;
};

type TeamSeasonRow = {
  display_name: string;
};

export async function getPublicSportingDirector(
  publicIdentifier: string
): Promise<GlobalSearchResult | null> {
  const normalizedIdentifier = normalizePublicIdentifier(publicIdentifier);

  if (normalizedIdentifier.length < 2) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const director =
    (await findSportingDirector({
      supabase,
      column: "username",
      identifier: normalizedIdentifier,
    })) ??
    (await findSportingDirector({
      supabase,
      column: "display_name",
      identifier: normalizedIdentifier,
      requireUniqueResult: true,
    }));

  if (!director || !director.country_id) {
    return null;
  }

  const [countryResult, assignmentResult, activeSeasonResult] =
    await Promise.all([
      supabase
        .from("countries")
        .select("name, iso_alpha2")
        .eq("id", director.country_id)
        .eq("is_active", true)
        .maybeSingle<CountryRow>(),
      supabase
        .from("team_manager_assignments")
        .select("team_id")
        .eq("sporting_director_id", director.id)
        .eq("role", "general_manager")
        .eq("status", "active")
        .maybeSingle<TeamAssignmentRow>(),
      supabase
        .from("seasons")
        .select("id")
        .eq("status", "active")
        .maybeSingle<ActiveSeasonRow>(),
    ]);

  assertDirectoryQuery(countryResult.error, "le pays du Directeur Sportif");
  assertDirectoryQuery(
    assignmentResult.error,
    "l’équipe actuelle du Directeur Sportif"
  );
  assertDirectoryQuery(activeSeasonResult.error, "la saison active");

  if (!countryResult.data) {
    return null;
  }

  const teamId = assignmentResult.data?.team_id ?? null;
  let teamName: string | null = null;

  if (teamId && activeSeasonResult.data) {
    const { data: teamSeason, error: teamSeasonError } = await supabase
      .from("team_seasons")
      .select("display_name")
      .eq("team_id", teamId)
      .eq("season_id", activeSeasonResult.data.id)
      .maybeSingle<TeamSeasonRow>();

    assertDirectoryQuery(teamSeasonError, "le nom actuel de l’équipe");
    teamName = teamSeason?.display_name ?? null;
  }

  return {
    result_type: "sporting_director",
    entity_id: director.id,
    public_identifier: director.username,
    display_name: director.display_name,
    avatar_key: director.avatar_key,
    reputation_points: director.reputation_points,
    country_code: countryResult.data.iso_alpha2,
    country_name: countryResult.data.name,
    team_name: teamName,
    team_id: teamId,
    sponsor_name: null,
    sporting_director_username: null,
    sporting_director_name: null,
    sporting_director_count: null,
    team_count: null,
  };
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

async function findSportingDirector({
  supabase,
  column,
  identifier,
  requireUniqueResult = false,
}: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  column: "display_name" | "username";
  identifier: string;
  requireUniqueResult?: boolean;
}): Promise<SportingDirectorRow | null> {
  const { data, error } = await supabase
    .from("sporting_directors")
    .select(
      "id, country_id, username, display_name, avatar_key, reputation_points"
    )
    .eq("status", "active")
    .ilike(column, identifier)
    .limit(2)
    .returns<SportingDirectorRow[]>();

  assertDirectoryQuery(error, "le profil du Directeur Sportif");

  const exactResults = (data ?? []).filter(
    (director) =>
      normalizePublicIdentifier(director[column]) === identifier
  );

  if (requireUniqueResult && exactResults.length !== 1) {
    return null;
  }

  return exactResults[0] ?? null;
}

function normalizePublicIdentifier(value: string): string {
  let decodedValue = value;

  try {
    decodedValue = decodeURIComponent(value);
  } catch {
    // Next.js décode déjà les segments valides. Une séquence invalide reste
    // simplement inchangée et ne pourra correspondre à aucun profil.
  }

  return decodedValue.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr");
}

function assertDirectoryQuery(
  error: { message: string } | null,
  resourceName: string
): asserts error is null {
  if (error) {
    throw new Error(
      `Impossible de charger ${resourceName} : ${error.message}`
    );
  }
}
