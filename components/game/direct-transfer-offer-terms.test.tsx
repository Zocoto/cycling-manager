import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DirectTransferOffer } from "@/services/transfer-market";

vi.mock("@/components/ui/app-link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
import { DirectTransferOfferTerms } from "./direct-transfer-offer-terms";

const cashOffer: DirectTransferOffer = {
  id: "offer", amount: 5000, salaryPerSeason: 9000, currency: "EUR", status: "pending",
  createdAt: "2026-10-22T12:00:00Z", respondedAt: null, buyerTeamId: "buyer", buyerTeamName: "Acheteur",
  rider: { id: "target", firstName: "Paul", lastName: "Cédé", overall: 60 }, offeredRider: null,
};

describe("direct transfer offer terms", () => {
  it("keeps cash-only offers clear without suggesting an exchange", () => {
    const html = renderToStaticMarkup(<DirectTransferOfferTerms offer={cashOffer} />);
    expect(html).toContain("Indemnité reçue");
    expect(html).toContain("5 000");
    expect(html).toContain("9 000");
    expect(html).toContain("Salaire à la charge de l’acheteur");
    expect(html).not.toContain("Vous recevez également");
    expect(html).not.toContain("L’échange des deux coureurs");
  });

  it("shows both sides' salaries, rider link, zero cash and indivisible acceptance for a pure swap", () => {
    const html = renderToStaticMarkup(<DirectTransferOfferTerms offer={{ ...cashOffer, amount: 0, offeredRider: { id: "counter-rider", firstName: "Jean", lastName: "Reçu", overall: 65, salaryPerSeason: 12000 } }} />);
    expect(html).toContain("0 €");
    expect(html).toContain("Jean Reçu");
    expect(html).toContain('href="/jeu/coureurs/counter-rider"');
    expect(html).toContain("9 000");
    expect(html).toContain("12 000");
    expect(html).toContain("Salaire à votre charge");
    expect(html).toContain("indivisibles");
    expect(html).toContain("course, stage ou reconnaissance");
  });
});
