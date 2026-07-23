import "server-only";

import { randomInt } from "node:crypto";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  generateRiderIdentities,
  hasRiderNameLibrary,
} from "@/lib/rider-names/generate-rider-identities";
import {
  ARCHITECT_SPECIALTIES,
  isArchitectSpecialty,
  type ArchitectSpecialty,
} from "@/lib/game/infrastructure";
import {
  STAFF_DAILY_LEVEL_DISTRIBUTION,
  STAFF_DAILY_ROLE_DISTRIBUTION,
  TRAINER_SPECIALTIES,
  calculateDueStaffSalary,
  calculateStaffWeeklySalary,
  describeStaffEffect,
  getStaffCapacityForDirectorLevel,
  isStaffRole,
  isTrainerSpecialty,
  type StaffRole,
  type TrainerSpecialty,
} from "@/lib/game/staff";
import { calculateSportingDirectorProgression } from "@/lib/game/sporting-director-progression";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type DirectorRow = {
  id: string;
  experience_points: number | string;
};

type AssignmentRow = { team_id: string };

type SeasonRow = {
  id: string;
  name: string;
  current_day_number: number | null;
};

type TeamSeasonRow = {
  id: string;
  team_id: string;
  display_name: string;
  cash_balance: number | string;
  currency: string;
};

type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
  is_active: boolean;
};

type GenerationProfileRow = {
  country_id: string;
  name_profile_code: string;
};

type BatchRow = {
  id: string;
  market_date: string;
};

type ListingRow = {
  id: string;
  staff_member_id: string;
  daily_slot: number;
  signing_fee: number | string;
  salary_per_season: number | string;
  currency_code: string;
  status: "available" | "hired" | "expired";
  hired_team_id: string | null;
  hired_at: string | null;
};

type MemberRow = {
  id: string;
  country_id: string;
  first_name: string;
  last_name: string;
  role: string;
  level: number;
  trainer_specialty: string | null;
  architect_specialty: string | null;
};

type ContractRow = {
  id: string;
  staff_member_id: string;
  salary_per_season: number | string;
  currency_code: string;
  signing_fee: number | string;
  signed_at: string;
};

type FinanceRow = { amount: number | string };

export type StaffMarketFilters = {
  search?: string;
  role?: StaffRole;
  level?: number;
  countryCode?: string;
  trainerSpecialty?: TrainerSpecialty;
};

export type TeamStaffMember = {
  id: string;
  contractId: string | null;
  firstName: string;
  lastName: string;
  countryId: string;
  countryName: string;
  countryCode: string;
  role: StaffRole;
  level: number;
  trainerSpecialty: TrainerSpecialty | null;
  architectSpecialty: ArchitectSpecialty | null;
  effects: string[];
  salaryPerSeason: number;
  salaryPerWeek: number;
  signingFee: number;
  currency: string;
  signedAt: string | null;
};

export type StaffMarketListing = {
  id: string;
  slot: number;
  status: ListingRow["status"];
  hiredTeamId: string | null;
  hiredByCurrentTeam: boolean;
  member: TeamStaffMember;
  canHire: boolean;
  hireBlockedReason: string | null;
};

export type TeamStaffOverview = {
  teamId: string;
  teamName: string;
  seasonName: string;
  currentDayNumber: number;
  currency: string;
  balance: number;
  projectedBudget: number;
  directorLevel: number;
  staffCapacity: number;
  activeStaffCount: number;
  availableStaffSlots: number;
  activePayroll: number;
  marketDate: string;
  marketTotalCount: number;
  marketAvailableCount: number;
  marketListings: StaffMarketListing[];
  teamStaff: TeamStaffMember[];
  countries: Array<{ name: string; code: string }>;
};

