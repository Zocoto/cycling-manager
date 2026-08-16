import "server-only";

import { getRiderSportingProfile } from "@/lib/game/rider-profile";
import {
  addRiderDepartureImpact,
  calculateFanClubAudience,
  calculateFanClubRiderPopularity,
  type FanClubSportingEvent,
} from "@/lib/game/fan-club-popularity";
import type {
  FanClubLiveData,
  FanClubPilotRace,
} from "@/lib/game/fan-club-pilot";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentDashboardFastSummary } from "@/services/dashboard-fast-summary";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type RosterRow = {
  rider_id: string;
  first_name: string;
  last_name: string;
  country_id: string;
  country_name: string;
  mountain: number;
  hills: number;
  flat: number;
  time_trial: number;
  cobbles: number;
  sprint: number;
  acceleration: number;
  downhill: number;
  endurance: number;
  resistance: number;
  recovery: number;
  breakaway: number;
  prologue: number;
};

type DirectorRow = {
  reputation_points: number | string;
  country_id: string | null;
};

type TeamSeasonRow = {
  id: string;
  team_id: string;
  season_id: string;
  registration_country_id: string | null;
};

type SeasonRow = {
  id: string;
  game_year: number;
  status: string;
  current_day_number: number | null;
};

type ContractRow = {
  rider_id: string;
  start_season_id: string;
  end_season_id: string;
};

type RatingHistoryRow = {
  rider_id: string;
  season_id: string;
};

type RaceRosterRow = {
  id: string;
  rider_id: string;
  race_registration_id: string;
};

type RegistrationRow = {
  id: string;
  race_edition_id: string;
  team_season_id: string | null;
};

type RaceResultRow = {
  id: string;
  race_edition_id: string;
  race_roster_id: string;
  final_rank: number | null;
};

type StageResultRow = {
  id: string;
  stage_id: string;
  race_roster_id: string;
  rank: number | null;
};

type AttackRow = {
  stage_id: string;
  race_roster_id: string;
  participation_type: string;
};

type StageRow = {
  id: string;
  race_edition_id: string;
  season_day_id: string;
  stage_number: number;
  name: string;
  distance_km: number | string;
};

type EditionRow = {
  id: string;
  race_id: string;
  season_id: string;
  race_category_id: string;
  display_name: string;
  status: string;
};

type CategoryRow = {
  id: string;
  prestige_rank: number;
};

type RaceRow = {
  id: string;
  race_format: string;
};

type SeasonDayRow = {
  id: string;
  day_number: number;
};

