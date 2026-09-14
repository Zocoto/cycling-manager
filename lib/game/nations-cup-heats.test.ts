import { describe, expect, it } from "vitest";

import {
  getNationsCupPoolKey,
  isSecondaryProfessionalNationsCupHeatSlug,
  PROFESSIONAL_NATIONS_CUP_EVENTS,
  PROFESSIONAL_NATIONS_CUP_HEAT_BATCH_SIZE,
} from "./nations-cup-heats";

describe("professional Nations Cup heats", () => {
  it("keeps five stable public event identities", () => {
    expect(PROFESSIONAL_NATIONS_CUP_EVENTS).toHaveLength(5);
    expect(
      PROFESSIONAL_NATIONS_CUP_EVENTS.map((event) => event.slotKey),
    ).toEqual([
      "nc-mountain",
      "nc-hills",
      "nc-sprint",
      "nc-cobbles",
      "nc-time-trial",
    ]);
  });

  it("builds the frozen division/group pool keys", () => {
    expect(getNationsCupPoolKey(1, null)).toBe("d1");
    expect(getNationsCupPoolKey(2, "A")).toBe("d2-a");
    expect(getNationsCupPoolKey(4, "C")).toBe("d4-c");
  });

  it("distinguishes secondary heats from the canonical D1 race", () => {
    expect(
      isSecondaryProfessionalNationsCupHeatSlug("nations-cup-montagne"),
    ).toBe(false);
    expect(
      isSecondaryProfessionalNationsCupHeatSlug("nations-cup-montagne-d2-a"),
    ).toBe(true);
  });

  it("sizes each cron pack for the forty short races scheduled together", () => {
    expect(PROFESSIONAL_NATIONS_CUP_HEAT_BATCH_SIZE).toBeGreaterThanOrEqual(
      Math.ceil((8 * PROFESSIONAL_NATIONS_CUP_EVENTS.length) / 3),
    );
  });
});
