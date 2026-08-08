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
        />
      </svg>,
    );

    expect(markup).toContain('data-race-road-chalk="climb"');
    expect(markup).toContain(
      'data-race-road-chalk-orientation="top-toward-finish-right"',
    );
    expect(markup).toContain("POGA");
    expect(markup).toContain("rotate(90");
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
          />
        </svg>,
      ),
    ).not.toContain("data-race-road-chalk");
  });
});
