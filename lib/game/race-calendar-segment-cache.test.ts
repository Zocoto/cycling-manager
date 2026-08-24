import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const raceCalendarService = readFileSync(
  join(process.cwd(), "services/race-calendar.ts"),
  "utf8",
);

describe("race calendar stage segment cache", () => {
  it("shares immutable stage geometry across server requests", () => {
    expect(raceCalendarService).toContain(
      'import { unstable_cache } from "next/cache"',
    );
    expect(raceCalendarService).toContain(
      'const loadCachedStageSegmentBatch = unstable_cache(',
    );
    expect(raceCalendarService).toContain(
      '["race-calendar-stage-segments-v1"]',
    );
    expect(raceCalendarService).toContain("revalidate: 900");
    expect(raceCalendarService).toContain(
      'tags: ["race-calendar-stage-segments"]',
    );
  });

  it("uses a service client only inside the cache and normalizes its key", () => {
    expect(raceCalendarService).toContain(
      "const admin = createSupabaseAdminClient();",
    );
    expect(raceCalendarService).toContain(
      "const normalizedStageIds = [...new Set(stageIds)].sort();",
    );
    expect(raceCalendarService).toContain(
      "loadCachedStageSegmentBatch(stageIdBatch)",
    );
    expect(raceCalendarService).not.toContain(
      "loadStageSegments(supabase, stageIds)",
    );
  });
});
