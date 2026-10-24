import { describe, expect, it } from "vitest";
import type { StageSimulationInput } from "./race-simulation";
import { getRaceWeather } from "./race-weather";
import { getRaceResultsWeather } from "./race-results-weather";

const weather = { ...getRaceWeather("frozen"), temperatureC: -3, windSpeedKph: 42 };
const input = {
  id: "stage-2", seed: "historic-official-seed", raceCountryCode: "BE", profileType: "hilly",
  weather,
} as StageSimulationInput;
const lockedSimulation = { raceEditionId: "edition-1", stageId: "stage-2", input };
const context = { raceEditionId: "edition-1", stageId: "stage-2" };

describe("results weather", () => {
  it("uses the exact frozen conditions, without regenerating or mutating them", () => {
    const before = JSON.stringify(lockedSimulation);
    expect(getRaceResultsWeather({ ...context, lockedSimulation })).toBe(weather);
    expect(JSON.stringify(lockedSimulation)).toBe(before);
  });
  it.each([undefined, null])("does not invent weather when the official input is missing: %s", source => {
    expect(getRaceResultsWeather({ ...context, lockedSimulation: source })).toBeNull();
  });
  it("rejects weather from another stage or edition", () => {
    expect(getRaceResultsWeather({ ...context, stageId: "stage-3", lockedSimulation })).toBeNull();
    expect(getRaceResultsWeather({ ...context, raceEditionId: "edition-2", lockedSimulation })).toBeNull();
  });
  it("does not redraw historical weather when a legacy input did not record it", () => {
    const legacyInput = { ...input, weather: undefined };
    expect(getRaceResultsWeather({ ...context, lockedSimulation: { ...lockedSimulation, input: legacyInput } })).toBeNull();
  });
});
