import "server-only";

import { getInternationalAcademyImpact } from "@/lib/game/national-federations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FederationChampion = {
  riderId: string;
  riderName: string;
  category: "professional" | "junior";
  discipline: "road" | "time_trial";
  seasonName: string;
  gameYear: number;
  avatarProfileKey?: string | null;
  avatarSeed?: number | string | null;
  teamId?: string | null;
  teamName?: string | null;
  age?: number;
};

export type FederationAcademy = {
  teamId: string;
  teamName: string;
  qualityLevel: number;
  contributionPercentage: number;
  completedAt: string;
};

export type NationalFederationSnapshot = {
  season: {
    id: string;
    name: string;
    gameYear: number;
    currentDayNumber: number;
  };
  viewer: {
    teamId: string | null;
    isAffiliated: boolean;
  };
  presidency: {
    mode: "automatic";
    presidentName: null;
  };
  academies: {
    centers: FederationAcademy[];
    totalImpactPercentage: number;
  };
  champions: {
    professional: Partial<
      Record<FederationChampion["discipline"], FederationChampion>
    >;
    junior: Partial<
      Record<FederationChampion["discipline"], FederationChampion>
    >;
  };
  palmares: FederationChampion[];
};

type SeasonRow = {
  id: string;
  name: string;
  game_year: number;
  current_day_number: number | null;
};

type ProfessionalTitleRow = {
  rider_id: string;
  season_id: string;
  championship_type: "road" | "time_trial";
  won_at: string;
  relinquished_at: string | null;
};

type JuniorTitleRow = {
  academy_rider_id: string;
  season_id: string;
  championship_type: "road" | "time_trial";
  won_at: string;
};

type RiderRow = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_profile_key: string | null;
  avatar_seed: number | string | null;
};

type JuniorRiderRow = RiderRow & {
  team_id: string | null;
  birth_game_year: number;
};

type RiderContractRow = { rider_id: string; team_id: string };
type RiderRatingRow = { rider_id: string; age: number };

type AcademyRow = {
  team_id: string;
  quality_level: number;
  completed_at: string;
};

type TeamSeasonRow = {
  team_id: string;
  display_name: string;
};

type ViewerTeamSeasonRow = {
  registration_country_id: string;
};

type CountryCodeRow = {
  iso_alpha2: string;
};

export async function getCurrentTeamFederationCountryCode(
  teamId: string,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const seasonResult = await admin
    .from("seasons")
    .select("id")
    .eq("status", "active")
    .maybeSingle<{ id: string }>();

  assertFederationQuery(seasonResult.error, "la saison active");
  if (!seasonResult.data) return null;

  const teamSeasonResult = await admin
    .from("team_seasons")
    .select("registration_country_id")
    .eq("team_id", teamId)
    .eq("season_id", seasonResult.data.id)
    .maybeSingle<ViewerTeamSeasonRow>();

  assertFederationQuery(
    teamSeasonResult.error,
    "la nationalité sportive de votre équipe",
  );
  if (!teamSeasonResult.data) return null;

  const countryResult = await admin
    .from("countries")
    .select("iso_alpha2")
    .eq("id", teamSeasonResult.data.registration_country_id)
    .eq("is_active", true)
    .maybeSingle<CountryCodeRow>();

  assertFederationQuery(countryResult.error, "votre fédération nationale");
  return countryResult.data?.iso_alpha2 ?? null;
}

