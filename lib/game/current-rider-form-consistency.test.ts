import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const currentFormReaders = [
  "services/team-training.ts",
  "services/team-race-reconnaissance.ts",
].map((path) => readFileSync(join(process.cwd(), path), "utf8"));

describe("current rider form consistency", () => {
  it("limits team form reads to elapsed days from the active season", () => {
    for (const source of currentFormReaders) {
      expect(source).toContain(
        ".filter((day) => day.day_number <= currentDayNumber)",
      );
      expect(source).toContain('.in("season_day_id", conditionDayIds)');
    }
  });
});
