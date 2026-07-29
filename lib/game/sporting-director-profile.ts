export function getSportingDirectorProfileHref(
  sportingDirectorId: string,
): string {
  const normalizedId = sportingDirectorId.trim();

  if (!normalizedId) {
    return "/jeu/classements?vue=equipes";
  }

  return `/jeu/directeurs-sportifs/${encodeURIComponent(normalizedId)}`;
}