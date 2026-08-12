import "server-only";

import type { AmateurJerseyConfig } from "@/lib/amateur-team";
import {
  getRiderSportingProfile,
  type RiderRatings,
} from "@/lib/game/rider-profile";
import {
  getRiderClimateProfile,
  type RiderClimateProfile,
} from "@/lib/game/race-weather";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type DevelopmentContext = {
  directorId: string;
  teamId: string;
  seasonId: string;
  seasonName: string;
  gameYear: number;
  currentDayNumber: number;
  teamName: string;
  teamPrimaryColor: string;
  teamSecondaryColor: string;
  teamAccentColor: string;
  teamJerseyPattern: AmateurJerseyConfig["pattern"];
};

type AcademyRow = {
  id: string;
  team_id: string;
  joined_season_id: string;
  joined_day_number: number;
  country_id: string;
  first_name: string;
  last_name: string;
  birth_game_year: number;
  archetype: string;
  potential_steps: number;
  avatar_profile_key: string;
  avatar_seed: string | number;
  mountain: number | string;
  hills: number | string;
  flat: number | string;
  time_trial: number | string;
  cobbles: number | string;
  sprint: number | string;
  acceleration: number | string;
  downhill: number | string;
  endurance: number | string;
  resistance: number | string;
  recovery: number | string;
  breakaway: number | string;
  prologue: number | string;
  training_priority: string;
  status: "active" | "recruited" | "promoted" | "free_agent";
  promotion_game_year: number | null;
};

type DevelopmentTeamRow = {
  id: string;
  team_id: string;
  season_id: string;
  display_name: string;
  jersey_pattern: AmateurJerseyConfig["pattern"];
  jersey_primary_color: string;
  jersey_secondary_color: string;
  jersey_accent_color: string;
  status: "active" | "completed";
  roster_locked_at: string;
};

type RosterRow = {
  development_team_id: string;
  academy_rider_id: string;
  race_number: number;
};

type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
};

type EditionRow = {
  id: string;
  season_id: string;
  slug: string;
  name: string;
  short_name: string;
  location_name: string;
  country_code: string;
  start_day_number: number;
  end_day_number: number;
  profile_type: DevelopmentRaceProfile;
  race_format: "one_day" | "stage_race";
  is_world_championship: boolean;
  selection_minimum: number;
  selection_maximum: number;
  status: "planned" | "completed" | "cancelled";
  simulated_at: string | null;
};

type StageRow = {
  id: string;
  race_edition_id: string;
  stage_number: number;
  day_number: number;
  name: string;
  stage_type: "road" | "individual_time_trial";
  profile_type: DevelopmentRaceProfile;
  distance_km: number | string;
};

type RegistrationRow = {
  id: string;
  development_team_id: string;
  race_edition_id: string;
  status: "registered" | "completed" | "withdrawn";
};

type SelectionRow = {
  registration_id: string;
  academy_rider_id: string;
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
};

export type DevelopmentRaceProfile =
  | "flat"
  | "sprint"
  | "hilly"
  | "mountain"
  | "cobbles"
  | "time_trial"
  | "mixed";

export type DevelopmentRider = {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  countryName: string;
  countryCode: string;
  profileKey: string;
  avatarSeed: string;
  potentialSteps: number;
  sportingProfile: string;
  ratings: RiderRatings;
  trainingPriority: string;
  status: AcademyRow["status"];
  promotionGameYear: number | null;
  raceNumber: number | null;
};

export type DevelopmentTeamIdentity = {
  id: string;
  displayName: string;
  status: DevelopmentTeamRow["status"];
  rosterLockedAt: string;
  jersey: AmateurJerseyConfig;
};

export type DevelopmentRaceStage = {
  id: string;
  number: number;
  dayNumber: number;
  name: string;
  stageType: StageRow["stage_type"];
  profileType: DevelopmentRaceProfile;
  distanceKm: number;
};

export type DevelopmentRace = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  locationName: string;
  countryCode: string;
  startDayNumber: number;
  endDayNumber: number;
  profileType: DevelopmentRaceProfile;
  raceFormat: EditionRow["race_format"];
  isWorldChampionship: boolean;
  selectionMinimum: number;
  selectionMaximum: number;
  status: EditionRow["status"];
  simulatedAt: string | null;
  stages: DevelopmentRaceStage[];
  registration: null | {
    id: string;
    status: RegistrationRow["status"];
    riderIds: string[];
  };
  canRegister: boolean;
};

