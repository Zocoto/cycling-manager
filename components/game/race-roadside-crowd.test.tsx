import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RaceRoadsideCrowd } from "./race-roadside-crowd";

describe("race roadside crowd", () => {
  it("keeps detailed supporters on both grass verges and densifies climbs", () => {
    const flat = renderToStaticMarkup(
      <RaceRoadsideCrowd
        show
        isMoving
        roadLeftY={173}
        roadRightY={173}
        roadDepthY={102}
        terrain="flat"
        palette={["#145A4A", "#F2C94C", "#2457C5"]}
      />,
    );
    const climb = renderToStaticMarkup(
      <RaceRoadsideCrowd
        show
        isMoving
        roadLeftY={216}
        roadRightY={130}
        roadDepthY={102}
        terrain="climb"
        palette={["#145A4A", "#F2C94C", "#2457C5"]}
      />,
    );

    expect(flat).toContain('data-race-roadside-crowd="roadside"');
    expect(flat).toContain('data-race-crowd-track="right-to-left"');
    expect(flat).toContain('data-race-crowd-spacing="clustered-irregular"');
    expect(flat).toContain('data-race-crowd-protected-corridor="full-road"');
    expect(flat).toContain('data-race-crowd-slope-flow="slope-corrected"');
    expect(flat).toContain('data-race-crowd-safe-lane="upper"');
    expect(flat).toContain('data-race-crowd-safe-lane="lower"');
    expect(flat).toContain("cm-race-crowd-scroll-slope");
    expect(flat.match(/data-race-crowd-copy=/g)).toHaveLength(2);
    expect(flat).toContain('data-race-crowd-layer="rear-verge"');
    expect(flat).toContain('data-race-crowd-layer="foreground-grass"');
    expect(flat).toContain('data-race-spectator="down"');
    expect(flat).toContain('data-race-spectator="one-raised"');
    expect(flat).toContain('data-race-spectator="both-raised"');
    expect(flat).toContain('data-race-spectator-jersey="yellow"');
    expect(flat).toContain('data-race-spectator-jersey="polka-dot"');
    expect(flat).toContain('data-race-supporter-prop="flag"');
    expect(flat).toContain('data-race-supporter-prop="phone"');
    expect(flat).toContain('data-race-supporter-prop="camera"');
    expect(flat).toContain('data-race-supporter-prop="cap"');
    expect(flat).toContain('data-race-supporter-accessory="phone"');
    expect(flat).toContain("#145A4A");

    expect(climb).toContain('data-race-roadside-crowd="climb-dense"');
    expect(climb).toContain('data-race-crowd-slope-flow="slope-corrected"');
    expect(climb).toContain("cm-race-crowd-scroll-slope");
    expect(climb).toContain("translate(1000 -86)");
    expect(climb).toContain("--cm-race-crowd-travel-y:26.875%");
    expect(climb).toContain('data-race-supporter-prop="smoke-flare"');
    expect(climb).toContain('data-race-crowd-protected-corridor="climb"');
    expect(climb).toContain("cm-supporter-smoke");
    expect(climb).not.toContain('data-race-supporter-motion="running"');
    expect(climb).not.toContain('data-race-supporter-special="flag-runner"');
    expect(climb).toContain('data-race-supporter-costume="devil"');
    expect(climb).toContain('data-race-supporter-costume="gaul-warrior"');
    expect(climb).toContain('data-race-supporter-costume="gaul-strongman"');
    expect(climb).toContain('data-race-supporter-costume="druid"');
    expect(climb).toContain('data-race-supporter-costume="horse-mask"');
    expect(flat).not.toContain('data-race-supporter-costume="devil"');
    expect(flat).not.toContain('data-race-supporter-motion="running"');
    expect((climb.match(/data-race-spectator=/g) ?? []).length).toBeGreaterThan(
      (flat.match(/data-race-spectator=/g) ?? []).length,
    );
  });

  it("renders one fixed detailed supporter beside a sprinter, outside the scrolling tiles", () => {
    const markup = renderToStaticMarkup(
      <RaceRoadsideCrowd
        show
        isMoving
        roadLeftY={216}
        roadRightY={130}
        roadDepthY={92}
        terrain="climb"
        featuredRunner={{
          x: 640,
          side: "upper",
          phase: 0.5,
          primaryColor: "#151515",
          secondaryColor: "#CFA953",
          teamId: "abbaye",
        }}
      />,
    );

    expect(markup.match(/data-race-supporter-pace="sprinter"/g)).toHaveLength(1);
    expect(markup.match(/data-race-supporter-motion="running"/g)).toHaveLength(1);
    expect(markup).toContain('data-race-featured-supporter="sprinter-pacer"');
    expect(markup).toContain('data-race-crowd-fixed-to-race="true"');
    expect(markup).toContain('data-race-supporter-phase="0.500"');
    expect(markup).toContain('opacity="0.98"');
    expect(markup).toContain("cm-supporter-pacer");
    expect(markup).toContain('data-race-supporter-detail="face"');
    expect(markup).toContain('data-race-supporter-detail="technical-shorts"');
    expect(markup).toContain('data-race-supporter-detail="running-shoes"');
    expect(markup).toContain('data-race-supporter-team="abbaye"');
  });

  it("scrolls crowds along either direction of slope and stops them only while paused", () => {
    const descent = renderToStaticMarkup(
      <RaceRoadsideCrowd
        show
        isMoving
        roadLeftY={128}
        roadRightY={214}
        roadDepthY={92}
        terrain="descent"
      />,
    );
    const pausedFlat = renderToStaticMarkup(
      <RaceRoadsideCrowd
        show
        isMoving={false}
        roadLeftY={173}
        roadRightY={173}
        roadDepthY={102}
        terrain="flat"
      />,
    );

    expect(descent).toContain('data-race-crowd-slope-flow="slope-corrected"');
    expect(descent).toContain("cm-race-crowd-scroll-slope");
    expect(descent).toContain("translate(1000 86)");
    expect(descent).toContain("--cm-race-crowd-travel-y:-26.875%");
    expect(pausedFlat).toContain('data-race-crowd-slope-flow="slope-corrected"');
    expect(pausedFlat).not.toContain("cm-race-crowd-scroll-slope");
  });

  it("dresses regular supporters in the engaged teams' paired colors", () => {
    const markup = renderToStaticMarkup(
      <RaceRoadsideCrowd
        show
        isMoving
        roadLeftY={173}
        roadRightY={173}
        roadDepthY={102}
        terrain="flat"
        teamPalettes={[
          {
            teamId: "veloria",
            primaryColor: "#123A68",
            secondaryColor: "#F3D35B",
          },
        ]}
      />,
    );

    expect(markup).toContain('data-race-supporter-team="veloria"');
    expect(markup).toContain("#123A68");
    expect(markup).toContain("#F3D35B");
    expect(markup).not.toContain('data-race-spectator-jersey="yellow"');
    expect(markup).not.toContain('data-race-spectator-jersey="polka-dot"');
  });
});