export async function getTeamStaffOverview(
  supabase: SupabaseServerClient,
  authUserId: string,
  filters: StaffMarketFilters = {},
): Promise<TeamStaffOverview | null> {
  const settlement = await supabase.rpc("settle_current_team_finances");
  assertQuery(settlement.error, "l’actualisation des finances");

  const admin = createSupabaseAdminClient();
  await ensureTodayStaffMarket(admin);

  const context = await loadCurrentContext(admin, authUserId);
  if (!context) return null;

  const marketDate = formatParisDate(new Date());
  const [batchResult, contractsResult, transactionsResult, countriesResult] =
    await Promise.all([
      admin
        .from("staff_market_batches")
        .select("id, market_date")
        .eq("market_date", marketDate)
        .maybeSingle<BatchRow>(),
      admin
        .from("staff_contracts")
        .select(
          "id, staff_member_id, salary_per_season, currency_code, signing_fee, signed_at",
        )
        .eq("team_id", context.teamSeason.team_id)
        .eq("status", "active")
        .order("signed_at", { ascending: true })
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
    ]);

  assertQuery(batchResult.error, "le marché du staff du jour");
  assertQuery(contractsResult.error, "le staff de l’équipe");
  assertQuery(transactionsResult.error, "le budget projeté");
  assertQuery(countriesResult.error, "les nationalités du staff");

  const batch = batchResult.data;
  const { data: listingRows, error: listingsError } = batch
    ? await admin
        .from("staff_market_listings")
        .select(
          "id, staff_member_id, daily_slot, signing_fee, salary_per_season, currency_code, status, hired_team_id, hired_at",
        )
        .eq("batch_id", batch.id)
        .order("daily_slot", { ascending: true })
        .returns<ListingRow[]>()
    : { data: [] as ListingRow[], error: null };

  assertQuery(listingsError, "les profils du marché du staff");
  const listings = listingRows ?? [];
  const contracts = contractsResult.data ?? [];
  const memberIds = [
    ...new Set([
      ...listings.map((listing) => listing.staff_member_id),
      ...contracts.map((contract) => contract.staff_member_id),
    ]),
  ];

  const { data: memberRows, error: membersError } =
    memberIds.length > 0
      ? await admin
          .from("staff_members")
          .select(
            "id, country_id, first_name, last_name, role, level, trainer_specialty, architect_specialty",
          )
          .in("id", memberIds)
          .returns<MemberRow[]>()
      : { data: [] as MemberRow[], error: null };

  assertQuery(membersError, "les identités du staff");
  const membersById = new Map(
    (memberRows ?? []).map((member) => [member.id, member]),
  );
  const countriesById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country]),
  );
  const balance = toNumber(context.teamSeason.cash_balance);
  const projectedBudget = (transactionsResult.data ?? []).reduce(
    (total, transaction) => total + toNumber(transaction.amount),
    balance,
  );
  const directorLevel = calculateSportingDirectorProgression(
    toNumber(context.director.experience_points),
  ).level;
  const staffCapacity = getStaffCapacityForDirectorLevel(directorLevel);
  const activeStaffCount = contracts.length;
  const commonBlockReason = getCommonHireBlockReason({
    activeStaffCount,
    staffCapacity,
  });

  const marketListings = listings.flatMap((listing) => {
    const memberRow = membersById.get(listing.staff_member_id);
    if (!memberRow) return [];
    const member = toStaffMember({
      member: memberRow,
      country: countriesById.get(memberRow.country_id),
      salaryPerSeason: toNumber(listing.salary_per_season),
      signingFee: toNumber(listing.signing_fee),
      currency: listing.currency_code,
    });
    if (!member || !matchesFilters(member, filters)) return [];

    const dueSalary = calculateDueStaffSalary(
      member.salaryPerSeason,
      context.season.current_day_number ?? 1,
    );
    const hireBlockedReason =
      listing.status !== "available"
        ? listing.hired_team_id === context.teamSeason.team_id
          ? "Déjà recruté par votre équipe."
          : "Ce profil a déjà été recruté."
        : commonBlockReason ??
          (balance < member.signingFee + dueSalary
            ? "Trésorerie insuffisante pour la signature et les échéances déjà dues."
            : projectedBudget < member.signingFee + member.salaryPerSeason
              ? "Budget projeté insuffisant pour couvrir la signature et la saison de salaire."
              : null);

    return [
      {
        id: listing.id,
        slot: listing.daily_slot,
        status: listing.status,
        hiredTeamId: listing.hired_team_id,
        hiredByCurrentTeam:
          listing.hired_team_id === context.teamSeason.team_id,
        member,
        canHire: hireBlockedReason === null,
        hireBlockedReason,
      } satisfies StaffMarketListing,
    ];
  });

  const teamStaff = contracts
    .flatMap((contract) => {
      const memberRow = membersById.get(contract.staff_member_id);
      if (!memberRow) return [];
      const member = toStaffMember({
        member: memberRow,
        country: countriesById.get(memberRow.country_id),
        contractId: contract.id,
        salaryPerSeason: toNumber(contract.salary_per_season),
        signingFee: toNumber(contract.signing_fee),
        currency: contract.currency_code,
        signedAt: contract.signed_at,
      });
      return member ? [member] : [];
    })
    .sort(
      (left, right) =>
        STAFF_DAILY_ROLE_DISTRIBUTION.indexOf(left.role) -
          STAFF_DAILY_ROLE_DISTRIBUTION.indexOf(right.role) ||
        right.level - left.level ||
        left.lastName.localeCompare(right.lastName, "fr"),
    );

  return {
    teamId: context.teamSeason.team_id,
    teamName: context.teamSeason.display_name,
    seasonName: context.season.name,
    currentDayNumber: context.season.current_day_number ?? 1,
    currency: context.teamSeason.currency,
    balance,
    projectedBudget,
    directorLevel,
    staffCapacity,
    activeStaffCount,
    availableStaffSlots: Math.max(0, staffCapacity - activeStaffCount),
    activePayroll: contracts.reduce(
      (total, contract) => total + toNumber(contract.salary_per_season),
      0,
    ),
    marketDate,
    marketTotalCount: listings.length,
    marketAvailableCount: listings.filter(
      (listing) => listing.status === "available",
    ).length,
    marketListings,
    teamStaff,
    countries: (countriesResult.data ?? []).map((country) => ({
      name: country.name,
      code: country.iso_alpha2,
    })),
  };
}

