/** Visual skin only. Does not activate Halloween games, rewards or inventory. */
export type AnnualThemeWindow = { start: { month: number; day: number }; end: { month: number; day: number } };
export type SeasonalThemeConfiguration = { enabled: boolean; window: AnnualThemeWindow | null };

// Approved seasonal skin: October 9 through November 2 inclusive, Paris civil dates.
// Visual only: dates match the live edition; rewards remain governed by the server.
// Disabling this configuration restores the usual UI.
export const HALLOWEEN_SITE_THEME: SeasonalThemeConfiguration = {
  enabled: true,
  window: { start: { month: 10, day: 9 }, end: { month: 11, day: 2 } },
};
const parisDate = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", month: "numeric", day: "numeric" });

function validDay({ month, day }: { month: number; day: number }) {
  const lengths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= lengths[month - 1];
}

export function isInAnnualThemeWindow(now: Date, window: AnnualThemeWindow): boolean {
  if (!Number.isFinite(now.getTime()) || !validDay(window.start) || !validDay(window.end)) return false;
  const parts = parisDate.formatToParts(now);
  const day = Number(parts.find((part) => part.type === "month")?.value) * 100 + Number(parts.find((part) => part.type === "day")?.value);
  const start = window.start.month * 100 + window.start.day;
  const end = window.end.month * 100 + window.end.day;
  return start <= end ? day >= start && day <= end : day >= start || day <= end;
}

export function getActiveSiteTheme(now = new Date(), configuration = HALLOWEEN_SITE_THEME): "halloween" | undefined {
  if (!configuration.enabled || !configuration.window) return undefined;
  return isInAnnualThemeWindow(now, configuration.window) ? "halloween" : undefined;
}

/** Paris offsets are whole hours: checking on the next UTC hour covers civil midnight,
 * including DST, without a per-second animation, interval or network request. */
export function nextSiteThemeCheckDelay(now: Date): number {
  if (!Number.isFinite(now.getTime())) return 3600000;
  const nextHour = new Date(now);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
  return Math.max(1, nextHour.getTime() - now.getTime());
}