export async function getNationalFederationSnapshot({
  countryId,
  countryCode,
  viewerTeamId,
}: {
  countryId: string;
  countryCode: string;
  viewerTeamId: string | null;
}): Promise<NationalFederationSnapshot> {
  const admin = createSupabaseAdminClient();
  const seasonResult = await admin
    .from("seasons")
    .select("id, name, game_year, current_day_number")
    .eq("status", "active")
    .maybeSingle<SeasonRow>();

  assertFederationQuery(seasonResult.error, "la saison active");

  if (!seasonResult.data) {
    throw new Error("Aucune saison active ne permet de charger la fédération.");
  }

  const season = seasonResult.data;
  const [professionalTitlesResult, juniorTitlesResult, academiesResult, viewerResult] =
    await Promise.all([
      admin
        .from("rider_national_championship_titles")
        .select(
          "rider_id, season_id, championship_type, won_at, relinquished_at",
        )
        .eq("country_id", countryId)
        .in("championship_type", ["road", "time_trial"])
        .order("won_at", { ascending: false })
        .returns<ProfessionalTitleRow[]>(),
      admin
        .from("junior_championship_titles")
        .select("academy_rider_id, season_id, championship_type, won_at")
        .eq("country_code", countryCode.trim().toUpperCase())
        .eq("title_level", "national")
        .order("won_at", { ascending: false })
        .returns<JuniorTitleRow[]>(),
      admin
        .from("international_youth_centers")
        .select("team_id, quality_level, completed_at")
        .eq("country_id", countryId)
        .order("quality_level", { ascending: false })
        .returns<AcademyRow[]>(),
      viewerTeamId
        ? admin
            .from("team_seasons")
            .select("registration_country_id")
            .eq("team_id", viewerTeamId)
            .eq("season_id", season.id)
            .maybeSingle<ViewerTeamSeasonRow>()
        : Promise.resolve({ data: null, error: null }),
    ]);

  assertFederationQuery(
    professionalTitlesResult.error,
    "les champions nationaux professionnels",
  );
  assertFederationQuery(
    juniorTitlesResult.error,
    "les champions nationaux juniors",
  );
  assertFederationQuery(
    academiesResult.error,
    "les académies internationales de la nation",
  );
  assertFederationQuery(viewerResult.error, "l’affiliation de votre équipe");

  const professionalTitles = professionalTitlesResult.data ?? [];
  const juniorTitles = juniorTitlesResult.data ?? [];
  const academyRows = academiesResult.data ?? [];
  const professionalRiderIds = unique(
    professionalTitles.map((title) => title.rider_id),
  );
  const juniorRiderIds = unique(
    juniorTitles.map((title) => title.academy_rider_id),
  );
  const seasonIds = unique([
    ...professionalTitles.map((title) => title.season_id),
    ...juniorTitles.map((title) => title.season_id),
  ]);
  const academyTeamIds = unique(academyRows.map((academy) => academy.team_id));

  const [professionalRidersResult, juniorRidersResult, seasonsResult, professionalContractsResult, professionalRatingsResult] =
    await Promise.all([
      professionalRiderIds.length > 0
        ? admin
            .from("riders")
            .select("id, first_name, last_name, avatar_profile_key, avatar_seed")
            .in("id", professionalRiderIds)
            .returns<RiderRow[]>()
        : Promise.resolve({ data: [], error: null }),
      juniorRiderIds.length > 0
        ? admin
            .from("youth_academy_riders")
            .select("id, first_name, last_name, avatar_profile_key, avatar_seed, team_id, birth_game_year")
            .in("id", juniorRiderIds)
            .returns<JuniorRiderRow[]>()
        : Promise.resolve({ data: [], error: null }),
      seasonIds.length > 0
        ? admin
            .from("seasons")
            .select("id, name, game_year")
            .in("id", seasonIds)
            .returns<Array<Pick<SeasonRow, "id" | "name" | "game_year">>>()
        : Promise.resolve({ data: [], error: null }),
      professionalRiderIds.length > 0
        ? admin
            .from("rider_contracts")
            .select("rider_id, team_id")
            .in("rider_id", professionalRiderIds)
            .eq("status", "active")
            .returns<RiderContractRow[]>()
        : Promise.resolve({ data: [], error: null }),
      professionalRiderIds.length > 0
        ? admin
            .from("rider_season_ratings")
            .select("rider_id, age")
            .eq("season_id", season.id)
            .in("rider_id", professionalRiderIds)
            .returns<RiderRatingRow[]>()
        : Promise.resolve({ data: [], error: null }),
    ]);

  assertFederationQuery(
    professionalRidersResult.error,
    "l’identité des champions professionnels",
  );
  assertFederationQuery(
    juniorRidersResult.error,
    "l’identité des champions juniors",
  );
  assertFederationQuery(seasonsResult.error, "l’historique des saisons");
  assertFederationQuery(
    professionalContractsResult.error,
    "les équipes des champions professionnels",
  );
  assertFederationQuery(
    professionalRatingsResult.error,
    "l’âge des champions professionnels",
  );

  const professionalContractByRiderId = new Map(
    (professionalContractsResult.data ?? []).map((contract) => [
      contract.rider_id,
      contract,
    ]),
  );
  const professionalAgeByRiderId = new Map(
    (professionalRatingsResult.data ?? []).map((rating) => [
      rating.rider_id,
      rating.age,
    ]),
  );
  const professionalRiderRowById = new Map(
    (professionalRidersResult.data ?? []).map((rider) => [rider.id, rider]),
  );
  const juniorRiderRowById = new Map(
    (juniorRidersResult.data ?? []).map((rider) => [rider.id, rider]),
  );
  const championTeamIds = unique([
    ...academyTeamIds,
    ...(professionalContractsResult.data ?? []).map((contract) => contract.team_id),
    ...(juniorRidersResult.data ?? []).flatMap((rider) =>
      rider.team_id ? [rider.team_id] : [],
    ),
  ]);
  const academyTeamsResult = championTeamIds.length
    ? await admin
        .from("team_seasons")
        .select("team_id, display_name")
        .eq("season_id", season.id)
        .in("team_id", championTeamIds)
        .returns<TeamSeasonRow[]>()
    : { data: [] as TeamSeasonRow[], error: null };
  assertFederationQuery(
    academyTeamsResult.error,
    "les équipes des champions et académies",
  );

  const professionalRiderById = toRiderNameMap(
    professionalRidersResult.data ?? [],
  );
  const juniorRiderById = toRiderNameMap(juniorRidersResult.data ?? []);
  const seasonById = new Map(
    (seasonsResult.data ?? []).map((row) => [row.id, row]),
  );
  const academyTeamNameById = new Map(
    (academyTeamsResult.data ?? []).map((row) => [
      row.team_id,
      row.display_name,
    ]),
  );

  const professionalPalmares = professionalTitles.flatMap((title) => {
    const titleSeason = seasonById.get(title.season_id);
    const riderName = professionalRiderById.get(title.rider_id);
    if (!titleSeason || !riderName) return [];

    const rider = professionalRiderRowById.get(title.rider_id);
    const contract = professionalContractByRiderId.get(title.rider_id);
    return [
      {
        riderId: title.rider_id,
        riderName,
        category: "professional" as const,
        discipline: title.championship_type,
        seasonName: titleSeason.name,
        gameYear: titleSeason.game_year,
        avatarProfileKey: rider?.avatar_profile_key ?? null,
        avatarSeed: rider?.avatar_seed ?? null,
        teamId: contract?.team_id ?? null,
        teamName: contract
          ? academyTeamNameById.get(contract.team_id) ?? null
          : null,
        age: professionalAgeByRiderId.get(title.rider_id) ?? 25,
      },
    ];
  });
  const juniorPalmares = juniorTitles.flatMap((title) => {
    const titleSeason = seasonById.get(title.season_id);
    const riderName = juniorRiderById.get(title.academy_rider_id);
    if (!titleSeason || !riderName) return [];

    const rider = juniorRiderRowById.get(title.academy_rider_id);
    return [
      {
        riderId: title.academy_rider_id,
        riderName,
        category: "junior" as const,
        discipline: title.championship_type,
        seasonName: titleSeason.name,
        gameYear: titleSeason.game_year,
        avatarProfileKey: rider?.avatar_profile_key ?? null,
        avatarSeed: rider?.avatar_seed ?? null,
        teamId: rider?.team_id ?? null,
        teamName: rider?.team_id
          ? academyTeamNameById.get(rider.team_id) ?? null
          : null,
        age: rider ? season.game_year - rider.birth_game_year : 17,
      },
    ];
  });
  const professionalCurrent = professionalTitles
    .filter((title) => title.relinquished_at === null)
    .reduce<NationalFederationSnapshot["champions"]["professional"]>(
      (champions, title) => {
        const titleSeason = seasonById.get(title.season_id);
        const riderName = professionalRiderById.get(title.rider_id);
        const rider = professionalRiderRowById.get(title.rider_id);
        const contract = professionalContractByRiderId.get(title.rider_id);
        if (!titleSeason || !riderName) return champions;

        champions[title.championship_type] = {
          riderId: title.rider_id,
          riderName,
          category: "professional",
          discipline: title.championship_type,
          seasonName: titleSeason.name,
          gameYear: titleSeason.game_year,
          avatarProfileKey: rider?.avatar_profile_key ?? null,
          avatarSeed: rider?.avatar_seed ?? null,
          teamId: contract?.team_id ?? null,
          teamName: contract
            ? academyTeamNameById.get(contract.team_id) ?? null
            : null,
          age: professionalAgeByRiderId.get(title.rider_id) ?? 25,
        };
        return champions;
      },
      {},
    );
  const juniorCurrent = collectLatestChampions(juniorPalmares);
  const academies = academyRows.map(
    (academy): FederationAcademy => ({
      teamId: academy.team_id,
      teamName:
        academyTeamNameById.get(academy.team_id) ?? "Équipe non active",
      qualityLevel: academy.quality_level,
      contributionPercentage: Math.min(50, academy.quality_level * 10),
      completedAt: academy.completed_at,
    }),
  );

  return {
    season: {
      id: season.id,
      name: season.name,
      gameYear: season.game_year,
      currentDayNumber: season.current_day_number ?? 1,
    },
    viewer: {
      teamId: viewerTeamId,
      isAffiliated:
        viewerResult.data?.registration_country_id === countryId,
    },
    presidency: {
      mode: "automatic",
      presidentName: null,
    },
    academies: {
      centers: academies,
      totalImpactPercentage: getInternationalAcademyImpact(
        academies.map((academy) => academy.qualityLevel),
      ),
    },
    champions: {
      professional: professionalCurrent,
      junior: juniorCurrent,
    },
    palmares: [...professionalPalmares, ...juniorPalmares].sort(
      (left, right) =>
        right.gameYear - left.gameYear ||
        left.category.localeCompare(right.category) ||
        left.discipline.localeCompare(right.discipline),
    ),
  };
}

function collectLatestChampions(
  palmares: FederationChampion[],
): NationalFederationSnapshot["champions"]["junior"] {
  return palmares.reduce<
    NationalFederationSnapshot["champions"]["junior"]
  >((champions, title) => {
    const current = champions[title.discipline];
    if (!current || title.gameYear > current.gameYear) {
      champions[title.discipline] = title;
    }
    return champions;
  }, {});
}

function toRiderNameMap(rows: RiderRow[]): Map<string, string> {
  return new Map(
    rows.map((row) => [
      row.id,
      `${row.first_name} ${row.last_name}`.trim(),
    ]),
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function assertFederationQuery(
  error: { message: string } | null,
  resourceName: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${resourceName} : ${error.message}`);
  }
}
