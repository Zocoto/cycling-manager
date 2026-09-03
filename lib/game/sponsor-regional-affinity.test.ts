import { describe, expect, it } from "vitest";

import { resolveRegionalSponsorPreference } from "./sponsor-regional-affinity";

describe("resolveRegionalSponsorPreference", () => {
  it("associe En Avant Guidon aux cinq sponsors bretons", () => {
    expect(resolveRegionalSponsorPreference(["En Avant Guidon"])).toEqual([
      "caramels-de-keravel",
      "maison-lannic",
      "cidrerie-aulne",
      "penn-kreiz-crepes",
      "sardines-du-raz",
    ]);
  });

  it("conserve l'affinité lorsqu'un sponsor a renommé l'équipe", () => {
    expect(
      resolveRegionalSponsorPreference(["Terroirs Unis", "En Avant Guidon"]),
    ).toHaveLength(5);
  });

  it("ne modifie pas les autres équipes", () => {
    expect(resolveRegionalSponsorPreference(["Équipe des Flandres"])).toEqual(
      [],
    );
  });
});
