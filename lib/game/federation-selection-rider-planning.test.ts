import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const service = readFileSync(
  join(process.cwd(), "services/rider-season-planning.ts"),
  "utf8",
);

describe("federation selections in rider planning", () => {
  it("merges linked national registrations with the current club registrations", () => {
    expect(service).toContain(
      '.from("national_federation_selection_race_links")',
    );
    expect(service).toContain(
      '.select("race_registration_id, race_edition_id")',
    );
    expect(service).toContain("federationRegistrationIds");
    expect(service).toContain("federationRegistrationsResult.data ?? []");
    expect(service).toContain("teamRegistrationsResult.data ?? []");
  });

  it("keeps only active startlist entries belonging to the displayed riders", () => {
    expect(service).toContain('.from("race_rosters")');
    expect(service).toContain('.in("rider_id", riderIds)');
    expect(service).toContain('.in("status", ["selected", "confirmed"])');
  });
});
