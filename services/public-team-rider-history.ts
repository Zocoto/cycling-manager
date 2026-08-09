import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ContractRow = {
  rider_id: string;
  start_season_id: string;
  end_season_id: string;
  left_season_id: string | null;
  status: string;
};

type RiderRow = {
  id: string;
  country_id: string;
  first_name: string;
  last_name: string;
  status: string;
  avatar_profile_key: string;
  avatar_seed: number | string;
};

type SeasonRow = {
  id: string;
  name: string;
  game_year: number;
};

type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
};

type ArchiveRow = {
  rider_id: string;
  retirement_age: number | null;
  retirement_season_name: string;
  retirement_game_year: number;
};

export type PublicTeamHistoricalRider = {
  id: string;
  firstName: string;
  lastName: string;
  countryName: string;
  countryCode: string;
  avatarProfileKey: string;
  avatarSeed: number | string;
  age: number | null;
  firstSeasonName: string;
  firstGameYear: number;
  lastSeasonName: string;
  lastGameYear: number;
  seasonsCount: number;
  isCurrent: boolean;
  isArchived: boolean;
  retirementSeasonName: string | null;
};

export async function getPublicTeamRiderHistory(
  teamIdentifier: string,
): Promise<PublicTeamHistoricalRider[]> {
  const teamId = teamIdentifier.trim().toLowerCase();
  if (!isUuid(teamId)) return [];

  const admin = createSupabaseAdminClient();
  const contractsResult = await admin
    .from("rider_contracts")
    .select("rider_id, start_season_id, end_season_id, left_season_id, status")
    .eq("team_id", teamId)
    .in("status", ["active", "completed", "terminated"])
    .returns<ContractRow[]>();
  assertQuery(contractsResult.error, "les anciens coureurs de l’équipe");

  const contracts = contractsResult.data ?? [];
  const riderIds = [...new Set(contracts.map((contract) => contract.rider_id))];
  if (!riderIds.length) return [];

  const seasonIds = [
    ...new Set(
      contracts.flatMap((contract) => [
        contract.start_season_id,
        contract.end_season_id,
        ...(contract.left_season_id ? [contract.left_season_id] : []),
      ]),
    ),
  ];
  const [ridersResult, seasonsResult, archivesResult, activeSeasonResult] =
    await Promise.all([
      admin
        .from("riders")
        .select(
          "id, country_id, first_name, last_name, status, avatar_profile_key, avatar_seed",
        )
        .in("id", riderIds)
        .returns<RiderRow[]>(),
      admin
        .from("seasons")
        .select("id, name, game_year")
        .in("id", seasonIds)
        .returns<SeasonRow[]>(),
      admin
        .from("rider_history_archives")
        .select(
          "rider_id, retirement_age, retirement_season_name, retirement_game_year",
        )
        .in("rider_id", riderIds)
        .returns<ArchiveRow[]>(),
      admin
        .from("seasons")
        .select("id")
        .eq("status", "active")
        .maybeSingle<{ id: string }>(),
    ]);

  assertQuery(ridersResult.error, "les identités des anciens coureurs");
  assertQuery(seasonsResult.error, "les saisons des anciens coureurs");
  assertQuery(archivesResult.error, "les archives des anciens coureurs");
  assertQuery(activeSeasonResult.error, "la saison active");

  const riders = ridersResult.data ?? [];
  const countryIds = [...new Set(riders.map((rider) => rider.country_id))];
  const [countriesResult, ratingsResult] = await Promise.all([
    admin
      .from("countries")
      .select("id, name, iso_alpha2")
      .in("id", countryIds)
      .returns<CountryRow[]>(),
    activeSeasonResult.data
      ? admin
          .from("rider_season_ratings")
          .select("rider_id, age")
          .eq("season_id", activeSeasonResult.data.id)
          .in("rider_id", riderIds)
          .returns<Array<{ rider_id: string; age: number }>>()
      : Promise.resolve({
          data: [] as Array<{ rider_id: string; age: number }>,
          error: null,
        }),
  ]);
  assertQuery(countriesResult.error, "les nationalités des anciens coureurs");
  assertQuery(ratingsResult.error, "l’âge actuel des anciens coureurs");

  const seasonById = new Map(
    (seasonsResult.data ?? []).map((season) => [season.id, season]),
  );
  const countryById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country]),
  );
  const archiveByRiderId = new Map(
    (archivesResult.data ?? []).map((archive) => [archive.rider_id, archive]),
  );
  const activeAgeByRiderId = new Map(
    (ratingsResult.data ?? []).map((rating) => [rating.rider_id, rating.age]),
  );
  const contractsByRiderId = groupBy(
    contracts,
    (contract) => contract.rider_id,
  );

  return riders
    .flatMap((rider): PublicTeamHistoricalRider[] => {
      const country = countryById.get(rider.country_id);
      const riderContracts = contractsByRiderId.get(rider.id) ?? [];
      const coveredYears = new Map<number, SeasonRow>();

      for (const contract of riderContracts) {
        const start = seasonById.get(contract.start_season_id);
        const end = seasonById.get(
          contract.left_season_id ?? contract.end_season_id,
        );
        if (!start || !end) continue;
        for (let year = start.game_year; year <= end.game_year; year += 1) {
          coveredYears.set(
            year,
            year === start.game_year
              ? start
              : year === end.game_year
                ? end
                : {
                    id: `${rider.id}-${year}`,
                    name: `Saison ${year}`,
                    game_year: year,
                  },
          );
        }
      }

      const seasons = [...coveredYears.values()].sort(
        (left, right) => left.game_year - right.game_year,
      );
      const firstSeason = seasons[0];
      const lastSeason = seasons.at(-1);
      if (!country || !firstSeason || !lastSeason) return [];

      const archive = archiveByRiderId.get(rider.id);
      return [
        {
          id: rider.id,
          firstName: rider.first_name,
          lastName: rider.last_name,
          countryName: country.name,
          countryCode: country.iso_alpha2,
          avatarProfileKey: rider.avatar_profile_key,
          avatarSeed: rider.avatar_seed,
          age:
            archive?.retirement_age ?? activeAgeByRiderId.get(rider.id) ?? null,
          firstSeasonName: firstSeason.name,
          firstGameYear: firstSeason.game_year,
          lastSeasonName: lastSeason.name,
          lastGameYear: lastSeason.game_year,
          seasonsCount: seasons.length,
          isCurrent: riderContracts.some(
            (contract) => contract.status === "active",
          ),
          isArchived: Boolean(archive) || rider.status === "retired",
          retirementSeasonName: archive?.retirement_season_name ?? null,
        },
      ];
    })
    .sort(
      (left, right) =>
        Number(right.isCurrent) - Number(left.isCurrent) ||
        right.lastGameYear - left.lastGameYear ||
        left.lastName.localeCompare(right.lastName, "fr") ||
        left.firstName.localeCompare(right.firstName, "fr"),
    );
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    grouped.set(key(row), [...(grouped.get(key(row)) ?? []), row]);
  }
  return grouped;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
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
