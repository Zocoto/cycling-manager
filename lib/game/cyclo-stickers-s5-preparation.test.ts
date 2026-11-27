import { describe, expect, it } from "vitest";
import { CYCLO_STICKERS_S5_PREPARATION as plan, SEASON_FIVE_ALBUM_PAGES as pages,
  SEASON_FIVE_ALBUM_SLOTS as slots } from "./cyclo-stickers-s5-preparation";

describe("season 5 editorial album preparation", () => {
  it("keeps the source season distinct from its future collection season and cannot publish cards", () => {
    expect(plan).toMatchObject({ sourceSeason: 5, collectionSeason: 6, status: "preparation",
      publicApproved: false, cardsReady: false, cardCreationDay: 28 });
    expect(plan.id).not.toBe("cyclo-stickers-s5-s4-final-v1");
    expect(slots.every(slot => slot.cardId === null)).toBe(true);
  });

  it("reserves all 72 positions without inventing identities or quadrennial titles", () => {
    expect(slots.map(slot => slot.number)).toEqual(Array.from({ length: 72 }, (_, index) => index + 1));
    expect(new Set(slots.map(slot => slot.key)).size).toBe(72);
    expect(Object.fromEntries(["ranking", "teams", "continental", "world", "memories", "breakaway"]
      .map(section => [section, slots.filter(slot => slot.section === section).length])))
      .toEqual({ ranking: 50, teams: 5, continental: 10, world: 2, memories: 2, breakaway: 3 });
    expect(slots.filter(slot => slot.section === "memories").map(slot => slot.key))
      .toEqual(["memory-cyclo-quizz", "memory-cumbre"]);
    expect(JSON.stringify(slots)).not.toMatch(/quadrennial|headless|Halloween|specimen|riderId|jersey|ratings/);
  });

  it("makes every empty position reachable once in bounded pages", () => {
    expect(pages.flatMap(page => page.slots)).toEqual(slots);
    expect(pages.every(page => page.slots.length > 0 && page.slots.length <= 6)).toBe(true);
    expect(pages.every(page => page.slots.every(slot => slot.section === page.section.id))).toBe(true);
  });
});
