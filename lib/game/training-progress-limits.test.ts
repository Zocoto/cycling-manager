import { describe, expect, it } from "vitest";
import { getTrainingProgressLimit } from "./training";

describe("training progression limits shown in reports", () => {
  const iguchi = { initialRating: 61, currentRating: 73, ratingGain: 12 };

  it("explains the +12 seasonal limit independently of four-star potential", () => {
    expect(getTrainingProgressLimit(iguchi, { age: 18, potentialSteps: 8 }))
      .toEqual({ kind: "season", value: 12 });
  });

  it.each([[59, 18], [60, 12], [69, 12], [70, 8], [79, 8], [80, 4], [89, 4], [90, 2]])(
    "uses the season-start tier for %i, with a maximum gain of %i", (initialRating, cap) => {
      expect(getTrainingProgressLimit({ initialRating, currentRating: initialRating + cap, ratingGain: cap },
        { age: 22, potentialSteps: 8 })).toEqual({ kind: "season", value: cap });
    },
  );

  it("does not label an ordinary balance of 999 as a limit", () => {
    expect(getTrainingProgressLimit({ ...iguchi, ratingGain: 11 }, { age: 18, potentialSteps: 8 })).toBeNull();
  });

  it("resets the seasonal allowance when the new season starts at 73", () => {
    expect(getTrainingProgressLimit({ initialRating: 73, currentRating: 73, ratingGain: 0 },
      { age: 19, potentialSteps: 8 })).toBeNull();
  });

  it("distinguishes the potential ceiling from the seasonal ceiling, including item gains above it", () => {
    for (const currentRating of [70, 72]) {
      expect(getTrainingProgressLimit({ initialRating: 68, currentRating, ratingGain: 2 },
        { age: 22, potentialSteps: 1 })).toEqual({ kind: "potential", value: 70 });
    }
  });

  it("explains veteran maintenance without imposing the youth seasonal cap", () => {
    expect(getTrainingProgressLimit({ initialRating: 73, currentRating: 73, ratingGain: 12 },
      { age: 32, potentialSteps: 8 })).toEqual({ kind: "veteran", value: 73 });
    expect(getTrainingProgressLimit({ initialRating: 73, currentRating: 72, ratingGain: 12 },
      { age: 32, potentialSteps: 8 })).toBeNull();
  });

  it("makes no inference when the rider's age is unavailable", () => {
    expect(getTrainingProgressLimit(iguchi, { potentialSteps: 8 })).toBeNull();
  });
});
