import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SponsorNegotiationControl } from "./sponsor-negotiation-control";

vi.mock("./actions", () => ({ negotiateContinuingSponsorObjectivesAction: async () => {}, negotiateSponsorOfferAction: async () => {} }));

describe("sponsor negotiation above the catalogue ceiling", () => {
  it("shows distinct Terroirs Unis amounts even with the previously saved ceiling", () => {
    const html = renderToStaticMarkup(<SponsorNegotiationControl offerId="offer" contractId="contract"
      negotiationMode="continuing-contract" sponsorName="Terroirs Unis" targetSeasonName="Saison 5"
      baseBudget={451810} budgetCeiling={451810} currentDifficulty="ambitious"
      primaryColor="#123456" textColor="#123456" backgroundColor="#ffffff" />);
    const text = html.replaceAll("\u202f", " ").replaceAll("\u00a0", " ");
    expect(text).toContain("410 000");expect(text).toContain("451 810");expect(text).toContain("500 000");
    expect(text).toContain("La majoration d’ambition s’applique aussi au-dessus du plafond catalogue.");
    expect(text).not.toContain("Plafond du palier atteint");
  });
});
