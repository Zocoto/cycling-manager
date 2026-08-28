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
  DAILY_TRANSFER_RIDER_COUNT,
  type TransferContractFilter,
  type TransferRiderProfileFilter,
} from "@/lib/game/transfer-market";
import {
  getFeaturedNationalDaysForMarketDate,
  NATIONAL_DAY_BONUS_RIDER_COUNT,
} from "@/lib/game/national-days";
import { calculateRiderSeasonSalary } from "@/lib/game/economy";
import {
  getRiderSportingProfile,
  type RiderRatings,
  type RiderSportingProfile,
} from "@/lib/game/rider-profile";
import {
  isTeamRosterAtCapacity,
  MAX_TEAM_ROSTER_SIZE,
} from "@/lib/game/team-roster-capacity";
import {
  canRenewCurrentTeamRiderContract,
  resolveEffectiveTeamContractEndYear,
} from "@/lib/game/team-contract-management";
import {
  createExactTransferScoutingReport,
  createStandardTransferScoutingReport,
  type TransferScoutingReport,
} from "@/lib/game/transfer-scouting";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

const RIDER_SEARCH_PAGE_SIZE = 48;

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
  is_national_day_bonus: boolean;
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
type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
  is_active: boolean;
};
type GenerationProfileRow = { country_id: string; name_profile_code: string };
type ContractRow = {
  id: string;
  rider_id: string;
  team_id: string;
  start_season_id: string;
  end_season_id: string;
  salary_per_season: number | string;
  transfer_locked_season_id: string | null;
  status: "active" | "planned";
};
type FinanceRow = { amount: number | string };
type DirectOfferRow = {
  id: string;
  season_id: string;
  rider_id: string;
  buyer_team_id: string;
  seller_team_id: string;
  offered_amount: number | string;
  salary_per_season: number | string;
  currency_code: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
  responded_at: string | null;
};
type SalaryQuoteRow = {
  rider_id: string;
  salary_per_season: number | string;
};
type RiderSearchRow = {
  rider_id: string;
  team_id: string | null;
  team_name: string | null;
  total_count: number | string;
};

export type TransferMarketRider = {
  id: string;
  firstName: string;
  lastName: string;
  countryName: string;
  countryCode: string;
  avatarProfileKey: string;
  avatarSeed: number | string;
  age: number;
  profileLabel: RiderSportingProfile;
  salaryPerSeason: number;
  scoutingReport: TransferScoutingReport;
};

export type TransferRiderSearchResult = TransferMarketRider & {
  contractStatus: TransferContractFilter;
  teamId: string | null;
  teamName: string | null;
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
  isNationalDayBonus: boolean;
  minimumBid: number;
  currentBid: number | null;
  minimumNextBid: number;
  bidCount: number;
  leaderTeamName: string | null;
  leaderTeamId: string | null;
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
  profileLabel: RiderSportingProfile;
};

export type TransferMarketFilters = {
  contractStatus?: TransferContractFilter;
  profile?: TransferRiderProfileFilter;
  country?: string;
  minimumAge?: number;
  maximumAge?: number;
  rating?: keyof RiderRatings | "overall";
  minimumRating?: number;
  page?: number;
};

export type TransferMarketOverview = {
  teamId: string;
  teamName: string;
  seasonId: string;
  seasonName: string;
  currentDayNumber: number;
  currency: string;
  cashBalance: number;
  projectedBudget: number;
  reservedBudget: number;
  availableBudget: number;
  dataRoomLevel: number;
  rosterSize: number;
  rosterLimit: number;
  rosterIsFull: boolean;
  marketDate: string;
  nationalDayFeatures: Array<{
    countryName: string;
    countryCode: string;
    bonusRiderCount: number;
    isExceptionalOverride: boolean;
  }>;
  dailyListings: TransferMarketListing[];
  directorListings: TransferMarketListing[];
  riderSearchResults: TransferRiderSearchResult[];
  riderSearchTotal: number;
  riderSearchPage: number;
  riderSearchPageSize: number;
  countries: Array<{ name: string; code: string }>;
  roster: TransferRosterCandidate[];
  directOffers: DirectTransferOffer[];
};

export type DirectTransferOffer = {
  id: string;
  amount: number;
  salaryPerSeason: number;
  currency: string;
  status: DirectOfferRow["status"];
  createdAt: string;
  respondedAt: string | null;
  buyerTeamId: string;
  buyerTeamName: string;
  rider: TransferRosterRider;
};

export type TransferMarketOverviewOptions = {
  includeDirectOffers?: boolean;
  includeRiderSearch?: boolean;
  includeRoster?: boolean;
};

