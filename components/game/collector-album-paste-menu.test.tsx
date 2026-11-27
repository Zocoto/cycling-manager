import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { createCycloStickersFinalSnapshot } from "@/lib/game/cyclo-stickers-final-snapshot";
import { createFinalCycloStickersSourceFixture } from "@/lib/game/cyclo-stickers-final-snapshot.fixture";
import { createCycloStickersPersistentStateFixture } from "@/lib/game/cyclo-stickers-persistence.fixture";
import { toCycloStickersAlbumView } from "@/lib/game/cyclo-stickers-persistent-view";
import { CycloStickersPersistentAlbum } from "./cyclo-stickers-persistent-album";
import { CollectorAlbumPasteMenu } from "./collector-album-paste-menu";
import { CollectorAlbum, type CollectorAlbumTab } from "./collector-album";

const snapshot = createCycloStickersFinalSnapshot(createFinalCycloStickersSourceFixture());

describe("paste menu", () => {
  it.each<CollectorAlbumTab>(["album", "boosters", "trades", "achievements", "duplicates", "leaderboard"])("highlights only two ready slots from %s", initialTab => {
    const state = createCycloStickersPersistentStateFixture();
    state.owned = [
      { cardNumber: 1, quantity: 3, pasted: false, reserved: 1 },
      { cardNumber: 2, quantity: 2, pasted: true, reserved: 0 },
      { cardNumber: 3, quantity: 1, pasted: false, reserved: 1 },
      { cardNumber: 68, quantity: 1, pasted: false, reserved: 0 },
    ];
    const html = renderToStaticMarkup(<CycloStickersPersistentAlbum authUserId="test-owner" snapshot={snapshot} initialState={state} initialTab={initialTab} />);
    expect(html).toContain('data-album-paste-menu="true"');
    expect(html).toContain('aria-label="Cartes à coller (2)"');
    expect(html).toMatch(/class="[^"]*available[^"]*"[^>]*aria-expanded="false"/);
  });

  it("keeps the zero-state access without a false highlight", () => {
    const html = renderToStaticMarkup(<CollectorAlbumPasteMenu cards={[]} ready onPaste={() => {}} onView={() => {}} />);
    expect(html).toContain('aria-label="Cartes à coller (0)"');
    expect(html).not.toContain("available");
  });

  it("keeps the book's paste shelf consistent with the menu while retaining trade access", () => {
    const state = createCycloStickersPersistentStateFixture();
    state.owned = [
      { cardNumber: 1, quantity: 3, pasted: false, reserved: 1 },
      { cardNumber: 2, quantity: 2, pasted: true, reserved: 0 },
      { cardNumber: 3, quantity: 1, pasted: false, reserved: 1 },
      { cardNumber: 68, quantity: 1, pasted: false, reserved: 0 },
    ];
    const html = renderToStaticMarkup(<CollectorAlbum snapshot={snapshot} storageOwnerId={state.directorId} initialProfile="tours" runtime={{
      state: toCycloStickersAlbumView(state), ready: true, ownerName: "Collectionneur", boosterCount: 0, tradeCount: 0,
      notice: "", onAction: () => {}, boosters: null, achievements: null, trades: () => null, duplicates: () => null,
    }} />);
    expect(html).toContain('aria-label="Cartes à coller (2)"');
    expect([...html.matchAll(/data-album-paste-card="(\d+)"/g)].map(match => Number(match[1]))).toEqual([1, 68]);
    expect(html).toContain("Les cartes à coller <span>2</span>");
    expect(html).toContain("Ouvrir mon carnet d’échanges");
    expect(html).toContain("Mes doubles");
  });

  it("makes the count accessible in English and disables interactions during a mutation", () => {
    const html = renderToStaticMarkup(<LocaleProvider initialLocale="en"><CollectorAlbumPasteMenu cards={snapshot.cards.slice(0, 2)} ready={false} onPaste={() => {}} onView={() => {}} /></LocaleProvider>);
    expect(html).toContain('aria-label="Stickers to paste (2)"');
    expect(html).toContain("disabled");
  });
});
