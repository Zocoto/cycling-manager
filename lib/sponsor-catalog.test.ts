import { describe, expect, it } from "vitest";

import { findSponsorByName } from "./sponsor-catalog";

describe("findSponsorByName", () => {
  it("retrouve un sponsor avec une casse et des espaces differents", () => {
    expect(findSponsorByName("  HEXA   BÂTIMENT ")?.id).toBe(
      "hexa-batiment"
    );
  });

  it("accepte aussi le nom court du sponsor", () => {
    expect(findSponsorByName("Hexa")?.id).toBe("hexa-batiment");
  });

  it("retourne null quand aucun sponsor ne correspond", () => {
    expect(findSponsorByName("Sponsor inconnu")).toBeNull();
    expect(findSponsorByName(null)).toBeNull();
  });
});
