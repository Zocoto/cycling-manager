import "server-only";

import type {
  RaceCalendarEdition,
  RaceCompetitionType,
  SeasonRaceCalendar,
} from "@/lib/game/race-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NationalChampionshipDiscipline = "route" | "contre-la-montre";

export type NationalChampionshipRider = {
  id: string;
  firstName: string;
  lastName: string;
  rosterId: string;
  status: "entered" | "withdrawn";
  finalRank: number | null;
};

export type NationalChampionshipCountry = {
  countryName: string;
  countryCode: string;
  eligibleRiderCount: number;
  enteredRiderCount: number;
  edition: RaceCalendarEdition;
  riders: NationalChampionshipRider[];
};

export type NationalChampionshipSelectionCell = {
  editionId: string | null;
  checked: boolean;
  editable: boolean;
  departureAt: string | null;
};

export type NationalChampionshipSelectionRow = {
  riderId: string;
  firstName: string;
  lastName: string;
  countryName: string;
  countryCode: string;
  nationalRank: number | null;
  isDefaultQualified: boolean;
  road: NationalChampionshipSelectionCell;
  timeTrial: NationalChampionshipSelectionCell;
};

export type NationalChampionshipSelectionMatrix = {
  rows: NationalChampionshipSelectionRow[];
  roadDepartureAt: string | null;
  timeTrialDepartureAt: string | null;
  missingEditionCount: number;
};

type ManagedTeamContext = {
  teamId: string;
  teamSeasonId: string;
};

type RegistrationRow = {
  id: string;
  race_edition_id: string;
};

type RosterRow = {
  id: string;
  race_registration_id: string;
  rider_id: string;
  status: "selected" | "confirmed" | "withdrawn" | "did_not_start";
};

type RiderRow = {
  id: string;
  country_id: string;
  first_name: string;
  last_name: string;
};

type ResultRow = {
  race_roster_id: string;
  final_rank: number | null;
};

type NationalRankingRow = {
  rider_id: string;
  national_rank: number;
};

export function getNationalChampionshipCompetitionType(
  discipline: NationalChampionshipDiscipline,
): RaceCompetitionType {
  return discipline === "route"
    ? "national_road"
    : "national_time_trial";
}

export function getNationalChampionshipDiscipline(
  competitionType: RaceCompetitionType,
): NationalChampionshipDiscipline | null {
  if (competitionType === "national_road") return "route";
  if (competitionType === "national_time_trial") return "contre-la-montre";
  return null;
}

export async function syncNationalChampionshipRegistrations(now = new Date()) {
  const admin = createSupabaseAdminClient();
  const result = await admin.rpc("process_due_national_championships", {
    p_now: now.toISOString(),
  });
  assertQuery(result.error, "les sélections automatiques des CN");
  return Number(result.data ?? 0);
}

export async function getCurrentTeamNationalChampionshipCountryCodes({
  authUserId,
  seasonId,
}: {
  authUserId: string;
  seasonId: string;
}): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  const context = await getManagedTeamContext(authUserId, seasonId);
  if (!context) return [];

  const riders = await getCurrentTeamRiders(context.teamId);
  if (riders.length === 0) return [];

  const countryIds = [...new Set(riders.map((rider) => rider.country_id))];
  const { data: countries, error } = await admin
    .from("countries")
    .select("id, iso_alpha2")
    .in("id", countryIds)
    .returns<Array<{ id: string; iso_alpha2: string }>>();
  assertQuery(error, "les pays de l’effectif");

  return (countries ?? [])
    .map((country) => country.iso_alpha2)
    .sort((left, right) => left.localeCompare(right));
}