export type DevelopmentRaceResult = {
  id: string;
  raceEditionId: string;
  stageId: string | null;
  scope: ResultRow["result_scope"];
  academyRiderId: string | null;
  developmentTeamId: string | null;
  riderName: string;
  teamName: string;
  countryCode: string;
  rank: number;
  elapsedTimeSeconds: number;
  gapToWinnerSeconds: number;
};

export type DevelopmentTeamOverview = {
  seasonId: string;
  seasonName: string;
  gameYear: number;
  currentDayNumber: number;
  creationWindowOpen: boolean;
  expectedTeamName: string;
  defaultJersey: AmateurJerseyConfig;
  eligibleRiders: DevelopmentRider[];
  team: DevelopmentTeamIdentity | null;
  roster: DevelopmentRider[];
  races: DevelopmentRace[];
  results: DevelopmentRaceResult[];
  statistics: {
    registrations: number;
    completedRaces: number;
    podiums: number;
    wins: number;
  };
};

export type DevelopmentRiderProfile = DevelopmentRider & {
  teamId: string;
  currentDevelopmentTeam: DevelopmentTeamIdentity | null;
  climateProfile: RiderClimateProfile;
  history: Array<{
    seasonId: string;
    seasonName: string;
    gameYear: number;
    teamName: string;
    raceCount: number;
    wins: number;
    podiums: number;
  }>;
  results: Array<DevelopmentRaceResult & { raceName: string; stageName: string | null }>;
};