export async function getFanClubLiveData({
  supabase,
  authUserId,
  headquartersLevel,
}: {
  supabase: ServerClient;
  authUserId: string;
  headquartersLevel: number;
}): Promise<FanClubLiveData | null> {
  const summary = await getCurrentDashboardFastSummary(supabase);
  if (!summary) return null;
  const admin = createSupabaseAdminClient();

  const [
    rosterResult,
    contractsResult,
    seasonsResult,
    directorResult,
    currentTeamSeasonResult,
  ] = await Promise.all([
    supabase.rpc("get_current_team_roster_with_potential"),
    admin
      .from("rider_contracts")
      .select("rider_id, start_season_id, end_season_id")
      .eq("team_id", summary.teamId)
      .eq("status", "active")
      .returns<ContractRow[]>(),
    admin
      .from("seasons")
      .select("id, game_year, status, current_day_number")
      .order("game_year", { ascending: true })
      .returns<SeasonRow[]>(),
    admin
      .from("sporting_directors")
      .select("reputation_points, country_id")
      .eq("auth_user_id", authUserId)
      .eq("status", "active")
      .maybeSingle<DirectorRow>(),
    admin
      .from("team_seasons")
      .select("id, team_id, season_id, registration_country_id")
      .eq("id", summary.teamSeasonId)
      .maybeSingle<TeamSeasonRow>(),
  ]);

  assertQuery(rosterResult.error, "l’effectif du Fan Club");
  assertQuery(contractsResult.error, "les contrats de l’effectif");
  assertQuery(seasonsResult.error, "les saisons");
  assertQuery(directorResult.error, "la réputation de l’équipe");
  assertQuery(currentTeamSeasonResult.error, "l’identité nationale de l’équipe");

  const roster = (rosterResult.data ?? []) as RosterRow[];
  const riderIds = roster.map((rider) => rider.rider_id);
  const seasons = seasonsResult.data ?? [];
  const activeSeason =
    seasons.find((season) => season.id === summary.seasonId) ??
    seasons.find((season) => season.status === "active") ??
    null;
  if (!activeSeason) {
    throw new Error("Impossible de calculer le Fan Club sans saison active.");
  }

  if (riderIds.length === 0) {
    return buildEmptyLiveData({
      teamName: summary.teamName,
      headquartersLevel,
      directorReputation: Number(directorResult.data?.reputation_points ?? 0),
    });
  }
  const ratingHistoryResult = await admin
    .from("rider_season_ratings")
    .select("rider_id, season_id")
    .in("rider_id", riderIds)
    .returns<RatingHistoryRow[]>();
  assertQuery(ratingHistoryResult.error, "l’ancienneté des coureurs");

  const [raceRostersResult, upcomingRegistrationsResult] = await Promise.all([
    admin
      .from("race_rosters")
      .select("id, rider_id, race_registration_id")
      .in("rider_id", riderIds)
      .returns<RaceRosterRow[]>(),
    admin
      .from("race_registrations")
      .select("id, race_edition_id, team_season_id")
      .eq("team_season_id", summary.teamSeasonId)
      .eq("status", "accepted")
      .returns<RegistrationRow[]>(),
  ]);
  assertQuery(raceRostersResult.error, "les participations des coureurs");
  assertQuery(upcomingRegistrationsResult.error, "les courses de l’équipe");

  const raceRosters = raceRostersResult.data ?? [];
  const raceRosterIds = raceRosters.map((row) => row.id);
  const registrationIds = [
    ...new Set(raceRosters.map((row) => row.race_registration_id)),
  ];

  const [raceResultsResult, stageResultsResult, attacksResult, registrationsResult] =
    await Promise.all([
      raceRosterIds.length > 0
        ? admin
            .from("race_results")
            .select("id, race_edition_id, race_roster_id, final_rank")
            .in("race_roster_id", raceRosterIds)
            .not("final_rank", "is", null)
            .lte("final_rank", 20)
            .returns<RaceResultRow[]>()
        : emptyResult<RaceResultRow>(),
      raceRosterIds.length > 0
        ? admin
            .from("stage_results")
            .select("id, stage_id, race_roster_id, rank")
            .in("race_roster_id", raceRosterIds)
            .not("rank", "is", null)
            .lte("rank", 10)
            .returns<StageResultRow[]>()
        : emptyResult<StageResultRow>(),
      raceRosterIds.length > 0
        ? admin
            .from("stage_attack_participants")
            .select("stage_id, race_roster_id, participation_type")
            .in("race_roster_id", raceRosterIds)
            .eq("participation_type", "breakaway")
            .returns<AttackRow[]>()
        : emptyResult<AttackRow>(),
      registrationIds.length > 0
        ? admin
            .from("race_registrations")
            .select("id, race_edition_id, team_season_id")
            .in("id", registrationIds)
            .returns<RegistrationRow[]>()
        : emptyResult<RegistrationRow>(),
    ]);

  assertQuery(raceResultsResult.error, "les classements généraux");
  assertQuery(stageResultsResult.error, "les résultats d’étapes");
  assertQuery(attacksResult.error, "les échappées");
  assertQuery(registrationsResult.error, "les équipes des résultats");

  const raceResults = raceResultsResult.data ?? [];
  const stageResults = stageResultsResult.data ?? [];
  const attacks = attacksResult.data ?? [];
  const historicalRegistrations = registrationsResult.data ?? [];
  const stageIds = [
    ...new Set([
      ...stageResults.map((row) => row.stage_id),
      ...attacks.map((row) => row.stage_id),
    ]),
  ];

  const seedStagesResult =
    stageIds.length > 0
      ? await admin
          .from("stages")
          .select(
            "id, race_edition_id, season_day_id, stage_number, name, distance_km",
          )
          .in("id", stageIds)
          .returns<StageRow[]>()
      : await emptyResult<StageRow>();
  assertQuery(seedStagesResult.error, "les étapes des performances");

  const seedStages = seedStagesResult.data ?? [];
  const upcomingRegistrations = upcomingRegistrationsResult.data ?? [];
  const editionIds = [
    ...new Set([
      ...raceResults.map((row) => row.race_edition_id),
      ...seedStages.map((row) => row.race_edition_id),
      ...upcomingRegistrations.map((row) => row.race_edition_id),
    ]),
  ];

  const editionsResult =
    editionIds.length > 0
      ? await admin
          .from("race_editions")
          .select(
            "id, race_id, season_id, race_category_id, display_name, status",
          )
          .in("id", editionIds)
          .returns<EditionRow[]>()
      : await emptyResult<EditionRow>();
  assertQuery(editionsResult.error, "les éditions de course");

  const editions = editionsResult.data ?? [];
  const categoryIds = [...new Set(editions.map((row) => row.race_category_id))];
  const raceIds = [...new Set(editions.map((row) => row.race_id))];
  const teamSeasonIds = [
    ...new Set(
      historicalRegistrations
        .map((row) => row.team_season_id)
        .filter((teamSeasonId): teamSeasonId is string => Boolean(teamSeasonId)),
    ),
  ];

  const [allStagesResult, categoriesResult, racesResult, teamSeasonsResult] =
    await Promise.all([
      editionIds.length > 0
        ? admin
            .from("stages")
            .select(
              "id, race_edition_id, season_day_id, stage_number, name, distance_km",
            )
            .in("race_edition_id", editionIds)
            .returns<StageRow[]>()
        : emptyResult<StageRow>(),
      categoryIds.length > 0
        ? admin
            .from("race_categories")
            .select("id, prestige_rank")
            .in("id", categoryIds)
            .returns<CategoryRow[]>()
        : emptyResult<CategoryRow>(),
      raceIds.length > 0
        ? admin
            .from("races")
            .select("id, race_format")
            .in("id", raceIds)
            .returns<RaceRow[]>()
        : emptyResult<RaceRow>(),
      teamSeasonIds.length > 0
        ? admin
            .from("team_seasons")
            .select("id, team_id, season_id, registration_country_id")
            .in("id", teamSeasonIds)
            .returns<TeamSeasonRow[]>()
        : emptyResult<TeamSeasonRow>(),
    ]);

  assertQuery(allStagesResult.error, "le calendrier des courses suivies");
  assertQuery(categoriesResult.error, "le prestige des courses");
  assertQuery(racesResult.error, "le format des courses");
  assertQuery(teamSeasonsResult.error, "l’historique des équipes");

  const allStages = allStagesResult.data ?? [];
  const seasonDayIds = [...new Set(allStages.map((row) => row.season_day_id))];
  const seasonDaysResult =
    seasonDayIds.length > 0
      ? await admin
          .from("season_days")
          .select("id, day_number")
          .in("id", seasonDayIds)
          .returns<SeasonDayRow[]>()
      : await emptyResult<SeasonDayRow>();
  assertQuery(seasonDaysResult.error, "les jours des performances");

  const sportingEvents = buildSportingEvents({
    currentTeamId: summary.teamId,
    raceRosters,
    registrations: historicalRegistrations,
    teamSeasons: teamSeasonsResult.data ?? [],
    raceResults,
    stageResults,
    attacks,
    editions,
    stages: allStages,
    categories: categoriesResult.data ?? [],
    races: racesResult.data ?? [],
    seasons,
    seasonDays: seasonDaysResult.data ?? [],
  });
  const eventsByRiderId = groupEventsByRider(sportingEvents);
  const seasonById = new Map(seasons.map((season) => [season.id, season]));
  const contractsByRider = new Map(
    (contractsResult.data ?? []).map((contract) => [
      contract.rider_id,
      contract,
    ]),
  );
  const careerSeasonsByRider = new Map<string, number[]>();
  for (const rating of ratingHistoryResult.data ?? []) {
    if (!riderIds.includes(rating.rider_id)) continue;
    const gameYear = seasonById.get(rating.season_id)?.game_year;
    if (!gameYear) continue;
    const values = careerSeasonsByRider.get(rating.rider_id) ?? [];
    values.push(gameYear);
    careerSeasonsByRider.set(rating.rider_id, values);
  }

  const teamCountryId =
    currentTeamSeasonResult.data?.registration_country_id ??
    directorResult.data?.country_id ??
    null;
  const calculatedRiders = roster.map((rider) => {
    const contract = contractsByRider.get(rider.rider_id);
    const startYear = contract
      ? seasonById.get(contract.start_season_id)?.game_year
      : activeSeason.game_year;
    const clubSeasons = seasons
      .filter(
        (season) =>
          season.game_year >= (startYear ?? activeSeason.game_year) &&
          season.game_year <= activeSeason.game_year,
      )
      .map((season) => season.game_year);

    return calculateFanClubRiderPopularity({
      id: rider.rider_id,
      name: `${rider.first_name} ${rider.last_name}`,
      initials: getInitials(rider.first_name, rider.last_name),
      role: getRiderSportingProfile({
        mountain: rider.mountain,
        hills: rider.hills,
        flat: rider.flat,
        timeTrial: rider.time_trial,
        cobbles: rider.cobbles,
        sprint: rider.sprint,
        acceleration: rider.acceleration,
        downhill: rider.downhill,
        endurance: rider.endurance,
        resistance: rider.resistance,
        recovery: rider.recovery,
        breakaway: rider.breakaway,
        prologue: rider.prologue,
      }),
      country: rider.country_name,
      nationalityMatchesTeam:
        Boolean(teamCountryId) && rider.country_id === teamCountryId,
      activeSeason: activeSeason.game_year,
      activeDay:
        activeSeason.current_day_number ?? summary.seasonDayNumber ?? 1,
      careerSeasons:
        careerSeasonsByRider.get(rider.rider_id) ?? [activeSeason.game_year],
      clubSeasons,
      events: eventsByRiderId.get(rider.rider_id) ?? [],
    });
  });

  const audience = calculateFanClubAudience({
    riders: calculatedRiders,
    directorReputation: Number(directorResult.data?.reputation_points ?? 0),
    headquartersLevel,
    activeSeason: activeSeason.game_year,
    events: sportingEvents.map((entry) => entry.event),
  });
  const totalPopularity = calculatedRiders.reduce(
    (total, rider) => total + rider.popularity,
    0,
  );
  const riders = calculatedRiders
    .map((rider) =>
      addRiderDepartureImpact(
        rider,
        audience.supporterCount,
        totalPopularity,
      ),
    )
    .sort(
      (left, right) =>
        right.popularity - left.popularity ||
        left.name.localeCompare(right.name, "fr"),
    );
  const upcomingEditionIds = new Set(
    upcomingRegistrations.map((row) => row.race_edition_id),
  );

  return {
    teamName: summary.teamName,
    supporterCount: audience.supporterCount,
    supporterTrend: audience.supporterTrend,
    fervor: audience.fervor,
    popularityIndex: audience.popularityIndex,
    recentResultsMultiplier: audience.recentResultsMultiplier,
    sportingResultCount: sportingEvents.filter(
      (entry) => entry.event.kind !== "breakaway",
    ).length,
    riders,
    races: buildUpcomingRaces({
      editionIds: upcomingEditionIds,
      editions,
      stages: allStages,
      seasonDays: seasonDaysResult.data ?? [],
      activeDay: activeSeason.current_day_number ?? summary.seasonDayNumber ?? 1,
    }),
    supporterBreakdown: audience.breakdown,
  };
}

