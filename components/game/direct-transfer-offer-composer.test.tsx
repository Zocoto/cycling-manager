import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ submit: vi.fn(), load: vi.fn() }));
vi.mock("@/app/jeu/transferts/actions", () => ({
  submitDirectTransferOfferAction: mocks.submit,
  loadDirectTransferTradeCandidatesAction: mocks.load,
}));

import { DirectTransferOfferComposer } from "./direct-transfer-offer-composer";

const props = {
  riderId: "00000000-0000-4000-8000-000000000100",
  salaryPerSeason: 7000,
  availableBudget: 25000,
  currency: "EUR",
  canMakeCashOffer: true,
  canMakeTradeOffer: true,
};

describe("direct transfer composer initial rendering", () => {
  it("keeps the cash-only form usable without loading trade options or another request", () => {
    const html = renderToStaticMarkup(<DirectTransferOfferComposer {...props} />);
    expect(html).toContain("Ajouter un coureur en échange");
    expect(html).toContain('name="amount"');
    expect(html).toContain('min="500"');
    expect(html).toContain('max="25000"');
    expect(html).toContain('value="10000"');
    expect(html).toContain('name="message"');
    expect(html).toContain('maxLength="500"');
    expect(html).toContain('data-financial-extra-expense="7000"');
    expect(html).not.toContain("disabled=");
    expect(html).not.toContain('name="offeredRiderId"');
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(html).toContain("immédiatement désinscrit de toutes ses courses à venir");
    expect(html).toContain("Un refus ou un retrait de l’offre ne le réinscrit pas");
    expect(html).toContain("bloque l’envoi et l’acceptation");
  });

  it("allows preparing an exchange with no free cash or recruitment slot, without submitting an invalid cash offer", () => {
    const html = renderToStaticMarkup(<DirectTransferOfferComposer {...props} canMakeCashOffer={false} availableBudget={0} />);
    expect(html).toContain("Ajouter un coureur en échange");
    expect(html).toContain("Ajoutez un coureur pour préparer un échange");
    expect(html).toContain('value="0"');
    expect(html).toContain('disabled=""');
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it("does not offer the exchange loader when this rider is not trade eligible", () => {
    const html = renderToStaticMarkup(<DirectTransferOfferComposer {...props} canMakeTradeOffer={false} />);
    expect(html).not.toContain("Ajouter un coureur en échange");
    expect(html).not.toContain("immédiatement désinscrit");
    expect(html).toContain("Transmettre l’offre");
    expect(mocks.load).not.toHaveBeenCalled();
  });
});