export async function getDevelopmentTeamOverview(
  authUserId: string,
): Promise<DevelopmentTeamOverview | null> {
  const admin = createSupabaseAdminClient();
  const context = await loadContext(admin, authUserId);
  if (!context) return null;

  const calendarResult = await admin.rpc("ensure_development_race_calendar", {
    p_season_id: context.seasonId,
  });
  assertQuery(calendarResult.error, "le calendrier de la Development Team");
  const settlementResult = await admin.rpc("settle_due_development_races");
  assertQuery(settlementResult.error, "les résultats juniors arrivés à échéance");

  const [academyResult, teamResult, editionsResult] = await Promise.all([
    admin
      .from("youth_academy_riders")
      .select("*")
      .eq("team_id", context.teamId)
      .in("status", ["active", "recruited"])
      .order("last_name")
      .returns<AcademyRow[]>(),
    admin
      .from("development_teams")
      .select("*")
      .eq("team_id", context.teamId)
      .eq("season_id", context.seasonId)
      .maybeSingle<DevelopmentTeamRow>(),
    admin
      .from("development_race_editions")
      .select("*")
      .eq("season_id", context.seasonId)
      .order("start_day_number")
      .returns<EditionRow[]>(),
  ]);
  assertQuery(academyResult.error, "les juniors éligibles");
  assertQuery(teamResult.error, "la Development Team");
  assertQuery(editionsResult.error, "les épreuves juniors");

  const academyRows = academyResult.data ?? [];
  const teamRow = teamResult.data;
  const editions = editionsResult.data ?? [];
  const academyCountryIds = unique(academyRows.map((rider) => rider.country_id));
  const [countriesResult, stagesResult] = await Promise.all([
    academyCountryIds.length
      ? admin
          .from("countries")
          .select("id, name, iso_alpha2")
          .in("id", academyCountryIds)
          .returns<CountryRow[]>()
      : Promise.resolve({ data: [] as CountryRow[], error: null }),
    editions.length
      ? admin
          .from("development_race_stages")
          .select("*")
          .in("race_edition_id", editions.map((edition) => edition.id))
          .order("stage_number")
          .returns<StageRow[]>()
      : Promise.resolve({ data: [] as StageRow[], error: null }),
  ]);
  assertQuery(countriesResult.error, "les nationalités des juniors");
  assertQuery(stagesResult.error, "les étapes juniors");

  const countriesById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country]),
  );
  let rosterRows: RosterRow[] = [];
  let registrationRows: RegistrationRow[] = [];
  let selectionRows: SelectionRow[] = [];
  let resultRows: ResultRow[] = [];

  if (teamRow) {
    const [rosterResult, registrationsResult] = await Promise.all([
      admin
        .from("development_team_roster")
        .select("development_team_id, academy_rider_id, race_number")
        .eq("development_team_id", teamRow.id)
        .order("race_number")
        .returns<RosterRow[]>(),
      admin
        .from("development_race_registrations")
        .select("id, development_team_id, race_edition_id, status")
        .eq("development_team_id", teamRow.id)
        .returns<RegistrationRow[]>(),
    ]);
    assertQuery(rosterResult.error, "l’effectif de la Development Team");
    assertQuery(registrationsResult.error, "les inscriptions juniors");
    rosterRows = rosterResult.data ?? [];
    registrationRows = registrationsResult.data ?? [];

    if (registrationRows.length) {
      const selectionsResult = await admin
        .from("development_race_registration_riders")
        .select("registration_id, academy_rider_id")
        .in("registration_id", registrationRows.map((registration) => registration.id))
        .returns<SelectionRow[]>();
      assertQuery(selectionsResult.error, "les sélections juniors");
      selectionRows = selectionsResult.data ?? [];
    }
  }

  if (editions.some((edition) => edition.status === "completed")) {
    const completedEditionIds = editions
      .filter((edition) => edition.status === "completed")
      .map((edition) => edition.id);
    const generalResult = await admin
      .from("development_race_results")
      .select("*")
      .in("race_edition_id", completedEditionIds)
      .eq("result_scope", "general")
      .order("rank")
      .returns<ResultRow[]>();
    assertQuery(generalResult.error, "les classements juniors");
    resultRows = generalResult.data ?? [];

    const stageRaceIds = editions
      .filter((edition) => edition.race_format === "stage_race" && edition.status === "completed")
      .map((edition) => edition.id);
    if (stageRaceIds.length) {
      const stageResult = await admin
        .from("development_race_results")
        .select("*")
        .in("race_edition_id", stageRaceIds)
        .eq("result_scope", "stage")
        .order("rank")
        .returns<ResultRow[]>();
      assertQuery(stageResult.error, "les résultats d’étapes juniors");
      resultRows = [...resultRows, ...(stageResult.data ?? [])];
    }
  }

  const raceNumberByRiderId = new Map(
    rosterRows.map((row) => [row.academy_rider_id, row.race_number]),
  );
  const riders = academyRows.map((rider) =>
    toDevelopmentRider(
      rider,
      countriesById.get(rider.country_id),
      context.gameYear,
      raceNumberByRiderId.get(rider.id) ?? null,
    ),
  );
  const riderById = new Map(riders.map((rider) => [rider.id, rider]));
  const roster = rosterRows.flatMap((row) => {
    const rider = riderById.get(row.academy_rider_id);
    return rider ? [{ ...rider, raceNumber: row.race_number }] : [];
  });
  const selectionsByRegistrationId = groupBy(
    selectionRows,
    (selection) => selection.registration_id,
  );
  const registrationByEditionId = new Map(
    registrationRows.map((registration) => [registration.race_edition_id, registration]),
  );
  const stagesByEditionId = groupBy(
    stagesResult.data ?? [],
    (stage) => stage.race_edition_id,
  );

  const races = editions.map((edition): DevelopmentRace => {
    const registration = registrationByEditionId.get(edition.id);
    return {
      id: edition.id,
      slug: edition.slug,
      name: edition.name,
      shortName: edition.short_name,
      locationName: edition.location_name,
      countryCode: edition.country_code,
      startDayNumber: edition.start_day_number,
      endDayNumber: edition.end_day_number,
      profileType: edition.profile_type,
      raceFormat: edition.race_format,
      isWorldChampionship: edition.is_world_championship,
      selectionMinimum: edition.selection_minimum,
      selectionMaximum: edition.selection_maximum,
      status: edition.status,
      simulatedAt: edition.simulated_at,
      stages: (stagesByEditionId.get(edition.id) ?? []).map(toDevelopmentStage),
      registration: registration
        ? {
            id: registration.id,
            status: registration.status,
            riderIds: (selectionsByRegistrationId.get(registration.id) ?? []).map(
              (selection) => selection.academy_rider_id,
            ),
          }
        : null,
      canRegister: Boolean(
        teamRow &&
          teamRow.status === "active" &&
          edition.status === "planned" &&
          context.currentDayNumber < edition.start_day_number,
      ),
    };
  });
  const results = resultRows.map(toDevelopmentResult);
  const ownFinalResults = results.filter(
    (result) =>
      result.scope === "general" && result.developmentTeamId === teamRow?.id,
  );

  return {
    seasonId: context.seasonId,
    seasonName: context.seasonName,
    gameYear: context.gameYear,
    currentDayNumber: context.currentDayNumber,
    creationWindowOpen: context.currentDayNumber >= 1 && context.currentDayNumber <= 7,
    expectedTeamName: `${context.teamName.trim()} Dev Team`,
    defaultJersey: {
      pattern: context.teamJerseyPattern,
      primaryColor: context.teamPrimaryColor,
      secondaryColor: context.teamSecondaryColor,
      accentColor: context.teamAccentColor,
    },
    eligibleRiders: riders,
    team: teamRow ? toDevelopmentTeamIdentity(teamRow) : null,
    roster,
    races,
    results,
    statistics: {
      registrations: registrationRows.filter(
        (registration) => registration.status !== "withdrawn",
      ).length,
      completedRaces: races.filter((race) => race.status === "completed").length,
      podiums: ownFinalResults.filter((result) => result.rank <= 3).length,
      wins: ownFinalResults.filter((result) => result.rank === 1).length,
    },
  };
}

