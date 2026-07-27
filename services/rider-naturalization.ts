import "server-only";

import {
  calculateInGameTenureDays,
  evaluateNaturalizationEligibility,
  findContinuousProfessionalTenureStart,
  type NaturalizationEligibility,
  type ProfessionalContractTenure,
} from "@/lib/game/naturalization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
};

type ContractRow = {
  start_season_id: string;
  end_season_id: string;
  joined_day_number: number;
};

type SeasonRow = {
  id: string;
  game_year: number;
  current_day_number: number | null;
};

export async function getProfessionalRiderNaturalizationEligibility({
  authUserId,
  riderId,
}: {
  authUserId: string;
  riderId: string;
}): Promise<NaturalizationEligibility | null> {
  const admin = createSupabaseAdminClient();
  const [directorResult, seasonResult] = await Promise.all([
    admin
      .from("sporting_directors")
      .select("id")
      .eq("auth_user_id", authUserId)
      .eq("status", "active")
      .maybeSingle<{ id: string }>(),
    admin
      .from("seasons")
      .select("id, game_year, current_day_number")
      .eq("status", "active")
      .maybeSingle<SeasonRow>(),
  ]);
  assertQuery(directorResult.error, "le Directeur Sportif");
  assertQuery(seasonResult.error, "la saison active");
  if (!directorResult.data || !seasonResult.data) return null;

  const assignmentResult = await admin
    .from("team_manager_assignments")
    .select("team_id")
    .eq("sporting_director_id", directorResult.data.id)
    .eq("role", "general_manager")
    .eq("status", "active")
    .maybeSingle<{ team_id: string }>();
  assertQuery(assignmentResult.error, "l’équipe du Directeur Sportif");
  if (!assignmentResult.data) return null;

  const teamId = assignmentResult.data.team_id;
  const [riderResult, contractResult, teamSeasonResult, titleResult] =
    await Promise.all([
      admin
        .from("riders")
        .select("country_id")
        .eq("id", riderId)
        .eq("status", "active")
        .maybeSingle<{ country_id: string }>(),
      admin
        .from("rider_contracts")
        .select("start_season_id, end_season_id, joined_day_number")
        .eq("rider_id", riderId)
        .eq("team_id", teamId)
        .eq("status", "active")
        .maybeSingle<ContractRow>(),
      admin
        .from("team_seasons")
        .select("registration_country_id")
        .eq("team_id", teamId)
        .eq("season_id", seasonResult.data.id)
        .maybeSingle<{ registration_country_id: string }>(),
      admin
        .from("rider_national_championship_titles")
        .select("id", { count: "exact", head: true })
        .eq("rider_id", riderId),
    ]);
  assertQuery(riderResult.error, "le coureur");
  assertQuery(contractResult.error, "le contrat actuel du coureur");
  assertQuery(teamSeasonResult.error, "la nationalité actuelle de l’équipe");
  assertQuery(titleResult.error, "le palmarès national du coureur");
  if (!riderResult.data || !contractResult.data || !teamSeasonResult.data) {
    return null;
  }

  const contractsResult = await admin
    .from("rider_contracts")
    .select("start_season_id, end_season_id, joined_day_number")
    .eq("rider_id", riderId)
    .eq("team_id", teamId)
    .in("status", ["active", "completed"])
    .returns<ContractRow[]>();
  assertQuery(contractsResult.error, "l’ancienneté du coureur dans l’équipe");

  const seasonIds = [
    ...new Set(
      (contractsResult.data ?? []).flatMap((contract) => [
        contract.start_season_id,
        contract.end_season_id,
      ]),
    ),
  ];
  const seasonsResult = seasonIds.length
    ? await admin
        .from("seasons")
        .select("id, game_year, current_day_number")
        .in("id", seasonIds)
        .returns<SeasonRow[]>()
    : { data: [] as SeasonRow[], error: null };
  assertQuery(seasonsResult.error, "les saisons contractuelles du coureur");
  const gameYearBySeasonId = new Map(
    (seasonsResult.data ?? []).map((season) => [season.id, season.game_year]),
  );

  const contracts = (contractsResult.data ?? []).flatMap(
    (contract): ProfessionalContractTenure[] => {
      const startGameYear = gameYearBySeasonId.get(contract.start_season_id);
      const endGameYear = gameYearBySeasonId.get(contract.end_season_id);
      return startGameYear === undefined || endGameYear === undefined
        ? []
        : [
            {
              startGameYear,
              endGameYear,
              joinedDayNumber: contract.joined_day_number,
            },
          ];
    },
  );
  const currentContract = contracts.find(
    (contract) =>
      contract.startGameYear ===
        gameYearBySeasonId.get(contractResult.data!.start_season_id) &&
      contract.endGameYear ===
        gameYearBySeasonId.get(contractResult.data!.end_season_id) &&
      contract.joinedDayNumber === contractResult.data!.joined_day_number,
  );
  if (!currentContract) return null;

  const tenureStart = findContinuousProfessionalTenureStart({
    currentContract,
    contracts,
  });
  const elapsedDays = calculateInGameTenureDays({
    startGameYear: tenureStart.startGameYear,
    startDayNumber: tenureStart.joinedDayNumber,
    currentGameYear: seasonResult.data.game_year,
    currentDayNumber: seasonResult.data.current_day_number ?? 1,
  });

  const countryIds = [
    riderResult.data.country_id,
    teamSeasonResult.data.registration_country_id,
  ];
  const countriesResult = await admin
    .from("countries")
    .select("id, name, iso_alpha2")
    .in("id", countryIds)
    .returns<CountryRow[]>();
  assertQuery(countriesResult.error, "les nationalités de naturalisation");
  const countryById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country]),
  );
  const currentCountry = countryById.get(riderResult.data.country_id);
  const targetCountry = countryById.get(
    teamSeasonResult.data.registration_country_id,
  );
  if (!currentCountry || !targetCountry) return null;

  return evaluateNaturalizationEligibility({
    level: "professional",
    elapsedDays,
    currentCountry: toCountry(currentCountry),
    targetCountry: toCountry(targetCountry),
    hasNationalChampionshipTitle: (titleResult.count ?? 0) > 0,
  });
}

function toCountry(country: CountryRow) {
  return {
    id: country.id,
    name: country.name,
    code: country.iso_alpha2,
  };
}

function assertQuery(
  error: { message: string } | null,
  label: string,
): void {
  if (error) {
    throw new Error(`Impossible de charger ${label} : ${error.message}`);
  }
}
