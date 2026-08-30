import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { RiderTransferManagement } from "@/services/transfer-market";

import { RiderTransferListingCard } from "./rider-transfer-listing-card";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const management: RiderTransferManagement = {
  isFreeAgent: false,
  canSignFreeAgent: false,
  freeAgentSalary: null,
  freeAgentWeeklySalary: null,
  freeAgentBlockedReason: null,
  canRenew: false,
  rosterSize: 22,
  rosterLimit: 35,
  rosterIsFull: false,
  renewalSalary: 14_000,
  contractEndSeasonYear: 3,
  ownsRider: true,
  canListRider: true,
  listingBlockedReason: null,
  recommendedListingPrice: 18_500,
  currentSalary: 12_000,
  activeListing: null,
  canDismiss: true,
  dismissalCost: 24_000,
  dismissalCurrency: "EUR",
  canMakeDirectOffer: false,
  directOfferSalary: null,
  directOfferBlockedReason: null,
  pendingDirectOfferAmount: null,
  availableBudget: 100_000,
  cashBalance: 100_000,
  currency: "EUR",
};

describe("RiderTransferListingCard", () => {
  it("permet de mettre en vente un coureur depuis sa fiche", () => {
    const markup = renderToStaticMarkup(
      <RiderTransferListingCard
        riderId="11111111-1111-4111-8111-111111111111"
        riderName="Marco Testa"
        management={management}
      />,
    );

    expect(markup).toContain('data-rider-transfer-listing="true"');
    expect(markup).toContain("Mettre le coureur en vente");
    expect(markup).toContain("18 500");
    expect(markup).toContain('name="riderId"');
    expect(markup).toContain('name="minimumBid"');
    expect(markup).toContain(
      'value="/jeu/coureurs/11111111-1111-4111-8111-111111111111"',
    );
    expect(markup).toContain("Mettre en vente pendant 24 h");
  });

  it("affiche l’enchère existante au lieu d’un second formulaire", () => {
    const markup = renderToStaticMarkup(
      <RiderTransferListingCard
        riderId="11111111-1111-4111-8111-111111111111"
        riderName="Marco Testa"
        management={{
          ...management,
          canListRider: false,
          listingBlockedReason: "Ce coureur est déjà proposé sur le marché.",
          activeListing: {
            id: "22222222-2222-4222-8222-222222222222",
            minimumBid: 20_000,
            closesAt: "2026-08-31T18:00:00.000Z",
          },
        }}
      />,
    );

    expect(markup).toContain("Enchère déjà publiée");
    expect(markup).toContain("20 000");
    expect(markup).toContain(
      "/jeu/transferts?onglet=quotidiennes#enchere-22222222-2222-4222-8222-222222222222",
    );
    expect(markup).not.toContain('name="minimumBid"');
  });
});
