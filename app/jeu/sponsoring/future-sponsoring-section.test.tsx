import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("./actions", () => ({ signSponsorOfferAction: vi.fn() }));
vi.mock("./sponsoring-controls", () => ({ ConfirmSponsorButton: () => null, SponsorJerseySelector: () => null }));
vi.mock("./sponsor-negotiation-control", () => ({ SponsorNegotiationControl: () => null }));
import { FutureSponsoringSection } from "./future-sponsoring-section";
describe("future sponsoring unavailable notice", () => {
  it("shows an honest, retryable partial error instead of a ready contract or signing form", () => {
    const html = renderToStaticMarkup(<FutureSponsoringSection reputationPoints={30} state={{ kind: "unavailable", targetGameYear: 4, targetSeasonName: "Saison 4" }} />);
    expect(html).toContain("Saison 4");
    expect(html).toContain('role="alert"');
    expect(html).toContain("temporairement indisponible");
    expect(html).toContain('href="/jeu/sponsoring"');
    expect(html).not.toContain("Votre prochain sponsor est prêt");
    expect(html).not.toContain("<form");
  });
});
