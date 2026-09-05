import { describe, expect, it } from "vitest";

import {
  PRE_RACE_AMBITION_DETAILS,
  isPreRaceAmbition,
  isPreRaceIntent,
} from "./pre-race-press";

describe("pre-race press conference rules", () => {
  it("exposes a clear risk/reward ladder", () => {
    expect(PRE_RACE_AMBITION_DETAILS.victory).toMatchObject({ success: 8, failure: -4 });
    expect(PRE_RACE_AMBITION_DETAILS.podium.target).toContain("top 3");
    expect(PRE_RACE_AMBITION_DETAILS.top_10.target).toContain("top 10");
    expect(PRE_RACE_AMBITION_DETAILS.visibility.target).toContain("top 20");
  });

  it("rejects unknown ambitions and intentions", () => {
    expect(isPreRaceAmbition("victory")).toBe(true);
    expect(isPreRaceAmbition("guaranteed-win")).toBe(false);
    expect(isPreRaceIntent("attack")).toBe(true);
    expect(isPreRaceIntent("cheat")).toBe(false);
  });
});
