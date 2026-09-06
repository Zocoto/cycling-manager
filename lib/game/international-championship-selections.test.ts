import { describe, expect, it } from "vitest";

import {
  canRespondToInternationalSelection,
  shouldDisplayInternationalSelection,
  splitDirectorInternationalSelections,
} from "./international-championship-selections";

const departureAt = "2026-07-26T16:00:00.000Z";

describe("international championship selections", () => {
  it("laisse le DS répondre à une place active avant le départ", () => {
    expect(
      canRespondToInternationalSelection({
        isSelected: true,
        responseStatus: "pending",
        departureAt,
        now: new Date("2026-07-25T16:00:00.000Z"),
      })
    ).toBe(true);
  });

  it("ferme la décision au départ, quand la participation devient automatique", () => {
    expect(
      canRespondToInternationalSelection({
        isSelected: true,
        responseStatus: "pending",
        departureAt,
        now: new Date(departureAt),
      })
    ).toBe(false);
  });

  it("ne rouvre pas une décision déjà confirmée ou refusée", () => {
    for (const responseStatus of ["confirmed", "declined"] as const) {
      expect(
        canRespondToInternationalSelection({
          isSelected: true,
          responseStatus,
          departureAt,
          now: new Date("2026-07-25T18:00:00.000Z"),
        })
      ).toBe(false);
    }
  });

  it("masque un réserviste en attente et affiche les décisions historiques", () => {
    expect(
      shouldDisplayInternationalSelection({
        isSelected: false,
        wasSelected: false,
        responseStatus: "pending",
      })
    ).toBe(false);
    expect(
      shouldDisplayInternationalSelection({
        isSelected: false,
        wasSelected: true,
        responseStatus: "declined",
      })
    ).toBe(true);
    expect(
      shouldDisplayInternationalSelection({
        isSelected: false,
        wasSelected: true,
        responseStatus: "ineligible_injury",
      })
    ).toBe(true);
    expect(
      shouldDisplayInternationalSelection({
        isSelected: false,
        wasSelected: false,
        responseStatus: "ineligible_injury",
      })
    ).toBe(false);
  });

  it("sépare les demandes à traiter des convocations déjà traitées", () => {
    const selections = [
      { candidateId: "pending", canRespond: true, responseStatus: "pending" },
      {
        candidateId: "confirmed",
        canRespond: false,
        responseStatus: "confirmed",
      },
      {
        candidateId: "declined",
        canRespond: false,
        responseStatus: "declined",
      },
      {
        candidateId: "expired",
        canRespond: false,
        responseStatus: "pending",
      },
    ] as const;

    const { pendingSelections, historicalSelections } =
      splitDirectorInternationalSelections([...selections]);

    expect(pendingSelections.map(({ candidateId }) => candidateId)).toEqual([
      "pending",
    ]);
    expect(historicalSelections.map(({ candidateId }) => candidateId)).toEqual([
      "declined",
      "confirmed",
    ]);
  });
});
