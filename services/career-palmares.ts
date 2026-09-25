import "server-only";

import {
  buildCareerPalmares,
  type CareerPalmares,
  type CareerDistinctiveJerseyEntry,
  type CareerDistinctiveJerseyType,
  type CareerPalmaresEntry,
  type CareerPalmaresSupplementEntry,
} from "@/lib/game/career-palmares";
import {
  isRaceCategoryCode,
  type RaceCategoryCode,
  type RaceCompetitionType,
} from "@/lib/game/race-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  collectChunkedPaginatedRows,
  collectPaginatedRows,
} from "@/lib/supabase/pagination";

type RiderRosterRow = {
  id: string;
};

type RaceResultRow = {
  id: string;
  race_edition_id: string;
  final_rank: number;
};

type StageResultRow = {
  id: string;
  stage_id: string;
};

type SecondaryResultRow = {
  id: string;
  race_edition_id: string;
  classification_type: CareerDistinctiveJerseyType;
};

type StageRow = {
  id: string;
  race_edition_id: string;
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
  is_monument: boolean;
  is_grand_tour: boolean;
};

type RaceCategoryRow = {
  id: string;
  code: string;
  prestige_rank: number;
};

type SeasonRow = {
  id: string;
  name: string;
  game_year: number;
};

type AcademyRiderRow = {
  id: string;
};

type DevelopmentTeamRow = {
  id: string;
};

type DevelopmentResultRow = {
  id: string;
  race_edition_id: string;
  rank: number;
};

type DevelopmentEditionRow = {
  id: string;
  season_id: string;
  slug: string;
  name: string;
};

type ProfessionalPalmaresContext = {
  edition: RaceEditionRow;
  race: RaceRow;
  category: RaceCategoryRow & { code: RaceCategoryCode };
  season: SeasonRow;
};

