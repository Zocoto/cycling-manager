import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  getRaceCameraMotoPlacements,
  RaceMediaConvoy,
} from "./race-media-convoy";

describe("race media convoy", () => {
  it("renders a detailed moving camera motorcycle and an occasional helicopter", () => {
    const markup = renderToStaticMarkup(
      <RaceMediaConvoy
        isMoving
        showHelicopter
        mode="side"
        visualSeed="multi-camera"
        groupPositions={[48, 71]}
        roadGeometry={{ leftPct: 54, rightPct: 54, depthPct: 32 }}
      />,
    );

    expect(markup).toContain('data-race-media-convoy="side"');
    expect(markup).toContain('data-race-media-motorcycles="2"');
    expect(markup.match(/data-race-camera-motorcycle="side"/g)).toHaveLength(2);
    expect(markup).toContain('data-race-camera-motorcycle-placement="ahead"');
    expect(markup).toContain('data-race-camera-motorcycle-placement="behind"');
    expect(markup.match(/data-race-camera-driver="articulated"/g)).toHaveLength(2);
    expect(markup).toContain('data-race-camera-operator="stabilized"');
    expect(markup.match(/data-race-person-scale="cyclist"/g)).toHaveLength(4);
    expect(markup.match(/data-race-camera-moto-wheel="detailed"/g)).toHaveLength(4);
    expect(markup).toContain('data-race-camera-motorcycle-body="touring"');
    expect(markup).toContain("cm-camera-moto");
    expect(markup).toContain('data-race-helicopter="occasional"');
    expect(markup).toContain("cm-race-helicopter");
  });

  it("keeps the helicopter occasional and freezes vehicles when paused", () => {
    const markup = renderToStaticMarkup(
      <RaceMediaConvoy isMoving={false} showHelicopter={false} mode="top" />,
    );

    expect(markup).toContain('data-race-camera-motorcycle="top"');
    expect(markup).not.toContain("data-race-helicopter");
    expect(markup).not.toContain("cm-camera-moto-wheel");
  });

  it("keeps motorcycles immediately ahead of and behind the race groups", () => {
    const placements = getRaceCameraMotoPlacements({
      visualSeed: "multi-camera",
      groupPositions: [42, 63, 71],
      roadGeometry: { leftPct: 58, rightPct: 46, depthPct: 32 },
      context: "race",
      mode: "side",
    });

    const ahead = placements.find((placement) => placement.position === "ahead");
    const behind = placements.find((placement) => placement.position === "behind");
    expect(ahead?.leftPct).toBeGreaterThan(71);
    expect(behind?.leftPct).toBeLessThan(42);
    expect(ahead?.cameraFacing).toBe("left");
    expect(behind?.cameraFacing).toBe("right");
  });
});
