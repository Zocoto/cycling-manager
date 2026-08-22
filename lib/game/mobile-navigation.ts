export type MobileNavigationGroup = {
  readonly label: string;
  readonly links: ReadonlyArray<readonly [string, string]>;
};

export const MOBILE_VISIBLE_DESTINATIONS = new Set([
  "/jeu",
  "/jeu/effectif",
  "/jeu/transferts",
  "/jeu/calendrier",
  "/jeu/preparation-course",
  "/jeu/resultats",
  "/jeu/messagerie",
  "/jeu/chat",
  "/jeu/gazette",
  "/jeu/recherche",
]);

export function getMobileMoreNavigationGroups(
  groups: ReadonlyArray<MobileNavigationGroup>,
) {
  return groups
    .map((group) => ({
      ...group,
      links: group.links.filter(
        ([, href]) => !MOBILE_VISIBLE_DESTINATIONS.has(href),
      ),
    }))
    .filter((group) => group.links.length > 0);
}
