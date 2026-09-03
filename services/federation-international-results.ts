import "server-only";

import { unstable_cache } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FederationInternationalPerformance = {
  competitionType: "world_championship" | "continental_championship";
  editionName: string;
  seasonName: string;
  gameYear: number;
  riderName: string;
  rank: number;
};

export type FederationInternationalResults = {
  world: FederationInternationalPerformance | null;
  continental: FederationInternationalPerformance | null;
  nationsCup: null;
};

type CountryRow = { continent_code: string | null };
type RaceRow = {
  id: string;
  competition_type: FederationInternationalPerformance["competitionType"];
  championship_continent_code: string | null;
};
type EditionRow = {
  id: string;
  race_id: string;
  display_name: string;
  season_id: string;
};
type SeasonRow = { id: string; name: string; game_year: number };
type ResultRow = {
  race_edition_id: string;
  race_roster_id: string;
  final_rank: number;
};
type RosterRow = { id: string; rider_id: string };
type RiderRow = {
  id: string;
  country_id: string;
  first_name: string;
  last_name: string;
};

const EMPTY_RESULTS: FederationInternationalResults = {
  world: null,
  continental: null,
  nationsCup: null,
};

const getCachedFederationInternationalResults = unstable_cache(
  loadFederationInternationalResults,
  ["federation-international-results"],
  { revalidate: 300, tags: ["federation-international-results"] },
);

export async function getFederationInternationalResults(
  countryId: string,
): Promise<FederationInternationalResults> {
  return getCachedFederationInternationalResults(countryId);
}

async function loadFederationInternationalResults(
  countryId: string,
): Promise<FederationInternationalResults> {
  try {
    const admin = createSupabaseAdminClient();
    const [countryResult, racesResult] = await Promise.all([
      admin
        .from("countries")
        .select("continent_code")
        .eq("id", countryId)
        .maybeSingle<CountryRow>(),
      admin
        .from("races")
        .select("id, competition_type, championship_continent_code")
        .in("competition_type", [
          "world_championship",
          "continental_championship",
        ])
        .eq("status", "active")
        .returns<RaceRow[]>(),
    ]);

    if (countryResult.error) throw countryResult.error;
    if (racesResult.error) throw racesResult.error;

    const continentCode = countryResult.data?.continent_code ?? null;
    const races = (racesResult.data ?? []).filter(
      (race) =>
        race.competition_type === "world_championship" ||
        !continentCode ||
        race.championship_continent_code === continentCode,
    );
    if (races.length === 0) return EMPTY_RESULTS;

    const editionsResult = await admin
      .from("race_editions")
      .select("id, race_id, display_name, season_id")
      .in(
        "race_id",
        races.map((race) => race.id),
      )
      .eq("status", "completed")
      .limit(30)
      .returns<EditionRow[]>();

    if (editionsResult.error) throw editionsResult.error;
    const editions = editionsResult.data ?? [];
    if (editions.length === 0) return EMPTY_RESULTS;

    const seasonsResult = await admin
      .from("seasons")
      .select("id, name, game_year")
      .in("id", [...new Set(editions.map((edition) => edition.season_id))])
      .returns<SeasonRow[]>();

    if (seasonsResult.error) throw seasonsResult.error;
    const seasonById = new Map(
      (seasonsResult.data ?? []).map((season) => [season.id, season]),
    );
    const raceById = new Map(races.map((race) => [race.id, race]));
    const latestGameYearByType = new Map<
      FederationInternationalPerformance["competitionType"],
      number
    >();

    for (const edition of editions) {
      const race = raceById.get(edition.race_id);
      const season = seasonById.get(edition.season_id);
      if (!race || !season) continue;
      latestGameYearByType.set(
        race.competition_type,
        Math.max(
          latestGameYearByType.get(race.competition_type) ?? 0,
          season.game_year,
        ),
      );
    }

    const latestEditions = editions.filter((edition) => {
      const race = raceById.get(edition.race_id);
      const season = seasonById.get(edition.season_id);
      return (
        race &&
        season &&
        season.game_year === latestGameYearByType.get(race.competition_type)
      );
    });
    if (latestEditions.length === 0) return EMPTY_RESULTS;

    const resultsResult = await admin
      .from("race_results")
      .select("race_edition_id, race_roster_id, final_rank")
      .in(
        "race_edition_id",
        latestEditions.map((edition) => edition.id),
      )
      .eq("status", "classified")
      .order("final_rank", { ascending: true })
      .limit(1000)
      .returns<ResultRow[]>();

    if (resultsResult.error) throw resultsResult.error;
    const results = resultsResult.data ?? [];
    if (results.length === 0) return EMPTY_RESULTS;

    const rostersResult = await admin
      .from("race_rosters")
      .select("id, rider_id")
      .in(
        "id",
        results.map((result) => result.race_roster_id),
      )
      .returns<RosterRow[]>();

    if (rostersResult.error) throw rostersResult.error;
    const rosters = rostersResult.data ?? [];
    const ridersResult =
      rosters.length > 0
        ? await admin
            .from("riders")
            .select("id, country_id, first_name, last_name")
            .in(
              "id",
              rosters.map((roster) => roster.rider_id),
            )
            .eq("country_id", countryId)
            .returns<RiderRow[]>()
        : { data: [] as RiderRow[], error: null };

    if (ridersResult.error) throw ridersResult.error;
    const rosterById = new Map(rosters.map((roster) => [roster.id, roster]));
    const riderById = new Map(
      (ridersResult.data ?? []).map((rider) => [rider.id, rider]),
    );
    const editionById = new Map(
      latestEditions.map((edition) => [edition.id, edition]),
    );
    const bestByType: FederationInternationalResults = { ...EMPTY_RESULTS };

    for (const result of results) {
      const roster = rosterById.get(result.race_roster_id);
      const rider = roster ? riderById.get(roster.rider_id) : null;
      const edition = editionById.get(result.race_edition_id);
      const race = edition ? raceById.get(edition.race_id) : null;
      const season = edition ? seasonById.get(edition.season_id) : null;
      if (!rider || !edition || !race || !season) continue;

      const key =
        race.competition_type === "world_championship"
          ? "world"
          : "continental";
      const currentBest = bestByType[key];
      if (currentBest && currentBest.rank <= result.final_rank) continue;

      bestByType[key] = {
        competitionType: race.competition_type,
        editionName: edition.display_name,
        seasonName: season.name,
        gameYear: season.game_year,
        riderName: `${rider.first_name} ${rider.last_name}`.trim(),
        rank: result.final_rank,
      };
    }

    return bestByType;
  } catch (error) {
    console.error(
      "Impossible de charger les références internationales fédérales :",
      error,
    );
    return EMPTY_RESULTS;
  }
}
