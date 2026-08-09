import "server-only";

import { calculateRiderSeasonSalary } from "@/lib/game/economy";
import {
  resolveTeamContractRiderStatus,
  type TeamContractRiderStatus,
} from "@/lib/game/team-contract-management";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type TeamContractManagementRider = {
  id: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  countryName: string;
  avatarProfileKey: string | null;
  avatarSeed: number | string | null;
  age: number;
  overall: number;
  status: TeamContractRiderStatus;
  currentSalary: number;
  currentCurrency: string;
  currentContractEndSeasonName: string;
  nextSalary: number | null;
  nextCurrency: string;
  nextContractEndSeasonName: string | null;
};

export type TeamContractManagementOverview = {
  currentSeasonName: string;
  nextSeasonName: string;
  riders: TeamContractManagementRider[];
  eligibleCount: number;
  securedCount: number;
  leavingCount: number;
  estimatedRenewalPayroll: number;
  projectedNextPayroll: number;
  currency: string;
};

type DirectorRow = { id: string };
type AssignmentRow = { team_id: string };
type SeasonRow = {
  id: string;
  name: string;
  game_year: number;
};
type TeamSeasonRow = { currency: string };
type ContractRow = {
  id: string;
  rider_id: string;
  team_id: string;
  start_season_id: string;
  end_season_id: string;
  salary_per_season: number | string;
  currency_code: string;
  status: "active" | "planned";
};
type RiderRow = {
  id: string;
  country_id: string;
  first_name: string;
  last_name: string;
  avatar_profile_key: string | null;
  avatar_seed: number | string | null;
};
type RatingRow = {
  rider_id: string;
  age: number;
  mountain: number;
  hills: number;
  flat: number;
  time_trial: number;
  cobbles: number;
  sprint: number;
  acceleration: number;
  downhill: number;
  endurance: number;
  resistance: number;
  recovery: number;
  breakaway: number;
  prologue: number;
};
type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
};
type SummaryRow = {
  rider_id: string;
  season_id: string;
  points: number | string;
};

