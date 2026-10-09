import { describe, expect, it } from "vitest";
import { groupSeasonAwards, SEASON_AWARD_KEYS } from "./season-awards";

describe("groupSeasonAwards", () => {
  it("groups all medal types independently, with chronological editions and no repeated records", () => {
    const awards = SEASON_AWARD_KEYS.flatMap((key) => [10, 2, 1].map((season) => ({
      id: `${key}-${season}`, key, seasonName: `Saison ${season}`, gameYear: season,
      statValue: season * 100,
    })));
    const snapshot = structuredClone(awards);
    const grouped = groupSeasonAwards([...awards, awards[0]]);
    expect(grouped).toHaveLength(SEASON_AWARD_KEYS.length);
    for (const medal of grouped) {
      expect(medal.gameYear).toBe(10);
      expect(medal.editions.map((edition) => edition.gameYear)).toEqual([1, 2, 10]);
      expect(medal.editions.map((edition) => edition.statValue)).toEqual([100, 200, 1000]);
    }
    expect(awards).toEqual(snapshot);
  });
});
