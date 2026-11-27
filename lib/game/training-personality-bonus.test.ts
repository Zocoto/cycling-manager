import { describe, expect, it } from "vitest";

import { buildSeniorDailyTrainingRiders, buildJuniorDailyTrainingRiders } from "./daily-training-report";
import { buildTrainingBonusBreakdown } from "./training-bonus-breakdown";
import { getDailyTrainingPersonalityBonus, getTrainingPersonalityBonus } from "./training-personality-bonus";

describe("training personality bonus reporting", () => {
  it("keeps the recorded bonus after a personality change and honors a recorded zero", () => {
    expect(getTrainingPersonalityBonus({ recordedPercentage: 5, currentPersonalityKey: "fidele" }))
      .toEqual({ percentage: 5, source: "session" });
    expect(getTrainingPersonalityBonus({ recordedPercentage: 0, currentPersonalityKey: "assidu" })).toBeNull();
    expect(getTrainingPersonalityBonus({ recordedPercentage: 5, currentPersonalityKey: "assidu", completed: false })).toBeNull();
  });

  it("distinguishes current information from legacy sessions and rejects invalid snapshots", () => {
    expect(getTrainingPersonalityBonus({ recordedPercentage: null, currentPersonalityKey: "assidu" }))
      .toEqual({ percentage: 5, source: "current" });
    expect(getTrainingPersonalityBonus({ recordedPercentage: undefined, currentPersonalityKey: "fidele" })).toBeNull();
    for (const recordedPercentage of [Number.NaN, Number.POSITIVE_INFINITY, -5, 10, "invalid"]) {
      expect(getTrainingPersonalityBonus({ recordedPercentage, currentPersonalityKey: "assidu" })).toBeNull();
    }
  });

  it("counts only attested junior sessions when a day mixes recorded and legacy reports", () => {
    expect(getDailyTrainingPersonalityBonus({ recordedPercentages: [5, null], currentPersonalityKey: "assidu" }))
      .toEqual({ percentage: 5, source: "session", sessionCount: 1, totalSessionCount: 2 });
    expect(getDailyTrainingPersonalityBonus({ recordedPercentages: [0, 0], currentPersonalityKey: "assidu" })).toBeNull();
    expect(getDailyTrainingPersonalityBonus({ recordedPercentages: [], currentPersonalityKey: "assidu" })).toBeNull();
  });

  it("multiplies the recorded five percent separately from trainer bonuses", () => {
    const base = { ratingKey: "mountain" as const, trainerLevel: 5, trainerSpecialty: "mountain" as const, trainerCountryMatch: false };
    const recorded = buildTrainingBonusBreakdown({ ...base, personalityBonusPercentage: 5 });
    expect(recorded.totalPercentage).toBe(26);
    expect(recorded.items.find((item) => item.key === "personality-assidu")?.percentage).toBe(5);
    expect(buildTrainingBonusBreakdown(base).items.some((item) => item.key === "personality-assidu")).toBe(false);
  });

  it("annotates gains without recalculating or crediting them again", () => {
    const riders = [{ id: "rider", firstName: "Ana", lastName: "Test", personalityKey: "assidu" }];
    const session = { riderId: "rider", status: "completed" as const, ratingChanges: { mountain: 0.1 }, formBefore: 90, formDelta: -5, formAfter: 85 };
    const original = buildSeniorDailyTrainingRiders({ riders, sessions: [session] });
    const annotated = buildSeniorDailyTrainingRiders({ riders, sessions: [{ ...session, personalityBonusPercentage: 5 }] });
    expect(annotated[0].statChanges).toEqual(original[0].statChanges);
    expect(annotated[0].personalityBonus?.source).toBe("session");
    const skipped = buildSeniorDailyTrainingRiders({ riders, sessions: [{ ...session, status: "skipped_injury", personalityBonusPercentage: 5 }] });
    expect(skipped[0].personalityBonus).toBeNull();
    const juniorSession = { riderId: "rider", trainingMode: "manual", slot: "manual_am", gameType: "rhythm", ratingChanges: { mountain: 0.01 } };
    const juniorOriginal = buildJuniorDailyTrainingRiders({ riders, sessions: [juniorSession] });
    const juniorAnnotated = buildJuniorDailyTrainingRiders({ riders, sessions: [{ ...juniorSession, personalityBonusPercentage: 5 }] });
    expect(juniorAnnotated[0].statChanges).toEqual(juniorOriginal[0].statChanges);
    expect(juniorAnnotated[0].personalityBonus?.source).toBe("session");
  });
});
