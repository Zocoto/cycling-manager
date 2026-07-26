import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  RaceSegmentPrime,
  RaceStageSegment,
} from "@/lib/game/race-profiles";

import { RaceStageProfile } from "./race-stage-profile";

describe("RaceStageProfile", () => {
  it("ne mentionne pas de GPM avec un sprint intermediaire seul", () => {
    const markup = renderToStaticMarkup(
      <RaceStageProfile
        segments={[
          createSegment({
            type: "intermediate_sprint",
            category: null,
            pointsScale: [20, 17, 15],
          }),
        ]}
        showLegend
      />
    );

    expect(markup).not.toContain("GPM");
    expect(markup).toContain("Sprint interm");
  });

  it("conserve la mention GPM quand une prime montagne existe", () => {
    const markup = renderToStaticMarkup(
      <RaceStageProfile
        segments={[
          createSegment({
            type: "mountain",
            category: "3",
            pointsScale: [2, 1],
          }),
        ]}
        showLegend
      />
    );

    expect(markup).toContain("GPM");
  });
});

function createSegment(
  prime: RaceSegmentPrime
): RaceStageSegment {
  return {
    segmentNumber: 1,
    distanceKm: 10,
    terrain: "flat",
    averageGradientPct: 0,
    surface: "asphalt",
    prime,
  };
}
