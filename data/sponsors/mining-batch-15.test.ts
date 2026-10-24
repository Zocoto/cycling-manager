import { describe, expect, it } from "vitest";

import { SPONSORS } from "./index";
import { MINING_BATCH_15_SPONSORS } from "./mining-batch-15";

describe("mining sponsor batch 15", () => {
  const expectedCountryCodes = ["AU", "CD", "GH", "KZ", "MN", "ZM", "ID", "FI", "CL", "SL"];

  it("adds ten mining sponsors to countries tied at the current minimum", () => {
    expect(MINING_BATCH_15_SPONSORS).toHaveLength(10);
    expect(MINING_BATCH_15_SPONSORS.map((sponsor) => sponsor.countryCode).sort()).toEqual(
      [...expectedCountryCodes].sort(),
    );
    expect(new Set(MINING_BATCH_15_SPONSORS.map((sponsor) => sponsor.id)).size).toBe(10);
  });

  it("uses a distinct mineral identity for every sponsor", () => {
    const mineralMarkers = ["fer", "cobalt", "aurifère", "uranium", "cuivre", "émeraudes", "nickel", "chromite", "lithium", "rutile"];
    expect(MINING_BATCH_15_SPONSORS.map((sponsor) => sponsor.sector.toLowerCase())).toEqual(
      expect.arrayContaining(mineralMarkers.map((mineral) => expect.stringContaining(mineral))),
    );
    expect(new Set(MINING_BATCH_15_SPONSORS.map((sponsor) => sponsor.colors.primary)).size).toBe(10);
  });

  it("covers every prestige level with three branded jerseys", () => {
    expect(new Set(MINING_BATCH_15_SPONSORS.map((sponsor) => sponsor.prestige))).toEqual(new Set([1, 2, 3, 4, 5]));
    for (const sponsor of MINING_BATCH_15_SPONSORS) {
      expect(sponsor.logoPath).toBe(`/images/sponsors/${sponsor.id}/logo.webp`);
      expect(sponsor.jerseys.map((jersey) => jersey.style)).toEqual(["classic", "modern", "bold"]);
    }
  });

  it("brings the catalog to 480 sponsors and raises each selected country to three", () => {
    expect(SPONSORS).toHaveLength(480);
    for (const countryCode of expectedCountryCodes) {
      expect(SPONSORS.filter((sponsor) => sponsor.countryCode === countryCode)).toHaveLength(3);
    }
  });
});
