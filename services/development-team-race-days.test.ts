import { describe, expect, it } from "vitest";

import { getRemainingDevelopmentStagesByRider } from "./development-team";

describe("junior registration race day projection", () => {
  it("adds only distinct remaining stages from registered club and federation starts", () => {
    const result = getRemainingDevelopmentStagesByRider({
      currentDayNumber: 12,
      editions: [
        { id: "tour", status: "planned" },
        { id: "future", status: "planned" },
        { id: "worlds", status: "planned" },
        { id: "cancelled", status: "cancelled" },
        { id: "completed", status: "completed" },
        { id: "withdrawn", status: "planned" },
      ],
      stagesByEditionId: new Map([
        ["tour", [
          { id: "past", day_number: 11 },
          { id: "published", day_number: 12 },
          { id: "today", day_number: 12 },
          { id: "last", day_number: 13 },
        ]],
        ["future", [{ id: "same-day-other-race", day_number: 13 }]],
        ["worlds", [{ id: "worlds-stage", day_number: 21 }]],
        ["cancelled", [{ id: "cancelled-stage", day_number: 14 }]],
        ["completed", [{ id: "completed-stage", day_number: 14 }]],
        ["withdrawn", [{ id: "withdrawn-stage", day_number: 14 }]],
      ]),
      registrations: [
        { id: "tour-registration", race_edition_id: "tour", status: "registered" },
        { id: "future-registration", race_edition_id: "future", status: "registered" },
        { id: "cancelled-registration", race_edition_id: "cancelled", status: "registered" },
        { id: "completed-registration", race_edition_id: "completed", status: "registered" },
        { id: "withdrawn-registration", race_edition_id: "withdrawn", status: "withdrawn" },
        { id: "closed-registration", race_edition_id: "future", status: "completed" },
      ],
      selections: [
        { registration_id: "tour-registration", academy_rider_id: "rider" },
        { registration_id: "tour-registration", academy_rider_id: "rider" },
        { registration_id: "future-registration", academy_rider_id: "rider" },
        { registration_id: "cancelled-registration", academy_rider_id: "rider" },
        { registration_id: "completed-registration", academy_rider_id: "rider" },
        { registration_id: "withdrawn-registration", academy_rider_id: "rider" },
        { registration_id: "closed-registration", academy_rider_id: "other" },
      ],
      federationRegistrations: [{
        race_edition_id: "worlds",
        national_federation_junior_race_registration_riders: [
          { academy_rider_id: "rider" },
        ],
      }],
      publishedStageIds: new Set(["published"]),
    });

    expect(result.get("rider")).toEqual(new Set([
      "today", "last", "same-day-other-race", "worlds-stage",
    ]));
    expect(result.has("other")).toBe(false);
  });
});
