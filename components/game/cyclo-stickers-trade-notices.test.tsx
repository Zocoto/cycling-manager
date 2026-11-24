import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { createCycloStickersFinalSnapshot } from "@/lib/game/cyclo-stickers-final-snapshot";
import { createFinalCycloStickersSourceFixture } from "@/lib/game/cyclo-stickers-final-snapshot.fixture";
import { createCycloStickersPersistentStateFixture } from "@/lib/game/cyclo-stickers-persistence.fixture";
import type { CycloStickersPersistentState, CycloStickersTrade } from "@/lib/game/cyclo-stickers-persistence";
import { CycloStickersTrades } from "./cyclo-stickers-trades";

const snapshot = createCycloStickersFinalSnapshot(createFinalCycloStickersSourceFixture());
const offer: CycloStickersTrade = {
  id: "proposal-1", fromDirectorId: "collector-1", fromName: "Collectionneur A",
  toDirectorId: "collector-2", toName: "Collectionneur B", give: [1, 2], receive: 3,
  status: "pending", createdAt: "2026-11-24", expiresAt: "2026-11-26",
};

function render(state: CycloStickersPersistentState, locale: "fr" | "en" = "fr") {
  return renderToStaticMarkup(<LocaleProvider initialLocale={locale}><CycloStickersTrades
    snapshot={snapshot} state={state} busy={false} mutate={async () => null}
    initialTarget={null} wanted={[]} initialView="inbox"
  /></LocaleProvider>);
}

describe("Cyclo-Stickers trade ownership notices", () => {
  it("warns before accepting an incoming sticker that is already pasted without blocking the trade", () => {
    const state = createCycloStickersPersistentStateFixture();
    state.owned = [{ cardNumber: 1, quantity: 1, pasted: true, reserved: 0 }];
    state.incomingOffers = [offer];
    const html = render(state);
    expect(html).toContain("Déjà dans ta collection");
    expect(html).toContain("Nouvelle pour toi");
    expect(html).toContain("Tu recevras 1 exemplaire en double.");
    expect(html).toContain("Les doubles ne remplissent pas de nouvelle case");
    expect(html.indexOf("Tu recevras")).toBeLessThan(html.indexOf("Accepter cet échange"));
    expect(html).toMatch(/<button[^>]*aria-describedby="[^"]*proposal-1-duplicates"[^>]*>Accepter cet échange<\/button>/);
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>Accepter cet échange/);
  });

  it("counts unpasted inventory cards and repeated received copies as spares", () => {
    const state = createCycloStickersPersistentStateFixture();
    state.owned = [{ cardNumber: 1, quantity: 2, pasted: false, reserved: 1 }];
    state.incomingOffers = [{ ...offer, give: [1, 2, 2] }];
    const html = render(state);
    expect(html).toContain("Tu recevras 2 exemplaires en double.");
    expect(html).toContain("Nouvelle pour toi · 1 double");
    expect(html).toContain(`2 × ${snapshot.cards.find(card => card.number === 2)?.name}`);
  });

  it("shows no duplicate warning when all received cards are new", () => {
    const state = createCycloStickersPersistentStateFixture();
    state.incomingOffers = [offer];
    const html = render(state);
    expect(html.match(/Nouvelle pour toi/g)).toHaveLength(2);
    expect(html).not.toContain("Tu recevras");
    expect(html).not.toContain("Déjà dans ta collection");
    expect(html).toContain("Accepter cet échange");
  });

  it.each([
    ["fr", "Tu recevras 2 exemplaires en double.", "Nouvelle pour toi · 2 doubles"],
    ["en", "You will receive 2 spare copies.", "New to your collection · 2 spares"],
  ] as const)("explains repeated new copies in %s", (locale, warning, badge) => {
    const state = createCycloStickersPersistentStateFixture();
    state.incomingOffers = [{ ...offer, give: [2, 2, 2] }];
    const html = render(state, locale);
    expect(html).toContain(warning);
    expect(html).toContain(badge);
  });

  it("checks requested cards on outgoing offers rather than the cards being given away", () => {
    const state = createCycloStickersPersistentStateFixture();
    state.owned = [
      { cardNumber: 1, quantity: 3, pasted: true, reserved: 1 },
      { cardNumber: 3, quantity: 1, pasted: false, reserved: 0 },
    ];
    state.outgoingOffers = [{ ...offer, give: [1], receiveCards: [3, 4] }];
    const html = render(state, "en");
    expect(html).toContain("You will receive 1 spare copy.");
    expect(html).toContain("Already in your collection");
    expect(html).toContain("New to your collection");
    expect(html).toContain("Spare copies do not fill a new space");
    expect(html).toContain("Cancel my offer");
    expect(html).not.toContain("Accept this trade");
  });
});