export async function getCurrentTeamNationalChampionshipSelectionMatrix({
  authUserId,
  calendar,
  now = new Date(),
}: {
  authUserId: string;
  calendar: SeasonRaceCalendar;
  now?: Date;
}): Promise<NationalChampionshipSelectionMatrix> {
  const admin = createSupabaseAdminClient();
  const context = await getManagedTeamContext(authUserId, calendar.seasonId);
  if (!context) {
    return {
      rows: [],
      roadDepartureAt: null,
      timeTrialDepartureAt: null,
      missingEditionCount: 0,
    };
  }

  const riders = await getCurrentTeamRiders(context.teamId);
  if (riders.length === 0) {
    return {
      rows: [],
      roadDepartureAt: null,
      timeTrialDepartureAt: null,
      missingEditionCount: 0,
    };
  }

  const riderIds = riders.map((rider) => rider.id);
  const countryIds = [...new Set(riders.map((rider) => rider.country_id))];
  const [{ data: countries, error: countriesError }, rankingsResult] =
    await Promise.all([
      admin
        .from("countries")
        .select("id, name, iso_alpha2")
        .in("id", countryIds)
        .returns<Array<{ id: string; name: string; iso_alpha2: string }>>(),
      admin
        .rpc("get_national_championship_country_rankings", {
          p_season_id: calendar.seasonId,
        })
        .in("rider_id", riderIds),
    ]);
  assertQuery(countriesError, "les pays de l’effectif");
  assertQuery(rankingsResult.error, "le classement national des coureurs");

  const countryById = new Map(
    (countries ?? []).map((country) => [country.id, country]),
  );
  const rankByRiderId = new Map(
    ((rankingsResult.data as NationalRankingRow[] | null) ?? []).map((ranking) => [
      ranking.rider_id,
      ranking.national_rank,
    ]),
  );
  const teamCountryCodes = new Set(
    (countries ?? []).map((country) => country.iso_alpha2),
  );
  const editions = calendar.editions.filter(
    (edition) =>
      teamCountryCodes.has(edition.countryCode) &&
      (edition.competitionType === "national_road" ||
        edition.competitionType === "national_time_trial"),
  );
  const editionIds = editions.map((edition) => edition.id);

  const registrationsResult =
    editionIds.length > 0
      ? await admin
          .from("race_registrations")
          .select("id, race_edition_id")
          .in("race_edition_id", editionIds)
          .eq("team_season_id", context.teamSeasonId)
          .returns<RegistrationRow[]>()
      : { data: [] as RegistrationRow[], error: null };
  assertQuery(registrationsResult.error, "les inscriptions de l’équipe aux CN");

  const registrations = registrationsResult.data ?? [];
  const editionIdByRegistrationId = new Map(
    registrations.map((registration) => [
      registration.id,
      registration.race_edition_id,
    ]),
  );
  const registrationIds = registrations.map((registration) => registration.id);
  const rostersResult =
    registrationIds.length > 0
      ? await admin
          .from("race_rosters")
          .select("id, race_registration_id, rider_id, status")
          .in("race_registration_id", registrationIds)
          .returns<RosterRow[]>()
      : { data: [] as RosterRow[], error: null };
  assertQuery(rostersResult.error, "les sélections de l’équipe aux CN");

  const selectedKeys = new Set(
    (rostersResult.data ?? [])
      .filter(
        (roster) =>
          roster.status === "selected" || roster.status === "confirmed",
      )
      .flatMap((roster) => {
        const editionId = editionIdByRegistrationId.get(
          roster.race_registration_id,
        );
        return editionId ? [`${editionId}:${roster.rider_id}`] : [];
      }),
  );
  const editionByCountryAndType = new Map(
    editions.map((edition) => [
      `${edition.countryCode}:${edition.competitionType}`,
      edition,
    ]),
  );

  let missingEditionCount = 0;
  const rows = riders
    .flatMap((rider): NationalChampionshipSelectionRow[] => {
      const country = countryById.get(rider.country_id);
      if (!country) return [];

      const roadEdition = editionByCountryAndType.get(
        `${country.iso_alpha2}:national_road`,
      );
      const timeTrialEdition = editionByCountryAndType.get(
        `${country.iso_alpha2}:national_time_trial`,
      );
      if (!roadEdition) missingEditionCount += 1;
      if (!timeTrialEdition) missingEditionCount += 1;

      const nationalRank = rankByRiderId.get(rider.id) ?? null;
      return [
        {
          riderId: rider.id,
          firstName: rider.first_name,
          lastName: rider.last_name,
          countryName: country.name,
          countryCode: country.iso_alpha2,
          nationalRank,
          isDefaultQualified:
            nationalRank !== null && nationalRank <= 200,
          road: buildSelectionCell({
            edition: roadEdition,
            riderId: rider.id,
            selectedKeys,
            now,
          }),
          timeTrial: buildSelectionCell({
            edition: timeTrialEdition,
            riderId: rider.id,
            selectedKeys,
            now,
          }),
        },
      ];
    })
    .sort(
      (left, right) =>
        left.lastName.localeCompare(right.lastName, "fr") ||
        left.firstName.localeCompare(right.firstName, "fr"),
    );

  return {
    rows,
    roadDepartureAt: getSharedDepartureAt(editions, "national_road"),
    timeTrialDepartureAt: getSharedDepartureAt(
      editions,
      "national_time_trial",
    ),
    missingEditionCount,
  };
}