async function ensureTodayStaffMarket(
  admin: ReturnType<typeof createSupabaseAdminClient>,
) {
  const marketDate = formatParisDate(new Date());
  const { data: batch, error: batchError } = await admin
    .from("staff_market_batches")
    .select("id")
    .eq("market_date", marketDate)
    .maybeSingle<{ id: string }>();

  assertQuery(batchError, "la génération quotidienne du staff");
  if (batch) return;

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

  assertQuery(countriesResult.error, "les pays de génération du staff");
  assertQuery(profilesResult.error, "les profils de noms du staff");
  const profileByCountryId = new Map(
    (profilesResult.data ?? []).map((profile) => [
      profile.country_id,
      profile.name_profile_code,
    ]),
  );
  const eligibleCountries = (countriesResult.data ?? []).filter((country) => {
    const profileCode = profileByCountryId.get(country.id);
    return Boolean(profileCode && hasRiderNameLibrary(profileCode));
  });
  const selectedCountries = selectRandomDistinct(eligibleCountries, 25);
  const identitiesByCountryId = generateStaffIdentities(
    selectedCountries,
    profileByCountryId,
  );
  const roles = shuffleCopy(STAFF_DAILY_ROLE_DISTRIBUTION);
  const levels = shuffleCopy(STAFF_DAILY_LEVEL_DISTRIBUTION);
  const candidates = selectedCountries.map((country, index) => {
    const identity = identitiesByCountryId.get(country.id);
    const role = roles[index]!;
    if (!identity) {
      throw new Error(`Aucune identité générée pour ${country.name}.`);
    }

    return {
      country_id: country.id,
      first_name: identity.first_name,
      last_name: identity.last_name,
      role,
      level: levels[index]!,
      trainer_specialty:
        role === "trainer"
          ? TRAINER_SPECIALTIES[randomInt(0, TRAINER_SPECIALTIES.length)]
          : null,
      architect_specialty:
        role === "architect"
          ? ARCHITECT_SPECIALTIES[
              randomInt(0, ARCHITECT_SPECIALTIES.length)
            ]
          : null,
    };
  });

  const { error: generationError } = await admin.rpc(
    "create_daily_staff_market",
    {
      p_market_date: marketDate,
      p_candidates: candidates,
    },
  );
  assertQuery(generationError, "les 25 profils du marché du staff");
}

function generateStaffIdentities(
  countries: CountryRow[],
  profileByCountryId: Map<string, string>,
) {
  const countriesByProfile = new Map<string, CountryRow[]>();
  for (const country of countries) {
    const profileCode = profileByCountryId.get(country.id);
    if (!profileCode) continue;
    countriesByProfile.set(profileCode, [
      ...(countriesByProfile.get(profileCode) ?? []),
      country,
    ]);
  }

  const identitiesByCountryId = new Map<
    string,
    { first_name: string; last_name: string }
  >();
  for (const [profileCode, profileCountries] of countriesByProfile) {
    const identities = generateRiderIdentities(
      profileCode,
      profileCountries.length,
    );
    profileCountries.forEach((country, index) => {
      identitiesByCountryId.set(country.id, identities[index]!);
    });
  }

  return identitiesByCountryId;
}

