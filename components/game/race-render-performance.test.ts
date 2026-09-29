import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("race rendering performance", () => {
  it("moves race actors on compositor transforms instead of layout coordinates", () => {
    const source = readSource("components/game/race-live-lab.tsx");

    expect(source).toContain("cm-race-motion-layer");
    expect(source).toContain("translate3d(${left}%");
    expect(source).toContain("transition-transform duration-150 ease-linear");
  });

  it("isolates the viewport and removes costly mobile-only filters", () => {
    const styles = readSource("app/globals.css");

    expect(styles).toContain(".cm-race-visual-viewport");
    expect(styles).toContain("contain: layout paint style");
    expect(styles).toContain(".cm-race-motion-layer");
    expect(styles).toContain("filter: none !important");
    expect(styles).toContain("backdrop-filter: none !important");
  });

  it("memoizes the detailed vector actors and scenery", () => {
    const cyclist = readSource("components/game/race-cyclist-detailed.tsx");
    const scenery = readSource("components/game/race-scenery-detailed.tsx");
    const crowd = readSource("components/game/race-roadside-crowd.tsx");

    expect(cyclist).toContain("memo(function SideRaceCyclist");
    expect(cyclist).toContain("memo(function TopRaceCyclist");
    expect(scenery).toContain("memo(function RaceSceneryBackdrop");
    expect(scenery).toContain("memo(function RaceBiotopeForeground");
    expect(crowd).toContain("memo(function RaceRoadsideCrowd");
  });
});
