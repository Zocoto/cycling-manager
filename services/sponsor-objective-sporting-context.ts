import "server-only";

import { getDivisionForRank } from "@/lib/game/economy";
import { calculateNationRiderOverall } from "@/lib/game/nation-rider-ranking";
import { getRiderSportingProfile, type RiderRatings } from "@/lib/game/rider-profile";
import type { SponsorObjectiveSportingContext } from "@/lib/game/sponsor-objective-sporting-level";
import { normalizeTeamDivisionCode } from "@/lib/game/team-divisions";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SponsorObjectiveTeamRiderCandidate } from "@/services/sponsor-objectives";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type SeasonRow = { id: string; game_year: number };
type TeamSeasonRow = { final_rank: number | null; division: { code: string } | null };
type ContractRow = {
  rider_id: string;
  team_id: string;
  start_season_id: string;
  end_season_id: string;
  status: "active" | "planned";
};
type RiderRow = { id: string; country_id: string; first_name: string; last_name: string };
type CountryRow = { id: string; iso_alpha2: string };
type RatingRow = {
  rider_id: string;
  mountain: number; hills: number; flat: number; time_trial: number;
  cobbles: number; sprint: number; acceleration: number; downhill: number;
  endurance: number; resistance: number; recovery: number; breakaway: number; prologue: number;
};
const RELATION_BATCH_SIZE = 75;
const RATING_COLUMNS = "rider_id, mountain, hills, flat, time_trial, cobbles, sprint, acceleration, downhill, endurance, resistance, recovery, breakaway, prologue";

export type SponsorObjectiveTeamSportingSnapshot = {
  teamSportingContext?: SponsorObjectiveSportingContext;
  teamRiderCandidates: SponsorObjectiveTeamRiderCandidate[];
};

/** Read once when creating an S5+ plan; never use this to refresh agreed targets. */
export async function loadSponsorObjectiveSportingContext({
  supabase, seasonId, targetSeasonGameYear, teamId,
}: {
  supabase: SupabaseAdminClient;
  seasonId: string;
  targetSeasonGameYear: number;
  teamId?: string;
}): Promise<SponsorObjectiveTeamSportingSnapshot> {
  if (targetSeasonGameYear < 5 || !teamId?.trim()) return { teamRiderCandidates: [] };
  const normalizedTeamId = teamId.trim();
  const activeResult = await supabase.from("seasons")
    .select("id, game_year").eq("status", "active").maybeSingle<SeasonRow>();
  assertQuery(activeResult.error, "la saison de référence des objectifs sponsor");
  const activeSeason = activeResult.data;
  if (!activeSeason || targetSeasonGameYear < activeSeason.game_year) return { teamRiderCandidates: [] };

  // A planned team season deliberately has no assigned division yet. Read the
  // current registration and official materialized rank, not that empty row.
  const [teamResult, contractsResult] = await Promise.all([
    supabase.from("team_seasons").select("final_rank, division:divisions(code)")
      .eq("team_id", normalizedTeamId).eq("season_id", activeSeason.id).maybeSingle<TeamSeasonRow>(),
    supabase.from("rider_contracts").select("rider_id, team_id, start_season_id, end_season_id, status")
      .eq("team_id", normalizedTeamId).in("status", ["active", "planned"]).returns<ContractRow[]>(),
  ]);
  assertQuery(teamResult.error, "la division de référence des objectifs sponsor");
  assertQuery(contractsResult.error, "l’effectif de référence des objectifs sponsor");
  if (!teamResult.data) return { teamRiderCandidates: [] };
  const currentDivision = normalizeTeamDivisionCode(teamResult.data.division?.code);
  const rawRank = teamResult.data.final_rank;
  const projectedRank = typeof rawRank === "number" && Number.isInteger(rawRank) && rawRank > 0 ? rawRank : null;
  const teamSportingContext: SponsorObjectiveSportingContext = {
    currentDivision,
    projectedDivision: targetSeasonGameYear === activeSeason.game_year
      ? currentDivision : projectedRank === null ? null : getDivisionForRank(projectedRank),
    projectedRank,
  };

  const contracts = contractsResult.data ?? [];
  const yearBySeasonId = new Map<string, number>([
    [seasonId, targetSeasonGameYear], [activeSeason.id, activeSeason.game_year],
  ]);
  await loadContractYears(supabase, contracts, yearBySeasonId);
  const plausibleContracts = contracts.filter((contract) =>
    coversYear(contract, targetSeasonGameYear, yearBySeasonId)
      || (contract.status === "active" && coversYear(contract, activeSeason.game_year, yearBySeasonId)),
  );
  let riderIds = [...new Set(plausibleContracts.map((contract) => contract.rider_id))];
  if (riderIds.length === 0) return { teamSportingContext, teamRiderCandidates: [] };

  // Expiring current contracts are uncertain at J21, not confirmed departures.
  // A signed planned move to another team, however, must remove that rider.
  const departureContracts: ContractRow[] = [];
  for (const ids of batches(riderIds)) {
    const result = await supabase.from("rider_contracts")
      .select("rider_id, team_id, start_season_id, end_season_id, status")
      .in("rider_id", ids).eq("status", "planned").neq("team_id", normalizedTeamId).returns<ContractRow[]>();
    assertQuery(result.error, "les départs confirmés des objectifs sponsor");
    departureContracts.push(...(result.data ?? []));
  }
  await loadContractYears(supabase, departureContracts, yearBySeasonId);
  const departures = new Set(departureContracts
    .filter((contract) => coversYear(contract, targetSeasonGameYear, yearBySeasonId))
    .map((contract) => contract.rider_id));
  riderIds = riderIds.filter((id) => !departures.has(id));
  if (riderIds.length === 0) return { teamSportingContext, teamRiderCandidates: [] };

  const riders: RiderRow[] = [];
  for (const ids of batches(riderIds)) {
    const result = await supabase.from("riders")
      .select("id, country_id, first_name, last_name").in("id", ids)
      .in("status", ["active", "free_agent"]).returns<RiderRow[]>();
    assertQuery(result.error, "les coureurs de référence des objectifs sponsor");
    riders.push(...(result.data ?? []));
  }
  if (riders.length === 0) return { teamSportingContext, teamRiderCandidates: [] };
  const visibleRiderIds = riders.map((rider) => rider.id);
  const countries: CountryRow[] = [];
  for (const ids of batches([...new Set(riders.map((rider) => rider.country_id))])) {
    const result = await supabase.from("countries").select("id, iso_alpha2").in("id", ids).returns<CountryRow[]>();
    assertQuery(result.error, "les nationalités de référence des objectifs sponsor");
    countries.push(...(result.data ?? []));
  }
  const ratingsByRiderId = new Map((await loadRatings(supabase, seasonId, visibleRiderIds))
    .map((rating) => [rating.rider_id, rating]));
  const missingIds = visibleRiderIds.filter((id) => !ratingsByRiderId.has(id));
  if (seasonId !== activeSeason.id && missingIds.length > 0) {
    for (const rating of await loadRatings(supabase, activeSeason.id, missingIds)) ratingsByRiderId.set(rating.rider_id, rating);
  }
  const countryById = new Map(countries.map((country) => [country.id, country.iso_alpha2.trim().toUpperCase()]));
  const joinedForTargetSeason = new Set(plausibleContracts
    .filter((contract) => yearBySeasonId.get(contract.start_season_id) === targetSeasonGameYear)
    .map((contract) => contract.rider_id));
  const teamRiderCandidates = riders.flatMap((rider): SponsorObjectiveTeamRiderCandidate[] => {
    const row = ratingsByRiderId.get(rider.id);
    const countryCode = countryById.get(rider.country_id);
    if (!row || !countryCode) return [];
    const ratings = toRatings(row);
    if (Object.values(ratings).some((rating) => !Number.isFinite(rating))) return [];
    return [{
      riderId: rider.id, riderName: `${rider.first_name} ${rider.last_name}`.trim(), countryCode,
      ratings, overallRating: calculateNationRiderOverall(ratings), sportingProfile: getRiderSportingProfile(ratings),
      joinedForTargetSeason: joinedForTargetSeason.has(rider.id),
    }];
  });
  return { teamSportingContext, teamRiderCandidates };
}

