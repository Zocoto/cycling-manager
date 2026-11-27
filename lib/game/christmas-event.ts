export const CHRISTMAS_EVENT_ID = "christmas-2026";
export const CHRISTMAS_EVENT_HREF = "/jeu/noel";
export const CHRISTMAS_STARTS_AT = "2026-11-30T23:00:00.000Z";
export const CHRISTMAS_ENDS_AT = "2026-12-31T23:00:00.000Z";

export type ChristmasEventPhase = "upcoming" | "open" | "closed";

/** Event and visual opening follow Paris midnight, never a browser preview date. */
export function getChristmasEventPhase(now = new Date()): ChristmasEventPhase {
  const time = now.getTime();
  if (!Number.isFinite(time) || time >= Date.parse(CHRISTMAS_ENDS_AT)) return "closed";
  return time < Date.parse(CHRISTMAS_STARTS_AT) ? "upcoming" : "open";
}

export function isChristmasEventOpen(now = new Date()): boolean {
  return getChristmasEventPhase(now) === "open";
}
