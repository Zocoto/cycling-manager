import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RaceRoadsideCrowd } from "./race-roadside-crowd";

describe("race roadside crowd", () => {
  it("keeps detailed supporters on both grass verges and densifies climbs", () => {
    const flat = renderToStaticMarkup(
      <RaceRoadsideCrowd
        show
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
        roadLeftY={216}
        roadRightY={130}
        roadDepthY={102}
        terrain="climb"
        palette={["#145A4A", "#F2C94C", "#2457C5"]}
      />,
    );

    expect(flat).toContain('data-race-roadside-crowd="roadside"');
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
    expect(climb).toContain('data-race-supporter-prop="smoke-flare"');
    expect((climb.match(/data-race-spectator=/g) ?? []).length).toBeGreaterThan(
      (flat.match(/data-race-spectator=/g) ?? []).length,
    );
  });
});
