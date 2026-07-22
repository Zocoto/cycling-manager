import "server-only";

import { randomInt } from "node:crypto";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  generateRiderIdentities,
  hasRiderNameLibrary,
} from "@/lib/rider-names/generate-rider-identities";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  calculateMinimumNextBid,
  calculateWeeklySalary,
} from "@/lib/game/transfer-market";
import {
  getRiderSportingProfile,
  type RiderRatings,
} from "@/lib/game/rider-profile";
import {
  createExactTransferScoutingReport,
  createStandardTransferScoutingReport,
  getScoutedNumericSortValue,
  scoutedValueCouldMeetMinimum,
  type TransferScoutingReport,
} from "@/lib/game/transfer-scouting";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type DirectorRow = { id: string };
type AssignmentRow = { team_id: string };
type SeasonRow = {
  id: string;
  name: string;
  game_year: number;
  current_day_number: number | null;
};
type TeamSeasonRow = {
  id: string;
  team_id: string;
  display_name: string;
  cash_balance: number | string;
  currency: string;
};
type ListingRow = {
  id: string;
  rider_id: string;
  season_id: string;
  listing_type: "daily" | "director";
  seller_team_id: string | null;
  market_date: string | null;
  daily_slot: number | null;
  minimum_bid: number | string;
  salary_per_season: number | string;
  currency_code: string;
  opens_at: string;
  closes_at: string;
  status: "open" | "settled" | "no_bid" | "cancelled";
  winning_team_id: string | null;
  winning_bid: number | string | null;
  settled_at: string | null;
  created_at: string;
};
type BidRow = {
  id: string;
  listing_id: string;
  team_id: string;
  amount: number | string;
  created_at: string;
};
type RiderRow = {
  id: string;
  country_id: string;
  first_name: string;
  last_name: string;
  status: string;
  avatar_profile_key: string;
  avatar_seed: number | string;
  potential_steps: number;
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
type CountryRow = { id: string; name: string; iso_alpha2: string; is_active: boolean };
type GenerationProfileRow = { country_id: string; name_profile_code: string };
type ContractRow = {
  rider_id: string;
  team_id: string;
  end_season_id: string;
  salary_per_season: number | string;
  transfer_locked_season_id: string | null;
  status: "active" | "planned";
};
type FinanceRow = { amount: number | string };

export type TransferMarketRider = {
  id: string;
  firstName: string;
  lastName: string;
  countryName: string;
  countryCode: string;
  avatarProfileKey: string;
  avatarSeed: number | string;
  age: number;
  profileLabel: string;
  salaryPerSeason: number;
  scoutingReport: TransferScoutingReport;
};

export type TransferRosterRider = {
  id: string;
  firstName: string;
  lastName: string;
  overall: number;
};

export type TransferMarketListing = {
  id: string;
  type: "daily" | "director";
  status: ListingRow["status"];
  sellerTeamId: string | null;
  sellerTeamName: string | null;
  minimumBid: number;
  currentBid: number | null;
  minimumNextBid: number;
  bidCount: number;
  leaderTeamName: string | null;
  ownBid: number | null;
  isOwnTeamLeading: boolean;
  salaryPerSeason: number;
  salaryPerWeek: number;
  currency: string;
  opensAt: string;
  closesAt: string;
  rider: TransferMarketRider;
};

export type TransferRosterCandidate = {
  rider: TransferRosterRider;
  currentSalary: number;
  currency: string;
  recommendedPrice: number;
  canList: boolean;
  listBlockedReason: string | null;
  canRenew: boolean;
  renewalSalary: number;
};

type LoadedMarketRider = TransferRosterRider & {
  countryName: string;
  countryCode: string;
  avatarProfileKey: string;
  avatarSeed: number | string;
  age: number;
  potentialSteps: number;
  ratings: RiderRatings;
  profileLabel: string;
};

export type TransferMarketFilters = {
  search?: string;
  country?: string;
  minimumAge?: number;
  maximumAge?: number;
  rating?: keyof RiderRatings | "overall";
  minimumRating?: number;
};

export type TransferMarketOverview = {
  teamId: string;
  teamName: string;
  seasonId: string;
  seasonName: string;
  currentDayNumber: number;
  currency: string;
  projectedBudget: number;
  reservedBudget: number;
  availableBudget: number;
  marketDate: string;
  dailyListings: TransferMarketListing[];
  directorListings: TransferMarketListing[];
  freeAgents: TransferMarketRider[];
  countries: Array<{ name: string; code: string }>;
  roster: TransferRosterCandidate[];
};

export type RiderTransferManagement = {
  isFreeAgent: boolean;
  canSignFreeAgent: boolean;
  freeAgentSalary: number | null;
  freeAgentWeeklySalary: number | null;
  freeAgentBlockedReason: string | null;
  canRenew: boolean;
  renewalSalary: number | null;
  hasPlannedRenewal: boolean;
};

export async function getTransferMarketOverview(
  supabase: SupabaseServerClient,
  authUserId: string,
  filters: TransferMarketFilters = {}
): Promise<TransferMarketOverview | null> {
  const admin = createSupabaseAdminClient();
  const [financeSettlement, context] = await Promise.all([
    supabase.rpc("settle_current_team_finances"),
    loadCurrentContext(admin, authUserId),
    prepareCurrentTransferMarket(admin),
  ]);

  if (financeSettlement.error) {
    throw new Error(`Impossible d’actualiser les finances : ${financeSettlement.error.message}`);
  }

  if (!context) return null;

  const marketDate = formatParisDate(new Date());
  const [
    listingsResult,
    bidsResult,
    contractsResult,
    transactionsResult,
    countriesResult,
    freeAgentResult,
    seasonYears,
  ] =
    await Promise.all([
      admin
        .from("transfer_market_listings")
        .select("id, rider_id, season_id, listing_type, seller_team_id, market_date, daily_slot, minimum_bid, salary_per_season, currency_code, opens_at, closes_at, status, winning_team_id, winning_bid, settled_at, created_at")
        .eq("season_id", context.season.id)
        .or(`status.eq.open,and(listing_type.eq.daily,market_date.eq.${marketDate})`)
        .order("closes_at", { ascending: true })
        .returns<ListingRow[]>(),
      admin
        .from("transfer_market_bids")
        .select("id, listing_id, team_id, amount, created_at")
        .order("amount", { ascending: false })
        .order("created_at", { ascending: true })
        .returns<BidRow[]>(),
      admin
        .from("rider_contracts")
        .select("rider_id, team_id, end_season_id, salary_per_season, transfer_locked_season_id, status")
        .eq("team_id", context.teamSeason.team_id)
        .in("status", ["active", "planned"])
        .returns<ContractRow[]>(),
      admin
        .from("team_finance_transactions")
        .select("amount")
        .eq("team_season_id", context.teamSeason.id)
        .eq("status", "pending")
        .returns<FinanceRow[]>(),
      admin
        .from("countries")
        .select("id, name, iso_alpha2, is_active")
        .eq("is_active", true)
        .order("name")
        .returns<CountryRow[]>(),
      admin
        .from("riders")
        .select("id")
        .eq("status", "free_agent")
        .limit(500)
        .returns<Array<{ id: string }>>(),
      loadSeasonYears(admin),
    ]);

  assertQuery(listingsResult.error, "les enchères");
  assertQuery(bidsResult.error, "les offres");
  assertQuery(contractsResult.error, "les contrats de l’effectif");
  assertQuery(transactionsResult.error, "le budget projeté");
  assertQuery(countriesResult.error, "les nationalités");
  assertQuery(freeAgentResult.error, "les agents libres");

  const listings = listingsResult.data ?? [];
  const bids = bidsResult.data ?? [];
  const activeContracts = (contractsResult.data ?? []).filter(
    (contract) => contract.status === "active"
  );
  const riderIds = new Set(listings.map((listing) => listing.rider_id));
  activeContracts.forEach((contract) => riderIds.add(contract.rider_id));

  const freeAgentRows = freeAgentResult.data ?? [];
  (freeAgentRows ?? []).forEach((rider) => riderIds.add(rider.id));

  const [riders, teams] = await Promise.all([
    loadMarketRiders(
      admin,
      [...riderIds],
      context.season.id,
      countriesResult.data ?? []
    ),
    loadTeamNames(
      admin,
      [
        ...new Set(
          listings.flatMap((listing) => [listing.seller_team_id, listing.winning_team_id])
            .concat(bids.map((bid) => bid.team_id))
            .filter((value): value is string => Boolean(value))
        ),
      ],
      context.season.id
    ),
  ]);

  const riderById = new Map(riders.map((rider) => [rider.id, rider]));
  const bidGroups = groupBids(bids);
  const teamNames = new Map(teams.map((team) => [team.id, team.name]));
  const mappedListings = listings.flatMap((listing) => {
    const rider = riderById.get(listing.rider_id);
    if (!rider) return [];
    const listingBids = bidGroups.get(listing.id) ?? [];
    const leader = listingBids[0] ?? null;
    const ownBid = listingBids
      .filter((bid) => bid.team_id === context.teamSeason.team_id)
      .reduce((maximum, bid) => Math.max(maximum, toNumber(bid.amount)), 0);
    const currentBid = leader ? toNumber(leader.amount) : null;

    return [{
      id: listing.id,
      type: listing.listing_type,
      status: listing.status,
      sellerTeamId: listing.seller_team_id,
      sellerTeamName: listing.seller_team_id
        ? teamNames.get(listing.seller_team_id) ?? "Équipe inconnue"
        : null,
      minimumBid: toNumber(listing.minimum_bid),
      currentBid,
      minimumNextBid: currentBid === null
        ? toNumber(listing.minimum_bid)
        : calculateMinimumNextBid(currentBid),
      bidCount: listingBids.length,
      leaderTeamName: leader ? teamNames.get(leader.team_id) ?? "Équipe inconnue" : null,
      ownBid: ownBid > 0 ? ownBid : null,
      isOwnTeamLeading: leader?.team_id === context.teamSeason.team_id,
      salaryPerSeason: toNumber(listing.salary_per_season),
      salaryPerWeek: calculateWeeklySalary(toNumber(listing.salary_per_season)),
      currency: listing.currency_code,
      opensAt: listing.opens_at,
      closesAt: listing.closes_at,
      rider: toTransferMarketRider({
        rider,
        seasonId: context.season.id,
        revealExactValues:
          listing.seller_team_id === context.teamSeason.team_id,
      }),
    } satisfies TransferMarketListing];
  });

  const openListingRiderIds = new Set(
    listings.filter((listing) => listing.status === "open").map((listing) => listing.rider_id)
  );
  const freeAgentIds = new Set(freeAgentRows.map((row) => row.id));
  const freeAgents = applyFreeAgentFilters(
    riders
      .filter(
        (rider) =>
          freeAgentIds.has(rider.id) && !openListingRiderIds.has(rider.id)
      )
      .map((rider) =>
        toTransferMarketRider({
          rider,
          seasonId: context.season.id,
          revealExactValues: false,
        })
      ),
    filters
  );
  const pendingTotal = (transactionsResult.data ?? []).reduce(
    (total, transaction) => total + toNumber(transaction.amount),
    0
  );
  const projectedBudget = Math.max(0, toNumber(context.teamSeason.cash_balance) + pendingTotal);
  const openListingIds = new Set(
    listings.filter((listing) => listing.status === "open").map((listing) => listing.id)
  );
  const leadingByListing = [...bidGroups.entries()]
    .filter(([listingId]) => openListingIds.has(listingId))
    .flatMap(([, group]) => group[0] ? [group[0]] : []);
  const reservedBudget = leadingByListing
    .filter((bid) => bid.team_id === context.teamSeason.team_id)
    .reduce((total, bid) => {
      const listing = mappedListings.find((candidate) => candidate.id === bid.listing_id);
      return total + toNumber(bid.amount) + (listing?.salaryPerSeason ?? 0);
    }, 0);
  const plannedRiderIds = new Set(
    (contractsResult.data ?? [])
      .filter((contract) => contract.status === "planned")
      .map((contract) => contract.rider_id)
  );
  const currentSeasonYear = context.season.game_year;
  return {
    teamId: context.teamSeason.team_id,
    teamName: context.teamSeason.display_name,
    seasonId: context.season.id,
    seasonName: context.season.name,
    currentDayNumber: context.season.current_day_number ?? 1,
    currency: context.teamSeason.currency,
    projectedBudget,
    reservedBudget,
    availableBudget: Math.max(0, projectedBudget - reservedBudget),
    marketDate,
    dailyListings: mappedListings.filter((listing) => listing.type === "daily"),
    directorListings: mappedListings.filter((listing) => listing.type === "director"),
    freeAgents,
    countries: (countriesResult.data ?? []).map((country) => ({
      name: country.name,
      code: country.iso_alpha2,
    })),
    roster: activeContracts.flatMap((contract) => {
      const rider = riderById.get(contract.rider_id);
      if (!rider) return [];
      const listed = openListingRiderIds.has(rider.id);
      const locked = contract.transfer_locked_season_id === context.season.id;
      const endYear = seasonYears.get(contract.end_season_id) ?? currentSeasonYear;
      const renewalSalary = rider.overall < 60 ? 0 : calculateSalaryApproximation(rider.overall);

      return [{
        rider: {
          id: rider.id,
          firstName: rider.firstName,
          lastName: rider.lastName,
          overall: rider.overall,
        },
        currentSalary: toNumber(contract.salary_per_season),
        currency: context.teamSeason.currency,
        recommendedPrice: Math.max(500, Math.round((rider.overall - 35) ** 2 * 110 / 500) * 500),
        canList: !listed && !locked,
        listBlockedReason: listed
          ? "Déjà proposé sur le marché"
          : locked
            ? "Recruté cette saison : revente impossible"
            : null,
        canRenew: endYear <= currentSeasonYear && !plannedRiderIds.has(rider.id),
        renewalSalary,
      } satisfies TransferRosterCandidate];
    }),
  };
}

export async function getRiderTransferManagement(
  authUserId: string,
  riderId: string
): Promise<RiderTransferManagement | null> {
  const admin = createSupabaseAdminClient();
  const context = await loadCurrentContext(admin, authUserId);
  if (!context) return null;

  const [riderResult, ratingResult, contractsResult, listingResult] = await Promise.all([
    admin.from("riders").select("id, status").eq("id", riderId).maybeSingle<{ id: string; status: string }>(),
    admin
      .from("rider_season_ratings")
      .select("mountain, hills, flat, time_trial, cobbles, sprint, acceleration, downhill, endurance, resistance, recovery, breakaway, prologue")
      .eq("rider_id", riderId)
      .eq("season_id", context.season.id)
      .maybeSingle<Omit<RatingRow, "rider_id" | "age">>(),
    admin
      .from("rider_contracts")
      .select("rider_id, team_id, end_season_id, salary_per_season, transfer_locked_season_id, status")
      .eq("rider_id", riderId)
      .in("status", ["active", "planned"])
      .returns<ContractRow[]>(),
    admin
      .from("transfer_market_listings")
      .select("id")
      .eq("rider_id", riderId)
      .eq("status", "open")
      .maybeSingle<{ id: string }>(),
  ]);
  assertQuery(riderResult.error, "le statut du coureur");
  assertQuery(ratingResult.error, "le niveau du coureur");
  assertQuery(contractsResult.error, "les contrats du coureur");
  assertQuery(listingResult.error, "la disponibilité du coureur");
  if (!riderResult.data || !ratingResult.data) return null;

  const ratings = toRatings(ratingResult.data);
  const overall = calculateOverall(ratings);
  const contracts = contractsResult.data ?? [];
  const activeContract = contracts.find((contract) => contract.status === "active") ?? null;
  const ownsRider = activeContract?.team_id === context.teamSeason.team_id;
  const hasPlannedRenewal = contracts.some(
    (contract) => contract.status === "planned" && contract.team_id === context.teamSeason.team_id
  );
  const seasonYears = await loadSeasonYears(admin);
  const canRenew = Boolean(
    ownsRider && activeContract &&
    (seasonYears.get(activeContract.end_season_id) ?? context.season.game_year) <= context.season.game_year &&
    !hasPlannedRenewal
  );
  const salary = calculateSalaryApproximation(overall);
  const isFreeAgent = riderResult.data.status === "free_agent" && !activeContract;

  return {
    isFreeAgent,
    canSignFreeAgent: isFreeAgent && !listingResult.data,
    freeAgentSalary: isFreeAgent ? salary : null,
    freeAgentWeeklySalary: isFreeAgent ? calculateWeeklySalary(salary) : null,
    freeAgentBlockedReason: isFreeAgent && listingResult.data
      ? "Ce coureur est encore engagé dans une enchère."
      : null,
    canRenew,
    renewalSalary: ownsRider ? (overall < 60 ? 0 : salary) : null,
    hasPlannedRenewal,
  };
}

async function ensureTodayDailyMarket(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const marketDate = formatParisDate(new Date());
  const { data: batch, error: batchError } = await admin
    .from("transfer_daily_batches")
    .select("id")
    .eq("market_date", marketDate)
    .maybeSingle<{ id: string }>();
  assertQuery(batchError, "la génération quotidienne");
  if (batch || getParisHour(new Date()) < 9) return;

  const [countriesResult, profilesResult] = await Promise.all([
    admin
      .from("countries")
      .select("id, name, iso_alpha2, is_active")
      .eq("is_active", true)
      .returns<CountryRow[]>(),
    admin
      .from("country_rider_generation_profiles")
      .select("country_id, name_profile_code")
      .returns<GenerationProfileRow[]>(),
  ]);
  assertQuery(countriesResult.error, "les pays de génération");
  assertQuery(profilesResult.error, "les profils de noms");
  const profileByCountry = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.country_id, profile.name_profile_code])
  );
  const candidates = (countriesResult.data ?? []).filter((country) => {
    const code = profileByCountry.get(country.id);
    return Boolean(code && hasRiderNameLibrary(code));
  });
  const selectedCountries = selectRandomDistinct(candidates, 5);
  const selectionsByProfile = new Map<string, CountryRow[]>();
  for (const country of selectedCountries) {
    const code = profileByCountry.get(country.id)!;
    selectionsByProfile.set(code, [...(selectionsByProfile.get(code) ?? []), country]);
  }
  const identities: Array<{ country_id: string; first_name: string; last_name: string }> = [];
  for (const [profileCode, countries] of selectionsByProfile) {
    const generated = generateRiderIdentities(profileCode, countries.length);
    generated.forEach((identity, index) => identities.push({
      country_id: countries[index]!.id,
      first_name: identity.first_name,
      last_name: identity.last_name,
    }));
  }
  shuffle(identities);

  const { error } = await admin.rpc("create_daily_transfer_market", {
    p_market_date: marketDate,
    p_rider_identities: identities,
    p_force: false,
  });
  assertQuery(error, "les cinq coureurs du marché quotidien");
}

