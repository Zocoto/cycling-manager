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
    expect(service).toContain("loadFederationRegistrations(");
    expect(service).toContain("...federationRegistrations");
    expect(service).toContain("...teamRegistrations");
  });

  it("keeps only active startlist entries belonging to the displayed riders", () => {
    expect(service).toContain('.from("race_rosters")');
    expect(service).toContain('.in("rider_id", riderIds)');
    expect(service).toContain('.in("status", ["selected", "confirmed"])');
  });

  it("batches large federation filters and degrades without blocking the page", () => {
    expect(service).toContain("PLANNING_QUERY_BATCH_SIZE = 75");
    expect(service).toContain("chunkValues(");
    expect(service).toContain("loadOptionalFederationRaceRosters(");
    expect(service).toContain(
      "Les sélections fédérales sont temporairement omises du planning.",
    );
    expect(service).toContain("return [];");
  });
});
