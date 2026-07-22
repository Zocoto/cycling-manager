import "server-only";

import type { NationalChampionshipType, RaceCalendarEdition } from "@/lib/game/race-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveSeasonRaceCalendar } from "@/services/race-calendar";
import { getTeamAmateurIdentityForAuthUser } from "@/services/team-amateur-identity";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ContractRow = { rider_id: string };
type RiderRow = { id: string; country_id: string };
type CountryRow = { id: string; name: string; iso_alpha2: string };

export type NationalChampionshipEntry = {
  edition: RaceCalendarEdition;
  eligibleRiderCount: number;
};

export type NationalChampionshipOverview = {
  seasonName: string;
  gameYear: number;
  currentDayNumber: number;
  discipline: NationalChampionshipType;
  entries: NationalChampionshipEntry[];
};

export async function getCurrentTeamNationalChampionships(
  supabase: SupabaseServerClient,
  authUserId: string,
  discipline: NationalChampionshipType
): Promise<NationalChampionshipOverview | null> {
  const [calendar, teamIdentity] = await Promise.all([
    getActiveSeasonRaceCalendar(supabase, new Date(), {
      includeNationalChampionships: true,
    }),
    getTeamAmateurIdentityForAuthUser(authUserId),
  ]);

  if (!calendar || !teamIdentity) return null;

  const admin = createSupabaseAdminClient();
  const contractsResult = await admin
    .from("rider_contracts")
    .select("rider_id")
    .eq("team_id", teamIdentity.teamId)
    .eq("status", "active")
    .returns<ContractRow[]>();

  if (contractsResult.error) {
    throw new Error(
      `Impossible de charger l'effectif pour les championnats nationaux : ${contractsResult.error.message}`
    );
  }

  const riderIds = [...new Set((contractsResult.data ?? []).map((row) => row.rider_id))];
  if (riderIds.length === 0) {
    return {
      seasonName: calendar.seasonName,
      gameYear: calendar.gameYear,
      currentDayNumber: calendar.currentDayNumber,
      discipline,
      entries: [],
    };
  }

  const ridersResult = await admin
    .from("riders")
    .select("id, country_id")
    .in("id", riderIds)
    .eq("status", "active")
    .returns<RiderRow[]>();

  if (ridersResult.error) {
    throw new Error(
      `Impossible de charger les nationalités de l'effectif : ${ridersResult.error.message}`
    );
  }

  const countryIds = [...new Set((ridersResult.data ?? []).map((rider) => rider.country_id))];
  const countriesResult = countryIds.length
    ? await admin
        .from("countries")
        .select("id, name, iso_alpha2")
        .in("id", countryIds)
        .returns<CountryRow[]>()
    : { data: [] as CountryRow[], error: null };

  if (countriesResult.error) {
    throw new Error(
      `Impossible de charger les nations représentées : ${countriesResult.error.message}`
    );
  }

  const countryById = new Map((countriesResult.data ?? []).map((country) => [country.id, country]));
  const riderCountByCountryCode = new Map<string, number>();
  for (const rider of ridersResult.data ?? []) {
    const code = countryById.get(rider.country_id)?.iso_alpha2.toUpperCase();
    if (code) riderCountByCountryCode.set(code, (riderCountByCountryCode.get(code) ?? 0) + 1);
  }

  const entries = calendar.editions
    .filter(
      (edition) =>
        edition.nationalChampionshipType === discipline &&
        riderCountByCountryCode.has(edition.countryCode.toUpperCase())
    )
    .map((edition) => ({
      edition,
      eligibleRiderCount: riderCountByCountryCode.get(edition.countryCode.toUpperCase()) ?? 0,
    }))
    .sort((left, right) => left.edition.countryName.localeCompare(right.edition.countryName, "fr"));

  return {
    seasonName: calendar.seasonName,
    gameYear: calendar.gameYear,
    currentDayNumber: calendar.currentDayNumber,
    discipline,
    entries,
  };
}
