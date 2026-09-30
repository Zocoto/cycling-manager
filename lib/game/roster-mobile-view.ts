export const ROSTER_MOBILE_VIEW_COOKIE = "cyclostratege-roster-mobile-view";

export type RosterMobileView = "synthese" | "fiches";

export function parseRosterMobileView(
  value: string | undefined,
): RosterMobileView | null {
  return value === "synthese" || value === "fiches" ? value : null;
}
