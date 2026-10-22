type GazetteEditionReference = {
  id: string;
  dayNumber: number;
};

type GazetteArchiveSeasonReference = {
  gameYear: number;
  editions: Array<{ id: string }>;
};

export function getCyclogazetteOpeningSourceGameYear(
  edition: GazetteEditionReference | null,
  archive: GazetteArchiveSeasonReference[],
) {
  if (!edition || edition.dayNumber !== 1) return null;
  const editionSeason = archive.find((season) =>
    season.editions.some((entry) => entry.id === edition.id),
  );
  return editionSeason && editionSeason.gameYear > 1
    ? editionSeason.gameYear - 1
    : null;
}

export function selectCyclogazetteOpeningAwards<T extends { gameYear: number }>(
  edition: GazetteEditionReference | null,
  archive: GazetteArchiveSeasonReference[],
  awards: T[],
) {
  if (!edition || edition.dayNumber !== 1) return [];

  const editionSeason = archive.find((season) =>
    season.editions.some((entry) => entry.id === edition.id),
  );
  if (!editionSeason) return [];

  return awards.filter((award) => award.gameYear === editionSeason.gameYear - 1);
}

export function selectCyclogazetteGalaAwards<T extends { gameYear: number }>(
  edition: GazetteEditionReference | null,
  archive: GazetteArchiveSeasonReference[],
  awards: T[],
) {
  if (!edition || edition.dayNumber !== 28) return [];

  const editionSeason = archive.find((season) =>
    season.editions.some((entry) => entry.id === edition.id),
  );
  if (!editionSeason) return [];

  return awards.filter((award) => award.gameYear === editionSeason.gameYear);
}
