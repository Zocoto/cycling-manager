import { describe, expect, it } from "vitest";

import { getParisDateKey, getParisHour } from "@/lib/game/cyclogazette";

describe("horaire de publication de La Cyclogazette", () => {
  it("reconnaît 20 h à Paris pendant l’heure d’été", () => {
    expect(getParisHour(new Date("2026-08-01T18:00:00Z"))).toBe(20);
    expect(getParisDateKey(new Date("2026-08-01T22:30:00Z"))).toBe("2026-08-02");
  });

  it("reconnaît 20 h à Paris pendant l’heure d’hiver", () => {
    expect(getParisHour(new Date("2026-01-10T19:00:00Z"))).toBe(20);
  });
});