export async function getCurrentTeamNationalChampionshipCountries({
  authUserId,
  calendar,
  discipline,
}: {
  authUserId: string;
  calendar: SeasonRaceCalendar;
  discipline: NationalChampionshipDiscipline;
}): Promise<NationalChampionshipCountry[]> {
  const admin = createSupabaseAdminClient();
  const context = await getManagedTeamContext(authUserId, calendar.seasonId);
  if (!context) return [];

  const riders = await getCurrentTeamRiders(context.teamId);
  if (riders.length === 0) return [];

  const ridersById = new Map(riders.map((rider) => [rider.id, rider]));
  const countsByCountryId = new Map<string, number>();
  for (const rider of riders) {
    countsByCountryId.set(
      rider.country_id,
      (countsByCountryId.get(rider.country_id) ?? 0) + 1,
    );
  }

  const { data: countries, error: countriesError } = await admin
    .from("countries")
    .select("id, name, iso_alpha2")
    .in("id", [...countsByCountryId.keys()])
    .returns<Array<{ id: string; name: string; iso_alpha2: string }>>();
  assertQuery(countriesError, "les pays de l’effectif");

  const countryByCode = new Map(
    (countries ?? []).map((country) => [country.iso_alpha2, country]),
  );
  const competitionType = getNationalChampionshipCompetitionType(discipline);
  const relevantEditions = calendar.editions.filter(
    (edition) =>
      edition.competitionType === competitionType &&
      countryByCode.has(edition.countryCode),
  );
  const editionIds = relevantEditions.map((edition) => edition.id);

  const registrationsResult =
    editionIds.length > 0
      ? await admin
          .from("race_registrations")
          .select("id, race_edition_id")
          .in("race_edition_id", editionIds)
          .eq("team_season_id", context.teamSeasonId)
          .returns<RegistrationRow[]>()
      : { data: [] as RegistrationRow[], error: null };
  assertQuery(registrationsResult.error, "les engagements automatiques aux CN");

  const registrations = registrationsResult.data ?? [];
  const registrationById = new Map(
    registrations.map((registration) => [registration.id, registration]),
  );
  const registrationIds = registrations.map((registration) => registration.id);
  const rostersResult =
    registrationIds.length > 0
      ? await admin
          .from("race_rosters")
          .select("id, race_registration_id, rider_id, status")
          .in("race_registration_id", registrationIds)
          .returns<RosterRow[]>()
      : { data: [] as RosterRow[], error: null };
  assertQuery(rostersResult.error, "les coureurs retenus aux CN");

  const rosters = (rostersResult.data ?? []).filter((roster) =>
    ridersById.has(roster.rider_id),
  );
  const rosterIds = rosters.map((roster) => roster.id);
  const resultsResult =
    rosterIds.length > 0
      ? await admin
          .from("race_results")
          .select("race_roster_id, final_rank")
          .in("race_roster_id", rosterIds)
          .returns<ResultRow[]>()
      : { data: [] as ResultRow[], error: null };
  assertQuery(resultsResult.error, "les résultats des coureurs aux CN");
  const resultByRosterId = new Map(
    (resultsResult.data ?? []).map((result) => [result.race_roster_id, result]),
  );

  const ridersByEditionId = new Map<string, NationalChampionshipRider[]>();
  for (const roster of rosters) {
    const registration = registrationById.get(roster.race_registration_id);
    const rider = ridersById.get(roster.rider_id);
    if (!registration || !rider) continue;

    const entries = ridersByEditionId.get(registration.race_edition_id) ?? [];
    entries.push({
      id: rider.id,
      firstName: rider.first_name,
      lastName: rider.last_name,
      rosterId: roster.id,
      status:
        roster.status === "selected" || roster.status === "confirmed"
          ? "entered"
          : "withdrawn",
      finalRank: resultByRosterId.get(roster.id)?.final_rank ?? null,
    });
    ridersByEditionId.set(registration.race_edition_id, entries);
  }

  return relevantEditions
    .map((edition) => {
      const country = countryByCode.get(edition.countryCode)!;
      const selectedRiders = (ridersByEditionId.get(edition.id) ?? []).sort(
        (left, right) =>
          (left.finalRank ?? Number.MAX_SAFE_INTEGER) -
            (right.finalRank ?? Number.MAX_SAFE_INTEGER) ||
          left.lastName.localeCompare(right.lastName, "fr") ||
          left.firstName.localeCompare(right.firstName, "fr"),
      );

      return {
        countryName: country.name,
        countryCode: country.iso_alpha2,
        eligibleRiderCount: countsByCountryId.get(country.id) ?? 0,
        enteredRiderCount: selectedRiders.filter(
          (rider) => rider.status === "entered",
        ).length,
        edition,
        riders: selectedRiders,
      };
    })
    .filter((entry) => entry.eligibleRiderCount > 0)
    .sort((left, right) =>
      left.countryName.localeCompare(right.countryName, "fr"),
    );
}

