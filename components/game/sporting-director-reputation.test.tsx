import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SportingDirectorReputation } from "./sporting-director-reputation";

describe("SportingDirectorReputation", () => {
  it("rend la valeur compacte consultable avec un libell\u00e9 accessible", () => {
    const markup = renderToStaticMarkup(
      <SportingDirectorReputation
        reputationPoints={3.5}
        compact
        breakdown={{
          items: [
            {
              key: "race-results",
              label: "R\u00e9sultats en course",
              points: 3.5,
            },
          ],
          recentGains: [],
          totalGains: 3.5,
          currentPoints: 3.5,
        }}
      />,
    );

    expect(markup).toContain("3,5 points");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("Consulter le d\u00e9tail");
  });
});
