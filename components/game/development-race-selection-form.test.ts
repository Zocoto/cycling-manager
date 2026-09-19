import { describe, expect, it } from "vitest";

import { isDevelopmentRaceRiderSelectionDisabled } from "./development-race-selection-form";

describe("isDevelopmentRaceRiderSelectionDisabled", () => {
  it("grise uniquement les juniors non retenus lorsque le quota est atteint", () => {
    const selectedRiderIds = new Set(["junior-1", "junior-2"]);

    expect(
      isDevelopmentRaceRiderSelectionDisabled(
        selectedRiderIds,
        "junior-3",
        2,
      ),
    ).toBe(true);
    expect(
      isDevelopmentRaceRiderSelectionDisabled(
        selectedRiderIds,
        "junior-1",
        2,
      ),
    ).toBe(false);
  });

  it("laisse tous les juniors accessibles tant qu'il reste une place", () => {
    expect(
      isDevelopmentRaceRiderSelectionDisabled(
        new Set(["junior-1"]),
        "junior-2",
        2,
      ),
    ).toBe(false);
  });
});
