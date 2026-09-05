type GazetteEditionReference = {
  id: string;
  dayNumber: number;
};

type GazetteArchiveSeasonReference = {
  gameYear: number;
  editions: Array<{ id: string }>;
};

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

  const previousGameYear = awards
    .filter((award) => award.gameYear < editionSeason.gameYear)
    .reduce<number | null>(
      (latest, award) =>
        latest === null || award.gameYear > latest ? award.gameYear : latest,
      null,
    );

  return previousGameYear === null
    ? []
    : awards.filter((award) => award.gameYear === previousGameYear);
}
