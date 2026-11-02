import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TRAINING_STAT_CODES } from "@/lib/game/training";
import { LatestTrainingReport, SeasonTrainingReport, TrainingReportPopover } from "./training-report-popover";
import { trainingLimitLatestFixture, trainingLimitSeasonFixture } from "@/test/fixtures/training-progress-limits";

describe("TrainingReportPopover", () => {
  it("explains a capped daily gain instead of promising it will increase the next note", () => {
    const markup = renderToStaticMarkup(<LatestTrainingReport
      report={trainingLimitLatestFixture} seasonReport={trainingLimitSeasonFixture} />);
    expect(markup).toContain("Plafond saisonnier atteint : +12/12. Reprise la saison prochaine.");
    expect(markup).toContain("+0,398");
    expect(markup).not.toContain("les décimales sont conservées pour les prochaines séances");
  });

  it("keeps the actual balance visible beside the seasonal ceiling", () => {
    const markup = renderToStaticMarkup(<SeasonTrainingReport report={trainingLimitSeasonFixture} />);
    expect(markup).toContain("Plafond saisonnier atteint : +12/12. Reprise la saison prochaine.");
    expect(markup).toContain("+0,999");
    expect(markup).toContain("14,409");
    expect(markup.match(/Plafond saisonnier atteint/g)).toHaveLength(1);
  });

  it("garde le rapport détaillé hors du HTML tant que le panneau reste fermé", () => {
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
          bonusBreakdownByStat: {
            mountain: {
              totalPercentage: 26.6,
              calculation: "stacked",
              items: [
                {
                  key: "trainer",
                  label: "Spécialité de l’entraîneur",
                  detail: "Montagne · niveau 3",
                  percentage: 20,
                },
              ],
            },
          },
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
    expect(markup).toContain("Saison");
    expect(markup).not.toContain("Bilan J1");
    expect(markup).not.toContain('data-layout="inline"');
    expect(markup).not.toContain("absolute right-0 z-50");
  });
});
