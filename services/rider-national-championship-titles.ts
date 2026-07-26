import "server-only";

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
  const uniqueRiderIds = [...new Set(riderIds.filter(Boolean))];

  if (uniqueRiderIds.length === 0) {
    return new Map();
  }

  const titlesResult = await supabase
    .from("rider_national_championship_titles")
    .select("rider_id, country_id, championship_type")
    .in("rider_id", uniqueRiderIds)
    .is("relinquished_at", null)
    .returns<NationalChampionshipTitleRow[]>();

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
  const titleByRiderId = new Map<string, ActiveNationalChampionshipTitle>();

  for (const title of titleRows) {
    const country = countryById.get(title.country_id);
    const currentTitle = titleByRiderId.get(title.rider_id);

    if (
      !country ||
      (currentTitle && currentTitle.championshipType === "road")
    ) {
      continue;
    }

    titleByRiderId.set(title.rider_id, {
      riderId: title.rider_id,
      countryCode: country.iso_alpha2,
      countryName: country.name,
      championshipType: title.championship_type,
    });
  }

  return titleByRiderId;
}
