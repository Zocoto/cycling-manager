import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const service = readFileSync(
  "services/federation-selection-weather.ts",
  "utf8",
);
const page = readFileSync(
  "app/jeu/federations/[codePays]/page.tsx",
  "utf8",
);

describe("federation selection weather service", () => {
  it("uses official professional and junior course identifiers when available", () => {
    expect(service).toContain('from("race_editions")');
    expect(service).toContain('from("stages")');
    expect(service).toContain('from("development_race_editions")');
    expect(service).toContain('from("development_race_stages")');
    expect(service).toContain("raceEditionId: edition.id");
    expect(service).toContain("stageId: selected.id");
  });

  it("is independent from club weather centres and receives the current day", () => {
    expect(service).not.toContain("team-weather-center");
    expect(service).not.toContain("getWeatherForecastHorizon");
    expect(page).toContain(
      "currentDayNumber: snapshot.season.currentDayNumber",
    );
  });
});