async function prepareCurrentTransferMarket(
  admin: ReturnType<typeof createSupabaseAdminClient>
) {
  const { error: marketSettlementError } = await admin.rpc(
    "settle_transfer_market"
  );
  assertQuery(marketSettlementError, "les enchères arrivées à échéance");

  await ensureTodayDailyMarket(admin);

  const { error: secondSettlementError } = await admin.rpc(
    "settle_transfer_market"
  );
  assertQuery(secondSettlementError, "la clôture du marché quotidien");
}

async function loadCurrentContext(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  authUserId: string
) {
  const { data: director, error: directorError } = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<DirectorRow>();
  assertQuery(directorError, "le Directeur Sportif");
  if (!director) return null;
  const [{ data: assignment, error: assignmentError }, { data: season, error: seasonError }] =
    await Promise.all([
      admin
        .from("team_manager_assignments")
        .select("team_id")
        .eq("sporting_director_id", director.id)
        .eq("role", "general_manager")
        .eq("status", "active")
        .maybeSingle<AssignmentRow>(),
      admin
        .from("seasons")
        .select("id, name, game_year, current_day_number")
        .eq("status", "active")
        .maybeSingle<SeasonRow>(),
    ]);
  assertQuery(assignmentError, "l’équipe du DS");
  assertQuery(seasonError, "la saison active");
  if (!assignment || !season) return null;
  const { data: teamSeason, error: teamSeasonError } = await admin
    .from("team_seasons")
    .select("id, team_id, display_name, cash_balance, currency")
    .eq("team_id", assignment.team_id)
    .eq("season_id", season.id)
    .maybeSingle<TeamSeasonRow>();
  assertQuery(teamSeasonError, "la saison de l’équipe");
  if (!teamSeason) return null;
  return { director, season, teamSeason };
}

