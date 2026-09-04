import "server-only";

import type {
  DevelopmentRaceProfile,
  DevelopmentRaceResult,
} from "@/services/development-team";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SeasonRow = {
  id: string;
  name: string;
  game_year: number;
  current_day_number: number | null;
};

type EditionRow = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  location_name: string;
  country_code: string;
  start_day_number: number;
  end_day_number: number;
  profile_type: DevelopmentRaceProfile;
  competition_type:
    | "continental_road"
    | "continental_time_trial"
    | "world_road"
    | "world_time_trial"
    | "nations_cup_junior";
  status: "planned" | "completed" | "cancelled";
};

type StageRow = {
  id: string;
  stage_number: number;
  day_number: number;
  name: string;
};

type ResultRow = {
  id: string;
  race_edition_id: string;
  stage_id: string | null;
  result_scope: "stage" | "general";
  academy_rider_id: string | null;
  development_team_id: string | null;
  rider_name: string;
  team_name: string;
  country_code: string;
  rank: number;
  elapsed_time_seconds: number;
  gap_to_winner_seconds: number;
  points: number;
};

type RegistrationRow = { id: string };
type RegistrationRiderRow = { registration_id: string };

export type JuniorChampionshipResultPage = {
  season: {
    name: string;
    gameYear: number;
    currentDayNumber: number;
  };
  race: {
    id: string;
    slug: string;
    name: string;
    shortName: string;
    locationName: string;
    countryCode: string;
    startDayNumber: number;
    endDayNumber: number;
    profileType: DevelopmentRaceProfile;
    competitionType: EditionRow["competition_type"];
    status: EditionRow["status"];
  };
  stages: Array<{
    id: string;
    number: number;
    dayNumber: number;
    name: string;
  }>;
  selectedRiderCount: number;
  results: DevelopmentRaceResult[];
};

export async function getJuniorChampionshipResultPage(
  slug: string,
): Promise<JuniorChampionshipResultPage | null> {
  const admin = createSupabaseAdminClient();
  const seasonResult = await admin
    .from("seasons")
    .select("id, name, game_year, current_day_number")
    .eq("status", "active")
    .maybeSingle<SeasonRow>();
  assertQuery(seasonResult.error, "la saison active");
  if (!seasonResult.data || seasonResult.data.game_year < 3) return null;

  const season = seasonResult.data;
  const editionResult = await admin
    .from("development_race_editions")
    .select(
      "id, slug, name, short_name, location_name, country_code, start_day_number, end_day_number, profile_type, competition_type, status",
    )
    .eq("season_id", season.id)
    .eq("slug", slug)
    .in("competition_type", [
      "continental_road",
      "continental_time_trial",
      "world_road",
      "world_time_trial",
      "nations_cup_junior",
    ])
    .maybeSingle<EditionRow>();
  assertQuery(editionResult.error, "le championnat junior");
  if (!editionResult.data) return null;

  const edition = editionResult.data;
  const [stagesResult, resultsResult, registrationsResult] = await Promise.all([
    admin
      .from("development_race_stages")
      .select("id, stage_number, day_number, name")
      .eq("race_edition_id", edition.id)
      .order("stage_number")
      .returns<StageRow[]>(),
    admin
      .from("development_race_results")
      .select("*")
      .eq("race_edition_id", edition.id)
      .order("rank")
      .returns<ResultRow[]>(),
    admin
      .from("national_federation_junior_race_registrations")
      .select("id")
      .eq("race_edition_id", edition.id)
      .in("status", ["registered", "completed"])
      .returns<RegistrationRow[]>(),
  ]);
  assertQuery(stagesResult.error, "les étapes du championnat junior");
  assertQuery(resultsResult.error, "les résultats du championnat junior");
  assertQuery(
    registrationsResult.error,
    "les inscriptions du championnat junior",
  );

  const registrations = registrationsResult.data ?? [];
  const selectedRidersResult = registrations.length
    ? await admin
        .from("national_federation_junior_race_registration_riders")
        .select("registration_id")
        .in(
          "registration_id",
          registrations.map((registration) => registration.id),
        )
        .returns<RegistrationRiderRow[]>()
    : { data: [] as RegistrationRiderRow[], error: null };
  assertQuery(
    selectedRidersResult.error,
    "les coureurs inscrits au championnat junior",
  );

  return {
    season: {
      name: season.name,
      gameYear: season.game_year,
      currentDayNumber: season.current_day_number ?? 1,
    },
    race: {
      id: edition.id,
      slug: edition.slug,
      name: edition.name,
      shortName: edition.short_name,
      locationName: edition.location_name,
      countryCode: edition.country_code,
      startDayNumber: edition.start_day_number,
      endDayNumber: edition.end_day_number,
      profileType: edition.profile_type,
      competitionType: edition.competition_type,
      status: edition.status,
    },
    stages: (stagesResult.data ?? []).map((stage) => ({
      id: stage.id,
      number: stage.stage_number,
      dayNumber: stage.day_number,
      name: stage.name,
    })),
    selectedRiderCount: selectedRidersResult.data?.length ?? 0,
    results: (resultsResult.data ?? []).map((result) => ({
      id: result.id,
      raceEditionId: result.race_edition_id,
      stageId: result.stage_id,
      scope: result.result_scope,
      academyRiderId: result.academy_rider_id,
      developmentTeamId: result.development_team_id,
      riderName: result.rider_name,
      teamName: result.team_name,
      countryCode: result.country_code,
      rank: result.rank,
      elapsedTimeSeconds: result.elapsed_time_seconds,
      gapToWinnerSeconds: result.gap_to_winner_seconds,
      points: result.points,
      podiumProgression: null,
    })),
  };
}

function assertQuery(
  error: { message: string } | null,
  resource: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${resource} : ${error.message}`);
  }
}
