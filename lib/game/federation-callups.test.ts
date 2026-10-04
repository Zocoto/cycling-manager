import { describe, expect, it } from "vitest";
import {
  filterFederationCallupsByCategory,
  formatFederationSelectionDeadline,
  getFederationCallupResponseClosesAt,
  isFederationCallupResponseOpen,
  splitFederationCallups,
  type FederationCallup,
} from "./federation-callups";

const callup: FederationCallup = {
  member_id: "member", country_code: "BE", country_name: "Belgique", slot_key: "cc-pro-road",
  competition_label: "CC Pros · Route", rider_id: "rider", rider_name: "Un coureur",
  rider_category: "professional", response_status: "pending", published_at: "2026-09-11T08:00:00Z",
  closes_at: "2026-09-25T11:00:00Z", can_respond: true, race_href: "/jeu/courses/test",
  conflicting_race_names: [],
};

describe("federation call-ups", () => {
  it("shows an early manually published invitation without applying an automatic publication window", () => {
    expect(splitFederationCallups([callup]).pending).toEqual([callup]);
  });
  it("keeps closed requests and decisions in history, without another response button", () => {
    const history = [
      { ...callup, can_respond: false },
      { ...callup, response_status: "confirmed" as const },
      { ...callup, response_status: "declined" as const },
    ];
    expect(splitFederationCallups(history)).toEqual({ pending: [], history });
  });
  it("keeps professional and junior invitations on separate pages", () => {
    const junior = {
      ...callup,
      member_id: "junior-member",
      rider_category: "junior" as const,
      competition_label: "CM Juniors · Route",
    };

    expect(
      filterFederationCallupsByCategory(
        [callup, junior],
        "professional",
      ),
    ).toEqual([callup]);
    expect(
      filterFederationCallupsByCategory([callup, junior], "junior"),
    ).toEqual([junior]);
  });
  it("uses Paris time for deadlines, including winter time", () => {
    expect(formatFederationSelectionDeadline("2026-09-25T11:00:00Z")).toContain("13:00");
    expect(formatFederationSelectionDeadline("2026-12-25T11:00:00Z")).toContain("12:00");
    expect(formatFederationSelectionDeadline(null)).toBe("Calendrier indisponible");
  });
  it("separates federation freeze time from the DS response deadline", () => {
    const departureAt = "2026-10-12T16:00:00.000Z";

    expect(
      getFederationCallupResponseClosesAt({
        competitionCode: "continental_championship",
        riderCategory: "professional",
        departureAt,
      }),
    ).toBe("2026-10-12T15:00:00.000Z");
    expect(
      getFederationCallupResponseClosesAt({
        competitionCode: "nations_cup",
        riderCategory: "professional",
        departureAt,
      }),
    ).toBe("2026-10-12T15:00:00.000Z");
    expect(
      getFederationCallupResponseClosesAt({
        competitionCode: "world_championship",
        riderCategory: "professional",
        departureAt,
      }),
    ).toBe("2026-10-11T16:00:00.000Z");
    expect(
      isFederationCallupResponseOpen(
        {
          competitionCode: "continental_championship",
          riderCategory: "professional",
          departureAt,
        },
        new Date("2026-10-12T14:59:59.000Z"),
      ),
    ).toBe(true);
    expect(
      isFederationCallupResponseOpen(
        {
          competitionCode: "continental_championship",
          riderCategory: "professional",
          departureAt,
        },
        new Date("2026-10-12T15:00:00.000Z"),
      ),
    ).toBe(false);
  });
});