export type RiderTransferManagement = {
  isFreeAgent: boolean;
  canSignFreeAgent: boolean;
  freeAgentSalary: number | null;
  freeAgentWeeklySalary: number | null;
  freeAgentBlockedReason: string | null;
  canRenew: boolean;
  rosterSize: number;
  rosterLimit: number;
  rosterIsFull: boolean;
  renewalSalary: number | null;
  contractEndSeasonYear: number | null;
  ownsRider: boolean;
  canDismiss: boolean;
  dismissalCost: number | null;
  dismissalCurrency: string;
  canMakeDirectOffer: boolean;
  directOfferSalary: number | null;
  directOfferBlockedReason: string | null;
  pendingDirectOfferAmount: number | null;
  availableBudget: number;
  cashBalance: number;
  currency: string;
};

export async function getTransferMarketOverview(
  supabase: SupabaseServerClient,
  authUserId: string,
  filters: TransferMarketFilters = {},
  options: TransferMarketOverviewOptions = {},
): Promise<TransferMarketOverview | null> {
  const admin = createSupabaseAdminClient();
  const context = await loadCurrentContext(admin, authUserId);

  if (!context) return null;

  const marketDate = formatParisDate(new Date());
  const [
    listingsResult,
    contractsResult,
    transactionsResult,
    countriesResult,
    riderSearchResult,
    seasonYears,
    dataRoomResult,
    pendingDirectOffersResult,
    receivedDirectOffersResult,
  ] = await Promise.all([
    admin
      .from("transfer_market_listings")
      .select(
        "id, rider_id, season_id, listing_type, seller_team_id, market_date, daily_slot, is_national_day_bonus, minimum_bid, salary_per_season, currency_code, opens_at, closes_at, status, winning_team_id, winning_bid, settled_at, created_at",
      )
      .eq("season_id", context.season.id)
      .or(
        `status.eq.open,and(listing_type.eq.daily,market_date.eq.${marketDate})`,
      )
      .order("closes_at", { ascending: true })
      .returns<ListingRow[]>(),
    admin
      .from("rider_contracts")
      .select(
        "id, rider_id, team_id, start_season_id, end_season_id, salary_per_season, transfer_locked_season_id, status",
      )
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
    options.includeRiderSearch
      ? admin
          .rpc("search_transfer_riders", {
            p_season_id: context.season.id,
            p_contract_status: filters.contractStatus ?? "all",
            p_country_code: filters.country || null,
            p_minimum_age: filters.minimumAge ?? null,
            p_maximum_age: filters.maximumAge ?? null,
            p_rating: filters.rating ?? "overall",
            p_minimum_rating: filters.minimumRating ?? null,
            p_profile: filters.profile ?? null,
            p_team_id: context.teamSeason.team_id,
            p_limit: RIDER_SEARCH_PAGE_SIZE,
            p_offset:
              (Math.max(1, filters.page ?? 1) - 1) * RIDER_SEARCH_PAGE_SIZE,
          })
          .returns<RiderSearchRow[]>()
      : Promise.resolve({ data: [] as RiderSearchRow[], error: null }),
    options.includeRoster
      ? loadSeasonYears(admin)
      : Promise.resolve(new Map<string, number>()),
    admin
      .from("team_infrastructures")
      .select("level")
      .eq("team_id", context.teamSeason.team_id)
      .eq("infrastructure_code", "recruitment_data_room")
      .maybeSingle<{ level: number }>(),
    admin
      .from("direct_transfer_offers")
      .select(
        "id, season_id, rider_id, buyer_team_id, seller_team_id, offered_amount, salary_per_season, currency_code, status, created_at, responded_at",
      )
      .eq("buyer_team_id", context.teamSeason.team_id)
      .eq("season_id", context.season.id)
      .eq("status", "pending")
      .returns<DirectOfferRow[]>(),
    options.includeDirectOffers
      ? admin
          .from("direct_transfer_offers")
          .select(
            "id, season_id, rider_id, buyer_team_id, seller_team_id, offered_amount, salary_per_season, currency_code, status, created_at, responded_at",
          )
          .eq("seller_team_id", context.teamSeason.team_id)
          .eq("season_id", context.season.id)
          .order("created_at", { ascending: false })
          .limit(100)
          .returns<DirectOfferRow[]>()
      : Promise.resolve({ data: [] as DirectOfferRow[], error: null }),
  ]);

  assertQuery(listingsResult.error, "les enchères");
  const listingIds = (listingsResult.data ?? []).map((listing) => listing.id);
  const bidsResult = listingIds.length > 0
    ? await admin
        .from("transfer_market_bids")
        .select("id, listing_id, team_id, amount, created_at")
        .in("listing_id", listingIds)
        .order("amount", { ascending: false })
        .order("created_at", { ascending: true })
        .returns<BidRow[]>()
    : { data: [] as BidRow[], error: null };
  assertQuery(bidsResult.error, "les offres");
  assertQuery(contractsResult.error, "les contrats de l’effectif");
  assertQuery(transactionsResult.error, "le budget projeté");
  assertQuery(countriesResult.error, "les nationalités");
  assertQuery(riderSearchResult.error, "la recherche de coureurs");
  assertQuery(dataRoomResult.error, "la Data Room de recrutement");
  assertQuery(pendingDirectOffersResult.error, "les offres directes réservées");
  assertQuery(receivedDirectOffersResult.error, "les offres directes reçues");
  const dataRoomLevel = dataRoomResult.data?.level ?? 0;

  const listings = listingsResult.data ?? [];
  const bids = bidsResult.data ?? [];
  const activeContracts = (contractsResult.data ?? []).filter(
    (contract) => contract.status === "active",
  );
  const riderIds = new Set(listings.map((listing) => listing.rider_id));
  if (options.includeRoster) {
    activeContracts.forEach((contract) => riderIds.add(contract.rider_id));
  }
  const rosterSize = new Set(
    activeContracts.map((contract) => contract.rider_id),
  ).size;
  const rosterIsFull = isTeamRosterAtCapacity(rosterSize);

  const riderSearchRows = Array.isArray(riderSearchResult.data)
    ? (riderSearchResult.data as RiderSearchRow[])
    : [];
  riderSearchRows.forEach((rider) => riderIds.add(rider.rider_id));
  const directOffers = receivedDirectOffersResult.data ?? [];
  directOffers.forEach((offer) => riderIds.add(offer.rider_id));

  const salaryRiderIds = [...riderIds];
  const nextSeasonId = options.includeRoster
    ? ([...seasonYears.entries()].find(
        ([, gameYear]) => gameYear === context.season.game_year + 1,
      )?.[0] ?? null)
    : null;
  const [riders, teams, currentSalaryQuotes, renewalSalaryQuotes] =
    await Promise.all([
    loadMarketRiders(
      admin,
      salaryRiderIds,
      context.season.id,
      countriesResult.data ?? [],
    ),
    loadTeamNames(
      admin,
      [
        ...new Set(
          listings
            .flatMap((listing) => [
              listing.seller_team_id,
              listing.winning_team_id,
            ])
            .concat(bids.map((bid) => bid.team_id))
            .concat(directOffers.map((offer) => offer.buyer_team_id))
            .filter((value): value is string => Boolean(value)),
        ),
      ],
      context.season.id,
    ),
    loadRiderSalaryQuotes(admin, salaryRiderIds, context.season.id),
    loadRiderSalaryQuotes(admin, salaryRiderIds, nextSeasonId),
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

    return [
      {
        id: listing.id,
        type: listing.listing_type,
        status: listing.status,
        sellerTeamId: listing.seller_team_id,
        sellerTeamName: listing.seller_team_id
          ? (teamNames.get(listing.seller_team_id) ?? "Équipe inconnue")
          : null,
        isNationalDayBonus: listing.is_national_day_bonus,
        minimumBid: toNumber(listing.minimum_bid),
        currentBid,
        minimumNextBid:
          currentBid === null
            ? toNumber(listing.minimum_bid)
            : calculateMinimumNextBid(currentBid),
        bidCount: listingBids.length,
        leaderTeamName: leader
          ? (teamNames.get(leader.team_id) ?? "Équipe inconnue")
          : null,
        leaderTeamId: leader?.team_id ?? null,
        ownBid: ownBid > 0 ? ownBid : null,
        isOwnTeamLeading: leader?.team_id === context.teamSeason.team_id,
        salaryPerSeason: toNumber(listing.salary_per_season),
        salaryPerWeek: calculateWeeklySalary(
          toNumber(listing.salary_per_season),
        ),
        currency: listing.currency_code,
        opensAt: listing.opens_at,
        closesAt: listing.closes_at,
        rider: toTransferMarketRider({
          rider,
          seasonId: context.season.id,
          salaryPerSeason: toNumber(listing.salary_per_season),
          dataRoomLevel,
          revealExactValues:
            listing.seller_team_id === context.teamSeason.team_id,
        }),
      } satisfies TransferMarketListing,
    ];
  });

  const openListingRiderIds = new Set(
    listings
      .filter((listing) => listing.status === "open")
      .map((listing) => listing.rider_id),
  );
  const riderSearchResults = riderSearchRows.flatMap((searchRow) => {
    const rider = riderById.get(searchRow.rider_id);
    if (!rider) return [];

    return [{
      ...toTransferMarketRider({
        rider,
        seasonId: context.season.id,
        salaryPerSeason:
          currentSalaryQuotes.get(rider.id) ??
          calculateSalaryApproximation(rider.overall),
        dataRoomLevel,
        revealExactValues: false,
      }),
      contractStatus: searchRow.team_id ? "contracted" : "free",
      teamId: searchRow.team_id,
      teamName: searchRow.team_name,
    } satisfies TransferRiderSearchResult];
  });
  const pendingTotal = (transactionsResult.data ?? []).reduce(
    (total, transaction) => total + toNumber(transaction.amount),
    0,
  );
  const cashBalance = toNumber(context.teamSeason.cash_balance);
  const projectedBudget = cashBalance + pendingTotal;
  const openListingIds = new Set(
    listings
      .filter((listing) => listing.status === "open")
      .map((listing) => listing.id),
  );
  const leadingByListing = [...bidGroups.entries()]
    .filter(([listingId]) => openListingIds.has(listingId))
    .flatMap(([, group]) => (group[0] ? [group[0]] : []));
  const reservedBudget =
    leadingByListing
      .filter((bid) => bid.team_id === context.teamSeason.team_id)
      .reduce((total, bid) => total + toNumber(bid.amount), 0) +
    (pendingDirectOffersResult.data ?? []).reduce(
      (total, offer) => total + toNumber(offer.offered_amount),
      0,
    );
  const plannedRiderIds = new Set(
    (contractsResult.data ?? [])
      .filter((contract) => contract.status === "planned")
      .map((contract) => contract.rider_id),
  );
  const currentSeasonYear = context.season.game_year;
  const featuredNationalDays = getFeaturedNationalDaysForMarketDate(marketDate);
  const countryByCode = new Map(
    (countriesResult.data ?? []).map((country) => [country.iso_alpha2, country]),
  );
  return {
    teamId: context.teamSeason.team_id,
    teamName: context.teamSeason.display_name,
    seasonId: context.season.id,
    seasonName: context.season.name,
    currentDayNumber: context.season.current_day_number ?? 1,
    currency: context.teamSeason.currency,
    cashBalance,
    projectedBudget,
    reservedBudget,
    availableBudget: Math.max(0, cashBalance - reservedBudget),
    dataRoomLevel,
    marketDate,
    nationalDayFeatures: featuredNationalDays.flatMap((featuredNationalDay) => {
      const country = countryByCode.get(featuredNationalDay.isoAlpha2);
      return country
        ? [{
          countryName: country.name,
          countryCode: country.iso_alpha2,
          bonusRiderCount: NATIONAL_DAY_BONUS_RIDER_COUNT,
          isExceptionalOverride:
            featuredNationalDay.isExceptionalOverride,
        }]
        : [];
    }),
    dailyListings: mappedListings.filter((listing) => listing.type === "daily"),
    directorListings: mappedListings.filter(
      (listing) => listing.type === "director",
    ),
    rosterSize,
    rosterLimit: MAX_TEAM_ROSTER_SIZE,
    rosterIsFull,
    riderSearchResults,
    riderSearchTotal: toNumber(riderSearchRows[0]?.total_count),
    riderSearchPage: Math.max(1, filters.page ?? 1),
    riderSearchPageSize: RIDER_SEARCH_PAGE_SIZE,
    countries: (countriesResult.data ?? []).map((country) => ({
      name: country.name,
      code: country.iso_alpha2,
    })),
    directOffers: directOffers.flatMap((offer) => {
      const rider = riderById.get(offer.rider_id);
      if (!rider) return [];
      return [
        {
          id: offer.id,
          amount: toNumber(offer.offered_amount),
          salaryPerSeason: toNumber(offer.salary_per_season),
          currency: offer.currency_code,
          status: offer.status,
          createdAt: offer.created_at,
          respondedAt: offer.responded_at,
          buyerTeamId: offer.buyer_team_id,
          buyerTeamName:
            teamNames.get(offer.buyer_team_id) ?? "Équipe inconnue",
          rider: {
            id: rider.id,
            firstName: rider.firstName,
            lastName: rider.lastName,
            overall: rider.overall,
          },
        } satisfies DirectTransferOffer,
      ];
    }),
    roster: activeContracts.flatMap((contract) => {
      const rider = riderById.get(contract.rider_id);
      if (!rider) return [];
      const listed = openListingRiderIds.has(rider.id);
      const locked = contract.transfer_locked_season_id === context.season.id;
      const endYear =
        seasonYears.get(contract.end_season_id) ?? currentSeasonYear;
      const renewalSalary =
        renewalSalaryQuotes.get(rider.id) ??
        calculateSalaryApproximation(rider.overall);

      return [
        {
          rider: {
            id: rider.id,
            firstName: rider.firstName,
            lastName: rider.lastName,
            overall: rider.overall,
          },
          currentSalary: toNumber(contract.salary_per_season),
          currency: context.teamSeason.currency,
          recommendedPrice: Math.max(
            500,
            Math.round(((rider.overall - 35) ** 2 * 110) / 500) * 500,
          ),
          canList: !listed && !locked,
          listBlockedReason: listed
            ? "Déjà proposé sur le marché"
            : locked
              ? "Recruté cette saison : revente impossible"
              : null,
          canRenew:
            endYear <= currentSeasonYear && !plannedRiderIds.has(rider.id),
          renewalSalary,
        } satisfies TransferRosterCandidate,
      ];
    }),
  };
}

