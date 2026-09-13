import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NationsCupEvent = {
  id: string;
  slug: string;
  name: string;
  profileType: string;
  status: string;
};

export type NationsCupStanding = {
  countryId: string;
  countryCode: string;
  countryName: string;
  uciRank: number;
  division: number;
  groupCode: string | null;
  points: number;
  wins: number;
  podiums: number;
  eventsCount: number;
  overallRank: number;
  divisionRank: number;
  groupRank: number;
  projectedDivision: number;
  movementZone: "promotion" | "relegation" | "safe";
  eventRanks: Record<string, number | null>;
};

export type NationsCupOverview = {
  seasonName: string;
  gameYear: number;
  currentDayNumber: number;
  events: NationsCupEvent[];
  standings: NationsCupStanding[];
};

type SeasonRow = {
  id: string;
  name: string;
  game_year: number;
  current_day_number: number | null;
};
type StandingRow = {
  country_id: string;
  country_code: string;
  country_name: string;
  uci_rank: number;
  division: number;
  group_code: string | null;
  points: number;
  wins: number;
  podiums: number;
  events_count: number;
  overall_rank: number;
  division_rank: number;
  group_rank: number;
  projected_division: number;
  movement_zone: "promotion" | "relegation" | "safe";
};
type RaceRow = { id: string; slug: string; name: string };
type EditionRow = { id: string; race_id: string; status: string };
type StageRow = { race_edition_id: string; profile_type: string };
type ResultRow = {
  race_edition_id: string;
  race_roster_id: string;
  final_rank: number;
};
type RosterRow = { id: string; rider_id: string };
type RiderRow = { id: string; country_id: string };

export async function getNationsCupOverview(): Promise<NationsCupOverview | null> {
  const admin = createSupabaseAdminClient();
  const seasonResult = await admin
    .from("seasons")
    .select("id, name, game_year, current_day_number")
    .eq("status", "active")
    .maybeSingle<SeasonRow>();
  if (seasonResult.error) throw seasonResult.error;
  const season = seasonResult.data;
  if (!season) return null;

  const [standingsResult, racesResult] = await Promise.all([
    admin.rpc("get_national_federation_nations_cup_movement_projection", {
      p_season_id: season.id,
    }),
    admin
      .from("races")
      .select("id, slug, name")
      .eq("competition_type", "nations_cup")
      .eq("status", "active")
      .order("name")
      .returns<RaceRow[]>(),
  ]);
  if (standingsResult.error) throw standingsResult.error;
  if (racesResult.error) throw racesResult.error;

  const races = racesResult.data ?? [];
  const editionsResult = races.length
    ? await admin
        .from("race_editions")
        .select("id, race_id, status")
        .eq("season_id", season.id)
        .in("race_id", races.map((race) => race.id))
        .returns<EditionRow[]>()
    : { data: [] as EditionRow[], error: null };
  if (editionsResult.error) throw editionsResult.error;
  const editions = editionsResult.data ?? [];
  const editionIds = editions.map((edition) => edition.id);
  const [stagesResult, resultsResult] = editionIds.length
    ? await Promise.all([
        admin
          .from("stages")
          .select("race_edition_id, profile_type")
          .in("race_edition_id", editionIds)
          .returns<StageRow[]>(),
        admin
          .from("race_results")
          .select("race_edition_id, race_roster_id, final_rank")
          .in("race_edition_id", editionIds)
          .eq("status", "classified")
          .returns<ResultRow[]>(),
      ])
    : [
        { data: [] as StageRow[], error: null },
        { data: [] as ResultRow[], error: null },
      ];
  if (stagesResult.error) throw stagesResult.error;
  if (resultsResult.error) throw resultsResult.error;

  const results = resultsResult.data ?? [];
  const rosterIds = [...new Set(results.map((result) => result.race_roster_id))];
  const rostersResult = rosterIds.length
    ? await admin
        .from("race_rosters")
        .select("id, rider_id")
        .in("id", rosterIds)
        .returns<RosterRow[]>()
    : { data: [] as RosterRow[], error: null };
  if (rostersResult.error) throw rostersResult.error;
  const riderIds = [
    ...new Set((rostersResult.data ?? []).map((roster) => roster.rider_id)),
  ];
  const ridersResult = riderIds.length
    ? await admin
        .from("riders")
        .select("id, country_id")
        .in("id", riderIds)
        .returns<RiderRow[]>()
    : { data: [] as RiderRow[], error: null };
  if (ridersResult.error) throw ridersResult.error;

  const editionByRaceId = new Map(editions.map((edition) => [edition.race_id, edition]));
  const stageByEditionId = new Map(
    (stagesResult.data ?? []).map((stage) => [stage.race_edition_id, stage]),
  );
  const countryByRosterId = new Map<string, string>();
  const countryByRiderId = new Map(
    (ridersResult.data ?? []).map((rider) => [rider.id, rider.country_id]),
  );
  for (const roster of rostersResult.data ?? []) {
    const countryId = countryByRiderId.get(roster.rider_id);
    if (countryId) countryByRosterId.set(roster.id, countryId);
  }
  const eventRankByCountry = new Map<string, Record<string, number | null>>();
  for (const result of results) {
    const countryId = countryByRosterId.get(result.race_roster_id);
    const edition = editions.find((item) => item.id === result.race_edition_id);
    if (!countryId || !edition) continue;
    const race = races.find((item) => item.id === edition.race_id);
    if (!race) continue;
    const ranks = eventRankByCountry.get(countryId) ?? {};
    ranks[race.slug] = result.final_rank;
    eventRankByCountry.set(countryId, ranks);
  }

  const events = races.flatMap((race): NationsCupEvent[] => {
    const edition = editionByRaceId.get(race.id);
    if (!edition) return [];
    return [{
      id: race.id,
      slug: race.slug,
      name: race.name.replace("Nations Cup · ", ""),
      profileType: stageByEditionId.get(edition.id)?.profile_type ?? "mixed",
      status: edition.status,
    }];
  });
  const standings = ((standingsResult.data ?? []) as StandingRow[]).map(
    (standing): NationsCupStanding => ({
      countryId: standing.country_id,
      countryCode: standing.country_code,
      countryName: standing.country_name,
      uciRank: standing.uci_rank,
      division: standing.division,
      groupCode: standing.group_code,
      points: standing.points,
      wins: standing.wins,
      podiums: standing.podiums,
      eventsCount: standing.events_count,
      overallRank: standing.overall_rank,
      divisionRank: standing.division_rank,
      groupRank: standing.group_rank,
      projectedDivision: standing.projected_division,
      movementZone: standing.movement_zone,
      eventRanks: eventRankByCountry.get(standing.country_id) ?? {},
    }),
  );

  return {
    seasonName: season.name,
    gameYear: season.game_year,
    currentDayNumber: season.current_day_number ?? 1,
    events,
    standings,
  };
}
