import { describe, expect, it } from "vitest";

import afghanistan from "@/data/rider-names/afghanistan.json";
import arabianPeninsula from "@/data/rider-names/arabian_peninsula.json";
import centralAsia from "@/data/rider-names/central_asia.json";
import centralEurope from "@/data/rider-names/central_europe.json";
import china from "@/data/rider-names/china.json";
import denmark from "@/data/rider-names/denmark.json";
import easternEurope from "@/data/rider-names/eastern_europe.json";
import eritrea from "@/data/rider-names/eritrea.json";
import ethiopia from "@/data/rider-names/ethiopia.json";
import finland from "@/data/rider-names/finland.json";
import france from "@/data/rider-names/france.json";
import belgium from "@/data/rider-names/belgium.json";
import ghana from "@/data/rider-names/ghana.json";
import greece from "@/data/rider-names/greece.json";
import iceland from "@/data/rider-names/iceland.json";
import india from "@/data/rider-names/india.json";
import ivoryCoast from "@/data/rider-names/ivory_coast.json";
import korea from "@/data/rider-names/korea.json";
import middleEastArabic from "@/data/rider-names/middle_east_arabic.json";
import nigeria from "@/data/rider-names/nigeria.json";
import norway from "@/data/rider-names/norway.json";
import profilesManifest from "@/data/rider-names/profiles.json";
import sweden from "@/data/rider-names/sweden.json";
import taiwan from "@/data/rider-names/taiwan.json";
import thailand from "@/data/rider-names/thailand.json";
import vietnam from "@/data/rider-names/vietnam.json";
import {
  generateRiderIdentities,
  hasRiderNameLibrary,
} from "@/lib/rider-names/generate-rider-identities";

