import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TRAINING_STAT_CODES } from "@/lib/game/training";
import { TrainingReportPopover } from "./training-report-popover";

describe("TrainingReportPopover", () => {
  it("propose la dernière séance et le cumul de saison dans le même rapport", () => {
    const markup = renderToStaticMarkup(
      <TrainingReportPopover
        report={{
          dayNumber: 6,
          status: "completed",
          intensity: 75,
          domain: "climber",
          minimumForm: 50,
          trainerLevel: 3,
          trainerSpecialty: "mountain",
          trainerCountryMatch: true,
          physiotherapistLevel: 2,
          formBefore: 82,
          formDelta: -13,
          formAfter: 69,
          progressMilli: { mountain: 850 },
          declineMilli: {},
          ratingChanges: { mountain: 1 },
          processedAt: "2026-07-27T08:00:00.000Z",
        }}
        seasonReport={{
          fromDayNumber: 1,
          toDayNumber: 6,
          firstSessionDayNumber: 1,
          lastSessionDayNumber: 6,
          sessionCount: 6,
          completedSessionCount: 5,
          skippedSessionCount: 1,
          totalFormDelta: -40,
          stats: TRAINING_STAT_CODES.map((statCode) => ({
            statCode,
            initialRating: statCode === "mountain" ? 60 : 50,
            currentRating: statCode === "mountain" ? 62 : 50,
            ratingGain: statCode === "mountain" ? 2 : 0,
            ratingLoss: 0,
            netRatingChange: statCode === "mountain" ? 2 : 0,
            balanceMilli: statCode === "mountain" ? 350 : 0,
            totalTrainingMilli: statCode === "mountain" ? 2_350 : 0,
            totalDeclineMilli: 0,
          })),
        }}
      />,
    );

    expect(markup).toContain("Rapports");
    expect(markup).toContain("Dernière séance");
    expect(markup).toContain("Saison");
    expect(markup).toContain("Bilan J1");
    expect(markup).toContain("J1 60");
    expect(markup).toContain("Travail +2,350");
  });
});