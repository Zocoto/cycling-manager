import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getTrainingPersonalityBonus } from "@/lib/game/training-personality-bonus";
import { buildTrainingBonusBreakdown } from "@/lib/game/training-bonus-breakdown";
import { TrainingPersonalityBonusNotice } from "./training-personality-bonus-notice";
import { LatestTrainingReport } from "./training-report-popover";
import { trainingLimitLatestFixture, trainingLimitSeasonFixture } from "@/test/fixtures/training-progress-limits";

describe("training personality report notice", () => {
  it("identifies a recorded Assidu bonus without changing the saved gain", () => {
    const bonus = getTrainingPersonalityBonus({ recordedPercentage: 5, currentPersonalityKey: "fidele" });
    const html = renderToStaticMarkup(<LatestTrainingReport
      report={{ ...trainingLimitLatestFixture, progressMilli: { hills: 105 }, ratingChanges: {}, personalityBonus: bonus }}
      seasonReport={trainingLimitSeasonFixture}
    />);

    expect(html).toContain("Caractère Assidu");
    expect(html).toContain("5 % de progression");
    expect(html).toContain("+0,105");
    expect(html).not.toContain("Caractère actuel");
    expect(html).not.toContain("+0,110");
  });

  it("keeps current-personality information distinct from a recorded session bonus", () => {
    const bonus = getTrainingPersonalityBonus({ recordedPercentage: null, currentPersonalityKey: "assidu" });
    const html = renderToStaticMarkup(<TrainingPersonalityBonusNotice bonus={bonus} />);

    expect(html).toContain("Caractère actuel : Assidu");
    expect(html).toContain("5 % de progression");
    expect(html).not.toContain('data-training-personality-bonus="session"');
  });

  it("does not claim a bonus for absent, explicitly zero or skipped sessions", () => {
    const bonuses = [
      null,
      getTrainingPersonalityBonus({ recordedPercentage: 0, currentPersonalityKey: "assidu" }),
      getTrainingPersonalityBonus({ recordedPercentage: 5, currentPersonalityKey: "assidu", completed: false }),
      getTrainingPersonalityBonus({ recordedPercentage: null, currentPersonalityKey: "assidu", completed: false }),
    ];

    for (const bonus of bonuses) {
      expect(renderToStaticMarkup(<TrainingPersonalityBonusNotice bonus={bonus} />)).toBe("");
    }
  });

  it("multiplies a recorded five-percent bonus separately from the coach family", () => {
    const common = { ratingKey: "mountain" as const, trainerLevel: 3, trainerSpecialty: "mountain" as const, trainerCountryMatch: false };
    const original = buildTrainingBonusBreakdown(common);
    const recorded = buildTrainingBonusBreakdown({ ...common, personalityBonusPercentage: 5 });
    const current = buildTrainingBonusBreakdown({ ...common, personalityBonusPercentage: 0 });

    expect(original.totalPercentage).toBeCloseTo(12);
    expect(recorded.totalPercentage).toBeCloseTo(17.6);
    expect(recorded.items.find((item) => item.label.includes("Assidu"))?.percentage).toBe(5);
    expect(current.totalPercentage).toBe(original.totalPercentage);
    expect(current.items.some((item) => item.label.includes("Assidu"))).toBe(false);
  });
});
