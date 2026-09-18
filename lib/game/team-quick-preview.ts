export type TeamQuickPreview = {
  id: string;
  name: string;
  countryName: string;
  countryCode: string;
  divisionName: string | null;
  sponsorName: string | null;
  directorName: string | null;
  ranking: { rank: number; points: number } | null;
};

export function getTeamIdFromProfileHref(href: string): string | null {
  const pathname = href.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  const match = pathname.match(/^\/jeu\/equipes\/([^/]+)$/);
  if (!match) return null;
  try {
    const id = decodeURIComponent(match[1]);
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
      ? id
      : null;
  } catch {
    return null;
  }
}