async function loadMarketRiders(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  riderIds: string[],
  seasonId: string,
  countries: CountryRow[]
): Promise<LoadedMarketRider[]> {
  if (riderIds.length === 0) return [];
  const [ridersResult, ratingsResult] = await Promise.all([
    admin
      .from("riders")
      .select("id, country_id, first_name, last_name, status, avatar_profile_key, avatar_seed, potential_steps")
      .in("id", riderIds)
      .returns<RiderRow[]>(),
    admin
      .from("rider_season_ratings")
      .select("rider_id, age, mountain, hills, flat, time_trial, cobbles, sprint, acceleration, downhill, endurance, resistance, recovery, breakaway, prologue")
      .eq("season_id", seasonId)
      .in("rider_id", riderIds)
      .returns<RatingRow[]>(),
  ]);
  assertQuery(ridersResult.error, "les coureurs du marché");
  assertQuery(ratingsResult.error, "leurs caractéristiques");
  const ratingByRider = new Map((ratingsResult.data ?? []).map((rating) => [rating.rider_id, rating]));
  const countryById = new Map(countries.map((country) => [country.id, country]));

  return (ridersResult.data ?? []).flatMap((rider) => {
    const rating = ratingByRider.get(rider.id);
    const country = countryById.get(rider.country_id);
    if (!rating || !country) return [];
    const ratings = toRatings(rating);
    return [{
      id: rider.id,
      firstName: rider.first_name,
      lastName: rider.last_name,
      countryName: country.name,
      countryCode: country.iso_alpha2,
      avatarProfileKey: rider.avatar_profile_key,
      avatarSeed: rider.avatar_seed,
      age: rating.age,
      overall: calculateOverall(ratings),
      potentialSteps: rider.potential_steps,
      ratings,
      profileLabel: getRiderSportingProfile(ratings),
    } satisfies LoadedMarketRider];
  });
}

