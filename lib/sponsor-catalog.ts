import { SPONSORS } from "@/data/sponsors";
import type { Sponsor } from "@/types/sponsor";

export function findSponsorByName(
  sponsorName: string | null | undefined
): Sponsor | null {
  const normalizedName = normalizeSponsorName(sponsorName);

  if (!normalizedName) {
    return null;
  }

  return (
    SPONSORS.find(
      (sponsor) =>
        normalizeSponsorName(sponsor.name) === normalizedName ||
        normalizeSponsorName(sponsor.shortName) === normalizedName
    ) ?? null
  );
}

function normalizeSponsorName(
  sponsorName: string | null | undefined
): string {
  return (sponsorName ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("fr");
}
