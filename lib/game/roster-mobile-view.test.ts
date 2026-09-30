import { describe, expect, it } from "vitest";

import { parseRosterMobileView } from "./roster-mobile-view";

describe("roster mobile view", () => {
  it("accepte uniquement les deux modes d’affichage mobiles", () => {
    expect(parseRosterMobileView("synthese")).toBe("synthese");
    expect(parseRosterMobileView("fiches")).toBe("fiches");
    expect(parseRosterMobileView("tableau")).toBeNull();
    expect(parseRosterMobileView(undefined)).toBeNull();
  });
});