function coversYear(contract: ContractRow, year: number, years: ReadonlyMap<string, number>): boolean {
  const first = years.get(contract.start_season_id), last = years.get(contract.end_season_id);
  return first !== undefined && last !== undefined && first <= year && year <= last;
}

async function loadContractYears(supabase: SupabaseAdminClient, contracts: readonly ContractRow[], years: Map<string, number>) {
  const missing = [...new Set(contracts.flatMap((contract) => [contract.start_season_id, contract.end_season_id]))]
    .filter((id) => !years.has(id));
  for (const ids of batches(missing)) {
    const result = await supabase.from("seasons").select("id, game_year").in("id", ids).returns<SeasonRow[]>();
    assertQuery(result.error, "les échéances des contrats des objectifs sponsor");
    for (const row of result.data ?? []) if (Number.isFinite(row.game_year)) years.set(row.id, row.game_year);
  }
}

async function loadRatings(supabase: SupabaseAdminClient, seasonId: string, riderIds: readonly string[]): Promise<RatingRow[]> {
  const rows: RatingRow[] = [];
  for (const ids of batches(riderIds)) {
    const result = await supabase.from("rider_season_ratings").select(RATING_COLUMNS)
      .eq("season_id", seasonId).in("rider_id", ids).returns<RatingRow[]>();
    assertQuery(result.error, "les notes de référence des objectifs sponsor");
    rows.push(...(result.data ?? []));
  }
  return rows;
}

function toRatings(row: RatingRow): RiderRatings {
  return { mountain: row.mountain, hills: row.hills, flat: row.flat, timeTrial: row.time_trial,
    cobbles: row.cobbles, sprint: row.sprint, acceleration: row.acceleration, downhill: row.downhill,
    endurance: row.endurance, resistance: row.resistance, recovery: row.recovery,
    breakaway: row.breakaway, prologue: row.prologue };
}

function batches<T>(values: readonly T[]): T[][] {
  const result: T[][] = [];
  for (let offset = 0; offset < values.length; offset += RELATION_BATCH_SIZE) result.push(values.slice(offset, offset + RELATION_BATCH_SIZE));
  return result;
}

function assertQuery(error: { message: string } | null, resource: string): asserts error is null {
  if (error) throw new Error(`Impossible de charger ${resource} : ${error.message}`);
}
