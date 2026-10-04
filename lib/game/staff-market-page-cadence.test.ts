import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  STAFF_MARKET_DAILY_COUNT,
  STAFF_MARKET_WAVE_INTERVAL_HOURS,
  STAFF_MARKET_WAVE_SIZE,
} from "@/lib/game/staff-market-waves";

const pageSource = readFileSync(
  join(process.cwd(), "app", "jeu", "staff", "page.tsx"),
  "utf8",
);

describe("staff market cadence presentation", () => {
  it("keeps the visible cadence aligned with the generation constants", () => {
    expect(STAFF_MARKET_WAVE_SIZE).toBe(5);
    expect(STAFF_MARKET_WAVE_INTERVAL_HOURS).toBe(2);
    expect(STAFF_MARKET_DAILY_COUNT).toBe(60);
    expect(pageSource).toContain('label="Marché"');
    expect(pageSource).toContain("STAFF_MARKET_WAVE_SIZE");
    expect(pageSource).toContain("STAFF_MARKET_WAVE_INTERVAL_HOURS");
    expect(pageSource).toContain("STAFF_MARKET_DAILY_COUNT");
  });

  it("does not advertise the former daily two-wave market", () => {
    expect(pageSource).not.toContain("25 profils à minuit");
    expect(pageSource).not.toContain("25 profils à midi");
    expect(pageSource).not.toContain("renouvellement quotidien du marché");
  });
});
