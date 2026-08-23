import "server-only";

import { collectChunkedPaginatedRows } from "@/lib/supabase/pagination";
import {
  CONTINENTAL_CHAMPIONSHIP_TITLE_TYPES,
  parseContinentalChampionshipTitleType,
  type ActiveContinentalChampionshipTitle,
} from "@/services/rider-continental-championship-titles";
import type {
  ActiveNationalChampionshipTitle,
  ActiveWorldChampionshipTitle,
} from "@/services/rider-national-championship-titles";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type ChampionshipTitleRow = {
  rider_id: string;
  country_id: string | null;
  championship_type: string;
};

type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
};

const ACTIVE_CHAMPIONSHIP_TYPES = [
  "road",
  "time_trial",
  "world_road",
  "world_time_trial",
  ...CONTINENTAL_CHAMPIONSHIP_TITLE_TYPES,
] as const;

export type ActiveChampionshipTitlesForRiders = {
  national: Map<string, ActiveNationalChampionshipTitle>;
  continental: Map<string, ActiveContinentalChampionshipTitle>;
  world: Map<string, ActiveWorldChampionshipTitle>;
};

/**
 * Loads every active jersey type through one paginated title query. The former
 * page-level implementation queried the same table three times and then loaded
 * countries separately, increasing the critical path of roster rendering.
 */
export async function getActiveChampionshipTitlesForRiders(
  supabase: SupabaseServerClient,
  riderIds: readonly string[],
): Promise<ActiveChampionshipTitlesForRiders> {
  const uniqueRiderIds = [...new Set(riderIds.filter(Boolean))];
  const empty = (): ActiveChampionshipTitlesForRiders => ({
    national: new Map(),
    continental: new Map(),
    world: new Map(),
  });

  if (uniqueRiderIds.length === 0) return empty();

  const titlesResult = await collectChunkedPaginatedRows<
    ChampionshipTitleRow,
    { message: string },
    string
  >({
    values: uniqueRiderIds,
    fetchPage: async (riderIdChunk, from, to) => {
      const result = await supabase
        .from("rider_national_championship_titles")
        .select("rider_id, country_id, championship_type")
        .in("rider_id", riderIdChunk)
        .in("championship_type", [...ACTIVE_CHAMPIONSHIP_TYPES])
        .is("relinquished_at", null)
        .range(from, to)
        .returns<ChampionshipTitleRow[]>();

      return { data: result.data, error: result.error };
    },
  });

  if (titlesResult.error) {
    throw new Error(
      `Impossible de récupérer les maillots de champions : ${titlesResult.error.message}`,
    );
  }

  const titleRows = titlesResult.data ?? [];
  const nationalRows = titleRows.filter(
    (title) =>
      title.championship_type === "road" ||
      title.championship_type === "time_trial",
  );
  const countryIds = [
    ...new Set(
      nationalRows
        .map((title) => title.country_id)
        .filter((countryId): countryId is string => Boolean(countryId)),
    ),
  ];
  const countriesResult = countryIds.length
    ? await supabase
        .from("countries")
        .select("id, name, iso_alpha2")
        .in("id", countryIds)
        .returns<CountryRow[]>()
    : { data: [] as CountryRow[], error: null };

  if (countriesResult.error) {
    throw new Error(
      `Impossible de récupérer les pays des champions : ${countriesResult.error.message}`,
    );
  }

  const countryById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country]),
  );
  const result = empty();

  for (const title of titleRows) {
    if (
      title.championship_type === "road" ||
      title.championship_type === "time_trial"
    ) {
      const country = title.country_id
        ? countryById.get(title.country_id)
        : null;
      if (!country) continue;

      setPreferredTitle(result.national, title.rider_id, {
        riderId: title.rider_id,
        countryCode: country.iso_alpha2,
        countryName: country.name,
        championshipType: title.championship_type,
      });
      continue;
    }

    if (
      title.championship_type === "world_road" ||
      title.championship_type === "world_time_trial"
    ) {
      const championshipType =
        title.championship_type === "world_time_trial"
          ? "time_trial"
          : "road";
      setPreferredTitle(result.world, title.rider_id, {
        riderId: title.rider_id,
        countryCode: "",
        countryName: "Monde",
        championshipType,
      });
      continue;
    }

    const continental = parseContinentalChampionshipTitleType(
      title.championship_type,
    );
    if (!continental) continue;

    setPreferredTitle(result.continental, title.rider_id, {
      riderId: title.rider_id,
      ...continental,
    });
  }

  return result;
}

function setPreferredTitle<
  T extends { championshipType: "road" | "time_trial" },
>(map: Map<string, T>, riderId: string, title: T) {
  const current = map.get(riderId);
  if (!current || title.championshipType === "road") {
    map.set(riderId, title);
  }
}
