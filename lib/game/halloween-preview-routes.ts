/** Route allowlist only: safe to import into authentication without the item catalogue. */
export const HALLOWEEN_PREVIEW_BOARDS = [
  { slug: "bureau", label: "Faux bureau" },
  { slug: "evenement", label: "Accueil Halloween" },
  { slug: "equipier-sans-tete", label: "Cycling Hollow" },
  { slug: "trick-or-treat", label: "Trick or Treat" },
  { slug: "boutique", label: "Boutique & avatars" },
  { slug: "boutons", label: "Boutons du site" },
  { slug: "site", label: "Accueil & rubriques" },
  // Keep existing private links usable, but do not advertise the superseded boards.
  { slug: "cycliste-sans-tete", label: "Ancien lien · poursuite", legacy: true },
  { slug: "mauvais-bonbons", label: "Ancien lien · boutique", legacy: true },
] as const;

export type HalloweenPreviewBoard = (typeof HALLOWEEN_PREVIEW_BOARDS)[number]["slug"];
export function isHalloweenPreviewBoard(value: string): value is HalloweenPreviewBoard {
  return HALLOWEEN_PREVIEW_BOARDS.some((board) => board.slug === value);
}

export const HALLOWEEN_PILOT_BOARDS = ["bureau", "evenement", "equipier-sans-tete", "trick-or-treat", "boutique"] as const;
export type HalloweenPilotBoard = (typeof HALLOWEEN_PILOT_BOARDS)[number];
export function isHalloweenPilotBoard(value: string): value is HalloweenPilotBoard {
  return HALLOWEEN_PILOT_BOARDS.some((board) => board === value);
}
export function halloweenPilotHref(board: HalloweenPilotBoard) {
  return `/apercus/halloween/pilote/${board}`;
}

/** Presentation links only. Never rewrites an arbitrary return URL. */
export function resolveHalloweenPresentationHref(href: string, pilot: boolean): string {
  if (!pilot) return href;
  if (href === "/jeu") return halloweenPilotHref("bureau");
  const prefix = "/apercus/halloween/";
  if (!href.startsWith(prefix)) return href;
  const board = href.slice(prefix.length);
  return isHalloweenPilotBoard(board) ? halloweenPilotHref(board) : href;
}