export async function getTeamContractManagementOverview(
  authUserId: string,
): Promise<TeamContractManagementOverview | null> {
  const admin = createSupabaseAdminClient();
  const { data: director, error: directorError } = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<DirectorRow>();
  assertQuery(directorError, "le Directeur Sportif");
  if (!director) return null;

  const [assignmentResult, seasonResult] = await Promise.all([
    admin
      .from("team_manager_assignments")
      .select("team_id")
      .eq("sporting_director_id", director.id)
      .eq("role", "general_manager")
      .eq("status", "active")
      .maybeSingle<AssignmentRow>(),
    admin
      .from("seasons")
      .select("id, name, game_year")
      .eq("status", "active")
      .maybeSingle<SeasonRow>(),
  ]);
  assertQuery(assignmentResult.error, "l’équipe du DS");
  assertQuery(seasonResult.error, "la saison active");
  if (!assignmentResult.data || !seasonResult.data) return null;

  const teamId = assignmentResult.data.team_id;
  const currentSeason = seasonResult.data;
  const [teamSeasonResult, activeContractsResult] = await Promise.all([
    admin
      .from("team_seasons")
      .select("currency")
      .eq("team_id", teamId)
      .eq("season_id", currentSeason.id)
      .maybeSingle<TeamSeasonRow>(),
    admin
      .from("rider_contracts")
      .select(
        "id, rider_id, team_id, start_season_id, end_season_id, salary_per_season, currency_code, status",
      )
      .eq("team_id", teamId)
      .eq("status", "active")
      .returns<ContractRow[]>(),
  ]);
  assertQuery(teamSeasonResult.error, "la saison de l’équipe");
  assertQuery(activeContractsResult.error, "les contrats actifs");

  const activeContracts = activeContractsResult.data ?? [];
  const currency = teamSeasonResult.data?.currency ?? "EUR";
  if (activeContracts.length === 0) {
    return {
      currentSeasonName: currentSeason.name,
      nextSeasonName: `Saison ${currentSeason.game_year + 1}`,
      riders: [],
      eligibleCount: 0,
      securedCount: 0,
      leavingCount: 0,
      estimatedRenewalPayroll: 0,
      projectedNextPayroll: 0,
      currency,
    };
  }

  const riderIds = [...new Set(activeContracts.map((row) => row.rider_id))];
  const [
    contractsResult,
    ridersResult,
    ratingsResult,
    countriesResult,
    seasonsResult,
    summariesResult,
  ] = await Promise.all([
    admin
      .from("rider_contracts")
      .select(
        "id, rider_id, team_id, start_season_id, end_season_id, salary_per_season, currency_code, status",
      )
      .in("rider_id", riderIds)
      .in("status", ["active", "planned"])
      .returns<ContractRow[]>(),
    admin
      .from("riders")
      .select(
        "id, country_id, first_name, last_name, avatar_profile_key, avatar_seed",
      )
      .in("id", riderIds)
      .returns<RiderRow[]>(),
    admin
      .from("rider_season_ratings")
      .select(
        "rider_id, age, mountain, hills, flat, time_trial, cobbles, sprint, acceleration, downhill, endurance, resistance, recovery, breakaway, prologue",
      )
      .eq("season_id", currentSeason.id)
      .in("rider_id", riderIds)
      .returns<RatingRow[]>(),
    admin
      .from("countries")
      .select("id, name, iso_alpha2")
      .returns<CountryRow[]>(),
    admin.from("seasons").select("id, name, game_year").returns<SeasonRow[]>(),
    admin
      .from("rider_season_summaries")
      .select("rider_id, season_id, points")
      .in("rider_id", riderIds)
      .returns<SummaryRow[]>(),
  ]);
  assertQuery(contractsResult.error, "l’historique contractuel");
  assertQuery(ridersResult.error, "les coureurs");
  assertQuery(ratingsResult.error, "les niveaux des coureurs");
  assertQuery(countriesResult.error, "les nationalités");
  assertQuery(seasonsResult.error, "les saisons contractuelles");
  assertQuery(summariesResult.error, "les bilans des coureurs");

  const seasons = seasonsResult.data ?? [];
  const seasonById = new Map(seasons.map((season) => [season.id, season]));
  const nextSeasonYear = currentSeason.game_year + 1;
  const nextSeason = seasons.find(
    (season) => season.game_year === nextSeasonYear,
  );
  const riderById = new Map(
    (ridersResult.data ?? []).map((rider) => [rider.id, rider]),
  );
  const ratingByRiderId = new Map(
    (ratingsResult.data ?? []).map((rating) => [rating.rider_id, rating]),
  );
  const countryById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country]),
  );
  const contractsByRiderId = groupByRiderId(contractsResult.data ?? []);
  const summariesByRiderId = groupByRiderId(summariesResult.data ?? []);

  const riders = activeContracts.flatMap((activeContract) => {
    const rider = riderById.get(activeContract.rider_id);
    const rating = ratingByRiderId.get(activeContract.rider_id);
    const country = rider ? countryById.get(rider.country_id) : null;
    if (!rider || !rating || !country) return [];

    const activeEndSeason = seasonById.get(activeContract.end_season_id);
    const activeEndYear = activeEndSeason?.game_year ?? currentSeason.game_year;
    const successor = (contractsByRiderId.get(rider.id) ?? [])
      .filter((contract) => contract.id !== activeContract.id)
      .find((contract) => {
        const startYear = seasonById.get(contract.start_season_id)?.game_year;
        const endYear = seasonById.get(contract.end_season_id)?.game_year;
        return (
          startYear !== undefined &&
          endYear !== undefined &&
          startYear <= nextSeasonYear &&
          endYear >= nextSeasonYear
        );
      });

    const status = resolveTeamContractRiderStatus({
      currentContractEndYear: activeEndYear,
      currentSeasonYear: currentSeason.game_year,
      currentTeamId: teamId,
      successorTeamId: successor?.team_id ?? null,
    });
    const overall = getOverall(rating);
    const previousSeasonUciPoints = Math.max(
      0,
      ...(summariesByRiderId.get(rider.id) ?? []).flatMap((summary) => {
        const summaryYear = seasonById.get(summary.season_id)?.game_year;
        return summaryYear !== undefined && summaryYear < nextSeasonYear
          ? [toNumber(summary.points)]
          : [];
      }),
    );
    const estimatedSalary = calculateRiderSeasonSalary({
      overall,
      previousSeasonUciPoints,
    });
    const currentSalary = toNumber(activeContract.salary_per_season);
    const nextSalary =
      status === "covered"
        ? currentSalary
        : status === "renewed"
          ? toNumber(successor?.salary_per_season)
          : status === "eligible"
            ? estimatedSalary
            : null;
    const nextContractEndSeasonName =
      status === "covered"
        ? activeEndSeason?.name ?? null
        : status === "renewed" && successor
          ? seasonById.get(successor.end_season_id)?.name ?? null
          : status === "eligible"
            ? nextSeason?.name ?? `Saison ${nextSeasonYear}`
            : null;

    return [
      {
        id: rider.id,
        firstName: rider.first_name,
        lastName: rider.last_name,
        countryCode: country.iso_alpha2,
        countryName: country.name,
        avatarProfileKey: rider.avatar_profile_key,
        avatarSeed: rider.avatar_seed,
        age: rating.age,
        overall,
        status,
        currentSalary,
        currentCurrency: activeContract.currency_code || currency,
        currentContractEndSeasonName:
          activeEndSeason?.name ?? currentSeason.name,
        nextSalary,
        nextCurrency: successor?.currency_code || currency,
        nextContractEndSeasonName,
      } satisfies TeamContractManagementRider,
    ];
  });

  riders.sort(
    (left, right) =>
      statusOrder(left.status) - statusOrder(right.status) ||
      left.lastName.localeCompare(right.lastName, "fr") ||
      left.firstName.localeCompare(right.firstName, "fr"),
  );

  return {
    currentSeasonName: currentSeason.name,
    nextSeasonName: nextSeason?.name ?? `Saison ${nextSeasonYear}`,
    riders,
    eligibleCount: riders.filter((rider) => rider.status === "eligible").length,
    securedCount: riders.filter(
      (rider) => rider.status === "renewed" || rider.status === "covered",
    ).length,
    leavingCount: riders.filter((rider) => rider.status === "leaving").length,
    estimatedRenewalPayroll: riders.reduce(
      (total, rider) =>
        total + (rider.status === "eligible" ? (rider.nextSalary ?? 0) : 0),
      0,
    ),
    projectedNextPayroll: riders.reduce(
      (total, rider) => total + (rider.nextSalary ?? 0),
      0,
    ),
    currency,
  };
}

function groupByRiderId<T extends { rider_id: string }>(rows: T[]) {
  const result = new Map<string, T[]>();
  for (const row of rows) {
    result.set(row.rider_id, [...(result.get(row.rider_id) ?? []), row]);
  }
  return result;
}

function getOverall(rating: RatingRow) {
  const values = [
    rating.mountain,
    rating.hills,
    rating.flat,
    rating.time_trial,
    rating.cobbles,
    rating.sprint,
    rating.acceleration,
    rating.downhill,
    rating.endurance,
    rating.resistance,
    rating.recovery,
    rating.breakaway,
    rating.prologue,
  ];
  return (
    Math.round(
      (values.reduce((total, value) => total + value, 0) / values.length) * 10,
    ) / 10
  );
}

function statusOrder(status: TeamContractRiderStatus) {
  if (status === "eligible") return 0;
  if (status === "renewed") return 1;
  if (status === "covered") return 2;
  return 3;
}

function toNumber(value: number | string | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function assertQuery(
  error: { message: string } | null,
  label: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${label} : ${error.message}`);
  }
}
