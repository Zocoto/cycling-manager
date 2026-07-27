import "server-only";

import { SPONSORS } from "@/data/sponsors";
import {
  isRaceCategoryCode,
  type RaceCompetitionType,
  type RaceFormat,
} from "@/lib/game/race-calendar";
import {
  countTeamVictories,
  selectRecentMajorTeamResults,
  selectSeasonTeamPalmares,
  type TeamResultCandidate,
  type TeamSecondaryClassificationType,
} from "@/lib/game/team-result-highlights";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { collectChunkedPaginatedRows } from "@/lib/supabase/pagination";
import {
  getPublicTeamSeasonHistory,
  type PublicTeamSeasonHistoryEntry,
} from "@/services/public-team-history";

export type PublicTeamHistoricalLogo = {
  sponsorName: string;
  logoPath: string;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
};

export type PublicTeamProfileSeasonHistoryEntry =
  PublicTeamSeasonHistoryEntry & {
    logo: PublicTeamHistoricalLogo | null;
    highlights: TeamResultCandidate[];
    victoryCount: number;
  };

export type PublicTeamProfileHistory = {
  seasons: PublicTeamProfileSeasonHistoryEntry[];
  recentResults: TeamResultCandidate[];
};

type SponsorContractRow = {
  sponsor_id: string;
  start_season_id: string;
  end_season_id: string;
  status: string;
  created_at: string;
};

type SponsorRegistryRow = {
  id: string;
  catalog_key: string;
};

type ContractSeasonRow = {
  id: string;
  game_year: number;
};

type RaceRegistrationRow = {
  id: string;
  race_edition_id: string;
  team_season_id: string | null;
};

type RaceRosterRow = {
  id: string;
  race_registration_id: string;
  rider_id: string;
};

type RaceEditionRow = {
  id: string;
  race_id: string;
  season_id: string;
  race_category_id: string;
  display_name: string;
};

type RaceRow = {
  id: string;
  slug: string;
  race_format: string;
  competition_type: string;
};

type RaceCategoryRow = {
  id: string;
  code: string;
  prestige_rank: number;
};

type StageRow = {
  id: string;
  race_edition_id: string;
  season_day_id: string;
  stage_number: number;
  name: string;
};

type SeasonDayRow = {
  id: string;
  season_id: string;
  day_number: number;
  calendar_date: string;
};

type RiderRow = {
  id: string;
  first_name: string;
  last_name: string;
};

type RaceResultRow = {
  id: string;
  race_edition_id: string;
  race_roster_id: string;
  status: string;
  final_rank: number | null;
};

type StageResultRow = {
  id: string;
  stage_id: string;
  race_roster_id: string;
  status: string;
  rank: number | null;
};

type SecondaryResultRow = {
  id: string;
  race_edition_id: string;
  classification_type: TeamSecondaryClassificationType;
  race_roster_id: string | null;
  team_season_id: string | null;
  rank: number;
};

type EditionContext = {
  edition: RaceEditionRow;
  race: RaceRow;
  category: RaceCategoryRow & { code: TeamResultCandidate["categoryCode"] };
  finalDay: SeasonDayRow;
};

