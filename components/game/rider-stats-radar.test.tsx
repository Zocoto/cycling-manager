import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RiderStatsRadar } from "./rider-stats-radar";

describe("RiderStatsRadar", () => {
  it("marks six primary ratings and seven secondary ratings", () => {
    const markup = renderToStaticMarkup(
      <RiderStatsRadar
        ratings={{
          mountain: 70,
          hills: 70,
          flat: 70,
          timeTrial: 70,
          cobbles: 70,
          sprint: 70,
          acceleration: 70,
          downhill: 70,
          endurance: 70,
          resistance: 70,
          recovery: 70,
          breakaway: 70,
          prologue: 70,
        }}
      />,
    );

    expect(markup.match(/data-rating-importance="primary"/g)).toHaveLength(6);
    expect(markup.match(/data-rating-importance="secondary"/g)).toHaveLength(7);
    expect(markup).toContain("bg-[#3F8F5A]");
    expect(markup).toContain("bg-[#DDEDE1]");
  });
});