async function loadTeamNames(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  teamIds: string[],
  seasonId: string
) {
  if (teamIds.length === 0) return [];
  const { data, error } = await admin
    .from("team_seasons")
    .select("team_id, display_name")
    .eq("season_id", seasonId)
    .in("team_id", teamIds)
    .returns<Array<{ team_id: string; display_name: string }>>();
  assertQuery(error, "les équipes du marché");
  return (data ?? []).map((team) => ({ id: team.team_id, name: team.display_name }));
}

async function loadSeasonYears(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data, error } = await admin.from("seasons").select("id, game_year").returns<Array<{ id: string; game_year: number }>>();
  assertQuery(error, "les saisons contractuelles");
  return new Map((data ?? []).map((season) => [season.id, season.game_year]));
}

function groupBids(bids: BidRow[]) {
  const groups = new Map<string, BidRow[]>();
  for (const bid of bids) groups.set(bid.listing_id, [...(groups.get(bid.listing_id) ?? []), bid]);
  for (const group of groups.values()) {
    group.sort((left, right) => toNumber(right.amount) - toNumber(left.amount) || left.created_at.localeCompare(right.created_at));
  }
  return groups;
}

function applyFreeAgentFilters(riders: TransferMarketRider[], filters: TransferMarketFilters) {
  const search = filters.search?.trim().toLocaleLowerCase("fr") ?? "";
  return riders
    .filter((rider) => !search || `${rider.firstName} ${rider.lastName}`.toLocaleLowerCase("fr").includes(search))
    .filter((rider) => !filters.country || rider.countryCode === filters.country)
    .filter((rider) => filters.minimumAge === undefined || rider.age >= filters.minimumAge)
    .filter((rider) => filters.maximumAge === undefined || rider.age <= filters.maximumAge)
    .filter((rider) => {
      if (!filters.rating || filters.minimumRating === undefined) return true;
      const scoutedValue =
        filters.rating === "overall"
          ? rider.scoutingReport.overall
          : rider.scoutingReport.ratings[filters.rating];
      return scoutedValueCouldMeetMinimum(
        scoutedValue,
        filters.minimumRating
      );
    })
    .sort(
      (left, right) =>
        getScoutedNumericSortValue(right.scoutingReport.overall) -
          getScoutedNumericSortValue(left.scoutingReport.overall) ||
        left.lastName.localeCompare(right.lastName, "fr")
    );
}