export async function getPublicTeamProfileHistory(
  teamId: string
): Promise<PublicTeamProfileHistory> {
  const normalizedTeamId = teamId.trim();

  if (!normalizedTeamId) {
    return { seasons: [], recentResults: [] };
  }

  const seasonHistory = await getPublicTeamSeasonHistory(normalizedTeamId);

  if (seasonHistory.length === 0) {
    return { seasons: [], recentResults: [] };
  }

  const admin = createSupabaseAdminClient();
  const teamSeasonIds = seasonHistory.map((entry) => entry.teamSeasonId);
  const seasonIds = seasonHistory.map((entry) => entry.seasonId);
  const [contractsResult, registrationsResult] = await Promise.all([
    admin
      .from("team_sponsor_contracts")
      .select("sponsor_id, start_season_id, end_season_id, status, created_at")
      .eq("team_id", normalizedTeamId)
      .eq("role", "principal")
      .in("status", ["active", "completed", "terminated"])
      .returns<SponsorContractRow[]>(),
    collectChunkedPaginatedRows<
      RaceRegistrationRow,
      { message: string },
      string
    >({
      values: teamSeasonIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("race_registrations")
          .select("id, race_edition_id, team_season_id")
          .in("team_season_id", chunk)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<RaceRegistrationRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
  ]);

  assertQuery(contractsResult.error, "les sponsors historiques de l’équipe");
  assertQuery(registrationsResult.error, "les engagements historiques de l’équipe");

  const contracts = contractsResult.data ?? [];
  const registrations = registrationsResult.data;
  const sponsorIds = [...new Set(contracts.map((contract) => contract.sponsor_id))];
  const contractSeasonIds = [
    ...new Set(
      contracts.flatMap((contract) => [
        contract.start_season_id,
        contract.end_season_id,
      ])
    ),
  ];
  const registrationIds = registrations.map((registration) => registration.id);
  const editionIds = [
    ...new Set(registrations.map((registration) => registration.race_edition_id)),
  ];

  const [
    sponsorRegistryResult,
    contractSeasonsResult,
    rostersResult,
    editionsResult,
    seasonDaysResult,
  ] = await Promise.all([
    sponsorIds.length
      ? admin
          .from("sponsors")
          .select("id, catalog_key")
          .in("id", sponsorIds)
          .returns<SponsorRegistryRow[]>()
      : Promise.resolve({ data: [] as SponsorRegistryRow[], error: null }),
    contractSeasonIds.length
      ? admin
          .from("seasons")
          .select("id, game_year")
          .in("id", contractSeasonIds)
          .returns<ContractSeasonRow[]>()
      : Promise.resolve({ data: [] as ContractSeasonRow[], error: null }),
    collectChunkedPaginatedRows<RaceRosterRow, { message: string }, string>({
      values: registrationIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("race_rosters")
          .select("id, race_registration_id, rider_id")
          .in("race_registration_id", chunk)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<RaceRosterRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
    collectChunkedPaginatedRows<RaceEditionRow, { message: string }, string>({
      values: editionIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("race_editions")
          .select("id, race_id, season_id, race_category_id, display_name")
          .in("id", chunk)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<RaceEditionRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
    collectChunkedPaginatedRows<SeasonDayRow, { message: string }, string>({
      values: seasonIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("season_days")
          .select("id, season_id, day_number, calendar_date")
          .in("season_id", chunk)
          .order("season_id", { ascending: true })
          .order("day_number", { ascending: true })
          .range(from, to)
          .returns<SeasonDayRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
  ]);

  assertQuery(sponsorRegistryResult.error, "le registre des sponsors historiques");
  assertQuery(contractSeasonsResult.error, "les saisons des contrats sponsors");
  assertQuery(rostersResult.error, "les coureurs engagés par l’équipe");
  assertQuery(editionsResult.error, "les éditions disputées par l’équipe");
  assertQuery(seasonDaysResult.error, "les journées des saisons de l’équipe");

  const rosters = rostersResult.data;
  const editions = editionsResult.data;
  const rosterIds = rosters.map((roster) => roster.id);
  const riderIds = [...new Set(rosters.map((roster) => roster.rider_id))];
  const raceIds = [...new Set(editions.map((edition) => edition.race_id))];
  const categoryIds = [
    ...new Set(editions.map((edition) => edition.race_category_id)),
  ];

  const [
    racesResult,
    categoriesResult,
    stagesResult,
    ridersResult,
    raceResultsResult,
    stageResultsResult,
    riderSecondaryResult,
    teamSecondaryResult,
  ] = await Promise.all([
    collectChunkedPaginatedRows<RaceRow, { message: string }, string>({
      values: raceIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("races")
          .select("id, slug, race_format, competition_type")
          .in("id", chunk)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<RaceRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
    collectChunkedPaginatedRows<RaceCategoryRow, { message: string }, string>({
      values: categoryIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("race_categories")
          .select("id, code, prestige_rank")
          .in("id", chunk)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<RaceCategoryRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
    collectChunkedPaginatedRows<StageRow, { message: string }, string>({
      values: editionIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("stages")
          .select("id, race_edition_id, season_day_id, stage_number, name")
          .in("race_edition_id", chunk)
          .order("race_edition_id", { ascending: true })
          .order("stage_number", { ascending: true })
          .range(from, to)
          .returns<StageRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
    collectChunkedPaginatedRows<RiderRow, { message: string }, string>({
      values: riderIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("riders")
          .select("id, first_name, last_name")
          .in("id", chunk)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<RiderRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
    collectChunkedPaginatedRows<RaceResultRow, { message: string }, string>({
      values: rosterIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("race_results")
          .select("id, race_edition_id, race_roster_id, status, final_rank")
          .in("race_roster_id", chunk)
          .eq("status", "classified")
          .not("final_rank", "is", null)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<RaceResultRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
    collectChunkedPaginatedRows<StageResultRow, { message: string }, string>({
      values: rosterIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("stage_results")
          .select("id, stage_id, race_roster_id, status, rank")
          .in("race_roster_id", chunk)
          .eq("status", "finished")
          .not("rank", "is", null)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<StageResultRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
    collectChunkedPaginatedRows<SecondaryResultRow, { message: string }, string>({
      values: rosterIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("race_secondary_results")
          .select(
            "id, race_edition_id, classification_type, race_roster_id, team_season_id, rank"
          )
          .in("race_roster_id", chunk)
          .eq("rank", 1)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<SecondaryResultRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
    collectChunkedPaginatedRows<SecondaryResultRow, { message: string }, string>({
      values: teamSeasonIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("race_secondary_results")
          .select(
            "id, race_edition_id, classification_type, race_roster_id, team_season_id, rank"
          )
          .in("team_season_id", chunk)
          .eq("rank", 1)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<SecondaryResultRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
  ]);

  assertQuery(racesResult.error, "les courses de l’équipe");
  assertQuery(categoriesResult.error, "les catégories des courses de l’équipe");
  assertQuery(stagesResult.error, "les étapes disputées par l’équipe");
  assertQuery(ridersResult.error, "les coureurs historiques de l’équipe");
  assertQuery(raceResultsResult.error, "les classements généraux de l’équipe");
  assertQuery(stageResultsResult.error, "les résultats d’étape de l’équipe");
  assertQuery(riderSecondaryResult.error, "les classements annexes des coureurs");
  assertQuery(teamSecondaryResult.error, "les classements par équipes");

  const candidates = buildResultCandidates({
    registrations,
    rosters,
    editions,
    races: racesResult.data,
    categories: categoriesResult.data,
    stages: stagesResult.data,
    seasonDays: seasonDaysResult.data,
    riders: ridersResult.data,
    raceResults: raceResultsResult.data,
    stageResults: stageResultsResult.data,
    secondaryResults: [
      ...new Map(
        [...riderSecondaryResult.data, ...teamSecondaryResult.data].map((row) => [
          row.id,
          row,
        ])
      ).values(),
    ],
  });
  const logoContext = {
    contracts,
    sponsorRegistry: sponsorRegistryResult.data ?? [],
    contractSeasons: contractSeasonsResult.data ?? [],
  };
  const seasons = seasonHistory.map((season) => {
    const seasonCandidates = candidates.filter(
      (candidate) => candidate.seasonId === season.seasonId
    );

    return {
      ...season,
      logo: resolveHistoricalLogo(season, logoContext),
      highlights: selectSeasonTeamPalmares(seasonCandidates),
      victoryCount: countTeamVictories(seasonCandidates),
    } satisfies PublicTeamProfileSeasonHistoryEntry;
  });
  const activeSeason = seasons.find((season) => season.status === "active");
  const recentResults =
    activeSeason && activeSeason.currentDayNumber
      ? selectRecentMajorTeamResults({
          candidates,
          activeSeasonId: activeSeason.seasonId,
          currentDayNumber: activeSeason.currentDayNumber,
        })
      : [];

  return { seasons, recentResults };
}

function buildResultCandidates({
  registrations,
  rosters,
  editions,
  races,
  categories,
  stages,
  seasonDays,
  riders,
  raceResults,
  stageResults,
  secondaryResults,
}: {
  registrations: RaceRegistrationRow[];
  rosters: RaceRosterRow[];
  editions: RaceEditionRow[];
  races: RaceRow[];
  categories: RaceCategoryRow[];
  stages: StageRow[];
  seasonDays: SeasonDayRow[];
  riders: RiderRow[];
  raceResults: RaceResultRow[];
  stageResults: StageResultRow[];
  secondaryResults: SecondaryResultRow[];
}): TeamResultCandidate[] {
  const registrationById = new Map(
    registrations.map((registration) => [registration.id, registration])
  );
  const rosterById = new Map(rosters.map((roster) => [roster.id, roster]));
  const editionById = new Map(editions.map((edition) => [edition.id, edition]));
  const raceById = new Map(races.map((race) => [race.id, race]));
  const categoryById = new Map(
    categories.map((category) => [category.id, category])
  );
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const dayById = new Map(seasonDays.map((day) => [day.id, day]));
  const riderById = new Map(riders.map((rider) => [rider.id, rider]));
  const stagesByEditionId = new Map<string, StageRow[]>();

  for (const stage of stages) {
    const editionStages = stagesByEditionId.get(stage.race_edition_id) ?? [];
    editionStages.push(stage);
    stagesByEditionId.set(stage.race_edition_id, editionStages);
  }

  const resolveContext = (editionId: string): EditionContext | null => {
    const edition = editionById.get(editionId);
    const race = edition ? raceById.get(edition.race_id) : null;
    const category = edition ? categoryById.get(edition.race_category_id) : null;
    const editionStages = stagesByEditionId.get(editionId) ?? [];
    const finalDay = editionStages
      .flatMap((stage) => {
        const day = dayById.get(stage.season_day_id);
        return day ? [day] : [];
      })
      .sort((left, right) => right.day_number - left.day_number)[0];

    if (
      !edition ||
      !race ||
      !category ||
      !isRaceCategoryCode(category.code) ||
      !finalDay
    ) {
      return null;
    }

    return {
      edition,
      race,
      category: { ...category, code: category.code },
      finalDay,
    };
  };
  const resolveRider = (rosterId: string, editionId: string) => {
    const roster = rosterById.get(rosterId);
    const registration = roster
      ? registrationById.get(roster.race_registration_id)
      : null;
    const rider = roster ? riderById.get(roster.rider_id) : null;

    if (!roster || !registration || !rider) return null;
    if (registration.race_edition_id !== editionId) return null;

    return `${rider.first_name} ${rider.last_name}`.trim();
  };
  const candidates: TeamResultCandidate[] = [];

  for (const result of raceResults) {
    if (!result.final_rank) continue;
    const context = resolveContext(result.race_edition_id);
    const riderName = resolveRider(
      result.race_roster_id,
      result.race_edition_id
    );
    if (!context || !riderName) continue;

    candidates.push(
      createCandidate({
        id: `race:${result.id}`,
        context,
        kind: "race",
        rank: result.final_rank,
        riderName,
      })
    );
  }

  for (const result of stageResults) {
    if (!result.rank) continue;
    const stage = stageById.get(result.stage_id);
    if (!stage) continue;
    const context = resolveContext(stage.race_edition_id);
    const riderName = resolveRider(result.race_roster_id, stage.race_edition_id);
    const day = dayById.get(stage.season_day_id);
    if (!context || !riderName || !day || context.race.race_format !== "stage_race") {
      continue;
    }

    candidates.push(
      createCandidate({
        id: `stage:${result.id}`,
        context,
        kind: "stage",
        rank: result.rank,
        riderName,
        stage,
        day,
      })
    );
  }

  for (const result of secondaryResults) {
    const context = resolveContext(result.race_edition_id);
    if (!context) continue;
    const riderName = result.race_roster_id
      ? resolveRider(result.race_roster_id, result.race_edition_id)
      : null;
    if (result.classification_type !== "team" && !riderName) continue;

    candidates.push(
      createCandidate({
        id: `classification:${result.id}`,
        context,
        kind: "classification",
        rank: result.rank,
        riderName,
        classificationType: result.classification_type,
      })
    );
  }

  return candidates;
}

function createCandidate({
  id,
  context,
  kind,
  rank,
  riderName,
  stage = null,
  day = context.finalDay,
  classificationType = null,
}: {
  id: string;
  context: EditionContext;
  kind: TeamResultCandidate["kind"];
  rank: number;
  riderName: string | null;
  stage?: StageRow | null;
  day?: SeasonDayRow;
  classificationType?: TeamSecondaryClassificationType | null;
}): TeamResultCandidate {
  return {
    id,
    kind,
    seasonId: context.edition.season_id,
    dayNumber: day.day_number,
    calendarDate: day.calendar_date,
    raceName: context.edition.display_name,
    raceSlug: context.race.slug,
    raceFormat: normalizeRaceFormat(context.race.race_format),
    categoryCode: context.category.code,
    prestigeRank: context.category.prestige_rank,
    competitionType: normalizeCompetitionType(context.race.competition_type),
    rank,
    riderName,
    stageNumber: stage?.stage_number ?? null,
    stageName: stage?.name ?? null,
    classificationType,
  };
}

function resolveHistoricalLogo(
  season: PublicTeamSeasonHistoryEntry,
  {
    contracts,
    sponsorRegistry,
    contractSeasons,
  }: {
    contracts: SponsorContractRow[];
    sponsorRegistry: SponsorRegistryRow[];
    contractSeasons: ContractSeasonRow[];
  }
): PublicTeamHistoricalLogo | null {
  const yearBySeasonId = new Map(
    contractSeasons.map((contractSeason) => [
      contractSeason.id,
      contractSeason.game_year,
    ])
  );
  const catalogKeyBySponsorId = new Map(
    sponsorRegistry.map((sponsor) => [sponsor.id, sponsor.catalog_key])
  );
  const matchingContract = contracts
    .filter((contract) => {
      const startYear = yearBySeasonId.get(contract.start_season_id);
      const endYear = yearBySeasonId.get(contract.end_season_id);
      return (
        startYear !== undefined &&
        endYear !== undefined &&
        season.gameYear >= startYear &&
        season.gameYear <= endYear
      );
    })
    .sort(
      (left, right) =>
        contractStatusPriority(right.status) - contractStatusPriority(left.status) ||
        Date.parse(right.created_at) - Date.parse(left.created_at)
    )[0];

  if (!matchingContract) return null;
  const catalogKey = catalogKeyBySponsorId.get(matchingContract.sponsor_id);
  const sponsor = SPONSORS.find((candidate) => candidate.id === catalogKey);
  if (!sponsor) return null;

  return {
    sponsorName: sponsor.name,
    logoPath: sponsor.logoPath,
    primaryColor: sponsor.colors.primary,
    backgroundColor: sponsor.colors.background,
    textColor: sponsor.colors.text,
  };
}

function contractStatusPriority(status: string): number {
  if (status === "active") return 3;
  if (status === "completed") return 2;
  return 1;
}

function normalizeRaceFormat(value: string): RaceFormat {
  return value === "stage_race" ? "stage_race" : "one_day";
}

function normalizeCompetitionType(value: string): RaceCompetitionType {
  const validTypes: RaceCompetitionType[] = [
    "standard",
    "national_road",
    "national_time_trial",
    "continental_championship",
    "world_championship",
  ];

  return validTypes.includes(value as RaceCompetitionType)
    ? (value as RaceCompetitionType)
    : "standard";
}

function assertQuery(
  error: { message: string } | null,
  context: string
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${context} : ${error.message}`);
  }
}
