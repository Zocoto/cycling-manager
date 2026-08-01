import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "components/game/youth-training-mini-game.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("youth training minigame surfaces", () => {
  it("rend une surface distincte pour chacun des six profils", () => {
    for (const gameType of [
      "rhythm",
      "reflex",
      "speed",
      "time_trial",
      "breakaway",
      "puncheur",
    ]) {
      expect(source).toContain(`data-youth-game="${gameType}"`);
    }
  });

  it("prévoit des interactions tactiles pour les trois nouveaux jeux", () => {
    expect(source).toContain("onTimeTrialControlStart");
    expect(source).toContain("onBreakawayAttack");
    expect(source).toContain("onPuncheurChargeStart");
    expect(source).toContain("touch-none");
  });
});