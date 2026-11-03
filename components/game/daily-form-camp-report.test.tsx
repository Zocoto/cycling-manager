import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DailyFormCampReport } from "@/lib/game/daily-form-camp-report";
import { DailyFormCampTextReport } from "./daily-form-camp-report";

const report: DailyFormCampReport = {
  teamName: "Test", seasonName: "Saison 4", dayNumber: 4, currentDayNumber: 5,
  calendarDate: "2026-10-12", riderCount: 1, totalFormGain: 4,
  riders: [{ riderId: "00000000-0000-4000-8000-000000000001", firstName: "Jean", lastName: "Morel",
    campType: "premium", startDayNumber: 3, endDayNumber: 5, formBefore: 96, formAfter: 100, formDelta: 4 }],
};

describe("daily form-camp report page content", () => {
  it("shows actual gains, rider identity and a route to the correct health tab", () => {
    const markup = renderToStaticMarkup(<DailyFormCampTextReport report={report} />);
    expect(markup).toContain("Jean Morel");
    expect(markup).toContain("/jeu/coureurs/00000000-0000-4000-8000-000000000001");
    expect(markup).toContain("96 % → 100 %");
    expect(markup).toContain("+4 points de forme");
    expect(markup).toContain("Plafond de forme atteint");
    expect(markup).toContain("/jeu/centre-de-soin?onglet=forme");
    expect(markup).toContain("gains réellement reçus");
  });

  it("does not offer navigation into an unsettled day", () => {
    const markup = renderToStaticMarkup(<DailyFormCampTextReport report={report} />);
    expect(markup).toContain("rapport-stages?jour=3");
    expect(markup).not.toContain("rapport-stages?jour=5");
    const older = renderToStaticMarkup(<DailyFormCampTextReport report={{ ...report, dayNumber: 3 }} />);
    expect(older).toContain("rapport-stages?jour=4");
  });

  it("formats decimal form values and actual gains with French decimal commas", () => {
    const markup = renderToStaticMarkup(<DailyFormCampTextReport report={{ ...report,
      totalFormGain: 11.1, riders: [{ ...report.riders[0], formBefore: 95.35, formAfter: 100, formDelta: 4.65 }] }} />);
    expect(markup).toContain("95,35 % → 100 %");
    expect(markup).toContain("+4,65 points de forme");
    expect(markup).toContain("+11,1 pts");
    expect(markup).not.toContain("4.650000");
  });

  it("explains the first day's pending report without rendering false gains", () => {
    const markup = renderToStaticMarkup(<DailyFormCampTextReport report={{ ...report,
      dayNumber: 1, currentDayNumber: 1, riders: [], riderCount: 0, totalFormGain: 0 }} />);
    expect(markup).toContain("Le premier bilan sera disponible après le passage à la journée suivante.");
    expect(markup).not.toContain("rapport-stages?jour=");
    expect(markup).not.toContain("Jean Morel");
  });
});
