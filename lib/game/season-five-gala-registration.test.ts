import { describe, expect, it } from "vitest";

import {
  buildSeasonFiveGalaSelections,
  isSeasonFiveGalaContinentalRiderEligible,
  parseSeasonFiveGalaContext,
  seasonFiveGalaRegistrationSchema,
  type GalaS5Rider,
} from "./season-five-gala-registration";

const ids = Array.from({ length: 9 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
const rider: GalaS5Rider = {
  rider_id: ids[0], first_name: "Fixture", last_name: "Rider",
  mountain: 75, hills: 74, flat: 73, time_trial: 72, cobbles: 71, sprint: 70,
};
const selections = { "pt-zoncolan": ids.slice(0, 7), "pt-liege": [], "pt-flanders": [] };
const input = { program: "pro-tour", selections };
const context = {
  isOpen: true,
  closesAt: "2026-12-04T11:00:00+00:00",
  team: { id: ids[8], name: "Fixture S5", futureName: "Fixture S6", identityReady: true },
  program: "pro-tour",
  selections,
  riders: [rider],
  courseCounts: { "pt-zoncolan": 1, "ct-fleche": 0 },
};

describe("season five gala compositions", () => {
  it("accepts one course and requires the other two course keys with empty compositions", () => {
    expect(seasonFiveGalaRegistrationSchema.parse(input)).toEqual({ ...input, previousProgram: null });
    expect(seasonFiveGalaRegistrationSchema.safeParse({ ...input, selections: { "pt-zoncolan": ids.slice(0, 7) } }).success).toBe(false);
  });

  it("allows the same riders in different courses and seven or eight riders per selected course", () => {
    expect(seasonFiveGalaRegistrationSchema.safeParse({
      ...input,
      previousProgram: "continental",
      selections: { ...selections, "pt-liege": ids.slice(0, 8), "pt-flanders": ids.slice(0, 7) },
    }).success).toBe(true);
  });

  it.each([
    { ...input, teamId: ids[8] },
    { ...input, previousProgram: "world-tour" },
    { ...input, selections: { ...selections, "pt-zoncolan": ids.slice(0, 6) } },
    { ...input, selections: { ...selections, "pt-zoncolan": ids } },
    { ...input, selections: { ...selections, "pt-zoncolan": Array(7).fill(ids[0]) } },
    { ...input, selections: { "pt-zoncolan": ids.slice(0, 7), "pt-liege": [], "ct-alpe": [] } },
    { ...input, selections: { ...selections, "ct-alpe": ids.slice(0, 7) } },
    { ...input, selections: { "pt-zoncolan": [], "pt-liege": [], "pt-flanders": [] } },
  ])("rejects incomplete, duplicate, mixed or forged composition data", (value) => {
    expect(seasonFiveGalaRegistrationSchema.safeParse(value).success).toBe(false);
  });

  it("builds an independent draft with only the chosen program's three course keys", () => {
    const source = { "ct-alpe": [ids[0]], "pt-zoncolan": [ids[1]] };
    const draft = buildSeasonFiveGalaSelections("continental", source);
    expect(draft).toEqual({ "ct-alpe": [ids[0]], "ct-fleche": [], "ct-hamburg": [] });
    draft["ct-alpe"].push(ids[2]);
    expect(source["ct-alpe"]).toEqual([ids[0]]);
  });
});

describe("season five gala native notes and stored context", () => {
  it("checks all six primary notes and preserves eligibility after an admitted rider progresses", () => {
    expect(isSeasonFiveGalaContinentalRiderEligible({ ...rider, acceleration: 95 })).toBe(true);
    expect(isSeasonFiveGalaContinentalRiderEligible({ ...rider, flat: 76 })).toBe(false);
    expect(isSeasonFiveGalaContinentalRiderEligible({ ...rider, flat: 0 })).toBe(false);
    const progressed = { ...rider, flat: 76.25, continentalAdmitted: true };
    expect(isSeasonFiveGalaContinentalRiderEligible(progressed)).toBe(true);
    expect(progressed.flat).toBe(76.25);
  });

  it("normalizes partial stored selections and maps frozen admissions without altering native notes", () => {
    const result = parseSeasonFiveGalaContext({
      ...context,
      selections: { "pt-zoncolan": ids.slice(0, 7) },
      riders: [{ ...rider, mountain: 79.125, frozen_admission: true }],
    });
    expect(result?.selections).toEqual(selections);
    expect(result?.riders[0]).toMatchObject({ mountain: 79.125, continentalAdmitted: true });
    expect(result?.team).toMatchObject({ futureName: "Fixture S6", identityReady: true });
  });

  it.each([
    { ...context, isOpen: "true" },
    { ...context, closesAt: "someday" },
    { ...context, selections: { "ct-alpe": ids.slice(0, 7) } },
    { ...context, riders: [{ ...rider, mountain: "75" }] },
    { ...context, riders: [rider, rider] },
    { ...context, courseCounts: { "ct-alpe": -1 } },
    { ...context, courseCounts: { "invented-race": 1 } },
  ])("rejects malformed server data", (value) => {
    expect(parseSeasonFiveGalaContext(value)).toBeNull();
  });
});
