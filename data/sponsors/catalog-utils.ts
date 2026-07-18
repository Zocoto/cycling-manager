import type { Sponsor } from "@/types/sponsor";

import { SPONSORS } from "./index";

export function getSponsorById(
  sponsorId: string
): Sponsor | undefined {
  return SPONSORS.find((sponsor) => sponsor.id === sponsorId);
}

export function getSponsorsByCountryCode(
  countryCode: string
): Sponsor[] {
  const normalizedCountryCode = countryCode.trim().toUpperCase();

  return SPONSORS.filter(
    (sponsor) => sponsor.countryCode === normalizedCountryCode
  );
}