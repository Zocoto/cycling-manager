import { describe, expect, it } from "vitest";

import afghanistan from "@/data/rider-names/afghanistan.json";
import arabianPeninsula from "@/data/rider-names/arabian_peninsula.json";
import centralAsia from "@/data/rider-names/central_asia.json";
import middleEastArabic from "@/data/rider-names/middle_east_arabic.json";
import profilesManifest from "@/data/rider-names/profiles.json";
import {
  generateRiderIdentities,
  hasRiderNameLibrary,
} from "@/lib/rider-names/generate-rider-identities";

describe("rider name libraries", () => {
  it("keeps every declared profile connected to a 100-name library", () => {
    const profileCodes = profilesManifest.profiles.map((profile) => profile.code);

    expect(new Set(profileCodes).size).toBe(profileCodes.length);
    expect(profileCodes).toHaveLength(39);

    for (const profileCode of profileCodes) {
      expect(hasRiderNameLibrary(profileCode), profileCode).toBe(true);

      const identities = generateRiderIdentities(
        profileCode,
        profilesManifest.minimumFirstNames,
      );

      expect(new Set(identities.map((identity) => identity.first_name)).size).toBe(
        profilesManifest.minimumFirstNames,
      );
      expect(new Set(identities.map((identity) => identity.last_name)).size).toBe(
        profilesManifest.minimumLastNames,
      );
    }
  });

  it("separates Afghanistan from the Turkic Central Asian pool", () => {
    expect(afghanistan.firstNames.length).toBeGreaterThanOrEqual(120);
    expect(afghanistan.lastNames.length).toBeGreaterThanOrEqual(120);
    expect(overlapRatio(afghanistan.lastNames, centralAsia.lastNames)).toBeLessThan(
      0.08,
    );
  });

  it("separates Arabian Peninsula family names from Levant and Iraq", () => {
    expect(arabianPeninsula.firstNames.length).toBeGreaterThanOrEqual(120);
    expect(arabianPeninsula.lastNames.length).toBeGreaterThanOrEqual(110);
    expect(middleEastArabic.firstNames.length).toBeGreaterThanOrEqual(100);
    expect(middleEastArabic.lastNames.length).toBeGreaterThanOrEqual(100);
    expect(
      overlapRatio(arabianPeninsula.lastNames, middleEastArabic.lastNames),
    ).toBeLessThan(0.08);
  });
});

function overlapRatio(left: string[], right: string[]) {
  const normalizedRight = new Set(right.map(normalizeName));
  const overlap = left.filter((name) => normalizedRight.has(normalizeName(name)));

  return overlap.length / Math.min(left.length, right.length);
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z]/g, "");
}