function toTransferMarketRider({
  rider,
  seasonId,
  revealExactValues,
}: {
  rider: LoadedMarketRider;
  seasonId: string;
  revealExactValues: boolean;
}): TransferMarketRider {
  return {
    id: rider.id,
    firstName: rider.firstName,
    lastName: rider.lastName,
    countryName: rider.countryName,
    countryCode: rider.countryCode,
    avatarProfileKey: rider.avatarProfileKey,
    avatarSeed: rider.avatarSeed,
    age: rider.age,
    profileLabel: rider.profileLabel,
    salaryPerSeason: calculateSalaryApproximation(rider.overall),
    scoutingReport: revealExactValues
      ? createExactTransferScoutingReport({
          ratings: rider.ratings,
          potentialSteps: rider.potentialSteps,
        })
      : createStandardTransferScoutingReport({
          riderId: rider.id,
          seasonId,
          ratings: rider.ratings,
          potentialSteps: rider.potentialSteps,
        }),
  };
}

function toRatings(row: Omit<RatingRow, "rider_id" | "age">): RiderRatings {
  return {
    mountain: row.mountain,
    hills: row.hills,
    flat: row.flat,
    timeTrial: row.time_trial,
    cobbles: row.cobbles,
    sprint: row.sprint,
    acceleration: row.acceleration,
    downhill: row.downhill,
    endurance: row.endurance,
    resistance: row.resistance,
    recovery: row.recovery,
    breakaway: row.breakaway,
    prologue: row.prologue,
  };
}

function calculateOverall(ratings: RiderRatings) {
  const values = Object.values(ratings);
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function calculateSalaryApproximation(overall: number) {
  const talentFactor = Math.max(0, (overall - 45) / 55);
  return Math.round(Math.min(150_000, 2_500 + talentFactor ** 2 * 100_000) / 100) * 100;
}

function formatParisDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function getParisHour(date: Date) {
  return Number(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(date));
}

function selectRandomDistinct<T>(values: T[], count: number) {
  if (values.length < count) throw new Error("Pas assez de pays pour générer le marché quotidien.");
  const copy = [...values];
  for (let index = 0; index < count; index += 1) {
    const selectedIndex = randomInt(index, copy.length);
    [copy[index], copy[selectedIndex]] = [copy[selectedIndex]!, copy[index]!];
  }
  return copy.slice(0, count);
}

function shuffle<T>(values: T[]) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const selectedIndex = randomInt(0, index + 1);
    [values[index], values[selectedIndex]] = [values[selectedIndex]!, values[index]!];
  }
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function assertQuery(error: { message: string } | null, resource: string): asserts error is null {
  if (error) throw new Error(`Impossible de charger ${resource} : ${error.message}`);
}
