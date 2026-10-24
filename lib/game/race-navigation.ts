export const RACE_REGISTRATION_ANCHOR = "inscription";

export function getRaceProfileHref(raceSlug: string) {
  return `/jeu/courses/${encodeURIComponent(raceSlug.trim())}`;
}

export function getRaceRegistrationHref(raceSlug: string) {
  return `${getRaceProfileHref(raceSlug)}#${RACE_REGISTRATION_ANCHOR}`;
}

export function isRaceCalendarHref(href: string) {
  return /^\/jeu\/calendrier\/?(?:[?#]|$)/.test(href);
}

/** Only the return from a canonical course profile needs a fresh document. */
export function shouldUseRaceCalendarDocumentNavigation(
  currentPathname: string,
  targetPathname: string,
) {
  return /^\/jeu\/courses\/[^/]+\/?$/.test(currentPathname)
    && isRaceCalendarHref(targetPathname);
}

/**
 * Registration links are action links, not race-profile preview links.
 * Keeping this intent check next to the canonical URL builder prevents a
 * registration CTA from being captured by the global race preview again.
 */
export function isRaceRegistrationHref(href: string) {
  const hashIndex = href.indexOf("#");
  if (hashIndex === -1) return false;

  const fragment = href.slice(hashIndex + 1);
  if (fragment !== RACE_REGISTRATION_ANCHOR) return false;

  const pathname = href
    .slice(0, hashIndex)
    .split("?", 1)[0]
    .replace(/\/+$/, "");

  return /^\/jeu\/courses\/[^/]+$/.test(pathname);
}
