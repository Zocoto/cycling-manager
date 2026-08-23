import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CollapsibleMobileRiderRatings } from "./collapsible-mobile-rider-ratings";

describe("mobile rider ratings", () => {
  it("ne construit pas les notes détaillées avant la demande du joueur", () => {
    const markup = renderToStaticMarkup(
      <CollapsibleMobileRiderRatings
        riderName="Camille Test"
        ratings={[
          {
            key: "mountain",
            label: "MO",
            fullLabel: "Montagne",
            importance: "primary",
            value: 81,
          },
        ]}
      />,
    );

    expect(markup).toContain("Voir les notes");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("Montagne");
    expect(markup).not.toContain(">81<");
  });
});