export async function getRiderTransferManagement(
  authUserId: string,
  riderId: string,
): Promise<RiderTransferManagement | null> {
  const admin = createSupabaseAdminClient();
  const context = await loadCurrentContext(admin, authUserId);
  if (!context) return null;

  const [
    riderResult,
    ratingResult,
    contractsResult,
    listingResult,
    teamContractsResult,
    pendingOfferResult,
    reservationsResult,
  ] = await Promise.all([
    admin
      .from("riders")
      .select("id, status")
      .eq("id", riderId)
      .maybeSingle<{ id: string; status: string }>(),
    admin
      .from("rider_season_ratings")
      .select(
        "mountain, hills, flat, time_trial, cobbles, sprint, acceleration, downhill, endurance, resistance, recovery, breakaway, prologue",
      )
      .eq("rider_id", riderId)
      .eq("season_id", context.season.id)
      .maybeSingle<Omit<RatingRow, "rider_id" | "age">>(),
    admin
      .from("rider_contracts")
      .select(
        "id, rider_id, team_id, start_season_id, end_season_id, salary_per_season, transfer_locked_season_id, status",
      )
      .eq("rider_id", riderId)
      .in("status", ["active", "planned"])
      .returns<ContractRow[]>(),
    admin
      .from("transfer_market_listings")
      .select("id")
      .eq("rider_id", riderId)
      .eq("status", "open")
      .maybeSingle<{ id: string }>(),
    admin
      .from("rider_contracts")
      .select("rider_id")
      .eq("team_id", context.teamSeason.team_id)
      .eq("status", "active")
      .returns<Array<{ rider_id: string }>>(),
    admin
      .from("direct_transfer_offers")
      .select("id, offered_amount")
      .eq("buyer_team_id", context.teamSeason.team_id)
      .eq("rider_id", riderId)
      .eq("status", "pending")
      .maybeSingle<{ id: string; offered_amount: number | string }>(),
    admin.rpc("get_team_transfer_reserved_budget", {
      p_team_id: context.teamSeason.team_id,
      p_excluded_offer_id: null,
      p_excluded_listing_id: null,
    }),
  ]);
  assertQuery(riderResult.error, "le statut du coureur");
  assertQuery(ratingResult.error, "le niveau du coureur");
  assertQuery(contractsResult.error, "les contrats du coureur");
  assertQuery(listingResult.error, "la disponibilité du coureur");
  assertQuery(teamContractsResult.error, "la capacité de l’effectif");
  assertQuery(pendingOfferResult.error, "l'offre directe en attente");
  assertQuery(reservationsResult.error, "les engagements de transfert");
  if (!riderResult.data || !ratingResult.data) return null;

  const ratings = toRatings(ratingResult.data);
  const overall = calculateOverall(ratings);
  const contracts = contractsResult.data ?? [];
  const rosterSize = new Set(
    (teamContractsResult.data ?? []).map((contract) => contract.rider_id),
  ).size;
  const rosterIsFull = isTeamRosterAtCapacity(rosterSize);
  const activeContract =
    contracts.find((contract) => contract.status === "active") ?? null;
  const ownsRider = activeContract?.team_id === context.teamSeason.team_id;
  const seasonYears = await loadSeasonYears(admin);
  const activeContractEndSeasonYear = activeContract
    ? seasonYears.get(activeContract.end_season_id) ?? null
    : null;
  const nextSeasonContract = contracts
    .filter((contract) => contract.id !== activeContract?.id)
    .filter((contract) => {
      const startYear = seasonYears.get(contract.start_season_id);
      const endYear = seasonYears.get(contract.end_season_id);
      return (
        startYear !== undefined &&
        endYear !== undefined &&
        startYear <= context.season.game_year + 1 &&
        endYear >= context.season.game_year + 1
      );
    })
    .sort(
      (left, right) =>
        (seasonYears.get(right.end_season_id) ?? 0) -
        (seasonYears.get(left.end_season_id) ?? 0),
    )[0];
  const successorContractEndSeasonYear = nextSeasonContract
    ? seasonYears.get(nextSeasonContract.end_season_id) ?? null
    : null;
  const contractEndSeasonYear = activeContractEndSeasonYear
    ? resolveEffectiveTeamContractEndYear({
        currentContractEndYear: activeContractEndSeasonYear,
        currentTeamId: context.teamSeason.team_id,
        successorTeamId: nextSeasonContract?.team_id ?? null,
        successorContractEndYear: successorContractEndSeasonYear,
      })
    : null;
  const canRenew = Boolean(
    ownsRider &&
    activeContract &&
    activeContractEndSeasonYear !== null &&
    canRenewCurrentTeamRiderContract({
      currentContractEndYear: activeContractEndSeasonYear,
      currentSeasonYear: context.season.game_year,
      hasNextSeasonContract: Boolean(nextSeasonContract),
    }),
  );
  const nextSeasonId = [...seasonYears.entries()].find(
    ([, gameYear]) => gameYear === context.season.game_year + 1,
  )?.[0];
  const [currentSalaryQuotes, renewalSalaryQuotes] = await Promise.all([
    loadRiderSalaryQuotes(admin, [riderId], context.season.id),
    loadRiderSalaryQuotes(admin, [riderId], nextSeasonId ?? null),
  ]);
  const salary =
    currentSalaryQuotes.get(riderId) ?? calculateSalaryApproximation(overall);
  const renewalSalary =
    renewalSalaryQuotes.get(riderId) ?? calculateSalaryApproximation(overall);
  const isFreeAgent =
    riderResult.data.status === "free_agent" && !activeContract;
  const availableBudget = Math.max(
    0,
    toNumber(context.teamSeason.cash_balance) -
      toNumber(reservationsResult.data),
  );
  const sourceContractLocked =
    activeContract?.transfer_locked_season_id === context.season.id;
  const canTargetRider = Boolean(activeContract && !ownsRider && !isFreeAgent);
  const dismissalResult = ownsRider
    ? await admin.rpc("calculate_rider_dismissal_compensation", {
        p_team_id: context.teamSeason.team_id,
        p_rider_id: riderId,
        p_active_season_id: context.season.id,
      })
    : { data: null, error: null };
  assertQuery(dismissalResult.error, "le solde de licenciement");

  const directOfferBlockedReason = canTargetRider
    ? pendingOfferResult.data
      ? "Votre équipe a déjà une offre en attente pour ce coureur."
      : sourceContractLocked
        ? "Ce coureur recruté cette saison ne peut pas encore être transféré."
        : rosterIsFull
          ? `Votre effectif compte déjà ${MAX_TEAM_ROSTER_SIZE} coureurs.`
          : availableBudget < 500
            ? "Votre trésorerie disponible ne couvre pas l’offre minimale."
            : null
    : null;

  return {
    isFreeAgent,
    canSignFreeAgent: isFreeAgent && !listingResult.data && !rosterIsFull,
    freeAgentSalary: isFreeAgent ? salary : null,
    freeAgentWeeklySalary: isFreeAgent ? calculateWeeklySalary(salary) : null,
    freeAgentBlockedReason: isFreeAgent
      ? listingResult.data
        ? "Ce coureur est encore engagé dans une enchère."
        : rosterIsFull
          ? `Votre effectif compte déjà ${MAX_TEAM_ROSTER_SIZE} coureurs.`
          : null
      : null,
    rosterSize,
    rosterLimit: MAX_TEAM_ROSTER_SIZE,
    rosterIsFull,
    canRenew,
    renewalSalary: ownsRider ? renewalSalary : null,
    contractEndSeasonYear,
    ownsRider,
    canDismiss: Boolean(ownsRider && activeContract),
    dismissalCost: ownsRider ? toNumber(dismissalResult.data) : null,
    dismissalCurrency: context.teamSeason.currency,
    canMakeDirectOffer: canTargetRider && directOfferBlockedReason === null,
    directOfferSalary: canTargetRider ? salary : null,
    directOfferBlockedReason,
    pendingDirectOfferAmount: pendingOfferResult.data
      ? toNumber(pendingOfferResult.data.offered_amount)
      : null,
    availableBudget,
    cashBalance: toNumber(context.teamSeason.cash_balance),
    currency: context.teamSeason.currency,
  };
}

