import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PreRacePressConference } from "@/lib/game/pre-race-press";
import { PreRacePressResult } from "./pre-race-press-result";

const conference: PreRacePressConference = {
  id: "press", teamName: "Team", directorName: "DS", leaderRiderId: "rider", leaderName: "Leader",
  ambition: "victory", raceIntent: "attack", publicStatement: "Nous visons la victoire.",
  status: "settled", targetMet: false, leaderFinalRank: 2, reputationDelta: 3,
  commitmentAmount: 0, sponsorBonus: 0, submittedAt: "2026-10-11", isOwn: true,
  achievementLevel: "partial", achievementPercent: 40, sponsorBonusAwarded: 0,
};
const render = (patch: Partial<PreRacePressConference> = {}) => renderToStaticMarkup(<PreRacePressResult conference={{ ...conference, ...patch }} />);
describe("pre-race partial result", () => {
  it("recognizes a close result without claiming the promise was kept", () => {
    expect(render()).toContain("Réussite partielle · 40 % · 2e · +3 réputation");
    expect(render()).toContain("La promesse n’est pas entièrement tenue");
    expect(render()).not.toContain("Objectif tenu");
  });
  it("shows the preserved stake and rounded credit inside the commitment", () => {
    expect(render({ commitmentAmount: 60, sponsorBonus: 4, sponsorBonusAwarded: 2, reputationDelta: -33 })).toContain("40 % de la mise préservés · satisfaction sponsor : +2/4");
    expect(render({ reputationDelta: -33 })).toContain("-33 réputation");
  });
  it("keeps a non-classified leader as a failure", () => {
    expect(render({ achievementLevel: "missed", achievementPercent: 0, leaderFinalRank: null, reputationDelta: -4 })).toContain("Objectif manqué · non classé · -4 réputation");
  });
  it("keeps full success and historical failures distinct", () => {
    expect(render({ targetMet: true, achievementLevel: "full", leaderFinalRank: 1 })).toContain("Objectif tenu · 1er");
    expect(render({ achievementLevel: null })).toContain("Objectif manqué");
  });
  it("does not render a verdict before settlement", () => expect(render({ status: "published" })).toBe(""));
});
