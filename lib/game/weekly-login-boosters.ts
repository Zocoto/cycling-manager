export const WEEKLY_LOGIN_BOOSTER_INTERVAL = 7;
export const WEEKLY_LOGIN_BOOSTER_FIRST_SEASON = 5;

export type WeeklyLoginBoosterProgress = {
  consecutiveDays: number;
  totalBoostersAwarded: number;
  boosterAwardedToday: boolean;
};

export function normalizeWeeklyLoginBoosterProgress(value: unknown): WeeklyLoginBoosterProgress | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const consecutiveDays = Number(raw.consecutiveDays);
  const totalBoostersAwarded = Number(raw.totalBoostersAwarded);
  if (!Number.isSafeInteger(consecutiveDays) || consecutiveDays < 0 ||
    !Number.isSafeInteger(totalBoostersAwarded) || totalBoostersAwarded < 0) return null;
  return { consecutiveDays, totalBoostersAwarded, boosterAwardedToday: raw.boosterAwardedToday === true };
}

export function getWeeklyLoginBoosterWeek(consecutiveDays: number) {
  const days = Math.max(0, Math.floor(consecutiveDays));
  return {
    completedDays: days === 0 ? 0 : (days - 1) % WEEKLY_LOGIN_BOOSTER_INTERVAL + 1,
    daysUntilNextBooster: WEEKLY_LOGIN_BOOSTER_INTERVAL - days % WEEKLY_LOGIN_BOOSTER_INTERVAL,
  };
}
