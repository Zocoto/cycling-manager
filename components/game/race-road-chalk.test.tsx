import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  getRaceRoadChalkLayout,
  RaceRoadChalk,
} from "./race-road-chalk";

describe("race road chalk", () => {
  it("writes favorites across climb roads with the text top toward the finish", () => {
    const markup = renderToStaticMarkup(
      <svg>
        <RaceRoadChalk
          show
          favoriteNames={["Poga", "Vinga"]}
          teamNames={["Dolci Bellini", "Dodo Blue"]}
          countryCode="IT"
          visualSeed="mountain-7"
          roadLeft={62}
          roadRight={46}
          roadDepth={30}
          isMoving
        />
      </svg>,
    );

    expect(markup).toContain('data-race-road-chalk="climb"');
    expect(markup).toContain(
      'data-race-road-chalk-orientation="top-toward-finish-right"',
    );
    expect(markup).toContain("POGA");
    expect(markup).toContain('data-race-road-chalk-density="supporter-burst"');
    expect(markup).toContain('data-race-road-chalk-layout="irregular-across-road-width"');
    expect(markup).toContain('data-race-road-chalk-source="team"');
    expect(markup).toContain('data-race-road-chalk-source="local-club"');
    expect(markup).toContain('data-race-road-chalk-source="supporter"');
    expect(markup).toContain("DOLCI BELLINI");
    expect(markup).toMatch(/VC TOSCANA|PEDALE FIRENZE|AS MONTELUPO/);
    expect(markup).toContain("rotate(");
    expect(markup).toContain('data-race-road-flow-direction="right-to-left"');
    expect(markup).toContain('data-race-road-chalk-moving="true"');
    expect(markup).toContain('class="cm-race-road-chalk-svg"');
    expect(markup).toContain(
      "animation-duration:var(--cm-scene-flow-duration, 18s)",
    );
  });

  it("varies road density from empty asphalt to irregular supporter bursts", () => {
    const empty = getRaceRoadChalkLayout({
      visualSeed: "empty-segment",
      maximumCount: 6,
    });
    const sparse = getRaceRoadChalkLayout({
      visualSeed: "race-chalk",
      maximumCount: 6,
    });
    const burst = getRaceRoadChalkLayout({
      visualSeed: "mountain-7",
      maximumCount: 6,
    });

    expect(empty).toEqual({ density: "none", placements: [] });
    expect(sparse.density).toBe("sparse");
    expect(sparse.placements.length).toBeGreaterThanOrEqual(2);
    expect(sparse.placements.length).toBeLessThanOrEqual(3);
    expect(burst.density).toBe("supporter-burst");
    expect(burst.placements).toHaveLength(6);
    expect(
      Math.max(...burst.placements.map((placement) => placement.x)) -
        Math.min(...burst.placements.map((placement) => placement.x)),
    ).toBeLessThan(50);
    expect(new Set(burst.placements.map((placement) => placement.rotation)).size)
      .toBeGreaterThan(1);
  });

  it("freezes the writing on the road when the simulation is paused", () => {
    const markup = renderToStaticMarkup(
      <svg>
        <RaceRoadChalk
          show
          favoriteNames={["Poga"]}
          roadLeft={62}
          roadRight={46}
          roadDepth={30}
          isMoving={false}
        />
      </svg>,
    );

    expect(markup).toContain('data-race-road-chalk-moving="false"');
    expect(markup).not.toContain("cm-race-road-chalk-svg");
  });

  it("stays absent outside climbs", () => {
    expect(
      renderToStaticMarkup(
        <svg>
          <RaceRoadChalk
            show={false}
            favoriteNames={[]}
            roadLeft={50}
            roadRight={50}
            roadDepth={30}
            isMoving
          />
        </svg>,
      ),
    ).not.toContain("data-race-road-chalk");
  });
});
