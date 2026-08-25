import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DAILY_REWARD_SEASON_LENGTH,
  groupDailyRewardInventoryItems,
  type DailyRewardAbility,
  type DailyRewardAcademyRider,
  type DailyRewardCountry,
  type DailyRewardConstructionProject,
  type DailyRewardEffectKind,
  type DailyRewardInventoryItem,
  type DailyRewardOffer,
  type DailyRewardOverview,
  type DailyRewardRace,
  type DailyRewardStaffMember,
} from "@/lib/game/daily-rewards";
import { getCurrentTeamItemTargetRiders } from "@/services/item-target-values";
import {
  getScoutingSupervisionStatus,
  normalizeScoutingSupervisionEffects,
} from "@/lib/game/scouting-supervision";

type RawOverview = {
  seasonId?: unknown;
  seasonName?: unknown;
  gameYear?: unknown;
  currentDayNumber?: unknown;
  claimedToday?: unknown;
  availableToday?: unknown;
  consecutiveDays?: unknown;
  prospectiveStreakDay?: unknown;
  importance?: unknown;
  claimedSeasonDays?: unknown;
  offers?: unknown;
  inventory?: unknown;
  riders?: unknown;
  eligibleRaces?: unknown;
  abilities?: unknown;
};

export async function getCurrentDailyRewardOverview(
  supabase: SupabaseClient,
): Promise<DailyRewardOverview | null> {
  const [result, managementTargetsResult] = await Promise.all([
    supabase.rpc("get_current_daily_reward_overview"),
    supabase.rpc("get_current_management_reward_targets"),
  ]);

  if (result.error) {
    throw new Error(
      `Impossible de charger les récompenses quotidiennes : ${result.error.message}`,
    );
  }

  if (!result.data || typeof result.data !== "object") return null;
  if (managementTargetsResult.error) {
    throw new Error(
      `Impossible de charger les cibles des objets de gestion : ${managementTargetsResult.error.message}`,
    );
  }

  const raw = result.data as RawOverview;
  const rawManagementTargets = readObject(managementTargetsResult.data);
  const seasonId = readString(raw.seasonId);
  if (!seasonId) return null;
  const gameYear = readNumber(raw.gameYear, 1);
  const [
    riders,
    academyResult,
    countriesResult,
    staffAcademyResult,
    scoutingSupervisionResult,
  ] = await Promise.all([
    getCurrentTeamItemTargetRiders(supabase),
    supabase
      .from("youth_academy_riders")
      .select("id, first_name, last_name, birth_game_year, promotion_game_year")
      .in("status", ["active", "recruited"])
      .order("last_name")
      .order("first_name"),
    supabase
      .from("countries")
      .select("id, name, iso_alpha2")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("team_infrastructures")
      .select("level")
      .eq("infrastructure_code", "staff_academy")
      .gt("level", 0)
      .maybeSingle<{ level: number }>(),
    supabase.rpc("get_current_scouting_supervision_status"),
  ]);

  if (academyResult.error) {
    throw new Error(
      `Impossible de charger les juniors éligibles : ${academyResult.error.message}`,
    );
  }
  if (countriesResult.error) {
    throw new Error(
      `Impossible de charger les nationalités du staff : ${countriesResult.error.message}`,
    );
  }
  if (staffAcademyResult.error) {
    throw new Error(
      `Impossible de vérifier l’Académie des métiers : ${staffAcademyResult.error.message}`,
    );
  }
  if (scoutingSupervisionResult.error) {
    throw new Error(
      `Impossible de charger le bonus de supervision du scouting : ${scoutingSupervisionResult.error.message}`,
    );
  }

  const academyRiders = (academyResult.data ?? []).flatMap((row) => {
    const age = gameYear - Number(row.birth_game_year);
    if (!Number.isInteger(age) || age < 17) return [];
    return [
      {
        id: row.id,
        name: `${row.first_name} ${row.last_name}`.trim(),
        age,
        promotionGameYear:
          row.promotion_game_year === null
            ? null
            : Number(row.promotion_game_year),
      } satisfies DailyRewardAcademyRider,
    ];
  });
  const countries = (countriesResult.data ?? []).map(
    (row) =>
      ({
        id: row.id,
        name: row.name,
        code: row.iso_alpha2,
      }) satisfies DailyRewardCountry,
  );
  const scoutingSupervisionPayload = readObject(
    scoutingSupervisionResult.data,
  );
  const scoutingSupervisionEffects = normalizeScoutingSupervisionEffects(
    scoutingSupervisionPayload.effects,
  );
  const currentDayNumber = readNumber(raw.currentDayNumber, 1);

  return {
    seasonId,
    seasonName: readString(raw.seasonName) || "Saison en cours",
    gameYear,
    currentDayNumber,
    seasonLength: DAILY_REWARD_SEASON_LENGTH,
    claimedToday: Boolean(raw.claimedToday),
    availableToday: Boolean(raw.availableToday),
    consecutiveDays: readNumber(raw.consecutiveDays, 0),
    prospectiveStreakDay: readNumber(raw.prospectiveStreakDay, 1),
    importance: readNumber(raw.importance, 1),
    claimedSeasonDays: readArray(raw.claimedSeasonDays)
      .map((value) => readNumber(value, 0))
      .filter((value) => value >= 1 && value <= DAILY_REWARD_SEASON_LENGTH),
    offers: readArray(raw.offers).flatMap(normalizeOffer),
    inventory: groupDailyRewardInventoryItems(
      readArray(raw.inventory)
        .flatMap(normalizeInventoryItem)
        .filter((item) => item.effectKind !== "equipment"),
    ),
    riders,
    eligibleRaces: readArray(raw.eligibleRaces).flatMap(normalizeRace),
    abilities: readArray(raw.abilities).flatMap(normalizeAbility),
    academyRiders,
    countries,
    staffAcademyBuilt: Number(staffAcademyResult.data?.level ?? 0) > 0,
    constructionProjects: readArray(
      rawManagementTargets.constructionProjects,
    ).flatMap(normalizeConstructionProject),
    staffMembers: readArray(rawManagementTargets.staffMembers).flatMap(
      normalizeStaffMember,
    ),
    scoutingSupervision: getScoutingSupervisionStatus(
      scoutingSupervisionEffects,
      currentDayNumber,
    ),
  };
}

