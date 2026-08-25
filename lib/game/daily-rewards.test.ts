import { describe, expect, it } from "vitest";

import {
  getDailyRewardImportance,
  getNextDailyRewardCycleDay,
  getRatingOptionsForOffer,
  groupDailyRewardInventoryItems,
  isStackableDailyReward,
  type DailyRewardInventoryItem,
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

  it("regroupe les cadeaux identiques et conserve l’exemplaire qui expire en premier", () => {
    const grouped = groupDailyRewardInventoryItems([
      createInventoryReward("recent", 3, "2026-08-10T08:00:00Z"),
      createInventoryReward("oldest", 2, "2026-08-01T08:00:00Z"),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({
      id: "oldest",
      key: "energy-ration",
      quantity: 5,
      expiresAfterGameYear: 2,
    });
  });

  it("réserve le cumul aux cadeaux dont l’effet peut réellement s’additionner", () => {
    expect(isStackableDailyReward("form_boost")).toBe(true);
    expect(isStackableDailyReward("rider_experience")).toBe(true);
    expect(isStackableDailyReward("rating_boost")).toBe(true);
    expect(isStackableDailyReward("scouting_boost")).toBe(true);
    expect(isStackableDailyReward("special_ability")).toBe(false);
    expect(isStackableDailyReward("naturalization")).toBe(false);
  });
});

function createInventoryReward(
  id: string,
  quantity: number,
  acquiredAt: string,
): DailyRewardInventoryItem {
  return {
    id,
    key: "energy-ration",
    name: "Ration énergétique",
    description: "",
    effectSummary: "+5 en forme",
    importance: 1,
    effectKind: "form_boost",
    iconKey: "nutrition",
    payload: { amount: 5 },
    quantity,
    acquiredAt,
    expiresAfterGameYear: 2,
  };
}

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