function buildSportingEvents({
  currentTeamId,
  raceRosters,
  registrations,
  teamSeasons,
  raceResults,
  stageResults,
  attacks,
  editions,
  stages,
  categories,
  races,
  seasons,
  seasonDays,
}: {
  currentTeamId: string;
  raceRosters: RaceRosterRow[];
  registrations: RegistrationRow[];
  teamSeasons: TeamSeasonRow[];
  raceResults: RaceResultRow[];
  stageResults: StageResultRow[];
  attacks: AttackRow[];
  editions: EditionRow[];
  stages: StageRow[];
  categories: CategoryRow[];
  races: RaceRow[];
  seasons: SeasonRow[];
  seasonDays: SeasonDayRow[];
}): Array<{ riderId: string; event: FanClubSportingEvent }> {
  const rosterById = new Map(raceRosters.map((row) => [row.id, row]));
  const registrationById = new Map(registrations.map((row) => [row.id, row]));
  const teamSeasonById = new Map(teamSeasons.map((row) => [row.id, row]));
  const editionById = new Map(editions.map((row) => [row.id, row]));
  const stageById = new Map(stages.map((row) => [row.id, row]));
  const categoryById = new Map(categories.map((row) => [row.id, row]));
  const raceById = new Map(races.map((row) => [row.id, row]));
  const seasonById = new Map(seasons.map((row) => [row.id, row]));
  const dayById = new Map(seasonDays.map((row) => [row.id, row.day_number]));
  const stagesByEdition = groupStagesByEdition(stages);
  const resolveContext = (rosterId: string, editionId: string) => {
    const roster = rosterById.get(rosterId);
    const registration = roster
      ? registrationById.get(roster.race_registration_id)
      : null;
    const teamSeason = registration?.team_season_id
      ? teamSeasonById.get(registration.team_season_id)
      : null;
    const edition = editionById.get(editionId);
    const season = edition ? seasonById.get(edition.season_id) : null;
    const category = edition
      ? categoryById.get(edition.race_category_id)
      : null;
    return {
      roster,
      edition,
      season,
      prestigeRank: category?.prestige_rank ?? 4,
      forCurrentTeam: teamSeason?.team_id === currentTeamId,
    };
  };

  const entries: Array<{ riderId: string; event: FanClubSportingEvent }> = [];

  for (const result of raceResults) {
    const context = resolveContext(result.race_roster_id, result.race_edition_id);
    if (!context.roster || !context.edition || !context.season) continue;
    const finalDay = Math.max(
      1,
      ...(stagesByEdition.get(context.edition.id) ?? []).map(
        (stage) => dayById.get(stage.season_day_id) ?? 1,
      ),
    );
    entries.push({
      riderId: context.roster.rider_id,
      event: {
        id: `race:${result.id}`,
        kind: "race_result",
        season: context.season.game_year,
        day: finalDay,
        reason: `${context.edition.display_name} — ${formatPlacement(result.final_rank, false)}`,
        rank: result.final_rank,
        prestigeRank: context.prestigeRank,
        forCurrentTeam: context.forCurrentTeam,
      },
    });
  }

  for (const result of stageResults) {
    const stage = stageById.get(result.stage_id);
    if (!stage) continue;
    const context = resolveContext(result.race_roster_id, stage.race_edition_id);
    if (
      !context.roster ||
      !context.edition ||
      !context.season ||
      raceById.get(context.edition.race_id)?.race_format !== "stage_race"
    ) {
      continue;
    }
    entries.push({
      riderId: context.roster.rider_id,
      event: {
        id: `stage:${result.id}`,
        kind: "stage_result",
        season: context.season.game_year,
        day: dayById.get(stage.season_day_id) ?? 1,
        reason: `${context.edition.display_name} — Étape ${stage.stage_number} : ${formatPlacement(result.rank, true)}`,
        rank: result.rank,
        prestigeRank: context.prestigeRank,
        forCurrentTeam: context.forCurrentTeam,
      },
    });
  }

  for (const attack of attacks) {
    const stage = stageById.get(attack.stage_id);
    if (!stage) continue;
    const context = resolveContext(attack.race_roster_id, stage.race_edition_id);
    if (!context.roster || !context.edition || !context.season) continue;
    entries.push({
      riderId: context.roster.rider_id,
      event: {
        id: `breakaway:${stage.id}:${context.roster.id}`,
        kind: "breakaway",
        season: context.season.game_year,
        day: dayById.get(stage.season_day_id) ?? 1,
        reason: `${context.edition.display_name} — Échappée sur l’étape ${stage.stage_number}`,
        rank: null,
        prestigeRank: context.prestigeRank,
        forCurrentTeam: context.forCurrentTeam,
      },
    });
  }

  return entries;
}