async function getManagedTeamContext(
  authUserId: string,
  seasonId: string,
): Promise<ManagedTeamContext | null> {
  const admin = createSupabaseAdminClient();
  const { data: director, error: directorError } = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();
  assertQuery(directorError, "le Directeur Sportif");
  if (!director) return null;

  const { data: assignment, error: assignmentError } = await admin
    .from("team_manager_assignments")
    .select("team_id")
    .eq("sporting_director_id", director.id)
    .eq("role", "general_manager")
    .eq("status", "active")
    .maybeSingle<{ team_id: string }>();
  assertQuery(assignmentError, "l’équipe dirigée");
  if (!assignment) return null;

  const { data: teamSeason, error: teamSeasonError } = await admin
    .from("team_seasons")
    .select("id")
    .eq("team_id", assignment.team_id)
    .eq("season_id", seasonId)
    .in("status", ["planned", "active"])
    .maybeSingle<{ id: string }>();
  assertQuery(teamSeasonError, "la saison de l’équipe");
  if (!teamSeason) return null;

  return {
    teamId: assignment.team_id,
    teamSeasonId: teamSeason.id,
  };
}

async function getCurrentTeamRiders(teamId: string): Promise<RiderRow[]> {
  const admin = createSupabaseAdminClient();
  const { data: contracts, error: contractsError } = await admin
    .from("rider_contracts")
    .select("rider_id")
    .eq("team_id", teamId)
    .eq("status", "active")
    .returns<Array<{ rider_id: string }>>();
  assertQuery(contractsError, "les contrats actifs");

  const riderIds = [...new Set((contracts ?? []).map((row) => row.rider_id))];
  if (riderIds.length === 0) return [];

  const { data: riders, error: ridersError } = await admin
    .from("riders")
    .select("id, country_id, first_name, last_name")
    .in("id", riderIds)
    .eq("status", "active")
    .returns<RiderRow[]>();
  assertQuery(ridersError, "les nationalités de l’effectif");
  return riders ?? [];
}

function buildSelectionCell({
  edition,
  riderId,
  selectedKeys,
  now,
}: {
  edition: RaceCalendarEdition | undefined;
  riderId: string;
  selectedKeys: ReadonlySet<string>;
  now: Date;
}): NationalChampionshipSelectionCell {
  const departureAt = edition?.stages[0]?.departureAt ?? null;
  const departureTime = departureAt ? new Date(departureAt).getTime() : 0;

  return {
    editionId: edition?.id ?? null,
    checked: edition ? selectedKeys.has(`${edition.id}:${riderId}`) : false,
    editable: Boolean(
      edition &&
        departureAt &&
        departureTime > now.getTime() &&
        edition.status !== "completed" &&
        edition.status !== "cancelled",
    ),
    departureAt,
  };
}

function getSharedDepartureAt(
  editions: RaceCalendarEdition[],
  competitionType: "national_road" | "national_time_trial",
): string | null {
  const departures = editions
    .filter((edition) => edition.competitionType === competitionType)
    .flatMap((edition) =>
      edition.stages[0]?.departureAt ? [edition.stages[0].departureAt] : [],
    );
  return departures.sort()[0] ?? null;
}

function assertQuery(error: { message: string } | null, context: string) {
  if (error) {
    throw new Error(`Impossible de charger ${context} : ${error.message}`);
  }
}
