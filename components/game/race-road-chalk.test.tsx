import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RaceRoadChalk } from "./race-road-chalk";

describe("race road chalk", () => {
  it("writes favorites across climb roads with the text top toward the finish", () => {
    const markup = renderToStaticMarkup(
      <svg>
        <RaceRoadChalk
          show
          favoriteNames={["Poga", "Vinga"]}
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
    expect(markup).toContain("rotate(90");
    expect(markup).toContain('data-race-road-flow-direction="right-to-left"');
    expect(markup).toContain('data-race-road-chalk-moving="true"');
    expect(markup).toContain('class="cm-race-road-chalk-svg"');
    const animationDuration = Number(
      markup.match(/animation-duration:([\d.]+)s/)?.[1],
    );
    expect(animationDuration).toBeCloseTo(
      (Math.hypot(100, 16) / 28) * 0.62,
    );
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
