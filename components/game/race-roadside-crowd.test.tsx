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
        isMoving={false}
        roadLeftY={216}
        roadRightY={130}
        roadDepthY={102}
        terrain="climb"
        palette={["#145A4A", "#F2C94C", "#2457C5"]}
      />,
    );

    expect(flat).toContain('data-race-roadside-crowd="roadside"');
    expect(flat).toContain('data-race-crowd-track="right-to-left"');
    expect(flat).toContain('data-race-crowd-protected-corridor="full-road"');
    expect(flat).toContain('data-race-crowd-safe-lane="upper"');
    expect(flat).toContain('data-race-crowd-safe-lane="lower"');
    expect(flat).toContain("cm-race-scenery-scroll");
    expect(flat.match(/data-race-crowd-copy=/g)).toHaveLength(2);
    expect(flat).toContain('data-race-crowd-layer="rear-verge"');
    expect(flat).toContain('data-race-crowd-layer="foreground-grass"');
    expect(flat).toContain('data-race-spectator="down"');
    expect(flat).toContain('data-race-spectator="one-raised"');
    expect(flat).toContain('data-race-spectator="both-raised"');
    expect(flat).toContain('data-race-spectator-jersey="yellow"');
    expect(flat).toContain('data-race-spectator-jersey="polka-dot"');
    expect(flat).toContain('data-race-supporter-prop="flag"');
    expect(flat).toContain("#145A4A");

    expect(climb).toContain('data-race-roadside-crowd="climb-dense"');
    expect(climb).not.toContain("cm-race-scenery-scroll");
    expect(climb).toContain('data-race-supporter-prop="smoke-flare"');
    expect(climb).toContain('data-race-crowd-protected-corridor="climb"');
    expect(climb).toContain("cm-supporter-smoke");
    expect(climb).toContain('data-race-supporter-motion="running"');
    expect(climb).toContain('data-race-supporter-special="flag-runner"');
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
