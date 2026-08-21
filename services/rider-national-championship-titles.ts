import "server-only";

import { collectChunkedPaginatedRows } from "@/lib/supabase/pagination";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type ActiveNationalChampionshipTitle = {
  riderId: string;
  countryCode: string;
  countryName: string;
  championshipType: "road" | "time_trial";
};

export type ActiveNationalChampionshipTitlesByDiscipline = Partial<
  Record<
    ActiveNationalChampionshipTitle["championshipType"],
    ActiveNationalChampionshipTitle
  >
>;
export type ActiveWorldChampionshipTitle = {
  riderId: string;
  countryCode: string;
  countryName: string;
  championshipType: "road" | "time_trial";
};

export type ActiveWorldChampionshipTitlesByDiscipline = Partial<
  Record<
    ActiveWorldChampionshipTitle["championshipType"],
    ActiveWorldChampionshipTitle
  >
>;

type WorldChampionshipTitleRow = {
  rider_id: string;
  championship_type: "world_road" | "world_time_trial";
};


type NationalChampionshipTitleRow = {
  rider_id: string;
  country_id: string;
  championship_type: "road" | "time_trial";
};

type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
};

export async function getActiveNationalChampionshipTitlesForRiders(
  supabase: SupabaseServerClient,
  riderIds: readonly string[],
): Promise<Map<string, ActiveNationalChampionshipTitle>> {
  const titlesByDiscipline =
    await getActiveNationalChampionshipTitlesByDisciplineForRiders(
      supabase,
      riderIds,
    );
  return new Map(
    [...titlesByDiscipline.entries()].flatMap(([riderId, titles]) => {
      const preferred = titles.road ?? titles.time_trial;
      return preferred ? [[riderId, preferred] as const] : [];
    }),
  );
}

export async function getActiveNationalChampionshipTitlesByDisciplineForRiders(
  supabase: SupabaseServerClient,
  riderIds: readonly string[],
): Promise<Map<string, ActiveNationalChampionshipTitlesByDiscipline>> {
  const uniqueRiderIds = [...new Set(riderIds.filter(Boolean))];

  if (uniqueRiderIds.length === 0) {
    return new Map();
  }

  const titlesResult = await collectChunkedPaginatedRows<
    NationalChampionshipTitleRow,
    { message: string },
    string
  >({
    values: uniqueRiderIds,
    fetchPage: async (riderIdChunk, from, to) => {
      const result = await supabase
        .from("rider_national_championship_titles")
        .select("rider_id, country_id, championship_type")
        .in("rider_id", riderIdChunk)
        .in("championship_type", ["road", "time_trial"])
        .is("relinquished_at", null)
        .range(from, to)
        .returns<NationalChampionshipTitleRow[]>();
      return { data: result.data, error: result.error };
    },
  });

  if (titlesResult.error) {
    throw new Error(
      `Impossible de récupérer les maillots de champions nationaux : ${titlesResult.error.message}`,
    );
  }

  const titleRows = titlesResult.data ?? [];
  const countryIds = [...new Set(titleRows.map((title) => title.country_id))];

  if (countryIds.length === 0) {
    return new Map();
  }

  const countriesResult = await supabase
    .from("countries")
    .select("id, name, iso_alpha2")
    .in("id", countryIds)
    .returns<CountryRow[]>();

  if (countriesResult.error) {
    throw new Error(
      `Impossible de récupérer les pays des champions nationaux : ${countriesResult.error.message}`,
    );
  }

  const countryById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country]),
  );
  const titleByRiderId = new Map<
    string,
    ActiveNationalChampionshipTitlesByDiscipline
  >();

  for (const title of titleRows) {
    const country = countryById.get(title.country_id);
    if (!country) continue;
    const currentTitles = titleByRiderId.get(title.rider_id) ?? {};
    currentTitles[title.championship_type] = {
      riderId: title.rider_id,
      countryCode: country.iso_alpha2,
      countryName: country.name,
      championshipType: title.championship_type,
    };
    titleByRiderId.set(title.rider_id, currentTitles);
  }

  return titleByRiderId;
}
export async function getActiveWorldChampionshipTitlesByDisciplineForRiders(
  supabase: SupabaseServerClient,
  riderIds: readonly string[],
): Promise<Map<string, ActiveWorldChampionshipTitlesByDiscipline>> {
  const uniqueRiderIds = [...new Set(riderIds.filter(Boolean))];
  if (uniqueRiderIds.length === 0) return new Map();

  const titlesResult = await collectChunkedPaginatedRows<
    WorldChampionshipTitleRow,
    { message: string },
    string
  >({
    values: uniqueRiderIds,
    fetchPage: async (riderIdChunk, from, to) => {
      const result = await supabase
        .from("rider_national_championship_titles")
        .select("rider_id, championship_type")
        .in("rider_id", riderIdChunk)
        .in("championship_type", ["world_road", "world_time_trial"])
        .is("relinquished_at", null)
        .range(from, to)
        .returns<WorldChampionshipTitleRow[]>();
      return { data: result.data, error: result.error };
    },
  });

  if (titlesResult.error) {
    throw new Error(
      `Impossible de recuperer les maillots de champions du monde : ${titlesResult.error.message}`,
    );
  }

  const worldTitlesByRiderId = new Map<
    string,
    ActiveWorldChampionshipTitlesByDiscipline
  >();

  for (const title of titlesResult.data ?? []) {
    const championshipType =
      title.championship_type === "world_time_trial"
        ? "time_trial"
        : "road";
    const currentTitles = worldTitlesByRiderId.get(title.rider_id) ?? {};
    currentTitles[championshipType] = {
      riderId: title.rider_id,
      countryCode: "",
      countryName: "Monde",
      championshipType,
    };
    worldTitlesByRiderId.set(title.rider_id, currentTitles);
  }

  return worldTitlesByRiderId;
}

export async function getActiveWorldChampionshipTitlesForRiders(
  supabase: SupabaseServerClient,
  riderIds: readonly string[],
): Promise<Map<string, ActiveWorldChampionshipTitle>> {
  const titlesByDiscipline =
    await getActiveWorldChampionshipTitlesByDisciplineForRiders(
      supabase,
      riderIds,
    );
  return new Map(
    [...titlesByDiscipline.entries()].flatMap(([riderId, titles]) => {
      const preferred = titles.road ?? titles.time_trial;
      return preferred ? [[riderId, preferred] as const] : [];
    }),
  );
}