async function ensureTodayDailyMarket(
  admin: ReturnType<typeof createSupabaseAdminClient>,
) {
  const marketDate = formatParisDate(new Date());
  const { data: batch, error: batchError } = await admin
    .from("transfer_daily_batches")
    .select("id")
    .eq("market_date", marketDate)
    .maybeSingle<{ id: string }>();
  assertQuery(batchError, "la génération quotidienne");
  if (batch || getParisHour(new Date()) < 9) return 0;

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
    (profilesResult.data ?? []).map((profile) => [
      profile.country_id,
      profile.name_profile_code,
    ]),
  );
  const candidates = (countriesResult.data ?? []).filter((country) => {
    const code = profileByCountry.get(country.id);
    return Boolean(code && hasRiderNameLibrary(code));
  });
  const featuredNationalDays = getFeaturedNationalDaysForMarketDate(marketDate);
  const nationalDayCountries = featuredNationalDays.flatMap((featured) => {
    const country = candidates.find(
      (candidate) => candidate.iso_alpha2 === featured.isoAlpha2,
    );
    if (!country) {
      console.error(
        `La sélection de fête nationale ${featured.isoAlpha2} ne dispose pas d’un profil de génération valide.`,
      );
      return [];
    }
    return [country];
  });
  const nationalDayCountryIds = new Set(
    nationalDayCountries.map((country) => country.id),
  );
  const regularCandidates = candidates.filter(
    (country) => !nationalDayCountryIds.has(country.id),
  );
  const selectedCountries = selectRandomDistinct(
    regularCandidates,
    DAILY_TRANSFER_RIDER_COUNT,
  );
  const selectionsByProfile = new Map<string, CountryRow[]>();
  for (const country of selectedCountries) {
    const code = profileByCountry.get(country.id)!;
    selectionsByProfile.set(code, [
      ...(selectionsByProfile.get(code) ?? []),
      country,
    ]);
  }
  const identities: Array<{
    country_id: string;
    first_name: string;
    last_name: string;
    is_national_day_bonus: boolean;
  }> = [];
  for (const [profileCode, countries] of selectionsByProfile) {
    const generated = generateRiderIdentities(profileCode, countries.length);
    generated.forEach((identity, index) =>
      identities.push({
        country_id: countries[index]!.id,
        first_name: identity.first_name,
        last_name: identity.last_name,
        is_national_day_bonus: false,
      }),
    );
  }
  shuffle(identities);

  for (const nationalDayCountry of nationalDayCountries) {
    const profileCode = profileByCountry.get(nationalDayCountry.id)!;
    const generated = generateRiderIdentities(
      profileCode,
      NATIONAL_DAY_BONUS_RIDER_COUNT,
    );
    generated.forEach((identity) =>
      identities.push({
        country_id: nationalDayCountry.id,
        first_name: identity.first_name,
        last_name: identity.last_name,
        is_national_day_bonus: true,
      }),
    );
  }

  const { data, error } = await admin.rpc("create_daily_transfer_market", {
    p_market_date: marketDate,
    p_rider_identities: identities,
    p_force: false,
  });
  assertQuery(error, "les coureurs du marché quotidien");
  return Number(data ?? 0);
}

