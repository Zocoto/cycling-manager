import { describe, expect, it } from "vitest";

import {
  YOUTH_SCOUTING_DURATION_OPTIONS,
  YOUTH_SCOUTING_MAX_DURATION_DAYS,
  YOUTH_SCOUTING_MIN_DURATION_DAYS,
  getYouthScoutingDurationOptionsForDay,
  isValidYouthScoutingDuration,
} from "./youth-scouting-duration";

describe("youth scouting duration", () => {
  it("propose uniquement les missions de trois à sept jours", () => {
    expect(YOUTH_SCOUTING_MIN_DURATION_DAYS).toBe(3);
    expect(YOUTH_SCOUTING_MAX_DURATION_DAYS).toBe(7);
    expect(YOUTH_SCOUTING_DURATION_OPTIONS).toEqual([3, 4, 5, 6, 7]);
  });

  it("refuse les missions trop courtes même lors d’un appel direct", () => {
    expect(isValidYouthScoutingDuration(1)).toBe(false);
    expect(isValidYouthScoutingDuration(2)).toBe(false);
    expect(isValidYouthScoutingDuration(3)).toBe(true);
    expect(isValidYouthScoutingDuration(7)).toBe(true);
    expect(isValidYouthScoutingDuration(8)).toBe(false);
    expect(isValidYouthScoutingDuration(3.5)).toBe(false);
  });

  it("retire les durées qui dépasseraient le dernier jour de la saison", () => {
    expect(getYouthScoutingDurationOptionsForDay(21)).toEqual([3, 4, 5, 6, 7]);
    expect(getYouthScoutingDurationOptionsForDay(22)).toEqual([3, 4, 5, 6]);
    expect(getYouthScoutingDurationOptionsForDay(25)).toEqual([3]);
    expect(getYouthScoutingDurationOptionsForDay(26)).toEqual([]);
  });
});
