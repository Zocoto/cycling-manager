import "server-only";

import { randomInt } from "node:crypto";

import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  generateRiderIdentities,
  hasRiderNameLibrary,
} from "@/lib/rider-names/generate-rider-identities";
import {
  ARCHITECT_SPECIALTIES,
  getStaffNaturalizationSeasonLimit,
  isArchitectSpecialty,
  type ArchitectSpecialty,
} from "@/lib/game/infrastructure";
import {
  STAFF_DAILY_ROLE_DISTRIBUTION,
  STAFF_LEVEL_WEIGHT_TOTAL,
  TRAINER_SPECIALTIES,
  calculateDueStaffSalary,
  calculateRemainingStaffSalary,
  calculateStaffDismissalCompensation,
  calculateStaffWeeklySalary,
  describeStaffEffect,
  getStaffCapacityForDirectorLevel,
  isStaffRole,
  isTrainerSpecialty,
  selectStaffLevelFromRoll,
  type StaffRole,
  type TrainerSpecialty,
} from "@/lib/game/staff";
import {
  STAFF_TALENT_DEFINITIONS,
  describeStaffTalent,
  getStaffTalentCodes,
  isStaffTalentForRole,
  selectInitialStaffTalent,
  type StaffTalentCode,
} from "@/lib/game/staff-talents";
import { calculateSportingDirectorProgression } from "@/lib/game/sporting-director-progression";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

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
  registration_country_id: string;
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

type MemberTalentRow = {
  staff_member_id: string;
  slot_number: number;
  talent_code: string;
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
  talents: Array<{
    slot: number;
    code: StaffTalentCode;
    label: string;
    description: string;
  }>;
  nationalityAffinity: boolean;
  salaryPerSeason: number;
  salaryPerWeek: number;
  signingFee: number;
  currency: string;
  signedAt: string | null;
  remainingCurrentSeasonSalary: number;
  dismissalCompensation: number;
};

