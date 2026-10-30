import { describe, expect, it } from "vitest";
import { getWeightProgramQuote, getWeightProgramCooldownDays, getWeightProgramFormCost, WEIGHT_PROGRAM_STEPS } from "./weight-program";
const rider = { riderId: "one", heightCm: 180, weightKg: 72, form: 80, cooldownDays: 0 };
describe("optional weight programmes", () => {
  it("preserves form on every legal weight step in either direction", () => {
    for (const percentage of [0, 5, 10, 15, 20, 25, 27.5, 35]) {
      for (const step of WEIGHT_PROGRAM_STEPS) for (const sign of [-1, 1]) {
        const expectedCost = Math.round(step * 20 * (1 - percentage / 100) * 10) / 10;
        expect(getWeightProgramFormCost(sign * step, percentage)).toBe(expectedCost);
        expect(getWeightProgramQuote(rider, sign * step, 0, percentage)).toEqual({
          allowed: true,
          formCost: expectedCost,
          weightAfterKg: 72 + sign * step,
          formAfter: Math.round((80 - expectedCost) * 100) / 100,
        });
      }
    }
  });

  it("retains the small saving of a one-star nutritionist without inventing fractional form noise", () => {
    expect(getWeightProgramFormCost(-0.2, 5)).toBe(3.8);
    expect(getWeightProgramQuote({ ...rider, form: 6.2 }, -0.2, 0, 5))
      .toMatchObject({ allowed: true, formCost: 3.8, formAfter: 2.4 });
    expect(getWeightProgramQuote({ ...rider, form: 3.79 }, -0.2, 0, 5).allowed).toBe(false);
    expect(getWeightProgramQuote({ ...rider, form: 3.8 }, -0.2, 0, 5))
      .toMatchObject({ allowed: true, formAfter: 0 });
  });

  it("clamps effective savings including affinity bonuses and ignores invalid percentages", () => {
    expect(getWeightProgramFormCost(1, 100)).toBe(13);
    expect(getWeightProgramFormCost(1, 35)).toBe(13);
    for (const invalid of [NaN, Infinity, -Infinity, -5]) {
      expect(getWeightProgramFormCost(1, invalid)).toBe(20);
    }
  });

  it("matches positive PostgreSQL half-tie rounding for fractional affinity percentages", () => {
    expect(getWeightProgramFormCost(0.6, 11.25)).toBe(10.7);
    expect(getWeightProgramFormCost(0.6, 23.75)).toBe(9.2);
    expect(getWeightProgramFormCost(1, 10.75)).toBe(17.9);
    expect(getWeightProgramFormCost(1, 25.75)).toBe(14.9);
  });

  it("uses supplements before the reduced cost while retaining cooldown and physical safety checks", () => {
    expect(getWeightProgramQuote({ ...rider, form: 1 }, 0.4, 5, 25))
      .toMatchObject({ allowed: true, formCost: 6, formAfter: 0 });
    expect(getWeightProgramQuote({ ...rider, form: 99 }, -1, 10, 25).formAfter).toBe(85);
    expect(getWeightProgramQuote({ ...rider, cooldownDays: 1 }, -1, 0, 35).allowed).toBe(false);
    expect(getWeightProgramQuote({ ...rider, weightKg: 58.3 }, -0.2, 0, 35).allowed).toBe(false);
    expect(getWeightProgramQuote({ ...rider, weightKg: 119.8 }, 0.4, 0, 35).allowed).toBe(false);
  });

  it("quotes identical form costs and shared delays in both directions", () => {
    for (const step of WEIGHT_PROGRAM_STEPS) for (const sign of [-1, 1]) {
      const quote = getWeightProgramQuote(rider, sign * step);
      expect(quote).toEqual({ allowed: true, formCost: step * 20, weightAfterKg: 72 + sign * step, formAfter: 80 - step * 20 });
      expect(getWeightProgramQuote({...rider, cooldownDays: 1}, sign * step).allowed).toBe(false);
    }
  });
  it("counts supplement form first but never beyond 100", () => {
    expect(getWeightProgramQuote({...rider, form: 2}, 0.4, 6)).toMatchObject({allowed: true, formAfter: 0});
    expect(getWeightProgramQuote({...rider, form: 2}, 0.4, 5).allowed).toBe(false);
    expect(getWeightProgramQuote({...rider, form: 99}, 1, 7).formAfter).toBe(80);
  });
  it.each([0, 0.3, 1.2, -1.2, NaN, Infinity])("rejects an invalid %s kg", delta => {
    expect(getWeightProgramQuote(rider, delta).allowed).toBe(false);
  });
  it("enforces measured physique, safety floor and upper limit", () => {
    expect(getWeightProgramQuote({...rider, weightKg: null}, 0.2).allowed).toBe(false);
    expect(getWeightProgramQuote({...rider, heightCm: null}, -0.2).allowed).toBe(false);
    expect(getWeightProgramQuote({...rider, weightKg: 58.3}, -0.2).allowed).toBe(false);
    expect(getWeightProgramQuote({...rider, weightKg: 119.8}, 0.2).allowed).toBe(true);
    expect(getWeightProgramQuote({...rider, weightKg: 119.8}, 0.4).allowed).toBe(false);
  });
  it("counts real calendar days, including a season change and offseason", () => {
    expect(getWeightProgramCooldownDays(null, "2026-10-08")).toBe(0);
    expect(getWeightProgramCooldownDays("2026-10-07", "2026-10-08")).toBe(4);
    expect(getWeightProgramCooldownDays("2026-10-04", "2026-10-08")).toBe(1);
    expect(getWeightProgramCooldownDays("2026-10-03", "2026-10-08")).toBe(0);
    expect(getWeightProgramCooldownDays("2026-09-30", "2026-10-08")).toBe(0);
  });
});