async function prepareCurrentTransferMarket(
  admin: ReturnType<typeof createSupabaseAdminClient>,
) {
  const startedAt = Date.now();
  const firstSettlementStartedAt = Date.now();
  const { data: firstSettled, error: marketSettlementError } = await admin.rpc(
    "settle_transfer_market",
  );
  assertQuery(marketSettlementError, "les enchères arrivées à échéance");
  const firstSettlementDurationMs = Date.now() - firstSettlementStartedAt;

  const dailyMarketStartedAt = Date.now();
  const generatedListings = await ensureTodayDailyMarket(admin);
  const dailyMarketDurationMs = Date.now() - dailyMarketStartedAt;

  let secondSettled = 0;
  let secondSettlementDurationMs = 0;
  if (generatedListings > 0) {
    const secondSettlementStartedAt = Date.now();
    const { data, error: secondSettlementError } = await admin.rpc(
      "settle_transfer_market",
    );
    assertQuery(secondSettlementError, "la clôture du marché quotidien");
    secondSettled = Number(data ?? 0);
    secondSettlementDurationMs = Date.now() - secondSettlementStartedAt;
  }

  return {
    settledListings: Number(firstSettled ?? 0) + secondSettled,
    generatedListings,
    firstSettlementDurationMs,
    dailyMarketDurationMs,
    secondSettlementDurationMs,
    durationMs: Date.now() - startedAt,
  };
}

