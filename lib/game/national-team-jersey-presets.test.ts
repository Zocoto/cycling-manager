import { describe, expect, it } from "vitest";
import { getNationalTeamJerseyPreset, MAURITIUS_NATIONAL_TEAM_JERSEY } from "./national-team-jersey-presets";

describe("approved selection jersey presets", () => {
  it("preserves the Mauritius design independently of preview fixtures", () => {
    const preset = getNationalTeamJerseyPreset(" mu ");
    expect(preset).toEqual(MAURITIUS_NATIONAL_TEAM_JERSEY);
    expect(preset?.elements.at(-1)?.text).toBe("MAURITIUS");
    expect(preset?.elements.slice(0, 4).map(layer => layer.color)).toEqual(["#EA2839", "#1646A0", "#F4D233", "#159B61"]);
  });
  it("returns an independent draft and never replaces another country's kit", () => {
    const draft = getNationalTeamJerseyPreset("MU")!;
    draft.elements[0].color = "#000000";
    expect(getNationalTeamJerseyPreset("MU")).toEqual(MAURITIUS_NATIONAL_TEAM_JERSEY);
    expect(getNationalTeamJerseyPreset("FR")).toBeNull();
  });
});
