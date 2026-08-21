import "server-only";

import {
  CONTINENTAL_CHAMPION_PALETTES,
  type ContinentalChampionshipCode,
} from "@/lib/rider-jersey";
import { collectChunkedPaginatedRows } from "@/lib/supabase/pagination";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type ActiveContinentalChampionshipTitle = {
  riderId: string;
  continentCode: ContinentalChampionshipCode;
  continentName: string;
  championshipType: "road" | "time_trial";
};

export type ActiveContinentalChampionshipTitlesByDiscipline = Partial<
  Record<
    ActiveContinentalChampionshipTitle["championshipType"],
    ActiveContinentalChampionshipTitle
  >
>;

type ContinentalChampionshipTitleRow = {
  rider_id: string;
  championship_type: string;
};

export const CONTINENTAL_CHAMPIONSHIP_TITLE_TYPES = [
  "continental_africa_road",
  "continental_africa_time_trial",
  "continental_america_road",
  "continental_america_time_trial",
  "continental_asia_road",
  "continental_asia_time_trial",
  "continental_europe_road",
  "continental_europe_time_trial",
  "continental_oceania_road",
  "continental_oceania_time_trial",
] as const;

export function parseContinentalChampionshipTitleType(
  value: string,
): Pick<
  ActiveContinentalChampionshipTitle,
  "continentCode" | "continentName" | "championshipType"
> | null {
  const match =
    /^continental_(africa|america|asia|europe|oceania)_(road|time_trial)$/.exec(
      value,
    );
  if (!match) return null;

  const continentCode = match[1] as ContinentalChampionshipCode;
  return {
    continentCode,
    continentName: CONTINENTAL_CHAMPION_PALETTES[continentCode].name,
    championshipType: match[2] as "road" | "time_trial",
  };
}

export async function getActiveContinentalChampionshipTitlesByDisciplineForRiders(
  supabase: SupabaseServerClient,
  riderIds: readonly string[],
): Promise<Map<string, ActiveContinentalChampionshipTitlesByDiscipline>> {
  const uniqueRiderIds = [...new Set(riderIds.filter(Boolean))];
  if (uniqueRiderIds.length === 0) return new Map();

  const titlesResult = await collectChunkedPaginatedRows<
    ContinentalChampionshipTitleRow,
    { message: string },
    string
  >({
    values: uniqueRiderIds,
    fetchPage: async (riderIdChunk, from, to) => {
      const result = await supabase
        .from("rider_national_championship_titles")
        .select("rider_id, championship_type")
        .in("rider_id", riderIdChunk)
        .in("championship_type", [...CONTINENTAL_CHAMPIONSHIP_TITLE_TYPES])
        .is("relinquished_at", null)
        .range(from, to)
        .returns<ContinentalChampionshipTitleRow[]>();
      return { data: result.data, error: result.error };
    },
  });

  if (titlesResult.error) {
    throw new Error(
      `Impossible de récupérer les maillots de champions continentaux : ${titlesResult.error.message}`,
    );
  }

  const titlesByRiderId = new Map<
    string,
    ActiveContinentalChampionshipTitlesByDiscipline
  >();

  for (const title of titlesResult.data ?? []) {
    const parsed = parseContinentalChampionshipTitleType(
      title.championship_type,
    );
    if (!parsed) continue;
    const currentTitles = titlesByRiderId.get(title.rider_id) ?? {};
    currentTitles[parsed.championshipType] = {
      riderId: title.rider_id,
      ...parsed,
    };
    titlesByRiderId.set(title.rider_id, currentTitles);
  }

  return titlesByRiderId;
}

export async function getActiveContinentalChampionshipTitlesForRiders(
  supabase: SupabaseServerClient,
  riderIds: readonly string[],
): Promise<Map<string, ActiveContinentalChampionshipTitle>> {
  const titlesByDiscipline =
    await getActiveContinentalChampionshipTitlesByDisciplineForRiders(
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
