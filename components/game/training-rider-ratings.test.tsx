import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TrainingRiderRatings } from "./training-rider-ratings";

describe("training rider ratings", () => {
  it("résume les forces et la faiblesse puis expose les treize notes", () => {
    const markup = renderToStaticMarkup(
      <TrainingRiderRatings
        riderName="Camille Test"
        ratings={{
          mountain: 82,
          hills: 78,
          recovery: 61,
          endurance: 69,
          resistance: 67,
          breakaway: 55,
          downhill: 64,
          acceleration: 71,
          sprint: 49,
          flat: 73,
          cobbles: 58,
          prologue: 52,
          timeTrial: 44,
        }}
      />,
    );

    expect(markup).toContain("MON 82 · VAL 78");
    expect(markup).toContain("↓ CLM 44");
    expect(markup).toContain('aria-label="Statistiques de Camille Test"');
    expect(markup.match(/<dd/g)).toHaveLength(13);
  });
});
