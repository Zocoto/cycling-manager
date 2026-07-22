import "server-only";

import type {
  RaceCalendarEdition,
  RaceCompetitionType,
  SeasonRaceCalendar,
} from "@/lib/game/race-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NationalChampionshipDiscipline = "route" | "contre-la-montre";

export type NationalChampionshipCountry = {
  countryName: string;
  countryCode: string;
  eligibleRiderCount: number;
  edition: RaceCalendarEdition;
};

export function getNationalChampionshipCompetitionType(
  discipline: NationalChampionshipDiscipline
): RaceCompetitionType {
  return discipline === "route"
    ? "national_road"
    : "national_time_trial";
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
  const { data: director, error: directorError } = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<{ id: string }>();

  assertQuery(directorError, "le Directeur Sportif");
  if (!director) return [];

  const { data: assignment, error: assignmentError } = await admin
    .from("team_manager_assignments")
    .select("team_id")
    .eq("sporting_director_id", director.id)
    .eq("role", "general_manager")
    .eq("status", "active")
    .maybeSingle<{ team_id: string }>();

  assertQuery(assignmentError, "l’équipe dirigée");
  if (!assignment) return [];

  const { data: contracts, error: contractsError } = await admin
    .from("rider_contracts")
    .select("rider_id")
    .eq("team_id", assignment.team_id)
    .eq("status", "active")
    .returns<Array<{ rider_id: string }>>();

  assertQuery(contractsError, "les contrats actifs");
  const riderIds = [...new Set((contracts ?? []).map((row) => row.rider_id))];
  if (riderIds.length === 0) return [];

  const { data: riders, error: ridersError } = await admin
    .from("riders")
    .select("id, country_id")
    .in("id", riderIds)
    .eq("status", "active")
    .returns<Array<{ id: string; country_id: string }>>();

  assertQuery(ridersError, "les nationalités de l’effectif");
  const countsByCountryId = new Map<string, number>();
  for (const rider of riders ?? []) {
    countsByCountryId.set(
      rider.country_id,
      (countsByCountryId.get(rider.country_id) ?? 0) + 1
    );
  }

  if (countsByCountryId.size === 0) return [];

  const { data: countries, error: countriesError } = await admin
    .from("countries")
    .select("id, name, iso_alpha2")
    .in("id", [...countsByCountryId.keys()])
    .returns<Array<{ id: string; name: string; iso_alpha2: string }>>();

  assertQuery(countriesError, "les pays de l’effectif");
  const countryByCode = new Map(
    (countries ?? []).map((country) => [country.iso_alpha2, country])
  );
  const competitionType = getNationalChampionshipCompetitionType(discipline);

  return calendar.editions
    .filter(
      (edition) =>
        edition.competitionType === competitionType &&
        countryByCode.has(edition.countryCode)
    )
    .map((edition) => {
      const country = countryByCode.get(edition.countryCode)!;
      return {
        countryName: country.name,
        countryCode: country.iso_alpha2,
        eligibleRiderCount: countsByCountryId.get(country.id) ?? 0,
        edition,
      };
    })
    .filter((entry) => entry.eligibleRiderCount > 0)
    .sort((left, right) =>
      left.countryName.localeCompare(right.countryName, "fr")
    );
}

function assertQuery(error: { message: string } | null, context: string) {
  if (error) {
    throw new Error(`Impossible de charger ${context} : ${error.message}`);
  }
}
