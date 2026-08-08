import { describe, expect, it } from "vitest";

import {
  assignStageRaceJerseys,
  getStageRaceJerseyVisuals,
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

  it("adapte les maillots distinctifs aux trois grands tours", () => {
    expect(
      getStageRaceJerseyVisuals({ countryCode: "FR", isGrandTour: true })
        .general.shortLabel,
    ).toBe("Maillot jaune");
    expect(
      getStageRaceJerseyVisuals({ countryCode: "ES", isGrandTour: true })
        .general.shortLabel,
    ).toBe("Maillot rouge");
    const italy = getStageRaceJerseyVisuals({
      countryCode: "IT",
      isGrandTour: true,
    });
    expect(italy.general.shortLabel).toBe("Maillot rose");
    expect(italy.sprint.shortLabel).toBe("Maillot cyclamen");
    expect(italy.mountain.shortLabel).toBe("Maillot bleu");
  });
});
