import "server-only";

import {
  canRespondToInternationalSelection,
  shouldDisplayInternationalSelection,
  type InternationalSelectionDecisionStatus,
} from "@/lib/game/international-championship-selections";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type InternationalSelectionResponseStatus =
  InternationalSelectionDecisionStatus;

export type InternationalChampionshipSelection = {
  candidateId: string;
  riderId: string;
  riderName: string;
  riderRank: number;
  uciPoints: number;
  overallRating: number;
  responseStatus: InternationalSelectionResponseStatus;
  isSelected: boolean;
  wasSelected: boolean;
  respondedAt: string | null;
  countryName: string;
  countryCode: string;
  nationRank: number;
  continentCode: string | null;
  championshipName: string;
  championshipSlug: string;
  competitionType: "continental_championship" | "world_championship";
  raceEditionId: string;
  dayNumber: number;
  departureAt: string;
  canRespond: boolean;
};

type CandidateRow = {
  id: string;
  nation_selection_id: string;
  rider_id: string;
  rider_rank: number;
  uci_points: number;
  overall_rating: number | string;
  response_status: InternationalSelectionResponseStatus;
  is_selected: boolean;
  selected_at: string | null;
  responded_at: string | null;
};

type NationSelectionRow = {
  id: string;
  race_edition_id: string;
  country_id: string;
  continent_code: string | null;
  nation_rank: number;
};

type RiderRow = {
  id: string;
  first_name: string;
  last_name: string;
};

type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
};

type EditionRow = {
  id: string;
  race_id: string;
  season_id: string;
  display_name: string;
};

type RaceRow = {
  id: string;
  slug: string;
  competition_type: "continental_championship" | "world_championship";
};

type StageRow = {
  race_edition_id: string;
  season_day_id: string;
  departure_at: string | null;
};

type SeasonDayRow = {
  id: string;
  day_number: number;
};

export async function processDueInternationalChampionshipSelections(
  now = new Date()
) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc(
    "process_due_international_championship_selections",
    { p_now: now.toISOString() }
  );

  if (error) {
    throw new Error(
      `Impossible de préparer les sélections internationales : ${error.message}`
    );
  }

  const row = (
    (data as
      | Array<{
          created_nation_selections: number;
          finalized_nation_selections: number;
        }>
      | null) ?? []
  )[0];

  return {
    createdNationSelections: row?.created_nation_selections ?? 0,
    finalizedNationSelections: row?.finalized_nation_selections ?? 0,
  };
}

