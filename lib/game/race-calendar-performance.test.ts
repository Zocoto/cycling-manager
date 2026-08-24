import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "services/race-calendar.ts"),
  "utf8",
);

describe("race calendar request performance", () => {
  it("loads the active season without settling global wildcard state", () => {
    const bootstrapBlock = source.slice(
      source.indexOf("const seasonResult"),
      source.indexOf("const { data: season"),
    );

    expect(bootstrapBlock).not.toContain("Promise.all([");
    expect(source).not.toContain('supabase.rpc("settle_due_elite_wildcards")');
    expect(bootstrapBlock).toContain('.from("seasons")');
    expect(bootstrapBlock.match(/\bawait\b/g)).toHaveLength(1);
  });

  it("loads engaged counts with the other calendar overview queries", () => {
    const engagedCountsIndex = source.indexOf("earlyEngagedCountsResult");
    const overviewBlock = source.slice(
      source.lastIndexOf("const [", engagedCountsIndex),
      source.indexOf("if (daysResult.error)"),
    );

    expect(overviewBlock).toContain("earlyEngagedCountsResult");
    expect(overviewBlock).toContain('rpc("get_active_calendar_engaged_counts")');
    expect(overviewBlock).toContain("await Promise.all([");
  });
});