describe("rider name libraries", () => {
  it("keeps every declared profile connected to an expanded library", () => {
    const profileCodes = profilesManifest.profiles.map((profile) => profile.code);

    expect(new Set(profileCodes).size).toBe(profileCodes.length);
    expect(profileCodes).toHaveLength(70);

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
        profilesManifest.minimumFirstNames,
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

  it("uses five expanded national libraries instead of one Nordic pool", () => {
    const nationalLibraries = [denmark, finland, iceland, norway, sweden];

    for (const library of nationalLibraries) {
      expect(
        library.firstNames.length,
        `${library.code}: firstNames`,
      ).toBeGreaterThanOrEqual(120);
      expect(
        library.lastNames.length,
        `${library.code}: lastNames`,
      ).toBeGreaterThanOrEqual(140);
      expect(hasRiderNameLibrary(library.code)).toBe(true);
    }

    expect(
      iceland.lastNames.filter((name) => name.endsWith("son")).length,
    ).toBeGreaterThan(iceland.lastNames.length * 0.85);
    expect(
      finland.lastNames.filter((name) => name.endsWith("nen")).length,
    ).toBeGreaterThan(finland.lastNames.length * 0.45);
    expect(overlapRatio(finland.lastNames, iceland.lastNames)).toBeLessThan(0.03);
  });

  it("gives France and Belgium the deepest high-volume catalogs", () => {
    expect(france.firstNames).toHaveLength(420);
    expect(france.lastNames).toHaveLength(500);
    expect(belgium.firstNames).toHaveLength(420);
    expect(belgium.lastNames.length).toBeGreaterThanOrEqual(430);
    expect(
      profilesManifest.profiles.reduce(
        (total, profile) => total + profile.minimumLastNames,
        0,
      ),
    ).toBeGreaterThanOrEqual(18_900);
  });

  it("keeps East Asian libraries free of unrelated fallback names", () => {
    const forbiddenByLibrary = [
      [china, ["Njoto", "Wilhelm", "Carvalho", "Hadikusuma", "Santos", "Epstein", "Bruce"]],
      [korea, ["Dupont", "Stevenson", "Schacht", "Mendoza", "Rodríguez", "Zhang"]],
      [taiwan, ["Karlova", "Wibowo", "Freeman", "Najwa", "Persson", "Michele"]],
    ] as const;

    for (const [library, forbiddenNames] of forbiddenByLibrary) {
      expect(library.lastNames.length, library.code).toBeGreaterThanOrEqual(200);
      expect(
        forbiddenNames.filter((name) => library.lastNames.includes(name)),
        library.code,
      ).toEqual([]);
    }
  });

  it("uses masculine surname forms for generated Central and Eastern European riders", () => {
    expect(
      centralEurope.lastNames.some((name) => /(?:ová|ská|cká|dzka)$/iu.test(name)),
    ).toBe(false);
    expect(
      easternEurope.lastNames.some((name) => /(?:ova|eva|ina|ska)$/iu.test(name)),
    ).toBe(false);
  });

  it("keeps the French first-name pool familiar across generations", () => {
    const obsoleteFrenchNames = [
      "Philothée",
      "Alcide",
      "Scholastique",
      "Abdon",
      "Adalbald",
      "Agathange",
      "Angilbe",
      "Bohémond",
      "Childebert",
      "Christodule",
      "Fulgence",
      "Mérovée",
      "Nicéphore",
    ];
    const representativeFrenchNames = [
      "Jean",
      "Philippe",
      "Laurent",
      "Jérôme",
      "Alexandre",
      "Thomas",
      "Hugo",
      "Nathan",
      "Maël",
      "Noah",
      "Liam",
    ];

    expect(new Set(france.firstNames.map(normalizeName)).size).toBe(
      france.firstNames.length,
    );
    expect(
      obsoleteFrenchNames.filter((name) => france.firstNames.includes(name)),
    ).toEqual([]);
    expect(france.firstNames).toEqual(
      expect.arrayContaining(representativeFrenchNames),
    );
  });

  it("keeps West African national pools culturally distinct", () => {
    expect(overlapRatio(ghana.lastNames, ivoryCoast.lastNames)).toBeLessThan(
      0.05,
    );
    expect(overlapRatio(ghana.lastNames, nigeria.lastNames)).toBeLessThan(0.15);
    expect(overlapRatio(ivoryCoast.lastNames, nigeria.lastNames)).toBeLessThan(
      0.08,
    );
  });

  it("models Ethiopian and Eritrean patronymics with separate pools", () => {
    expect(ethiopia.firstNames).toEqual(ethiopia.lastNames);
    expect(eritrea.firstNames).toEqual(eritrea.lastNames);
    expect(overlapRatio(ethiopia.firstNames, eritrea.firstNames)).toBeLessThan(
      0.2,
    );
  });

  it("keeps the Greek pool free of truncated and foreign fallback names", () => {
    const greekSurnamePattern =
      /(?:s|ou|idis|iadis|akis|opoulos|oglou|as|is|os)$/i;
    const knownPollutedValues = [
      "Rm",
      "Mohamed",
      "Krzysztof",
      "Singh",
      "Camilleri",
    ];
    const greekNames = new Set([...greece.firstNames, ...greece.lastNames]);

    expect(greece.firstNames.length).toBeGreaterThanOrEqual(120);
    expect(greece.lastNames.length).toBeGreaterThanOrEqual(160);
    expect(greece.firstNames.every((name) => name.length >= 4)).toBe(true);
    expect(greece.lastNames.every((name) => name.length >= 4)).toBe(true);
    expect(knownPollutedValues.some((name) => greekNames.has(name))).toBe(false);
    expect(
      greece.lastNames.filter((name) => greekSurnamePattern.test(name)).length,
    ).toBeGreaterThan(greece.lastNames.length * 0.95);
  });

  it("separates the main South and Southeast Asian national pools", () => {
    expect(overlapRatio(india.lastNames, thailand.lastNames)).toBeLessThan(0.02);
    expect(overlapRatio(vietnam.lastNames, thailand.lastNames)).toBeLessThan(
      0.02,
    );
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