function buildUpcomingRaces({
  editionIds,
  editions,
  stages,
  seasonDays,
  activeDay,
}: {
  editionIds: Set<string>;
  editions: EditionRow[];
  stages: StageRow[];
  seasonDays: SeasonDayRow[];
  activeDay: number;
}): FanClubPilotRace[] {
  const dayById = new Map(seasonDays.map((row) => [row.id, row.day_number]));
  const stagesByEdition = groupStagesByEdition(stages);

  return editions
    .filter(
      (edition) =>
        editionIds.has(edition.id) &&
        !["completed", "cancelled"].includes(edition.status),
    )
    .map((edition) => {
      const editionStages = stagesByEdition.get(edition.id) ?? [];
      const futureDays = editionStages
        .map((stage) => dayById.get(stage.season_day_id) ?? 0)
        .filter((day) => day >= activeDay);
      if (futureDays.length === 0) return null;
      const day = Math.min(...futureDays);
      return {
        id: edition.id,
        name: edition.display_name,
        timing: day === activeDay ? "Aujourd’hui" : `J+${day - activeDay}`,
        distanceKm: Math.max(
          1,
          Math.round(
            editionStages.reduce(
              (total, stage) => total + Number(stage.distance_km),
              0,
            ),
          ),
        ),
        day,
      };
    })
    .filter(
      (
        race,
      ): race is FanClubPilotRace & {
        day: number;
      } => race !== null,
    )
    .sort((left, right) => left.day - right.day)
    .slice(0, 8)
    .map((race) => ({
      id: race.id,
      name: race.name,
      timing: race.timing,
      distanceKm: race.distanceKm,
    }));
}

