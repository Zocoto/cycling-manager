import { describe, expect, it } from "vitest";

import {
  getFederationSelectionCallUpLeadDays,
  getFederationSelectionForecast,
} from "./federation-selection-weather";

describe("federation selection weather", () => {
  it("publishes forecasts when each call-up window opens", () => {
    const worldSlot = {
      slotKey: "world-pro-road",
      competitionCode: "world_championship",
      riderCategory: "professional" as const,
      profileLabel: "Route",
      hostCountryCode: "CA",
      dayNumber: 26,
    };

    expect(getFederationSelectionCallUpLeadDays(worldSlot)).toBe(4);
    expect(
      getFederationSelectionForecast({
        slot: worldSlot,
        gameYear: 3,
        currentGameYear: 3,
        currentDayNumber: 21,
      }).weather,
    ).toBeNull();
    expect(
      getFederationSelectionForecast({
        slot: worldSlot,
        gameYear: 3,
        currentGameYear: 3,
        currentDayNumber: 22,
      }).weather,
    ).not.toBeNull();
  });

  it("uses the three-day federation registration window for juniors", () => {
    const juniorForecast = getFederationSelectionForecast({
      slot: {
        slotKey: "nc-junior-road",
        competitionCode: "nations_cup_junior",
        riderCategory: "junior",
        profileLabel: "Route",
        hostCountryCode: "CH",
        dayNumber: 24,
      },
      gameYear: 3,
      currentGameYear: 3,
      currentDayNumber: 21,
    });

    expect(juniorForecast.revealDayNumber).toBe(21);
    expect(juniorForecast.weather).not.toBeNull();
  });

  it("never leaks a future-season forecast into the preview season", () => {
    const forecast = getFederationSelectionForecast({
      slot: {
        slotKey: "cc-pro-road",
        competitionCode: "continental_championship",
        riderCategory: "professional",
        profileLabel: "Route",
        hostCountryCode: "NL",
        dayNumber: 15,
      },
      gameYear: 3,
      currentGameYear: 2,
      currentDayNumber: 28,
    });

    expect(forecast.isVisible).toBe(false);
    expect(forecast.weather).toBeNull();
  });
});
