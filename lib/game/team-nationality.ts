export type TeamNationality = {
  countryCode: string;
  countryName: string;
  source: "sponsor" | "amateur";
};

export function resolveTeamNationality({
  sponsorCountryCode,
  amateurCountryCode,
  amateurCountryName,
}: {
  sponsorCountryCode?: string | null;
  amateurCountryCode?: string | null;
  amateurCountryName?: string | null;
}): TeamNationality | null {
  const normalizedSponsorCountryCode = normalizeCountryCode(sponsorCountryCode);

  if (normalizedSponsorCountryCode) {
    return {
      countryCode: normalizedSponsorCountryCode,
      countryName: getFrenchCountryName(normalizedSponsorCountryCode),
      source: "sponsor",
    };
  }

  const normalizedAmateurCountryCode = normalizeCountryCode(amateurCountryCode);
  const normalizedAmateurCountryName = amateurCountryName?.trim();

  if (!normalizedAmateurCountryCode || !normalizedAmateurCountryName) {
    return null;
  }

  return {
    countryCode: normalizedAmateurCountryCode,
    countryName: normalizedAmateurCountryName,
    source: "amateur",
  };
}

function normalizeCountryCode(countryCode?: string | null): string | null {
  const normalizedCountryCode = countryCode?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(normalizedCountryCode)
    ? normalizedCountryCode
    : null;
}

function getFrenchCountryName(countryCode: string): string {
  const countryNames = new Intl.DisplayNames(["fr"], { type: "region" });
  return countryNames.of(countryCode) ?? countryCode;
}
