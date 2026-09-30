import { describe, expect, it } from "vitest";

import { normalizeScoutingVisibility } from "@/services/scouting-visibility";

describe("normalizeScoutingVisibility", () => {
  const now = Date.parse("2026-09-30T10:00:00.000Z");

  it("reconnaît une fenêtre encore active", () => {
    expect(
      normalizeScoutingVisibility("2026-10-01T09:59:59.000Z", now),
    ).toEqual({
      active: true,
      activeUntil: "2026-10-01T09:59:59.000Z",
    });
  });

  it("masque les dates absentes, invalides ou expirées", () => {
    expect(normalizeScoutingVisibility(null, now)).toEqual({
      active: false,
      activeUntil: null,
    });
    expect(normalizeScoutingVisibility("invalide", now)).toEqual({
      active: false,
      activeUntil: null,
    });
    expect(
      normalizeScoutingVisibility("2026-09-30T10:00:00.000Z", now),
    ).toEqual({ active: false, activeUntil: null });
  });
});
