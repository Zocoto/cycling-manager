import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DAILY_REWARD_SEASON_LENGTH,
  groupDailyRewardInventoryItems,
  type DailyRewardAbility,
  type DailyRewardAcademyRider,
  type DailyRewardCountry,
  type DailyRewardEffectKind,
  type DailyRewardInventoryItem,
  type DailyRewardOffer,
  type DailyRewardOverview,
  type DailyRewardRace,
} from "@/lib/game/daily-rewards";
import { getCurrentTeamItemTargetRiders } from "@/services/item-target-values";

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
  const result = await supabase.rpc("get_current_daily_reward_overview");

  if (result.error) {
    throw new Error(
      `Impossible de charger les récompenses quotidiennes : ${result.error.message}`,
    );
  }

  if (!result.data || typeof result.data !== "object") return null;

  const raw = result.data as RawOverview;
  const seasonId = readString(raw.seasonId);
  if (!seasonId) return null;
  const gameYear = readNumber(raw.gameYear, 1);
  const [riders, academyResult, countriesResult] = await Promise.all([
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

  return {
    seasonId,
    seasonName: readString(raw.seasonName) || "Saison en cours",
    gameYear,
    currentDayNumber: readNumber(raw.currentDayNumber, 1),
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
