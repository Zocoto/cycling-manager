const LOCAL_ORIGIN = "https://cycling-manager.local";
const STAFF_ALERT_SOURCE_PREFIX = "recruitment-alert:staff:";

export const STAFF_RECRUITMENT_ALERTS_HREF = "/jeu/staff?onglet=marche&alertes=1";

export function normalizeStaffMarketListingId(value: string | null | undefined) {
  return value && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase()
    : undefined;
}

/** Resolve legacy mail anchors as well as current targeted links, without a DB rewrite. */
export function getStaffRecruitmentTargetHref(href: string | null) {
  if (!href || !href.startsWith("/") || href.startsWith("//")) return null;
  try {
    const url = new URL(href, LOCAL_ORIGIN);
    if (url.origin !== LOCAL_ORIGIN || url.pathname !== "/jeu/staff" ||
      (url.searchParams.has("onglet") && url.searchParams.get("onglet") !== "marche")) return null;
    const listingId = normalizeStaffMarketListingId(url.searchParams.get("profil")) ??
      normalizeStaffMarketListingId(url.hash.startsWith("#staff-") ? url.hash.slice(7) : null);
    return listingId
      ? `/jeu/staff?onglet=marche&profil=${listingId}#staff-${listingId}`
      : null;
  } catch {
    return null;
  }
}

/** Match exactly the non-archived notification sources counted by the assistant. */
export function filterStaffMarketAlertListings<T extends { id: string }>(
  listings: T[],
  { listingId, alertSourceReferences }: {
    listingId?: string;
    alertSourceReferences?: readonly string[];
  },
): T[] {
  if (listingId) return listings.filter((listing) => listing.id === listingId);
  if (alertSourceReferences === undefined) return listings;
  const sources = new Set(alertSourceReferences);
  return listings.filter((listing) => sources.has(`${STAFF_ALERT_SOURCE_PREFIX}${listing.id}`));
}