export async function getDevelopmentRiderProfile(
  authUserId: string,
  academyRiderId: string,
): Promise<DevelopmentRiderProfile | null> {
  const admin = createSupabaseAdminClient();
  const context = await loadContext(admin, authUserId);
  if (!context) return null;

  const rosterResult = await admin
    .from("development_team_roster")
    .select("development_team_id, academy_rider_id, race_number")
    .eq("academy_rider_id", academyRiderId)
    .returns<RosterRow[]>();
  assertQuery(rosterResult.error, "l’historique Development Team du junior");
  const rosterRows = rosterResult.data ?? [];
  if (!rosterRows.length) return null;

  const teamResult = await admin
    .from("development_teams")
    .select("*")
    .in("id", unique(rosterRows.map((row) => row.development_team_id)))
    .eq("team_id", context.teamId)
    .order("created_at", { ascending: false })
    .returns<DevelopmentTeamRow[]>();
  assertQuery(teamResult.error, "les équipes juniors du coureur");
  const teamRows = teamResult.data ?? [];
  if (!teamRows.length) return null;

  const riderResult = await admin
    .from("youth_academy_riders")
    .select("*")
    .eq("id", academyRiderId)
    .eq("team_id", context.teamId)
    .maybeSingle<AcademyRow>();
  assertQuery(riderResult.error, "la fiche du junior");
  if (!riderResult.data) return null;

  const seasonIds = unique(teamRows.map((team) => team.season_id));
  const [countryResult, seasonsResult, resultRowsResult] = await Promise.all([
    admin
      .from("countries")
      .select("id, name, iso_alpha2")
      .eq("id", riderResult.data.country_id)
      .maybeSingle<CountryRow>(),
    admin
      .from("seasons")
      .select("id, name, game_year")
      .in("id", seasonIds)
      .returns<Array<{ id: string; name: string; game_year: number }>>(),
    admin
      .from("development_race_results")
      .select("*")
      .eq("academy_rider_id", academyRiderId)
      .order("created_at", { ascending: false })
      .returns<ResultRow[]>(),
  ]);
  assertQuery(countryResult.error, "la nationalité du junior");
  assertQuery(seasonsResult.error, "les saisons juniors");
  assertQuery(resultRowsResult.error, "les résultats du junior");

  const resultRows = resultRowsResult.data ?? [];
  const editionIds = unique(resultRows.map((result) => result.race_edition_id));
  const stageIds = unique(
    resultRows.flatMap((result) => (result.stage_id ? [result.stage_id] : [])),
  );
  const [editionsResult, stagesResult] = await Promise.all([
    editionIds.length
      ? admin
          .from("development_race_editions")
          .select("id, name, season_id")
          .in("id", editionIds)
          .returns<Array<{ id: string; name: string; season_id: string }>>()
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; season_id: string }>, error: null }),
    stageIds.length
      ? admin
          .from("development_race_stages")
          .select("id, name")
          .in("id", stageIds)
          .returns<Array<{ id: string; name: string }>>()
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null }),
  ]);
  assertQuery(editionsResult.error, "les courses du palmarès junior");
  assertQuery(stagesResult.error, "les étapes du palmarès junior");

  const country = countryResult.data;
  const currentRoster = rosterRows.find(
    (row) =>
      row.development_team_id ===
      teamRows.find((team) => team.season_id === context.seasonId)?.id,
  );
  const rider = toDevelopmentRider(
    riderResult.data,
    country ?? undefined,
    context.gameYear,
    currentRoster?.race_number ?? null,
  );
  const seasonById = new Map(
    (seasonsResult.data ?? []).map((season) => [season.id, season]),
  );
  const editionById = new Map(
    (editionsResult.data ?? []).map((edition) => [edition.id, edition]),
  );
  const stageById = new Map(
    (stagesResult.data ?? []).map((stage) => [stage.id, stage]),
  );
  const resultDtos = resultRows.map((result) => ({
    ...toDevelopmentResult(result),
    raceName: editionById.get(result.race_edition_id)?.name ?? "Épreuve junior",
    stageName: result.stage_id ? stageById.get(result.stage_id)?.name ?? null : null,
  }));

  return {
    ...rider,
    teamId: context.teamId,
    currentDevelopmentTeam:
      teamRows.find((team) => team.season_id === context.seasonId)
        ? toDevelopmentTeamIdentity(
            teamRows.find((team) => team.season_id === context.seasonId)!,
          )
        : null,
    climateProfile: getRiderClimateProfile({
      riderId: rider.id,
      countryCode: rider.countryCode,
    }),
    history: teamRows
      .map((team) => {
        const season = seasonById.get(team.season_id);
        const seasonEditionIds = new Set(
          (editionsResult.data ?? [])
            .filter((edition) => edition.season_id === team.season_id)
            .map((edition) => edition.id),
        );
        const seasonResults = resultDtos.filter(
          (result) =>
            result.scope === "general" && seasonEditionIds.has(result.raceEditionId),
        );
        return {
          seasonId: team.season_id,
          seasonName: season?.name ?? `Saison ${season?.game_year ?? "—"}`,
          gameYear: season?.game_year ?? 0,
          teamName: team.display_name,
          raceCount: seasonResults.length,
          wins: seasonResults.filter((result) => result.rank === 1).length,
          podiums: seasonResults.filter((result) => result.rank <= 3).length,
        };
      })
      .sort((left, right) => right.gameYear - left.gameYear),
    results: resultDtos,
  };
}