export async function getCurrentDirectorInternationalSelections({
  authUserId,
  now = new Date(),
  processDue = true,
}: {
  authUserId: string;
  now?: Date;
  processDue?: boolean;
}): Promise<InternationalChampionshipSelection[]> {
  const admin = createSupabaseAdminClient();

  if (processDue) {
    await processDueInternationalChampionshipSelections(now);
  }

  const { data: director, error: directorError } = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();

  assertQuery(directorError, "le Directeur Sportif");
  if (!director) return [];

  const [activeSeasonResult, candidatesResult] = await Promise.all([
    admin
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .maybeSingle<{ id: string }>(),
    admin
      .from("international_championship_rider_selections")
      .select(
        "id, nation_selection_id, rider_id, rider_rank, uci_points, overall_rating, response_status, is_selected, selected_at, responded_at"
      )
      .eq("sporting_director_id", director.id)
      .order("created_at", { ascending: false })
      .returns<CandidateRow[]>(),
  ]);

  assertQuery(activeSeasonResult.error, "la saison active");
  assertQuery(candidatesResult.error, "les sélections internationales");
  const activeSeason = activeSeasonResult.data;
  const candidateRows = candidatesResult.data ?? [];
  if (!activeSeason || candidateRows.length === 0) return [];

  const nationSelectionIds = unique(
    candidateRows.map((candidate) => candidate.nation_selection_id)
  );
  const riderIds = unique(candidateRows.map((candidate) => candidate.rider_id));

  const [nationSelectionsResult, ridersResult] = await Promise.all([
    admin
      .from("international_championship_nation_selections")
      .select("id, race_edition_id, country_id, continent_code, nation_rank")
      .in("id", nationSelectionIds)
      .returns<NationSelectionRow[]>(),
    admin
      .from("riders")
      .select("id, first_name, last_name")
      .in("id", riderIds)
      .returns<RiderRow[]>(),
  ]);

  assertQuery(nationSelectionsResult.error, "les nations sélectionnées");
  assertQuery(ridersResult.error, "les coureurs sélectionnés");

  const nationSelections = nationSelectionsResult.data ?? [];
  const countryIds = unique(
    nationSelections.map((selection) => selection.country_id)
  );
  const raceEditionIds = unique(
    nationSelections.map((selection) => selection.race_edition_id)
  );

  const [countriesResult, editionsResult, stagesResult] = await Promise.all([
    admin
      .from("countries")
      .select("id, name, iso_alpha2")
      .in("id", countryIds)
      .returns<CountryRow[]>(),
    admin
      .from("race_editions")
      .select("id, race_id, season_id, display_name")
      .in("id", raceEditionIds)
      .eq("season_id", activeSeason.id)
      .returns<EditionRow[]>(),
    admin
      .from("stages")
      .select("race_edition_id, season_day_id, departure_at")
      .in("race_edition_id", raceEditionIds)
      .order("departure_at", { ascending: true })
      .returns<StageRow[]>(),
  ]);

  assertQuery(countriesResult.error, "les pays sélectionnés");
  assertQuery(editionsResult.error, "les championnats internationaux");
  assertQuery(stagesResult.error, "les départs des championnats");

  const editions = editionsResult.data ?? [];
  const raceIds = unique(editions.map((edition) => edition.race_id));
  const seasonDayIds = unique(
    (stagesResult.data ?? []).map((stage) => stage.season_day_id)
  );

  const [racesResult, seasonDaysResult] = await Promise.all([
    admin
      .from("races")
      .select("id, slug, competition_type")
      .in("id", raceIds)
      .in("competition_type", [
        "continental_championship",
        "world_championship",
      ])
      .returns<RaceRow[]>(),
    admin
      .from("season_days")
      .select("id, day_number")
      .in("id", seasonDayIds)
      .returns<SeasonDayRow[]>(),
  ]);

  assertQuery(racesResult.error, "les types de championnats");
  assertQuery(seasonDaysResult.error, "les jours des championnats");

  const riderById = new Map(
    (ridersResult.data ?? []).map((rider) => [rider.id, rider])
  );
  const nationSelectionById = new Map(
    nationSelections.map((selection) => [selection.id, selection])
  );
  const countryById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country])
  );
  const editionById = new Map(
    editions.map((edition) => [edition.id, edition])
  );
  const raceById = new Map(
    (racesResult.data ?? []).map((race) => [race.id, race])
  );
  const dayById = new Map(
    (seasonDaysResult.data ?? []).map((day) => [day.id, day])
  );
  const firstStageByEditionId = new Map<string, StageRow>();

  for (const stage of stagesResult.data ?? []) {
    if (!firstStageByEditionId.has(stage.race_edition_id)) {
      firstStageByEditionId.set(stage.race_edition_id, stage);
    }
  }

  return candidateRows
    .flatMap((candidate): InternationalChampionshipSelection[] => {
      const rider = riderById.get(candidate.rider_id);
      const nationSelection = nationSelectionById.get(
        candidate.nation_selection_id
      );
      const country = nationSelection
        ? countryById.get(nationSelection.country_id)
        : null;
      const edition = nationSelection
        ? editionById.get(nationSelection.race_edition_id)
        : null;
      const race = edition ? raceById.get(edition.race_id) : null;
      const stage = edition
        ? firstStageByEditionId.get(edition.id)
        : null;
      const day = stage ? dayById.get(stage.season_day_id) : null;

      if (
        !rider ||
        !nationSelection ||
        !country ||
        !edition ||
        !race ||
        !stage?.departure_at ||
        !day
      ) {
        return [];
      }

      return [
        {
          candidateId: candidate.id,
          riderId: candidate.rider_id,
          riderName: `${rider.first_name} ${rider.last_name}`,
          riderRank: candidate.rider_rank,
          uciPoints: candidate.uci_points,
          overallRating: Number(candidate.overall_rating),
          responseStatus: candidate.response_status,
          isSelected: candidate.is_selected,
          wasSelected: candidate.selected_at !== null,
          respondedAt: candidate.responded_at,
          countryName: country.name,
          countryCode: country.iso_alpha2,
          nationRank: nationSelection.nation_rank,
          continentCode: nationSelection.continent_code,
          championshipName: edition.display_name,
          championshipSlug: race.slug,
          competitionType: race.competition_type,
          raceEditionId: edition.id,
          dayNumber: day.day_number,
          departureAt: stage.departure_at,
          canRespond: canRespondToInternationalSelection({
            isSelected: candidate.is_selected,
            responseStatus: candidate.response_status,
            departureAt: stage.departure_at,
            now,
          }),
        },
      ];
    })
    .filter(shouldDisplayInternationalSelection)
    .sort(
      (left, right) =>
        Date.parse(left.departureAt) - Date.parse(right.departureAt) ||
        left.riderRank - right.riderRank ||
        left.riderName.localeCompare(right.riderName, "fr")
    );
}

export async function respondToInternationalChampionshipSelection({
  supabase,
  candidateId,
  accept,
}: {
  supabase: SupabaseServerClient;
  candidateId: string;
  accept: boolean;
}) {
  const { error } = await supabase.rpc(
    "respond_to_international_championship_selection",
    {
      p_candidate_id: candidateId,
      p_accept: accept,
    }
  );

  if (error) {
    throw new Error(error.message);
  }
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function assertQuery(
  error: { message: string } | null,
  label: string
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${label} : ${error.message}`);
  }
}
