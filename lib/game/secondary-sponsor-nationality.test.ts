import { describe, expect, it } from "vitest";

import type { TeamSponsorCountryAffinity } from "@/lib/game/sponsor-nationality-affinity";
import { selectSecondarySponsorCountryCodes } from "./secondary-sponsor-nationality";

const affinity: TeamSponsorCountryAffinity = {
  teamCountryCode: "CO",
  directorCountryCode: "FR",
  leaderCountryCodes: ["CO", "AM"],
  rosterMajorityCountryCode: "CO",
  internationalSchoolAffinities: [],
  preferredSponsorIds: [],
};

describe("secondary sponsor nationality", () => {
  it("keeps La Cumbre's Colombian identity and limits its French director's slot", () => {
    expect(selectSecondarySponsorCountryCodes({ affinity, seed: "cumbre:s6", availableCountryCodes: ["FR", "AM", "CO"] }))
      .toEqual(["CO", "FR", "AM"]);
  });

  it("uses the national roster majority when there is no other leader country", () => {
    expect(selectSecondarySponsorCountryCodes({
      affinity: { ...affinity, leaderCountryCodes: ["CO"], rosterMajorityCountryCode: "AM" },
      seed: "majority:s6", availableCountryCodes: ["FR", "AM", "CO"],
    })).toEqual(["CO", "FR", "AM"]);
  });

  it("completes with team-country partners rather than three foreign-director partners", () => {
    expect(selectSecondarySponsorCountryCodes({
      affinity: { ...affinity, leaderCountryCodes: ["CO"] },
      seed: "cumbre:s6", availableCountryCodes: ["FR", "CO"],
    })).toEqual(["CO", "FR", "CO"]);
  });

  it("normalizes countries and ignores unavailable catalogue countries", () => {
    expect(selectSecondarySponsorCountryCodes({
      affinity: { ...affinity, teamCountryCode: " co ", directorCountryCode: " fr " },
      seed: "cumbre:s6", availableCountryCodes: [" co ", "fr", "FR"],
    })).toEqual(["CO", "FR", "CO"]);
  });

  it("gives national offers when all sporting affinities share the team's nationality", () => {
    expect(selectSecondarySponsorCountryCodes({
      affinity: { ...affinity, directorCountryCode: "CO", leaderCountryCodes: ["CO"] },
      seed: "cumbre:s6", availableCountryCodes: ["CO", "FR", "AM"],
    })).toEqual(["CO", "CO", "CO"]);
  });

  it("uses only available distinct neighboring/fallback countries when the home catalogue is missing", () => {
    const selected = selectSecondarySponsorCountryCodes({
      affinity, seed: "missing:s6", availableCountryCodes: ["FR", "AM", "BE", "PE"],
    });
    expect(selected).toHaveLength(3);
    expect(selected.slice(0, 2)).toEqual(["FR", "AM"]);
    expect(new Set(selected).size).toBe(3);
  });

  it("draws international school contacts deterministically without making them automatic", () => {
    const withSchool = { ...affinity, internationalSchoolAffinities: [{ countryCode: "JP", qualityLevel: 1 }] };
    const options = { affinity: withSchool, seed: "school:s6", availableCountryCodes: ["CO", "FR", "AM", "JP"] };
    expect(selectSecondarySponsorCountryCodes(options)).toEqual(selectSecondarySponsorCountryCodes(options));
    const contacted = Array.from({ length: 100 }, (_, index) => selectSecondarySponsorCountryCodes({ ...options, seed: `school:${index}` }).includes("JP"));
    expect(contacted).toContain(true);
    expect(contacted).toContain(false);
    expect(contacted.filter(Boolean).length).toBeLessThan(60);
  });

  it("does not duplicate an already selected foreign director via an international school", () => {
    const withSchool = { ...affinity, internationalSchoolAffinities: [{ countryCode: "FR", qualityLevel: 5 }] };
    for (let index = 0; index < 10; index += 1) {
      const selected = selectSecondarySponsorCountryCodes({ affinity: withSchool, seed: `same:${index}`, availableCountryCodes: ["CO", "FR", "AM"] });
      expect(selected).toEqual(["CO", "FR", "AM"]);
    }
  });

  it("bounds slot requests and returns no country when no catalogue exists", () => {
    expect(selectSecondarySponsorCountryCodes({ affinity, seed: "none", availableCountryCodes: [] })).toEqual([]);
    expect(selectSecondarySponsorCountryCodes({ affinity, seed: "none", availableCountryCodes: ["CO"], count: 0 })).toEqual([]);
    expect(selectSecondarySponsorCountryCodes({ affinity, seed: "none", availableCountryCodes: ["CO"], count: 20 })).toEqual(["CO", "CO", "CO"]);
  });
});
