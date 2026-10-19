import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RaceTeamStageReport } from "./race-team-stage-report";
import { buildTeamStageReport } from "@/lib/game/race-team-stage-report";
import type { OfficialRiderResult } from "@/lib/game/race-results";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { createRaceJournalFixture } from "@/test/race-journal-fixture";

it("affiche un bilan utile même sans scénario et ne présente pas des distances inconnues comme nulles", () => {
  const result: OfficialRiderResult = { riderId: "rider", riderName: "Lucas Martin", teamId: "team", teamName: "Vélo Club", rank: 8, status: "finished", elapsedTimeMs: 3600000, gapToWinnerMs: 65000, mountainPoints: 0, sprintPoints: 0, abandonmentReason: null };
  const report = buildTeamStageReport({ teamId: "team", stageId: "stage", results: [result] });
  const markup = renderToStaticMarkup(<RaceTeamStageReport report={report} />);
  expect(markup).toContain("Lucas Martin");
  expect(markup).toContain("8e");
  expect(markup).toContain("1 min 5 s");
  expect(markup).toContain("n’a pas été enregistré");
  expect(markup).not.toContain("Protection : 0");
  expect(renderToStaticMarkup(<RaceTeamStageReport report={null} />)).toBe("");
});

it("localise les actions de soutien en préservant les noms et les détails fermés", () => {
  const { report } = createRaceJournalFixture();
  const markup = renderToStaticMarkup(<LocaleProvider initialLocale="en"><RaceTeamStageReport report={report} /></LocaleProvider>);
  expect(markup).toContain("Chase support");
  expect(markup).toContain("In the breakaway");
  expect(markup).toMatch(/Marc Petit<\/span> for <span data-i18n-skip="true">Lucas Martin/);
  expect(markup).not.toContain(" pour ");
  expect(markup).not.toContain("data-rider-journal-content");
});
