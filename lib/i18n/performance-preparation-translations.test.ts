import { describe, expect, it } from "vitest";
import { TEAM_INFRASTRUCTURE_DEFINITIONS } from "@/lib/game/infrastructure";
import { translateUiText } from "./ui-translations";

describe("performance preparation translations", () => {
  for (const code of ["indoor_track", "wind_tunnel"] as const) {
    it(`translates all five ${code} levels including decimal bonuses and capacity`, () => {
      const levels = TEAM_INFRASTRUCTURE_DEFINITIONS[code].levels;
      for (const level of levels) {
        const translated = translateUiText(level.effect);
        expect(translated).toContain("After 2 days of preparation:");
        expect(translated).toContain(code === "indoor_track" ? "SP and ACC" : "TT, PRL and STA");
        expect(translated).not.toContain("coureur");
      }
      expect(translateUiText(levels[1].effect)).toContain("+1.5");
      expect(translateUiText(levels[4].effect)).toContain("for 6 days · 3 riders in parallel.");
    });
  }
});
