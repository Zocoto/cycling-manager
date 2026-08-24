import { describe, expect, it } from "vitest";

import { getHealthCenterErrorMessage } from "@/lib/game/health-center-errors";

describe("getHealthCenterErrorMessage", () => {
  it("ne montre jamais le message SQL brut d’un statement timeout", () => {
    const message = getHealthCenterErrorMessage(
      "canceling statement due to statement timeout",
    );

    expect(message).toContain("Aucune modification partielle");
    expect(message).not.toContain("statement timeout");
  });

  it("conserve les erreurs métier utiles au joueur", () => {
    expect(
      getHealthCenterErrorMessage(
        "Le nutritionniste sélectionné a déjà utilisé toute sa capacité aujourd’hui.",
      ),
    ).toBe(
      "Le nutritionniste sélectionné a déjà utilisé toute sa capacité aujourd’hui.",
    );
  });
});