export type StaffMarketListing = {
  id: string;
  slot: number;
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
  staffAcademyLevel: number;
  marketListings: StaffMarketListing[];
  teamStaff: TeamStaffMember[];
  countries: Array<{ name: string; code: string }>;
  staffNaturalization: {
    welcomeCenterLevel: number;
    limit: number;
    used: number;
    remaining: number;
    targetCountryId: string;
    targetCountryName: string;
    targetCountryCode: string;
  };
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
  const [
    batchResult,
    contractsResult,
    transactionsResult,
    countriesResult,
    researchLabResult,
    staffAcademyResult,
    welcomeCenterResult,
    staffNaturalizationsResult,
  ] = await Promise.all([
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
    admin
      .from("team_infrastructures")
      .select("level")
      .eq("team_id", context.teamSeason.team_id)
      .eq("infrastructure_code", "research_lab")
      .maybeSingle<{ level: number }>(),
    admin
      .from("team_infrastructures")
      .select("level")
      .eq("team_id", context.teamSeason.team_id)
      .eq("infrastructure_code", "staff_academy")
      .maybeSingle<{ level: number }>(),
    admin
      .from("team_infrastructures")
      .select("level")
      .eq("team_id", context.teamSeason.team_id)
      .eq("infrastructure_code", "international_welcome_center")
      .maybeSingle<{ level: number }>(),
    admin
      .from("staff_naturalizations")
      .select("id", { count: "exact", head: true })
      .eq("team_id", context.teamSeason.team_id)
      .eq("season_id", context.season.id),
  ]);

  assertQuery(batchResult.error, "le marché du staff du jour");
  assertQuery(contractsResult.error, "le staff de l’équipe");
  assertQuery(transactionsResult.error, "le budget projeté");
  assertQuery(countriesResult.error, "les nationalités du staff");
  assertQuery(researchLabResult.error, "le Laboratoire R&D");
  assertQuery(staffAcademyResult.error, "l’Académie des métiers");
  assertQuery(welcomeCenterResult.error, "le Centre d’accueil international");
  assertQuery(
    staffNaturalizationsResult.error,
    "les naturalisations du staff",
  );

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
  const availableListings = listings.filter(
    (listing) => listing.status === "available",
  );
  const contracts = contractsResult.data ?? [];
  const memberIds = [
    ...new Set([
      ...availableListings.map((listing) => listing.staff_member_id),
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
  const { data: talentRows, error: talentsError } =
    memberIds.length > 0
      ? await admin
          .from("staff_member_talents")
          .select("staff_member_id, slot_number, talent_code")
          .in("staff_member_id", memberIds)
          .order("slot_number", { ascending: true })
          .returns<MemberTalentRow[]>()
      : { data: [] as MemberTalentRow[], error: null };

  assertQuery(talentsError, "les talents du staff");
  const membersById = new Map(
    (memberRows ?? []).map((member) => [member.id, member]),
  );
  const talentsByMemberId = groupBy(
    talentRows ?? [],
    (talent) => talent.staff_member_id,
  );
  const countriesById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country]),
  );
  const targetCountry = countriesById.get(
    context.teamSeason.registration_country_id,
  );
  if (!targetCountry) {
    throw new Error("Le pays d’inscription de l’équipe est introuvable.");
  }
  const welcomeCenterLevel = Number(welcomeCenterResult.data?.level ?? 0);
  const staffNaturalizationLimit =
    getStaffNaturalizationSeasonLimit(welcomeCenterLevel);
  const staffNaturalizationUsed = staffNaturalizationsResult.count ?? 0;
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
  const activeNutritionistCount = contracts.filter(
    (contract) =>
      membersById.get(contract.staff_member_id)?.role === "nutritionist",
  ).length;
  const commonBlockReason = getCommonHireBlockReason({
    activeStaffCount,
    staffCapacity,
  });

  const marketListings = availableListings.flatMap((listing) => {
    const memberRow = membersById.get(listing.staff_member_id);
    if (!memberRow) return [];
    const member = toStaffMember({
      member: memberRow,
      country: countriesById.get(memberRow.country_id),
      salaryPerSeason: toNumber(listing.salary_per_season),
      signingFee: toNumber(listing.signing_fee),
      currency: listing.currency_code,
      talents: talentsByMemberId.get(memberRow.id) ?? [],
      teamCountryId: context.teamSeason.registration_country_id,
      currentDayNumber: context.season.current_day_number ?? 1,
    });
    if (!member || !matchesFilters(member, filters)) return [];

    const dueSalary = calculateDueStaffSalary(
      member.salaryPerSeason,
      context.season.current_day_number ?? 1,
    );
    const hireBlockedReason =
      commonBlockReason ??
      (member.role === "research_engineer" &&
      Number(researchLabResult.data?.level ?? 0) < 1
        ? "Construisez le Laboratoire R&D avant de recruter cet ingénieur."
        : null) ??
      (member.role === "educator" &&
      Number(staffAcademyResult.data?.level ?? 0) < 1
        ? "Construisez l’Académie des métiers avant de recruter ce formateur."
        : null) ??
      (member.role === "nutritionist" && activeNutritionistCount >= 3
        ? "Limite atteinte : une équipe ne peut employer que 3 nutritionnistes actifs."
        : null) ??
      (balance < member.signingFee + dueSalary
        ? "Trésorerie insuffisante pour la signature et les échéances déjà dues."
        : null);

    return [
      {
        id: listing.id,
        slot: listing.daily_slot,
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
        talents: talentsByMemberId.get(memberRow.id) ?? [],
        teamCountryId: context.teamSeason.registration_country_id,
        currentDayNumber: context.season.current_day_number ?? 1,
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
    staffAcademyLevel: Number(staffAcademyResult.data?.level ?? 0),
    marketListings,
    teamStaff,
    countries: (countriesResult.data ?? []).map((country) => ({
      name: country.name,
      code: country.iso_alpha2,
    })),
    staffNaturalization: {
      welcomeCenterLevel,
      limit: staffNaturalizationLimit,
      used: staffNaturalizationUsed,
      remaining: Math.max(
        0,
        staffNaturalizationLimit - staffNaturalizationUsed,
      ),
      targetCountryId: targetCountry.id,
      targetCountryName: targetCountry.name,
      targetCountryCode: targetCountry.iso_alpha2,
    },
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
  const candidates = selectedCountries.map((country, index) => {
    const identity = identitiesByCountryId.get(country.id);
    const role = roles[index]!;
    if (!identity) {
      throw new Error(`Aucune identité générée pour ${country.name}.`);
    }

    const trainerSpecialty =
      role === "trainer"
        ? TRAINER_SPECIALTIES[randomInt(0, TRAINER_SPECIALTIES.length)]
        : null;
    const talentCodes = getStaffTalentCodes(role);
    const level = selectStaffLevelFromRoll(
      randomInt(0, STAFF_LEVEL_WEIGHT_TOTAL),
    );

    return {
      country_id: country.id,
      first_name: identity.first_name,
      last_name: identity.last_name,
      role,
      level,
      trainer_specialty: trainerSpecialty,
      architect_specialty:
        role === "architect"
          ? ARCHITECT_SPECIALTIES[randomInt(0, ARCHITECT_SPECIALTIES.length)]
          : null,
      talent_code: selectInitialStaffTalent({
        role,
        trainerSpecialty,
        staffLevel: level,
        roll: randomInt(0, talentCodes.length),
      }),
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
    .select(
      "id, team_id, display_name, cash_balance, currency, registration_country_id",
    )
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
  talents,
  teamCountryId,
  currentDayNumber,
}: {
  member: MemberRow;
  country: CountryRow | undefined;
  contractId?: string | null;
  salaryPerSeason: number;
  signingFee: number;
  currency: string;
  signedAt?: string | null;
  talents: MemberTalentRow[];
  teamCountryId: string;
  currentDayNumber: number;
}): TeamStaffMember | null {
  if (!country || !isStaffRole(member.role)) return null;
  const role = member.role;
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
  const parsedTalents = talents.flatMap((talent) => {
    if (!isStaffTalentForRole(talent.talent_code, role)) return [];
    const code = talent.talent_code;

    return [
      {
        slot: talent.slot_number,
        code,
        label: STAFF_TALENT_DEFINITIONS[code].label,
        description: describeStaffTalent(code, member.level),
      },
    ];
  });

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
    talents: parsedTalents,
    nationalityAffinity:
      member.role !== "trainer" && country.id === teamCountryId,
    salaryPerSeason,
    salaryPerWeek: calculateStaffWeeklySalary(salaryPerSeason),
    signingFee,
    currency,
    signedAt,
    remainingCurrentSeasonSalary: calculateRemainingStaffSalary(
      salaryPerSeason,
      currentDayNumber,
    ),
    dismissalCompensation: calculateStaffDismissalCompensation(
      salaryPerSeason,
      currentDayNumber,
    ),
  };
}

function matchesFilters(member: TeamStaffMember, filters: StaffMarketFilters) {
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

function groupBy<T>(values: readonly T[], key: (value: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const value of values) {
    const groupKey = key(value);
    grouped.set(groupKey, [...(grouped.get(groupKey) ?? []), value]);
  }
  return grouped;
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
