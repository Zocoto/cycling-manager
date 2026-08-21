import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RaceMediaConvoy } from "./race-media-convoy";

describe("race media convoy", () => {
  it("renders a detailed moving camera motorcycle and an occasional helicopter", () => {
    const markup = renderToStaticMarkup(
      <RaceMediaConvoy isMoving showHelicopter mode="side" />,
    );

    expect(markup).toContain('data-race-media-convoy="side"');
    expect(markup).toContain('data-race-camera-motorcycle="side"');
    expect(markup).toContain('data-race-camera-operator="stabilized"');
    expect(markup.match(/data-race-camera-moto-wheel="detailed"/g)).toHaveLength(2);
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
});