function toDevelopmentRider(
  rider: AcademyRow,
  country: CountryRow | undefined,
  gameYear: number,
  raceNumber: number | null,
): DevelopmentRider {
  const ratings = scaleYouthRatings(rider);
  return {
    id: rider.id,
    firstName: rider.first_name,
    lastName: rider.last_name,
    age: gameYear - rider.birth_game_year,
    countryName: country?.name ?? "Pays inconnu",
    countryCode: country?.iso_alpha2 ?? "--",
    profileKey: rider.avatar_profile_key,
    avatarSeed: String(rider.avatar_seed),
    potentialSteps: rider.potential_steps,
    sportingProfile: getRiderSportingProfile(ratings),
    ratings,
    trainingPriority: rider.training_priority,
    status: rider.status,
    promotionGameYear: rider.promotion_game_year,
    raceNumber,
  };
}

function scaleYouthRatings(row: AcademyRow): RiderRatings {
  return {
    mountain: scaleRating(row.mountain),
    hills: scaleRating(row.hills),
    flat: scaleRating(row.flat),
    timeTrial: scaleRating(row.time_trial),
    cobbles: scaleRating(row.cobbles),
    sprint: scaleRating(row.sprint),
    acceleration: scaleRating(row.acceleration),
    downhill: scaleRating(row.downhill),
    endurance: scaleRating(row.endurance),
    resistance: scaleRating(row.resistance),
    recovery: scaleRating(row.recovery),
    breakaway: scaleRating(row.breakaway),
    prologue: scaleRating(row.prologue),
  };
}

function scaleRating(value: number | string) {
  return Math.min(100, Math.max(0, Math.round(34 + Number(value) * 8)));
}

