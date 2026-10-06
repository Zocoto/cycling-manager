import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readGalaYoutubeVideoId, SEASON_FINALE_GALA_PRIZES, SEASON_FINALE_GALA_PRIZES_CONFIRMED, SEASON_FINALE_GALA_RACE, SEASON_FINALE_GALA_MIN_RIDERS, SEASON_FINALE_GALA_MAX_RIDERS, SEASON_FINALE_GALA_TEAMS_PER_GROUP, SEASON_FINALE_GALA_PCM_MAX_TEAMS, SEASON_FINALE_GALA_DEADLINE, isSeasonFinaleGalaDeadlineReached } from "./season-finale-gala";

describe("Grand Gala de fin de saison", () => {
  it("ferme exactement jeudi 8 octobre à midi à Paris (UTC+2), pas à midi UTC", () => {
    const deadline = Date.parse(SEASON_FINALE_GALA_DEADLINE);
    expect(new Date(deadline).toISOString()).toBe("2026-10-08T10:00:00.000Z");
    expect(isSeasonFinaleGalaDeadlineReached(deadline - 1)).toBe(false);
    expect(isSeasonFinaleGalaDeadlineReached(deadline)).toBe(true);
    expect(isSeasonFinaleGalaDeadlineReached(deadline + 1)).toBe(true);
  });
  it("réutilise uniquement le parcours vallonné officiel du pilote PCM", () => {
    expect(SEASON_FINALE_GALA_RACE.key).toBe("gala-des-puncheurs");
    expect(SEASON_FINALE_GALA_RACE.primaryRating).toBe("hills");
    expect(SEASON_FINALE_GALA_RACE.pcmSource.stageFilename).toBe("topclas_fleche");
    expect(SEASON_FINALE_GALA_RACE.distanceKm).toBe(205);
  });
  it("définit cinq lots distincts validés, dont des gants exceptionnels", () => {
    expect(SEASON_FINALE_GALA_PRIZES.map((prize) => prize.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(SEASON_FINALE_GALA_PRIZES.map((prize) => prize.key)).size).toBe(5);
    expect(SEASON_FINALE_GALA_PRIZES[1]).toMatchObject({ slot: "gloves", rarity: "Exceptionnel" });
    expect(SEASON_FINALE_GALA_PRIZES_CONFIRMED).toBe(true);
    for (const prize of SEASON_FINALE_GALA_PRIZES) expect(existsSync(join(process.cwd(), "public", prize.image))).toBe(true);
  });
  it("prévoit 6 à 8 coureurs et conserve une place pour le spectateur sous le plafond PCM", () => {
    expect([SEASON_FINALE_GALA_MIN_RIDERS, SEASON_FINALE_GALA_MAX_RIDERS]).toEqual([6, 8]);
    expect(SEASON_FINALE_GALA_TEAMS_PER_GROUP).toBe(20);
    expect(SEASON_FINALE_GALA_TEAMS_PER_GROUP + 1).toBeLessThanOrEqual(SEASON_FINALE_GALA_PCM_MAX_TEAMS);
  });
  it.each([
    "https://www.youtube.com/watch?v=Abcdef123_-&t=42",
    "https://youtu.be/Abcdef123_-",
    "https://m.youtube.com/watch?v=Abcdef123_-",
    "https://youtube.com/embed/Abcdef123_-",
  ])("valide un lien YouTube reconnu : %s", (url) => expect(readGalaYoutubeVideoId(url)).toBe("Abcdef123_-"));
  it.each([null, undefined, "", "n'importe quoi", "http://youtu.be/Abcdef123_-", "https://youtube.com.evil.test/watch?v=Abcdef123_-", "https://evil.test/Abcdef123_-", "https://user:secret@youtube.com/watch?v=Abcdef123_-", "https://youtu.be/short", "https://youtu.be/Abcdef123_-/extra"])("refuse un replay non fiable : %s", (url) => expect(readGalaYoutubeVideoId(url)).toBeNull());
});