function normalizeOffer(value: unknown): DailyRewardOffer[] {
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  const key = readString(row.key);
  const effectKind = readEffectKind(row.effectKind);
  if (!key || !effectKind) return [];

  return [
    {
      key,
      name: readString(row.name) || "Cadeau quotidien",
      description: readString(row.description),
      effectSummary: readString(row.effectSummary),
      importance: readNumber(row.importance, 1),
      effectKind,
      iconKey: readString(row.iconKey) || "gift",
      payload: readObject(row.payload),
    },
  ];
}

function normalizeInventoryItem(value: unknown): DailyRewardInventoryItem[] {
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  const offers = normalizeOffer(row);
  const id = readString(row.id);
  if (!id || offers.length === 0) return [];

  return [
    {
      ...offers[0],
      id,
      quantity: 1,
      acquiredAt: readString(row.acquiredAt),
      expiresAfterGameYear: readNumber(row.expiresAfterGameYear, 1),
    },
  ];
}


function normalizeRace(value: unknown): DailyRewardRace[] {
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  const id = readString(row.id);
  const name = readString(row.name);
  if (!id || !name) return [];
  return [{ id, name, firstDayNumber: readNumber(row.firstDayNumber, 1) }];
}

function normalizeAbility(value: unknown): DailyRewardAbility[] {
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  const code = readString(row.code);
  const name = readString(row.name);
  if (!code || !name) return [];
  return [{ code, name, effectSummary: readString(row.effectSummary) }];
}

function normalizeConstructionProject(
  value: unknown,
): DailyRewardConstructionProject[] {
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  const id = readString(row.id);
  const name = readString(row.name);
  const targetLevel = readNumber(row.targetLevel, 0);
  const remainingDays = readNumber(row.remainingDays, 0);
  if (!id || !name || targetLevel < 1 || remainingDays < 1) return [];
  return [{ id, name, targetLevel, remainingDays }];
}

function normalizeStaffMember(value: unknown): DailyRewardStaffMember[] {
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  const contractId = readString(row.contractId);
  const name = readString(row.name);
  const roleLabel = readString(row.roleLabel);
  const level = readNumber(row.level, 0);
  if (!contractId || !name || !roleLabel || level < 1 || level >= 5) return [];
  return [{ contractId, name, roleLabel, level }];
}

function readEffectKind(value: unknown): DailyRewardEffectKind | null {
  const normalized = readString(value);
  const allowed: DailyRewardEffectKind[] = [
    "form_boost",
    "rider_experience",
    "rating_boost",
    "training_multiplier",
    "scouting_boost",
    "equipment",
    "special_ability",
    "naturalization",
    "wildcard",
    "instant_youth_promotion",
    "custom_staff_recruitment",
    "construction_time_reduction",
    "staff_level_boost",
  ];
  return allowed.includes(normalized as DailyRewardEffectKind)
    ? (normalized as DailyRewardEffectKind)
    : null;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}


function readNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
