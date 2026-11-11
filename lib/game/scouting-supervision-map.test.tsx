import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/jeu/centre-de-formation/actions", () => ({
  startYouthScoutingAction: vi.fn(),
}));

import { YouthScoutingMap } from "@/components/game/youth-scouting-map";
import { getScoutingSupervisionStatus } from "@/lib/game/scouting-supervision";
import type { YouthCountry } from "@/services/youth-development";

const france: YouthCountry = {
  id: "france",
  name: "France",
  code: "FR",
  latitude: 46.6,
  longitude: 2.2,
  reputation: 8,
  reputationSourceSeasonName: null,
  uciNationRank: null,
  specialty: "climber",
  secondarySpecialty: "puncheur",
  specialtyLabel: "Grimpeur",
  secondarySpecialtyLabel: "Puncheur",
  facilityLevel: 1,
};

function renderMission(currentDayNumber: number, percentage = 10) {
  const effects = [{ percentage, startsDayNumber: 1, endsDayNumber: 7 }];
  return renderToStaticMarkup(
    <YouthScoutingMap
      countries={[france]}
      scouts={[]}
      currentDayNumber={currentDayNumber}
      scoutingSupervision={getScoutingSupervisionStatus(effects, currentDayNumber)}
    />,
  ).replace(/<[^>]*>/g, "").replace(/\s+/g, " ");
}

describe("scouting map report bonus preview", () => {
  // The form initially selects three days, including the dispatch day.
  it("confirms the bonus on a report delivered after the seventh active day", () => {
    const markup = renderMission(6);
    expect(markup).toContain("Rapport prévu au J8");
    expect(markup).toContain("bonus de supervision confirmé : +10 %.");
    expect(markup).not.toContain("aura expiré");
  });

  it("warns when the report falls beyond the final covered report day", () => {
    const markup = renderMission(7);
    expect(markup).toContain("Rapport prévu au J9");
    expect(markup).toContain("aura expiré avant le rapport");
    expect(markup).not.toContain("bonus de supervision confirmé");
  });

  it("continues to show the real +20 percent bonus for earlier reports", () => {
    const markup = renderMission(1, 20);
    expect(markup).toContain("Rapport prévu au J3");
    expect(markup).toContain("bonus de supervision confirmé : +20 %.");
  });

  it("does not show an active object or report bonus after its window", () => {
    const markup = renderMission(8);
    expect(markup).not.toContain("Supervision renforcée");
    expect(markup).not.toContain("bonus de supervision confirmé");
    expect(markup).not.toContain("aura expiré");
  });

  it("previews the return day without a supervision bonus", () => {
    expect(renderMission(26)).toContain("Rapport prévu au J28.");
  });
});
