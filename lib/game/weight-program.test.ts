import { describe, expect, it } from "vitest";
import { getWeightProgramQuote, getWeightProgramCooldownDays, WEIGHT_PROGRAM_STEPS } from "./weight-program";
const rider = { riderId: "one", heightCm: 180, weightKg: 72, form: 80, cooldownDays: 0 };
describe("optional weight programmes", () => {
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
