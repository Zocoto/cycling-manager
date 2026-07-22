import { describe, expect, it } from "vitest";

import {
  RACE_SCENERY_KINDS,
  getRaceSceneryKind,
  getTeamKitPattern,
  getTeamMonogram,
  shouldShowRaceSpectators,
} from "./race-visuals";

describe("race visual helpers", () => {
  it("cycles through every scenery kind on a long flat course", () => {
    const scenery = new Set(
      Array.from({ length: 12 }, (_, index) =>
        getRaceSceneryKind({
          seed: "visual-stage",
          segment: {
            segmentNumber: index + 1,
            terrain: "flat",
            surface: "asphalt",
          },
        })
      )
    );

    expect(scenery).toEqual(new Set(RACE_SCENERY_KINDS));
  });

  it("uses plausible roadside environments for cobbled sectors and finishes", () => {
    const cobbled = getRaceSceneryKind({
      seed: "pavés",
      segment: { segmentNumber: 4, terrain: "flat", surface: "cobbles" },
    });
    const finish = getRaceSceneryKind({
      seed: "finish",
      segment: { segmentNumber: 9, terrain: "flat", surface: "asphalt" },
      isFinish: true,
    });

    expect(["village", "fields", "forest"]).toContain(cobbled);
    expect(["village", "urban"]).toContain(finish);
    expect(
      shouldShowRaceSpectators({
        seed: "finish",
        segmentNumber: 9,
        scenery: finish,
        isFinish: true,
      })
    ).toBe(true);
  });

  it("derives stable, recognizable team kit details", () => {
    expect(getTeamKitPattern("team-a")).toBe(getTeamKitPattern("team-a"));
    expect(getTeamMonogram("Union Cycliste des Coquinous")).toBe("UC");
    expect(getTeamMonogram("Hexa Bâtiment")).toBe("HB");
  });
});