async function loadCurrentContext(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  authUserId: string,
) {
  const { data: director, error: directorError } = await admin
    .from("sporting_directors")
    .select("id, experience_points")
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
      .select("id, name, current_day_number")
      .eq("status", "active")
      .maybeSingle<SeasonRow>(),
  ]);

  assertQuery(assignmentResult.error, "l’affectation à l’équipe");
  assertQuery(seasonResult.error, "la saison active");
  if (!assignmentResult.data || !seasonResult.data) return null;

  const { data: teamSeason, error: teamSeasonError } = await admin
    .from("team_seasons")
    .select("id, team_id, display_name, cash_balance, currency")
    .eq("team_id", assignmentResult.data.team_id)
    .eq("season_id", seasonResult.data.id)
    .maybeSingle<TeamSeasonRow>();

  assertQuery(teamSeasonError, "l’équipe de la saison");
  if (!teamSeason) return null;

  return {
    director,
    season: seasonResult.data,
    teamSeason,
  };
}

function toStaffMember({
  member,
  country,
  contractId = null,
  salaryPerSeason,
  signingFee,
  currency,
  signedAt = null,
}: {
  member: MemberRow;
  country: CountryRow | undefined;
  contractId?: string | null;
  salaryPerSeason: number;
  signingFee: number;
  currency: string;
  signedAt?: string | null;
}): TeamStaffMember | null {
  if (!country || !isStaffRole(member.role)) return null;
  const trainerSpecialty =
    member.trainer_specialty && isTrainerSpecialty(member.trainer_specialty)
      ? member.trainer_specialty
      : null;
  const architectSpecialty =
    member.architect_specialty &&
    isArchitectSpecialty(member.architect_specialty)
      ? member.architect_specialty
      : member.role === "architect"
        ? "balanced"
        : null;

  return {
    id: member.id,
    contractId,
    firstName: member.first_name,
    lastName: member.last_name,
    countryId: country.id,
    countryName: country.name,
    countryCode: country.iso_alpha2,
    role: member.role,
    level: member.level,
    trainerSpecialty,
    architectSpecialty,
    effects: describeStaffEffect({
      role: member.role,
      level: member.level,
      trainerSpecialty,
      architectSpecialty,
      countryName: country.name,
    }),
    salaryPerSeason,
    salaryPerWeek: calculateStaffWeeklySalary(salaryPerSeason),
    signingFee,
    currency,
    signedAt,
  };
}

function matchesFilters(
  member: TeamStaffMember,
  filters: StaffMarketFilters,
) {
  const search = normalizeSearch(filters.search ?? "");
  if (
    search &&
    !normalizeSearch(`${member.firstName} ${member.lastName}`).includes(search)
  ) {
    return false;
  }
  if (filters.role && member.role !== filters.role) return false;
  if (filters.level && member.level !== filters.level) return false;
  if (
    filters.countryCode &&
    member.countryCode.toUpperCase() !== filters.countryCode.toUpperCase()
  ) {
    return false;
  }
  if (
    filters.trainerSpecialty &&
    member.trainerSpecialty !== filters.trainerSpecialty
  ) {
    return false;
  }
  return true;
}

function getCommonHireBlockReason({
  activeStaffCount,
  staffCapacity,
}: {
  activeStaffCount: number;
  staffCapacity: number;
}) {
  if (activeStaffCount >= staffCapacity) {
    return `Capacité atteinte : ${staffCapacity} membre${staffCapacity > 1 ? "s" : ""} au niveau actuel du DS.`;
  }
  return null;
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("fr");
}

function formatParisDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function selectRandomDistinct<T>(values: T[], count: number) {
  if (values.length < count) {
    throw new Error(
      `Pas assez de nationalités pour générer ${count} profils de staff.`,
    );
  }
  return shuffleCopy(values).slice(0, count);
}

function shuffleCopy<T>(values: readonly T[]) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const selectedIndex = randomInt(0, index + 1);
    [copy[index], copy[selectedIndex]] = [copy[selectedIndex]!, copy[index]!];
  }
  return copy;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function assertQuery(
  error: { message: string } | null,
  resource: string,
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${resource} : ${error.message}`);
  }
}
