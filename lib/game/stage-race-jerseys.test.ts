import { describe, expect, it } from "vitest";

import {
  assignStageRaceJerseys,
  STAGE_RACE_JERSEY_VISUALS,
} from "./stage-race-jerseys";

describe("stage race jerseys", () => {
  it("respecte la priorité jaune, vert, pois, blanc", () => {
    const standings = {
      general: ["a", "b", "c", "d"].map((riderId) => ({ riderId })),
      sprint: ["a", "b", "c", "d"].map((riderId) => ({ riderId })),
      mountain: ["a", "b", "c", "d"].map((riderId) => ({ riderId })),
      youth: ["a", "b", "c", "d"].map((riderId) => ({ riderId })),
    };

    expect(assignStageRaceJerseys(standings)).toEqual({
      general: "a",
      sprint: "b",
      mountain: "c",
      youth: "d",
    });
  });

  it("décrit les quatre couleurs distinctives attendues", () => {
    expect(STAGE_RACE_JERSEY_VISUALS.general.primaryColor).toBe("#F5D547");
    expect(STAGE_RACE_JERSEY_VISUALS.sprint.primaryColor).toBe("#168C52");
    expect(STAGE_RACE_JERSEY_VISUALS.mountain).toMatchObject({
      primaryColor: "#FFFDF7",
      accentColor: "#D62839",
      pattern: "polka-dots",
    });
    expect(STAGE_RACE_JERSEY_VISUALS.youth.primaryColor).toBe("#FFFFFF");
  });
});
