export const FEDERATION_JUNIOR_MIN_AGE = 16;
export const FEDERATION_JUNIOR_MAX_AGE = 18;

export function getFederationJuniorBirthYearRange(gameYear: number) {
  return {
    minBirthGameYear: gameYear - FEDERATION_JUNIOR_MAX_AGE,
    maxBirthGameYear: gameYear - FEDERATION_JUNIOR_MIN_AGE,
  };
}

export function isFederationJuniorAgeEligible({
  gameYear,
  birthGameYear,
}: {
  gameYear: number;
  birthGameYear: number;
}) {
  const age = gameYear - birthGameYear;
  return age >= FEDERATION_JUNIOR_MIN_AGE && age <= FEDERATION_JUNIOR_MAX_AGE;
}
