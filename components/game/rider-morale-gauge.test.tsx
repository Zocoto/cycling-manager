import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RiderMoraleGauge } from "./rider-morale-gauge";

describe("RiderMoraleGauge", () => {
  it("affiche une jauge bleue et détaille les variations au survol", () => {
    const markup = renderToStaticMarkup(
      <RiderMoraleGauge
        value={72}
        events={[
          {
            id: "event-1",
            label: "Victoire d’étape",
            delta: 4,
            moraleBefore: 68,
            moraleAfter: 72,
            occurredAt: "2026-09-27T08:00:00.000Z",
            sourceType: "stage_result",
          },
        ]}
      />,
    );

    expect(markup).toContain("Moral");
    expect(markup).toContain("72%");
    expect(markup).toContain('aria-valuenow="72"');
    expect(markup).toContain("bg-[#3B82F6]");
    expect(markup).toContain("Victoire d’étape");
    expect(markup).toContain("+4");
  });
});
