import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createExactTransferScoutingReport } from "@/lib/game/transfer-scouting";
import { FREE_AGENT_RIDER_JERSEY } from "@/lib/rider-jersey";
import type { TransferRosterCandidate } from "@/services/transfer-market";

import { DirectorRiderSaleConsole } from "./director-rider-sale-console";

const candidate: TransferRosterCandidate = {
  rider: {
    id: "11111111-1111-4111-8111-111111111111",
    firstName: "Marco",
    lastName: "Testa",
    overall: 65,
    countryName: "Italie",
    countryCode: "IT",
    avatarProfileKey: "italian",
    avatarSeed: 42,
    age: 24,
    profileLabel: "Grimpeur",
    salaryPerSeason: 12_000,
    scoutingReport: createExactTransferScoutingReport({
      potentialSteps: 5,
      ratings: {
        mountain: 78,
        hills: 71,
        flat: 55,
        timeTrial: 61,
        cobbles: 48,
        sprint: 52,
        acceleration: 67,
        downhill: 69,
        endurance: 73,
        resistance: 72,
        recovery: 70,
        breakaway: 75,
        prologue: 58,
      },
    }),
  },
  currentSalary: 12_000,
  currency: "EUR",
  recommendedPrice: 18_500,
  canList: true,
  listBlockedReason: null,
  canRenew: false,
  renewalSalary: 0,
};

describe("DirectorRiderSaleConsole", () => {
  it("réunit la liste de valeur, les notes exactes et la validation de vente", () => {
    const markup = renderToStaticMarkup(
      <DirectorRiderSaleConsole
        roster={[candidate]}
        jersey={FREE_AGENT_RIDER_JERSEY}
        returnPath="/jeu/transferts?onglet=directeurs"
      />,
    );

    expect(markup).toContain("Liste de valeur");
    expect(markup).toContain("Marco Testa");
    expect(markup).toContain("MOY 65,3");
    expect(markup).toContain("Données de votre équipe");
    expect(markup).toContain("18 500");
    expect(markup).toContain('name="riderId"');
    expect(markup).toContain('name="minimumBid"');
    expect(markup).toContain("Valider la mise en vente");
    expect(markup).toContain("immédiatement visible dans « Enchères » pendant 24 heures");
  });
});