function groupEventsByRider(
  entries: Array<{ riderId: string; event: FanClubSportingEvent }>,
): Map<string, FanClubSportingEvent[]> {
  const grouped = new Map<string, FanClubSportingEvent[]>();
  for (const entry of entries) {
    const events = grouped.get(entry.riderId) ?? [];
    events.push(entry.event);
    grouped.set(entry.riderId, events);
  }
  return grouped;
}

function groupStagesByEdition(
  stages: StageRow[],
): Map<string, StageRow[]> {
  const grouped = new Map<string, StageRow[]>();
  for (const stage of stages) {
    const editionStages = grouped.get(stage.race_edition_id) ?? [];
    editionStages.push(stage);
    grouped.set(stage.race_edition_id, editionStages);
  }
  return grouped;
}

function buildEmptyLiveData({
  teamName,
  headquartersLevel,
  directorReputation,
}: {
  teamName: string;
  headquartersLevel: number;
  directorReputation: number;
}): FanClubLiveData {
  const audience = calculateFanClubAudience({
    riders: [],
    directorReputation,
    headquartersLevel,
    activeSeason: 1,
    events: [],
  });
  return {
    teamName,
    supporterCount: audience.supporterCount,
    supporterTrend: audience.supporterTrend,
    fervor: audience.fervor,
    popularityIndex: audience.popularityIndex,
    recentResultsMultiplier: audience.recentResultsMultiplier,
    sportingResultCount: 0,
    riders: [],
    races: [],
    supporterBreakdown: audience.breakdown,
  };
}

function formatPlacement(rank: number | null, stage: boolean): string {
  if (rank === 1) return stage ? "Victoire d’étape" : "Victoire";
  if (!rank) return "Résultat classé";
  return `${rank}e place`;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();
}

function emptyResult<T>(): Promise<{ data: T[]; error: null }> {
  return Promise.resolve({ data: [] as T[], error: null });
}

function assertQuery(
  error: { message: string } | null,
  label: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${label} : ${error.message}`);
  }
}

