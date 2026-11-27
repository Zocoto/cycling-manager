import { describe, expect, it } from "vitest";
import { getSecondarySponsorPrincipalJerseyId } from "./secondary-sponsor-jersey";

const continuing = {
  status: "active" as const, start_season_id: "s5", selected_jersey_id: "current",
  pending_jersey_id: "next", pending_jersey_season_id: "s6",
};

describe("secondary sponsor jersey season selection", () => {
  it("uses the saved current jersey during the active season, independent of the next choice", () => {
    expect(getSecondarySponsorPrincipalJerseyId(continuing, { id: "s5", status: "active" })).toBe("current");
    expect(getSecondarySponsorPrincipalJerseyId({ ...continuing, pending_jersey_season_id: "s5" }, { id: "s5", status: "active" })).toBe("current");
  });
  it("requires the exact season's pending choice for a continuing sponsor", () => {
    expect(getSecondarySponsorPrincipalJerseyId(continuing, { id: "s6", status: "planned" })).toBe("next");
    expect(getSecondarySponsorPrincipalJerseyId({ ...continuing, pending_jersey_season_id: "s7" }, { id: "s6", status: "planned" })).toBeNull();
    expect(getSecondarySponsorPrincipalJerseyId({ ...continuing, pending_jersey_season_id: null }, { id: "s6", status: "planned" })).toBeNull();
    expect(getSecondarySponsorPrincipalJerseyId({ ...continuing, pending_jersey_id: null }, { id: "s6", status: "planned" })).toBeNull();
  });
  it("takes a new contract's selected jersey only for that contract's future season", () => {
    const planned = { ...continuing, status: "planned" as const, start_season_id: "s6", selected_jersey_id: "new-team", pending_jersey_id: "unrelated" };
    expect(getSecondarySponsorPrincipalJerseyId(planned, { id: "s6", status: "planned" })).toBe("new-team");
    expect(getSecondarySponsorPrincipalJerseyId(planned, { id: "s7", status: "planned" })).toBeNull();
    expect(getSecondarySponsorPrincipalJerseyId(planned, { id: "s6", status: "active" })).toBeNull();
  });
  it("does not offer placement against a completed season", () => {
    expect(getSecondarySponsorPrincipalJerseyId(continuing, { id: "s5", status: "completed" })).toBeNull();
  });
});
