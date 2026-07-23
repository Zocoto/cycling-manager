import { describe, expect, it } from "vitest";

import {
  RACE_SCENERY_KINDS,
  getRaceSceneryKind,
  getTeamKitPattern,
  getTeamMonogram,
  shouldShowRaceSpectators,
} from "./race-visuals";

describe("race visual helpers", () => {
  it("keeps one coherent scenery family between an urban start and finish", () => {
    const scenery = new Set(
      Array.from({ length: 12 }, (_, index) =>
        getRaceSceneryKind({
          seed: "visual-stage",
          segment: {
            segmentNumber: index + 1,
            terrain: "flat",
            surface: "asphalt",
          },
          isStart: index === 0,
          isFinish: index === 11,
        })
      )
    );
    const middleScenery = [...scenery].filter(
      (kind) => kind !== "urban"
    );

    expect(scenery).toContain("urban");
    expect(middleScenery.length).toBeLessThanOrEqual(2);
    expect(middleScenery.every((kind) => RACE_SCENERY_KINDS.includes(kind))).toBe(true);
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

    expect(["village", "fields", "forest", "meadow"]).toContain(cobbled);
    expect(finish).toBe("urban");
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
