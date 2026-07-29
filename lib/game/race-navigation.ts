export const RACE_REGISTRATION_ANCHOR = "inscription";

export function getRaceProfileHref(raceSlug: string) {
  return `/jeu/courses/${encodeURIComponent(raceSlug.trim())}`;
}

export function getRaceRegistrationHref(raceSlug: string) {
  return `${getRaceProfileHref(raceSlug)}#${RACE_REGISTRATION_ANCHOR}`;
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
