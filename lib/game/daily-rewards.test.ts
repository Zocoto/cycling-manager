import { describe, expect, it } from "vitest";

import {
  getDailyRewardImportance,
  getNextDailyRewardCycleDay,
  getRatingOptionsForOffer,
  type DailyRewardOffer,
} from "@/lib/game/daily-rewards";

describe("daily rewards", () => {
  it("follows the validated 40-gift importance curve", () => {
    const curve = Array.from({ length: 40 }, (_, index) =>
      getDailyRewardImportance(index + 1),
    );

    expect(curve).toEqual([
      1, 1, 1, 2, 1, 1, 3, 2, 2, 2,
      3, 2, 2, 4, 3, 3, 3, 4, 3, 3,
      6, 4, 4, 4, 5, 4, 6, 7, 4, 5,
      6, 8, 4, 5, 6, 9, 4, 5, 6, 10,
    ]);
  });

  it("restarts at cycle day 1 after the level 10 gift", () => {
    expect(getNextDailyRewardCycleDay(39)).toBe(40);
    expect(getNextDailyRewardCycleDay(40)).toBe(1);
    expect(getDailyRewardImportance(41)).toBe(1);
    expect(getDailyRewardImportance(80)).toBe(10);
  });

  it("limits permanent stat gifts to the announced stat family", () => {
    const secondaryOffer = createRatingOffer("secondary");
    const primaryOffer = createRatingOffer("primary");

    expect(
      getRatingOptionsForOffer(secondaryOffer).map((option) => option.databaseKey),
    ).toEqual([
      "recovery",
      "endurance",
      "resistance",
      "breakaway",
      "downhill",
      "acceleration",
      "prologue",
    ]);
    expect(
      getRatingOptionsForOffer(primaryOffer).map((option) => option.databaseKey),
    ).toEqual([
      "mountain",
      "hills",
      "sprint",
      "flat",
      "cobbles",
      "time_trial",
    ]);
  });
});

function createRatingOffer(statScope: "primary" | "secondary"): DailyRewardOffer {
  return {
    key: `test-${statScope}`,
    name: "Test",
    description: "",
    effectSummary: "",
    importance: 5,
    effectKind: "rating_boost",
    iconKey: "rating",
    payload: { statScope },
  };
}