export async function runTransferMarketMaintenance() {
  const admin = createSupabaseAdminClient();
  return prepareCurrentTransferMarket(admin);
}

async function loadCurrentContext(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  authUserId: string,
) {
  const { data: director, error: directorError } = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<DirectorRow>();
  assertQuery(directorError, "le Directeur Sportif");
  if (!director) return null;
  const [
    { data: assignment, error: assignmentError },
    { data: season, error: seasonError },
  ] = await Promise.all([
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
  countries: CountryRow[],
): Promise<LoadedMarketRider[]> {
  if (riderIds.length === 0) return [];
  const [ridersResult, ratingsResult] = await Promise.all([
    admin
      .from("riders")
      .select(
        "id, country_id, first_name, last_name, status, avatar_profile_key, avatar_seed, potential_steps",
      )
      .in("id", riderIds)
      .returns<RiderRow[]>(),
    admin
      .from("rider_season_ratings")
      .select(
        "rider_id, age, mountain, hills, flat, time_trial, cobbles, sprint, acceleration, downhill, endurance, resistance, recovery, breakaway, prologue",
      )
      .eq("season_id", seasonId)
      .in("rider_id", riderIds)
      .returns<RatingRow[]>(),
  ]);
  assertQuery(ridersResult.error, "les coureurs du marché");
  assertQuery(ratingsResult.error, "leurs caractéristiques");
  const ratingByRider = new Map(
    (ratingsResult.data ?? []).map((rating) => [rating.rider_id, rating]),
  );
  const countryById = new Map(
    countries.map((country) => [country.id, country]),
  );

  return (ridersResult.data ?? []).flatMap((rider) => {
    const rating = ratingByRider.get(rider.id);
    const country = countryById.get(rider.country_id);
    if (!rating || !country) return [];
    const ratings = toRatings(rating);
    return [
      {
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
      } satisfies LoadedMarketRider,
    ];
  });
}

async function loadTeamNames(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  teamIds: string[],
  seasonId: string,
) {
  if (teamIds.length === 0) return [];
  const { data, error } = await admin
    .from("team_seasons")
    .select("team_id, display_name")
    .eq("season_id", seasonId)
    .in("team_id", teamIds)
    .returns<Array<{ team_id: string; display_name: string }>>();
  assertQuery(error, "les équipes du marché");
  return (data ?? []).map((team) => ({
    id: team.team_id,
    name: team.display_name,
  }));
}

async function loadSeasonYears(
  admin: ReturnType<typeof createSupabaseAdminClient>,
) {
  const { data, error } = await admin
    .from("seasons")
    .select("id, game_year")
    .returns<Array<{ id: string; game_year: number }>>();
  assertQuery(error, "les saisons contractuelles");
  return new Map((data ?? []).map((season) => [season.id, season.game_year]));
}

async function loadRiderSalaryQuotes(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  riderIds: string[],
  seasonId: string | null,
) {
  if (!seasonId || riderIds.length === 0) return new Map<string, number>();

  const { data, error } = await admin
    .rpc("calculate_rider_season_salary_quotes", {
      p_rider_ids: riderIds,
      p_season_id: seasonId,
    })
    .returns<SalaryQuoteRow[]>();
  assertQuery(error, "les demandes salariales des coureurs");
  const quotes = Array.isArray(data) ? (data as SalaryQuoteRow[]) : [];

  return new Map(
    quotes.map((quote) => [
      quote.rider_id,
      toNumber(quote.salary_per_season),
    ]),
  );
}

function groupBids(bids: BidRow[]) {
  const groups = new Map<string, BidRow[]>();
  for (const bid of bids)
    groups.set(bid.listing_id, [...(groups.get(bid.listing_id) ?? []), bid]);
  for (const group of groups.values()) {
    group.sort(
      (left, right) =>
        toNumber(right.amount) - toNumber(left.amount) ||
        left.created_at.localeCompare(right.created_at),
    );
  }
  return groups;
}

function toTransferMarketRider({
  rider,
  seasonId,
  salaryPerSeason,
  dataRoomLevel,
  revealExactValues,
}: {
  rider: LoadedMarketRider;
  seasonId: string;
  salaryPerSeason: number;
  dataRoomLevel: number;
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
    salaryPerSeason,
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
          dataRoomLevel,
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
  return (
    Math.round(
      (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
    ) / 10
  );
}

function calculateSalaryApproximation(overall: number) {
  return calculateRiderSeasonSalary({ overall });
}

function formatParisDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getParisHour(date: Date) {
  return Number(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date),
  );
}

function selectRandomDistinct<T>(values: T[], count: number) {
  if (values.length < count)
    throw new Error("Pas assez de pays pour générer le marché quotidien.");
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
    [values[index], values[selectedIndex]] = [
      values[selectedIndex]!,
      values[index]!,
    ];
  }
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function assertQuery(
  error: { message: string } | null,
  resource: string,
): asserts error is null {
  if (error)
    throw new Error(`Impossible de charger ${resource} : ${error.message}`);
}
