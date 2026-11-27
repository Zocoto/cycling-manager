import { describe, expect, it } from "vitest";
import { validateChristmasFlight } from "./christmas-flight-validation";

const ticks = Math.ceil(6540 / 236 * 120);
describe("production Christmas flight proof", () => {
  it("replays an entire real course without trusting a supplied score", () => {
    expect(validateChristmasFlight({ version: 1, ticks, commands: [] }, 30)).toEqual({
      score: 0, deliveries: 0, qualities: { successful: 0, super: 0, perfect: 0 },
    });
  });
  it("uses the real auto-release, wind, precision and obstacle engine for an owned scope", () => {
    const proof = { version: 1, ticks, commands: [{ tick: 0, kind: "input", keys: [], pointer: null, automatic: true, granted: true }] };
    const result = validateChristmasFlight(proof, 30, true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.deliveries).toBeGreaterThan(0);
    expect(Object.values(result.qualities).reduce((sum, count) => sum + count, 0)).toBe(result.deliveries);
    expect(() => validateChristmasFlight(proof, 30, false)).toThrow("Commandes");
  });
  it("rejects early, incomplete, overlong and tampered proofs", () => {
    expect(() => validateChristmasFlight({version:1,ticks,commands:[]}, 1)).toThrow("Durée");
    expect(() => validateChristmasFlight({version:1,ticks:100,commands:[]}, 30)).toThrow("n’est pas terminée");
    expect(() => validateChristmasFlight({version:1,ticks:ticks+1,commands:[]}, 30)).toThrow("dépasse");
    expect(() => validateChristmasFlight({version:1,ticks,commands:[],score:7000}, 30)).toThrow("Preuve");
    expect(() => validateChristmasFlight({version:1,ticks,commands:[{tick:0,kind:"input",keys:[],pointer:[9999,1],automatic:false,granted:false}]}, 30)).toThrow("Commandes");
    expect(() => validateChristmasFlight({version:1,ticks,commands:[{tick:9,kind:"drop"},{tick:8,kind:"drop"}]}, 30)).toThrow("Commandes");
  });
});
