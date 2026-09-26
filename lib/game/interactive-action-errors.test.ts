import { describe, expect, it } from "vitest";

import { getHealthCenterErrorMessage } from "./health-center-errors";
import { getInteractiveActionErrorMessage } from "./interactive-action-errors";

describe("getInteractiveActionErrorMessage", () => {
  it.each([
    "canceling statement due to statement timeout",
    "canceling statement due to lock timeout",
    "could not obtain lock on row in relation team_seasons",
  ])("reformule une contention SQL sans exposer le détail (%s)", (message) => {
    const result = getInteractiveActionErrorMessage(message);

    expect(result).toContain("Une autre opération est en cours");
    expect(result).toContain("pas été enregistrée, même partiellement");
    expect(result).not.toContain("statement");
  });

  it("conserve une erreur métier bornée", () => {
    expect(getInteractiveActionErrorMessage("  Choix invalide.  ")).toBe(
      "Choix invalide.",
    );
  });

  it("couvre aussi les contentions du centre de soin", () => {
    expect(
      getHealthCenterErrorMessage("canceling statement due to lock timeout"),
    ).toContain("Aucune modification partielle");
  });
});