export async function getRiderCareerPalmares(
  riderId: string,
): Promise<CareerPalmares> {
  const normalizedRiderId = riderId.trim().toLowerCase();
  if (!isUuid(normalizedRiderId)) return buildCareerPalmares([]);

  const admin = createSupabaseAdminClient();
  const [rostersResult, academyRiderResult] = await Promise.all([
    collectPaginatedRows<RiderRosterRow, { message: string }>({
      fetchPage: async (from, to) => {
        const result = await admin
          .from("race_rosters")
          .select("id")
          .eq("rider_id", normalizedRiderId)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<RiderRosterRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
    admin
      .from("youth_academy_riders")
      .select("id")
      .eq("promoted_rider_id", normalizedRiderId)
      .maybeSingle<AcademyRiderRow>(),
  ]);
  assertQuery(rostersResult.error, "les engagements historiques du coureur");
  assertQuery(academyRiderResult.error, "le parcours junior du coureur");

  const rosterIds = rostersResult.data.map((roster) => roster.id);
  const academyRiderId = academyRiderResult.data?.id ?? null;
  const [
    raceResultsResult,
    stageResultsResult,
    secondaryResultsResult,
    developmentResultsResult,
  ] = await Promise.all([
    collectChunkedPaginatedRows<RaceResultRow, { message: string }, string>({
      values: rosterIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("race_results")
          .select("id, race_edition_id, final_rank")
          .in("race_roster_id", chunk)
          .eq("status", "classified")
          .lte("final_rank", 3)
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
          .select("id, stage_id")
          .in("race_roster_id", chunk)
          .eq("status", "finished")
          .eq("rank", 1)
          .order("id", { ascending: true })
          .range(from, to)
          .returns<StageResultRow[]>();
        return { data: result.data, error: result.error };
      },
    }),
    collectChunkedPaginatedRows<SecondaryResultRow, { message: string }, string>(
      {
        values: rosterIds,
        fetchPage: async (chunk, from, to) => {
          const result = await admin
            .from("race_secondary_results")
            .select("id, race_edition_id, classification_type")
            .in("race_roster_id", chunk)
            .in("classification_type", ["mountain", "sprint", "youth"])
            .eq("rank", 1)
            .order("id", { ascending: true })
            .range(from, to)
            .returns<SecondaryResultRow[]>();
          return { data: result.data, error: result.error };
        },
      },
    ),
    academyRiderId
      ? collectPaginatedRows<DevelopmentResultRow, { message: string }>({
          fetchPage: async (from, to) => {
            const result = await admin
              .from("development_race_results")
              .select("id, race_edition_id, rank")
              .eq("academy_rider_id", academyRiderId)
              .eq("result_scope", "general")
              .lte("rank", 3)
              .order("id", { ascending: true })
              .range(from, to)
              .returns<DevelopmentResultRow[]>();
            return { data: result.data, error: result.error };
          },
        })
      : Promise.resolve({
          data: [] as DevelopmentResultRow[],
          error: null,
        }),
  ]);
  assertQuery(raceResultsResult.error, "les podiums professionnels du coureur");
  assertQuery(stageResultsResult.error, "les victoires d’étape du coureur");
  assertQuery(
    secondaryResultsResult.error,
    "les maillots distinctifs du coureur",
  );
  assertQuery(
    developmentResultsResult.error,
    "les podiums juniors du coureur",
  );

  const professionalPalmares = await loadProfessionalPalmares({
    admin,
    raceResults: raceResultsResult.data,
    stageResults: stageResultsResult.data,
    secondaryResults: secondaryResultsResult.data,
  });
  const juniorEntries = await loadDevelopmentPalmaresEntries({
    admin,
    results: developmentResultsResult.data,
  });

  return buildCareerPalmares(
    [...professionalPalmares.entries, ...juniorEntries],
    {
      stageVictories: professionalPalmares.stageVictories,
      distinctiveJerseys: professionalPalmares.distinctiveJerseys,
    },
  );
}

export async function getTeamJuniorPalmaresEntries(
  teamId: string,
): Promise<CareerPalmaresEntry[]> {
  const normalizedTeamId = teamId.trim().toLowerCase();
  if (!isUuid(normalizedTeamId)) return [];

  const admin = createSupabaseAdminClient();
  const developmentTeamsResult = await collectPaginatedRows<
    DevelopmentTeamRow,
    { message: string }
  >({
    fetchPage: async (from, to) => {
      const result = await admin
        .from("development_teams")
        .select("id")
        .eq("team_id", normalizedTeamId)
        .order("id", { ascending: true })
        .range(from, to)
        .returns<DevelopmentTeamRow[]>();
      return { data: result.data, error: result.error };
    },
  });
  assertQuery(
    developmentTeamsResult.error,
    "les équipes de développement historiques",
  );

  const developmentTeamIds = developmentTeamsResult.data.map(
    (team) => team.id,
  );
  const resultsResult = await collectChunkedPaginatedRows<
    DevelopmentResultRow,
    { message: string },
    string
  >({
    values: developmentTeamIds,
    fetchPage: async (chunk, from, to) => {
      const result = await admin
        .from("development_race_results")
        .select("id, race_edition_id, rank")
        .in("development_team_id", chunk)
        .eq("result_scope", "general")
        .lte("rank", 3)
        .order("id", { ascending: true })
        .range(from, to)
        .returns<DevelopmentResultRow[]>();
      return { data: result.data, error: result.error };
    },
  });
  assertQuery(resultsResult.error, "les podiums juniors de l’équipe");

  return loadDevelopmentPalmaresEntries({
    admin,
    results: resultsResult.data,
  });
}

async function loadProfessionalPalmares({
  admin,
  raceResults,
  stageResults,
  secondaryResults,
}: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  raceResults: RaceResultRow[];
  stageResults: StageResultRow[];
  secondaryResults: SecondaryResultRow[];
}): Promise<{
  entries: CareerPalmaresEntry[];
  stageVictories: CareerPalmaresSupplementEntry[];
  distinctiveJerseys: CareerDistinctiveJerseyEntry[];
}> {
  const stagesResult = await collectChunkedPaginatedRows<
    StageRow,
    { message: string },
    string
  >({
    values: unique(stageResults.map((result) => result.stage_id)),
    fetchPage: async (chunk, from, to) => {
      const result = await admin
        .from("stages")
        .select("id, race_edition_id")
        .in("id", chunk)
        .order("id", { ascending: true })
        .range(from, to)
        .returns<StageRow[]>();
      return { data: result.data, error: result.error };
    },
  });
  assertQuery(stagesResult.error, "les étapes gagnées par le coureur");

  const stageById = new Map(
    stagesResult.data.map((stage) => [stage.id, stage]),
  );
  const editionIds = unique([
    ...raceResults.map((result) => result.race_edition_id),
    ...stageResults.flatMap((result) => {
      const editionId = stageById.get(result.stage_id)?.race_edition_id;
      return editionId ? [editionId] : [];
    }),
    ...secondaryResults.map((result) => result.race_edition_id),
  ]);
  const editionsResult = await collectChunkedPaginatedRows<
    RaceEditionRow,
    { message: string },
    string
  >({
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
  });
  assertQuery(editionsResult.error, "les éditions des podiums du coureur");

  const editions = editionsResult.data;
  const raceIds = unique(editions.map((edition) => edition.race_id));
  const categoryIds = unique(
    editions.map((edition) => edition.race_category_id),
  );
  const seasonIds = unique(editions.map((edition) => edition.season_id));
  const [racesResult, categoriesResult, seasonsResult] = await Promise.all([
    collectChunkedPaginatedRows<RaceRow, { message: string }, string>({
      values: raceIds,
      fetchPage: async (chunk, from, to) => {
        const result = await admin
          .from("races")
          .select(
            "id, slug, race_format, competition_type, is_monument, is_grand_tour",
          )
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
    loadSeasons(admin, seasonIds),
  ]);
  assertQuery(racesResult.error, "les courses des podiums du coureur");
  assertQuery(categoriesResult.error, "les catégories des podiums du coureur");

  const editionById = new Map(editions.map((edition) => [edition.id, edition]));
  const raceById = new Map(racesResult.data.map((race) => [race.id, race]));
  const categoryById = new Map(
    categoriesResult.data.map((category) => [category.id, category]),
  );
  const seasonById = new Map(
    seasonsResult.map((season) => [season.id, season]),
  );

  const resolveContext = (
    editionId: string,
  ): ProfessionalPalmaresContext | null => {
    const edition = editionById.get(editionId);
    const race = edition ? raceById.get(edition.race_id) : null;
    const category = edition
      ? categoryById.get(edition.race_category_id)
      : null;
    const season = edition ? seasonById.get(edition.season_id) : null;

    if (
      !edition ||
      !race ||
      !category ||
      !season ||
      !isRaceCategoryCode(category.code)
    ) {
      return null;
    }

    return {
      edition,
      race,
      category: { ...category, code: category.code },
      season,
    };
  };

  const entries = raceResults.flatMap<CareerPalmaresEntry>((result) => {
    const context = resolveContext(result.race_edition_id);
    if (!context) return [];

    return [
      {
        resultId: `professional:${result.id}`,
        raceKey: context.race.slug,
        raceName: context.edition.display_name,
        seasonId: context.season.id,
        seasonName: context.season.name,
        gameYear: context.season.game_year,
        rank: result.final_rank,
        categoryCode: context.category.code,
        competitionType: normalizeCompetitionType(
          context.race.competition_type,
        ),
        prestigeRank: context.category.prestige_rank,
        isGrandTour: context.race.is_grand_tour,
        isMonument: context.race.is_monument,
        isJunior: false,
      },
    ];
  });
  const toSupplementEntry = (
    resultId: string,
    editionId: string,
  ): CareerPalmaresSupplementEntry | null => {
    const context = resolveContext(editionId);
    if (!context || context.race.race_format !== "stage_race") return null;

    return {
      resultId,
      raceKey: context.race.slug,
      raceName: context.edition.display_name,
      seasonId: context.season.id,
      seasonName: context.season.name,
      gameYear: context.season.game_year,
      prestigeRank: context.category.prestige_rank,
    };
  };
  const stageVictories = stageResults.flatMap<CareerPalmaresSupplementEntry>(
    (result) => {
      const editionId = stageById.get(result.stage_id)?.race_edition_id;
      const entry = editionId
        ? toSupplementEntry(`stage:${result.id}`, editionId)
        : null;
      return entry ? [entry] : [];
    },
  );
  const distinctiveJerseys =
    secondaryResults.flatMap<CareerDistinctiveJerseyEntry>((result) => {
      const entry = toSupplementEntry(
        `classification:${result.id}`,
        result.race_edition_id,
      );
      return entry
        ? [{ ...entry, classificationType: result.classification_type }]
        : [];
    });

  return { entries, stageVictories, distinctiveJerseys };
}

async function loadDevelopmentPalmaresEntries({
  admin,
  results,
}: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  results: DevelopmentResultRow[];
}): Promise<CareerPalmaresEntry[]> {
  const editionIds = unique(results.map((result) => result.race_edition_id));
  const editionsResult = await collectChunkedPaginatedRows<
    DevelopmentEditionRow,
    { message: string },
    string
  >({
    values: editionIds,
    fetchPage: async (chunk, from, to) => {
      const result = await admin
        .from("development_race_editions")
        .select("id, season_id, slug, name")
        .in("id", chunk)
        .order("id", { ascending: true })
        .range(from, to)
        .returns<DevelopmentEditionRow[]>();
      return { data: result.data, error: result.error };
    },
  });
  assertQuery(editionsResult.error, "les éditions des podiums juniors");

  const seasons = await loadSeasons(
    admin,
    unique(editionsResult.data.map((edition) => edition.season_id)),
  );
  const editionById = new Map(
    editionsResult.data.map((edition) => [edition.id, edition]),
  );
  const seasonById = new Map(seasons.map((season) => [season.id, season]));

  return results.flatMap<CareerPalmaresEntry>((result) => {
    const edition = editionById.get(result.race_edition_id);
    const season = edition ? seasonById.get(edition.season_id) : null;
    if (!edition || !season) return [];

    return [
      {
        resultId: `junior:${result.id}`,
        raceKey: edition.slug,
        raceName: edition.name,
        seasonId: season.id,
        seasonName: season.name,
        gameYear: season.game_year,
        rank: result.rank,
        categoryCode: null,
        competitionType: null,
        prestigeRank: 99,
        isGrandTour: false,
        isMonument: false,
        isJunior: true,
      },
    ];
  });
}

async function loadSeasons(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  seasonIds: string[],
): Promise<SeasonRow[]> {
  const seasonsResult = await collectChunkedPaginatedRows<
    SeasonRow,
    { message: string },
    string
  >({
    values: seasonIds,
    fetchPage: async (chunk, from, to) => {
      const result = await admin
        .from("seasons")
        .select("id, name, game_year")
        .in("id", chunk)
        .order("id", { ascending: true })
        .range(from, to)
        .returns<SeasonRow[]>();
      return { data: result.data, error: result.error };
    },
  });
  assertQuery(seasonsResult.error, "les saisons des podiums");
  return seasonsResult.data;
}

function normalizeCompetitionType(value: string): RaceCompetitionType {
  const validTypes: RaceCompetitionType[] = [
    "standard",
    "national_road",
    "national_time_trial",
    "continental_championship",
    "world_championship",
    "nations_cup",
  ];
  return validTypes.includes(value as RaceCompetitionType)
    ? (value as RaceCompetitionType)
    : "standard";
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function assertQuery(
  error: { message: string } | null,
  resourceName: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${resourceName} : ${error.message}`);
  }
}
