import {
  RIDER_PRIMARY_RATING_KEYS,
  RIDER_RATING_AXES,
  RIDER_SECONDARY_RATING_KEYS,
  type RiderRatingKey,
} from "@/lib/game/rider-profile";
import type { ItemTargetRider } from "@/lib/game/item-target-values";

export const DAILY_REWARD_SEASON_LENGTH = 28;
export const DAILY_REWARD_CYCLE_LENGTH = 40;

export type DailyRewardEffectKind =
  | "form_boost"
  | "rider_experience"
  | "rating_boost"
  | "training_multiplier"
  | "scouting_boost"
  | "equipment"
  | "special_ability"
  | "naturalization"
  | "wildcard"
  | "instant_youth_promotion"
  | "custom_staff_recruitment"
  | "construction_time_reduction"
  | "staff_level_boost";

export type DailyRewardOffer = {
  key: string;
  name: string;
  description: string;
  effectSummary: string;
  importance: number;
  effectKind: DailyRewardEffectKind;
  iconKey: string;
  payload: Record<string, unknown>;
};

export type DailyRewardInventoryItem = DailyRewardOffer & {
  id: string;
  quantity: number;
  acquiredAt: string;
  expiresAfterGameYear: number;
};

export type DailyRewardRider = ItemTargetRider;

export type DailyRewardRace = {
  id: string;
  name: string;
  firstDayNumber: number;
};

export type DailyRewardAbility = {
  code: string;
  name: string;
  effectSummary: string;
};

export type DailyRewardAcademyRider = {
  id: string;
  name: string;
  age: number;
  promotionGameYear: number | null;
};

export type DailyRewardCountry = {
  id: string;
  name: string;
  code: string;
};

export type DailyRewardConstructionProject = {
  id: string;
  name: string;
  targetLevel: number;
  remainingDays: number;
};

export type DailyRewardStaffMember = {
  contractId: string;
  name: string;
  roleLabel: string;
  level: number;
};

export type DailyRewardOverview = {
  seasonId: string;
  seasonName: string;
  gameYear: number;
  currentDayNumber: number;
  seasonLength: number;
  claimedToday: boolean;
  availableToday: boolean;
  consecutiveDays: number;
  prospectiveStreakDay: number;
  importance: number;
  claimedSeasonDays: number[];
  offers: DailyRewardOffer[];
  inventory: DailyRewardInventoryItem[];
  riders: DailyRewardRider[];
  eligibleRaces: DailyRewardRace[];
  abilities: DailyRewardAbility[];
  academyRiders: DailyRewardAcademyRider[];
  countries: DailyRewardCountry[];
  constructionProjects: DailyRewardConstructionProject[];
  staffMembers: DailyRewardStaffMember[];
};

export const DAILY_REWARD_RATING_OPTIONS = RIDER_RATING_AXES.map((axis) => ({
  key: axis.key,
  databaseKey: toDatabaseRatingKey(axis.key),
  label: axis.label,
  shortLabel: axis.shortLabel,
  importance: axis.importance,
}));

export function getDailyRewardImportance(streakDay: number): number {
  const cycleDay =
    ((Math.max(1, streakDay) - 1) % DAILY_REWARD_CYCLE_LENGTH) + 1;

  if (cycleDay === 40) return 10;
  if (cycleDay === 36) return 9;
  if (cycleDay === 32) return 8;
  if (cycleDay === 28) return 7;
  if ([21, 27, 31, 35, 39].includes(cycleDay)) return 6;
  if ([25, 30, 34, 38].includes(cycleDay)) return 5;
  if ([14, 18, 22, 23, 24, 26, 29, 33, 37].includes(cycleDay)) return 4;
  if ([7, 11, 15, 16, 17, 19, 20].includes(cycleDay)) return 3;
  if ([4, 8, 9, 10, 12, 13].includes(cycleDay)) return 2;
  return 1;
}

export function getNextDailyRewardCycleDay(currentCycleDay: number): number {
  if (currentCycleDay >= DAILY_REWARD_CYCLE_LENGTH) return 1;
  if (currentCycleDay < 1) return 1;
  return currentCycleDay + 1;
}

export function getRatingOptionsForOffer(offer: DailyRewardOffer) {
  const scope = readString(offer.payload.statScope);

  if (scope === "primary") {
    return DAILY_REWARD_RATING_OPTIONS.filter((option) =>
      (RIDER_PRIMARY_RATING_KEYS as readonly RiderRatingKey[]).includes(
        option.key,
      ),
    );
  }

  if (scope === "secondary") {
    return DAILY_REWARD_RATING_OPTIONS.filter((option) =>
      (RIDER_SECONDARY_RATING_KEYS as readonly RiderRatingKey[]).includes(
        option.key,
      ),
    );
  }

  return DAILY_REWARD_RATING_OPTIONS;
}

export function requiresRiderTarget(kind: DailyRewardEffectKind) {
  return [
    "form_boost",
    "rider_experience",
    "rating_boost",
    "special_ability",
    "naturalization",
  ].includes(kind);
}

export function isStackableDailyReward(kind: DailyRewardEffectKind) {
  return ["form_boost", "rider_experience", "rating_boost"].includes(kind);
}

export function groupDailyRewardInventoryItems(
  items: readonly DailyRewardInventoryItem[],
): DailyRewardInventoryItem[] {
  const grouped = new Map<string, DailyRewardInventoryItem>();

  for (const item of items) {
    const existing = grouped.get(item.key);
    if (!existing) {
      grouped.set(item.key, {
        ...item,
        quantity: Math.max(1, item.quantity),
      });
      continue;
    }

    const itemExpiresFirst =
      item.expiresAfterGameYear < existing.expiresAfterGameYear ||
      (item.expiresAfterGameYear === existing.expiresAfterGameYear &&
        item.acquiredAt.localeCompare(existing.acquiredAt) < 0);

    grouped.set(item.key, {
      ...existing,
      id: itemExpiresFirst ? item.id : existing.id,
      acquiredAt: itemExpiresFirst ? item.acquiredAt : existing.acquiredAt,
      expiresAfterGameYear: Math.min(
        existing.expiresAfterGameYear,
        item.expiresAfterGameYear,
      ),
      quantity: existing.quantity + Math.max(1, item.quantity),
    });
  }

  return [...grouped.values()].sort(
    (left, right) =>
      right.importance - left.importance ||
      left.name.localeCompare(right.name, "fr"),
  );
}

export function toDatabaseRatingKey(key: RiderRatingKey) {
  return key === "timeTrial" ? "time_trial" : key;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}
