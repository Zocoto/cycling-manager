import "server-only";

import {
  getNationsCupPoolKey,
  PROFESSIONAL_NATIONS_CUP_EVENTS,
} from "@/lib/game/nations-cup-heats";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NationsCupEvent = {
  id: string;
  slug: string;
  hrefSlug: string;
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
type HeatRow = {
  slot_key: string;
  pool_key: string;
  division: number;
  group_code: string | null;
  race_id: string;
  race_edition_id: string;
};
type RaceRow = { id: string; slug: string };
type EditionRow = { id: string; race_id: string; status: string };
type StageRow = { race_edition_id: string; profile_type: string };
type ResultRow = {
  race_edition_id: string;
  race_roster_id: string;
  final_rank: number;
};
type RosterRow = { id: string; rider_id: string };
type RiderRow = { id: string; country_id: string };
type TeamSeasonRow = { registration_country_id: string | null };
type AssignmentRow = { division: number; group_code: string | null };

export async function getNationsCupOverview(
  { teamId = null }: { teamId?: string | null } = {},
): Promise<NationsCupOverview | null> {
  const admin = createSupabaseAdminClient();
  const seasonResult = await admin
    .from("seasons")
    .select("id, name, game_year, current_day_number")
    .eq("status", "active")
    .maybeSingle<SeasonRow>();
  if (seasonResult.error) throw seasonResult.error;
  const season = seasonResult.data;
  if (!season) return null;

  const [standingsResult, heatsResult, teamSeasonResult] = await Promise.all([
    admin.rpc("get_national_federation_nations_cup_movement_projection", {
      p_season_id: season.id,
    }),
    admin
      .from("national_federation_nations_cup_heats")
      .select(
        "slot_key, pool_key, division, group_code, race_id, race_edition_id",
      )
      .eq("season_id", season.id)
      .returns<HeatRow[]>(),
    teamId
      ? admin
          .from("team_seasons")
          .select("registration_country_id")
          .eq("season_id", season.id)
          .eq("team_id", teamId)
          .maybeSingle<TeamSeasonRow>()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (standingsResult.error) throw standingsResult.error;
  if (heatsResult.error) throw heatsResult.error;
  if (teamSeasonResult.error) throw teamSeasonResult.error;

  const viewerCountryId = teamSeasonResult.data?.registration_country_id ?? null;
  const viewerAssignmentResult = viewerCountryId
    ? await admin
        .from("national_federation_nations_cup_assignments")
        .select("division, group_code")
        .eq("season_id", season.id)
        .eq("country_id", viewerCountryId)
        .maybeSingle<AssignmentRow>()
    : { data: null, error: null };
  if (viewerAssignmentResult.error) throw viewerAssignmentResult.error;
  const viewerPoolKey = viewerAssignmentResult.data
    ? getNationsCupPoolKey(
        viewerAssignmentResult.data.division,
        viewerAssignmentResult.data.group_code,
      )
    : "d1";

  const heats = heatsResult.data ?? [];
  const raceIds = [...new Set(heats.map((heat) => heat.race_id))];
  const editionIds = [
    ...new Set(heats.map((heat) => heat.race_edition_id)),
  ];
  const [racesResult, editionsResult, stagesResult, resultsResult] =
    editionIds.length
      ? await Promise.all([
          admin
            .from("races")
            .select("id, slug")
            .in("id", raceIds)
            .returns<RaceRow[]>(),
          admin
            .from("race_editions")
            .select("id, race_id, status")
            .in("id", editionIds)
            .returns<EditionRow[]>(),
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
          { data: [] as RaceRow[], error: null },
          { data: [] as EditionRow[], error: null },
          { data: [] as StageRow[], error: null },
          { data: [] as ResultRow[], error: null },
        ];
  if (racesResult.error) throw racesResult.error;
  if (editionsResult.error) throw editionsResult.error;
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

  const raceById = new Map(
    (racesResult.data ?? []).map((race) => [race.id, race]),
  );
  const editionById = new Map(
    (editionsResult.data ?? []).map((edition) => [edition.id, edition]),
  );
  const stageByEditionId = new Map(
    (stagesResult.data ?? []).map((stage) => [stage.race_edition_id, stage]),
  );
  const heatByEditionId = new Map(
    heats.map((heat) => [heat.race_edition_id, heat]),
  );
  const countryByRiderId = new Map(
    (ridersResult.data ?? []).map((rider) => [rider.id, rider.country_id]),
  );
  const countryByRosterId = new Map<string, string>();
  for (const roster of rostersResult.data ?? []) {
    const countryId = countryByRiderId.get(roster.rider_id);
    if (countryId) countryByRosterId.set(roster.id, countryId);
  }

  const eventBySlotKey = new Map<
    string,
    (typeof PROFESSIONAL_NATIONS_CUP_EVENTS)[number]
  >(
    PROFESSIONAL_NATIONS_CUP_EVENTS.map((event) => [event.slotKey, event]),
  );
  const eventRankByCountry = new Map<string, Record<string, number | null>>();
  for (const result of results) {
    const countryId = countryByRosterId.get(result.race_roster_id);
    const heat = heatByEditionId.get(result.race_edition_id);
    const event = heat ? eventBySlotKey.get(heat.slot_key) : null;
    if (!countryId || !event) continue;
    const ranks = eventRankByCountry.get(countryId) ?? {};
    ranks[event.slug] = result.final_rank;
    eventRankByCountry.set(countryId, ranks);
  }

  const events = PROFESSIONAL_NATIONS_CUP_EVENTS.flatMap(
    (definition): NationsCupEvent[] => {
      const eventHeats = heats.filter(
        (heat) => heat.slot_key === definition.slotKey,
      );
      if (eventHeats.length === 0) return [];
      const selectedHeat =
        eventHeats.find((heat) => heat.pool_key === viewerPoolKey) ??
        eventHeats.find((heat) => heat.pool_key === "d1") ??
        eventHeats[0];
      const selectedEdition = editionById.get(selectedHeat.race_edition_id);
      const selectedRace = raceById.get(selectedHeat.race_id);
      const statuses = eventHeats.flatMap((heat) => {
        const status = editionById.get(heat.race_edition_id)?.status;
        return status ? [status] : [];
      });
      if (!selectedEdition || !selectedRace) return [];
      return [
        {
          id: definition.slotKey,
          slug: definition.slug,
          hrefSlug: selectedRace.slug,
          name: definition.name,
          profileType:
            stageByEditionId.get(selectedEdition.id)?.profile_type ??
            definition.profileType,
          status: summarizeHeatStatuses(statuses),
        },
      ];
    },
  );
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

function summarizeHeatStatuses(statuses: string[]) {
  if (statuses.length > 0 && statuses.every((status) => status === "completed")) {
    return "completed";
  }
  if (statuses.some((status) => status === "in_progress")) return "in_progress";
  if (statuses.some((status) => status === "registration_open")) {
    return "registration_open";
  }
  if (statuses.some((status) => status === "registration_closed")) {
    return "registration_closed";
  }
  return statuses[0] ?? "planned";
}
