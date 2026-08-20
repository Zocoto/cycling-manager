import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "services/staff-race-effects.ts"),
  "utf8",
);

describe("race registration staff effects query", () => {
  it("keeps large race rosters out of the physiotherapist query URL", () => {
    expect(source).not.toContain('.in("rider_id", riderIds)');
    expect(source).toContain("const requestedRiderIds = new Set(riderIds)");
    expect(source).toContain(
      "if (!requestedRiderIds.has(assignment.rider_id)) continue;",
    );
  });
});