function toDevelopmentTeamIdentity(
  row: DevelopmentTeamRow,
): DevelopmentTeamIdentity {
  return {
    id: row.id,
    displayName: row.display_name,
    status: row.status,
    rosterLockedAt: row.roster_locked_at,
    jersey: {
      pattern: row.jersey_pattern,
      primaryColor: row.jersey_primary_color,
      secondaryColor: row.jersey_secondary_color,
      accentColor: row.jersey_accent_color,
    },
  };
}

function toDevelopmentStage(row: StageRow): DevelopmentRaceStage {
  return {
    id: row.id,
    number: row.stage_number,
    dayNumber: row.day_number,
    name: row.name,
    stageType: row.stage_type,
    profileType: row.profile_type,
    distanceKm: Number(row.distance_km),
  };
}

function toDevelopmentResult(row: ResultRow): DevelopmentRaceResult {
  return {
    id: row.id,
    raceEditionId: row.race_edition_id,
    stageId: row.stage_id,
    scope: row.result_scope,
    academyRiderId: row.academy_rider_id,
    developmentTeamId: row.development_team_id,
    riderName: row.rider_name,
    teamName: row.team_name,
    countryCode: row.country_code,
    rank: row.rank,
    elapsedTimeSeconds: row.elapsed_time_seconds,
    gapToWinnerSeconds: row.gap_to_winner_seconds,
  };
}

async function loadContext(
  admin: AdminClient,
  authUserId: string,
): Promise<DevelopmentContext | null> {
  const directorResult = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();
  assertQuery(directorResult.error, "le Directeur Sportif");
  if (!directorResult.data) return null;

  const assignmentResult = await admin
    .from("team_manager_assignments")
    .select("team_id")
    .eq("sporting_director_id", directorResult.data.id)
    .eq("role", "general_manager")
    .eq("status", "active")
    .maybeSingle<{ team_id: string }>();
  assertQuery(assignmentResult.error, "l’équipe du Directeur Sportif");
  if (!assignmentResult.data) return null;

  const seasonResult = await admin
    .from("seasons")
    .select("id, name, game_year, current_day_number")
    .eq("status", "active")
    .maybeSingle<{
      id: string;
      name: string;
      game_year: number;
      current_day_number: number | null;
    }>();
  assertQuery(seasonResult.error, "la saison active");
  if (!seasonResult.data) return null;

  const [teamSeasonResult, teamResult] = await Promise.all([
    admin
      .from("team_seasons")
      .select("display_name")
      .eq("team_id", assignmentResult.data.team_id)
      .eq("season_id", seasonResult.data.id)
      .maybeSingle<{ display_name: string }>(),
    admin
      .from("teams")
      .select(
        "amateur_jersey_pattern, amateur_jersey_primary_color, amateur_jersey_secondary_color, amateur_jersey_accent_color",
      )
      .eq("id", assignmentResult.data.team_id)
      .maybeSingle<{
        amateur_jersey_pattern: AmateurJerseyConfig["pattern"] | null;
        amateur_jersey_primary_color: string | null;
        amateur_jersey_secondary_color: string | null;
        amateur_jersey_accent_color: string | null;
      }>(),
  ]);
  assertQuery(teamSeasonResult.error, "l’identité de l’équipe");
  assertQuery(teamResult.error, "le maillot de l’équipe");
  if (!teamSeasonResult.data) return null;

  return {
    directorId: directorResult.data.id,
    teamId: assignmentResult.data.team_id,
    seasonId: seasonResult.data.id,
    seasonName: seasonResult.data.name,
    gameYear: seasonResult.data.game_year,
    currentDayNumber: seasonResult.data.current_day_number ?? 1,
    teamName: teamSeasonResult.data.display_name,
    teamJerseyPattern: teamResult.data?.amateur_jersey_pattern ?? "classic",
    teamPrimaryColor: teamResult.data?.amateur_jersey_primary_color ?? "#176951",
    teamSecondaryColor:
      teamResult.data?.amateur_jersey_secondary_color ?? "#FFFDF4",
    teamAccentColor: teamResult.data?.amateur_jersey_accent_color ?? "#F2C94C",
  };
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    grouped.set(key(row), [...(grouped.get(key(row)) ?? []), row]);
  }
  return grouped;
}

function assertQuery(error: { message: string } | null, label: string) {
  if (error) throw new Error(`Impossible de charger ${label} : ${error.message}`);
}
