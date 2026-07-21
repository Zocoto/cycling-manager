import { describe, expect, it } from "vitest";

import {
  RACE_SIMULATOR_ALLOWED_EMAIL,
  canAccessRaceSimulator,
} from "./race-simulator-access";

describe("race simulator access", () => {
  it("autorise uniquement le compte de test prévu", () => {
    expect(canAccessRaceSimulator(RACE_SIMULATOR_ALLOWED_EMAIL)).toBe(true);
    expect(canAccessRaceSimulator("  PAUL.LEBLANC22@GMAIL.COM ")).toBe(true);
  });

  it("refuse les comptes absents ou différents", () => {
    expect(canAccessRaceSimulator(null)).toBe(false);
    expect(canAccessRaceSimulator(undefined)).toBe(false);
    expect(canAccessRaceSimulator("paul.leblanc22+test@gmail.com")).toBe(false);
    expect(canAccessRaceSimulator("zocoto@hotmail.com")).toBe(false);
  });
});
