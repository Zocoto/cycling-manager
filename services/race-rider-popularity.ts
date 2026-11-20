import "server-only";

import { calculateFanClubRiderPopularity } from "@/lib/game/fan-club-popularity";
import {
  getFanClubHeadquartersSpecializationEffects,
  isFanClubHeadquartersSpecializationCode,
} from "@/lib/game/fan-club-specialization";
import { collectChunkedPaginatedRows } from "@/lib/supabase/pagination";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildSportingEvents } from "@/services/fan-club-data";
import { hasSpecialAbility } from "@/lib/game/special-abilities";
import type { StageSimulationInput } from "@/lib/game/race-simulation";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
type SportingFacts = Parameters<typeof buildSportingEvents>[0];
type Season = SportingFacts["seasons"][number];
type RiderPopularitySubject = {
  id: string;
  teamId: string;
  countryCode: string | null;
  name: string;
};
type Contract = {
  rider_id: string;
  team_id: string;
  start_season_id: string;
  end_season_id: string;
};
type TeamPopularityContext = {
  team_id: string;
  registration_country_code: string | null;
  community_growth_bonus_percentage: number | string;
  headquarters_level: number;
  active_specialization_code: string | null;
};

/** Uses the same sporting facts and score as the fan-club page, only for holders. */
export async function loadRaceRiderPopularityDirectory(
  admin: AdminClient,
  {
    riders,
    seasonId,
    gameYear,
    dayNumber,
  }: {
    riders: readonly RiderPopularitySubject[];
    seasonId: string;
    gameYear: number;
    dayNumber: number;
  },
): Promise<ReadonlyMap<string, number>> {
  const subjects = [...new Map(riders.map(rider => [rider.id, rider])).values()];
  if (!subjects.length) return new Map();
  const riderIds = subjects.map(rider => rider.id);

  async function readRows<Row>(
    table: string,
    columns: string,
    key: string,
    values: string[],
    filter?: { maximumRank?: { key: string; value: number }; breakawayOnly?: boolean; activeOnly?: boolean },
  ): Promise<Row[]> {
    const result = await collectChunkedPaginatedRows<Row, { message: string }, string>({
      values: [...new Set(values)],
      maxConcurrency: 2,
      fetchPage: async (chunk, from, to) => {
        let query = admin.from(table).select(columns).in(key, chunk);
        if (filter?.maximumRank) {
          query = query.not(filter.maximumRank.key, "is", null)
            .lte(filter.maximumRank.key, filter.maximumRank.value);
        }
        if (filter?.breakawayOnly) query = query.eq("participation_type", "breakaway");
        if (filter?.activeOnly) query = query.eq("status", "active");
        if (table === "rider_season_ratings") {
          query = query.order("rider_id").order("season_id");
        } else if (table === "stage_attack_participants") {
          query = query.order("stage_id").order("race_roster_id");
        } else {
          query = query.order(table === "rider_popularity_profiles" ? "rider_id" : "id");
        }
        const response = await query.range(from, to).returns<Row[]>();
        return { data: response.data, error: response.error };
      },
    });
    if (result.error) throw new Error("Impossible de charger la popularité des coureurs : " + result.error.message);
    return result.data;
  }

  const [seasonsResponse, contracts, ratingHistory, mediaProfiles, raceRosters] = await Promise.all([
    admin.from("seasons").select("id, game_year, status, current_day_number")
      .order("game_year").returns<Season[]>(),
    readRows<Contract>("rider_contracts", "rider_id, team_id, start_season_id, end_season_id", "rider_id", riderIds, { activeOnly: true }),
    readRows<{ rider_id: string; season_id: string }>("rider_season_ratings", "rider_id, season_id", "rider_id", riderIds),
    readRows<{ rider_id: string; popularity_points: number | string }>("rider_popularity_profiles", "rider_id, popularity_points", "rider_id", riderIds),
    readRows<SportingFacts["raceRosters"][number]>("race_rosters", "id, rider_id, race_registration_id", "rider_id", riderIds),
  ]);
  if (seasonsResponse.error) throw new Error("Impossible de charger les saisons de popularité : " + seasonsResponse.error.message);
  const seasons = seasonsResponse.data ?? [];
  const seasonById = new Map(seasons.map(season => [season.id, season]));
  if (!seasonById.has(seasonId)) throw new Error("La saison de popularité des coureurs est introuvable.");
  const currentContractByRider = new Map(contracts.filter(contract => {
    const starts = seasonById.get(contract.start_season_id)?.game_year;
    const ends = seasonById.get(contract.end_season_id)?.game_year;
    return starts !== undefined && ends !== undefined && starts <= gameYear && ends >= gameYear;
  }).map(contract => [contract.rider_id, contract]));
  const teamIds = [...new Set(subjects.map(rider => currentContractByRider.get(rider.id)?.team_id ?? rider.teamId))];

  const rosterIds = raceRosters.map(roster => roster.id);
  const [teamContextResult, raceResults, stageResults, attacks] = await Promise.all([
    admin.rpc("get_race_team_popularity_context", {
      p_team_ids: teamIds,
      p_season_id: seasonId,
    }).returns<TeamPopularityContext[]>(),
    readRows<SportingFacts["raceResults"][number]>("race_results", "id, race_edition_id, race_roster_id, final_rank", "race_roster_id", rosterIds, { maximumRank: { key: "final_rank", value: 20 } }),
    readRows<SportingFacts["stageResults"][number]>("stage_results", "id, stage_id, race_roster_id, rank", "race_roster_id", rosterIds, { maximumRank: { key: "rank", value: 10 } }),
    readRows<SportingFacts["attacks"][number]>("stage_attack_participants", "stage_id, race_roster_id, participation_type", "race_roster_id", rosterIds, { breakawayOnly: true }),
  ]);
  if (teamContextResult.error) throw new Error("Impossible de charger le contexte de popularité : " + teamContextResult.error.message);
  if (!Array.isArray(teamContextResult.data)) throw new Error("Le contexte de popularité des équipes est invalide.");
  const teamContextById = new Map<string, TeamPopularityContext>(
    teamContextResult.data.map(context => [context.team_id, context]),
  );

  const performanceRosterIds = new Set([...raceResults, ...stageResults, ...attacks].map(result => result.race_roster_id));
  const historicalRegistrationIds = raceRosters.filter(roster => performanceRosterIds.has(roster.id)).map(roster => roster.race_registration_id);
  const stageIds = [...new Set([...stageResults, ...attacks].map(result => result.stage_id))];
  const [registrations, seedStages] = await Promise.all([
    readRows<SportingFacts["registrations"][number]>("race_registrations", "id, race_edition_id, team_season_id", "id", historicalRegistrationIds),
    readRows<SportingFacts["stages"][number]>("stages", "id, race_edition_id, season_day_id, stage_number, name, distance_km", "id", stageIds),
  ]);
  const editionIds = [...new Set([...raceResults.map(result => result.race_edition_id), ...seedStages.map(stage => stage.race_edition_id)])];
  const editions = await readRows<SportingFacts["editions"][number]>(
    "race_editions", "id, race_id, season_id, race_category_id, display_name, status, host_country_id, is_neutral_host", "id", editionIds,
  );
  const [stages, categories, races, teamSeasons] = await Promise.all([
    readRows<SportingFacts["stages"][number]>("stages", "id, race_edition_id, season_day_id, stage_number, name, distance_km", "race_edition_id", editionIds),
    readRows<SportingFacts["categories"][number]>("race_categories", "id, prestige_rank", "id", editions.map(edition => edition.race_category_id)),
    readRows<SportingFacts["races"][number]>("races", "id, race_format, country_id", "id", editions.map(edition => edition.race_id)),
    readRows<SportingFacts["teamSeasons"][number]>("team_seasons", "id, team_id, season_id, registration_country_id", "id", registrations.flatMap(registration => registration.team_season_id ? [registration.team_season_id] : [])),
  ]);
  const seasonDays = await readRows<SportingFacts["seasonDays"][number]>(
    "season_days", "id, day_number", "id", stages.map(stage => stage.season_day_id),
  );
  const careerSeasonsByRider = new Map<string, number[]>();
  for (const rating of ratingHistory) {
    const year = seasonById.get(rating.season_id)?.game_year;
    if (year === undefined) continue;
    const years = careerSeasonsByRider.get(rating.rider_id) ?? [];
    years.push(year);
    careerSeasonsByRider.set(rating.rider_id, years);
  }
  const mediaByRider = new Map(mediaProfiles.map(profile => [profile.rider_id, Number(profile.popularity_points)]));
  const currentTeamIdByRider = new Map(subjects.map(subject => [
    subject.id, currentContractByRider.get(subject.id)?.team_id ?? subject.teamId,
  ]));
  const events = buildSportingEvents({
    currentTeamId: "", currentTeamIdByRider, raceRosters, registrations, teamSeasons, raceResults,
    stageResults, attacks, editions, stages, categories, races, seasons, seasonDays,
  });
  const eventsByRider = new Map<string, typeof events[number]["event"][]>();
  for (const entry of events) {
    if (entry.event.season > gameYear || (entry.event.season === gameYear && entry.event.day > dayNumber)) continue;
    const riderEvents = eventsByRider.get(entry.riderId) ?? [];
    riderEvents.push(entry.event);
    eventsByRider.set(entry.riderId, riderEvents);
  }
  const popularityByRider = new Map<string, number>();
  for (const teamId of teamIds) {
    const context = teamContextById.get(teamId);
    const specialization = context?.active_specialization_code;
    const specializationEffects = getFanClubHeadquartersSpecializationEffects(
      isFanClubHeadquartersSpecializationCode(specialization)
        ? { code: specialization, infrastructureLevel: context?.headquarters_level ?? 0 }
        : null,
    );
    for (const subject of subjects) {
      const contract = currentContractByRider.get(subject.id);
      if ((contract?.team_id ?? subject.teamId) !== teamId) continue;
      const starts = contract ? seasonById.get(contract.start_season_id)?.game_year : gameYear;
      const clubSeasons = seasons.filter(season => season.game_year >= (starts ?? gameYear) && season.game_year <= gameYear).map(season => season.game_year);
      const rider = calculateFanClubRiderPopularity({
        id: subject.id, name: subject.name, initials: "", role: "", country: "",
        nationalityMatchesTeam: Boolean(context?.registration_country_code) && subject.countryCode?.toUpperCase() === context?.registration_country_code?.toUpperCase(),
        activeSeason: gameYear, activeDay: dayNumber,
        careerSeasons: careerSeasonsByRider.get(subject.id) ?? [gameYear],
        clubSeasons, events: eventsByRider.get(subject.id) ?? [],
        communityGrowthBonusPercentage: Number(context?.community_growth_bonus_percentage ?? 0),
        mediaPopularityPoints: mediaByRider.get(subject.id) ?? 0,
        resultPopularityBonusPercentage: specializationEffects.riderPopularityGainBonusPercentage,
      });
      popularityByRider.set(subject.id, rider.popularity);
    }
  }
  return popularityByRider;
}

export async function snapshotCrowdSurgePopularity(
  input: StageSimulationInput,
  { admin, seasonId, gameYear, dayNumber }: {
    admin: AdminClient;
    seasonId: string;
    gameYear: number;
    dayNumber: number;
  },
): Promise<StageSimulationInput> {
  const unavailable = new Set(input.unavailableRiderIds ?? []);
  const subjects = input.riders.filter(rider =>
    hasSpecialAbility(rider, "crowd_surge") && rider.popularity === undefined && !unavailable.has(rider.id),
  );
  if (!subjects.length) return input;
  const popularity = await loadRaceRiderPopularityDirectory(admin, {
    riders: subjects.map(rider => ({
      id: rider.id, teamId: rider.teamId, name: rider.name, countryCode: rider.countryCode ?? null,
    })),
    seasonId, gameYear, dayNumber,
  });
  return {
    ...input,
    riders: input.riders.map(rider => popularity.has(rider.id)
      ? { ...rider, popularity: popularity.get(rider.id)! }
      : rider),
  };
}

