import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { createCycloStickersFinalSnapshot } from "@/lib/game/cyclo-stickers-final-snapshot";
import { createFinalCycloStickersSourceFixture } from "@/lib/game/cyclo-stickers-final-snapshot.fixture";
import { createCycloStickersPersistentStateFixture } from "@/lib/game/cyclo-stickers-persistence.fixture";
import { CycloStickersPersistentAlbum } from "./cyclo-stickers-persistent-album";
import { CycloStickersTrades } from "./cyclo-stickers-trades";
import { LocaleProvider } from "@/components/i18n/locale-provider";

it("renders the authenticated owner and empty server stock without demonstration grants", () => {
  const html = renderToStaticMarkup(<CycloStickersPersistentAlbum snapshot={createCycloStickersFinalSnapshot(createFinalCycloStickersSourceFixture())} initialState={createCycloStickersPersistentStateFixture()} initialTab="boosters" />);
  expect(html).toContain("Collectionneur réel de recette");
  expect(html).toContain("Aucun sachet fermé");
  expect(html).not.toContain("Abbaye du Lion");
  expect(html).not.toContain("Réinitialiser uniquement cet essai");
  expect(html).not.toContain("Deux cartes et deux sachets d’essai");
  expect(html).not.toContain("collectionneurs sont fictifs");
});

it("shows the connection cycle and the earned booster in the Boosters tab", () => {
  const snapshot = createCycloStickersFinalSnapshot(createFinalCycloStickersSourceFixture());
  const initialState = createCycloStickersPersistentStateFixture();
  const loginBoosterProgress = { consecutiveDays: 6, totalBoostersAwarded: 2, boosterAwardedToday: true };
  const boosters = renderToStaticMarkup(<CycloStickersPersistentAlbum snapshot={snapshot} initialState={initialState} initialTab="boosters" loginBoosterProgress={loginBoosterProgress} />);
  expect(boosters).toContain("3 jours d’affilée, 1 booster");
  expect(boosters).toContain("Boosters gagnés : 2");
  expect(boosters).toContain("Votre booster du jour a été ajouté");
  expect(boosters).toContain('aria-valuenow="3"');
  expect(boosters).toContain("Un jour manqué remet la série à zéro");

  const album = renderToStaticMarkup(<CycloStickersPersistentAlbum snapshot={snapshot} initialState={initialState} loginBoosterProgress={loginBoosterProgress} />);
  expect(album).not.toContain("3 jours d’affilée, 1 booster");
});

it("renders only real collectors and protects already pasted special cards", () => {
  const state = createCycloStickersPersistentStateFixture();
  state.owned = [{ cardNumber: 68, quantity: 1, pasted: true, reserved: 0 }];
  const html = renderToStaticMarkup(<CycloStickersPersistentAlbum snapshot={createCycloStickersFinalSnapshot(createFinalCycloStickersSourceFixture())} initialState={state} initialTab="trades" />);
  expect(html).toContain("Propositions reçues");
  expect(html).toContain("Tu n’as aucune vignette libre à proposer.");
  expect(html).not.toContain("Trouver des échanges");
  expect(html).not.toContain("Collectionneur démo");
  expect(html).not.toContain("Simuler l’acceptation");
  expect(html).not.toContain("Décoller pour le test");
});

it("starts from unreserved loose copies and carries the book's requested sticker into the search", () => {
  const snapshot = createCycloStickersFinalSnapshot(createFinalCycloStickersSourceFixture());
  const state = createCycloStickersPersistentStateFixture();
  state.owned = [
    { cardNumber: 1, quantity: 4, pasted: true, reserved: 1 },
    { cardNumber: 2, quantity: 1, pasted: false, reserved: 1 },
  ];
  const html = renderToStaticMarkup(<CycloStickersTrades snapshot={snapshot} state={state} busy={false} mutate={async () => null} initialTarget={3} wanted={[4, 5]} />);
  const first = snapshot.cards.find(card => card.number === 1)!;
  const second = snapshot.cards.find(card => card.number === 2)!;
  expect(html).toContain("Tes vignettes à proposer");
  expect(html).toContain(`aria-label="Ajouter ${first.name}"`);
  expect(html).toContain("×2");
  expect(html).not.toContain(`aria-label="Ajouter ${second.name}"`);
  expect(html).toContain('value="selected" selected=""');
  expect(html).toContain("Ma liste de recherche (2)");
  expect(html).toContain("Chercher un DS par son nom");
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Trouver des échanges<\/button>/);
});

it("renders each requested copy on a multi-sticker incoming offer in English", () => {
  const snapshot = createCycloStickersFinalSnapshot(createFinalCycloStickersSourceFixture());
  const state = createCycloStickersPersistentStateFixture();
  state.incomingOffers = [{
    id: "trade-1", fromDirectorId: "collector-1", fromName: "Collector One",
    toDirectorId: state.directorId, toName: state.owner.displayName,
    give: [1], receive: 2, receiveCards: [2, 2, 3], status: "pending", createdAt: "2026-11-14", expiresAt: "2026-11-16",
  }];
  const html = renderToStaticMarkup(<LocaleProvider initialLocale="en"><CycloStickersPersistentAlbum snapshot={snapshot} initialState={state} initialTab="trades" /></LocaleProvider>);
  expect(html).toContain("Sticker trades");
  expect(html).toContain("Collector One");
  expect(html).toContain(`2 × ${snapshot.cards.find(card => card.number === 2)?.name} + ${snapshot.cards.find(card => card.number === 3)?.name}`);
  expect(html).toContain("Accept this trade");
});

it("offers a direct paste after opening and counts a second copy as a duplicate", () => {
  const snapshot = createCycloStickersFinalSnapshot(createFinalCycloStickersSourceFixture());
  const state = createCycloStickersPersistentStateFixture();
  state.openedPacks = [{ id: "new-pack", inventorySource: "edition", cards: [1, 1] }];
  state.owned = [{ cardNumber: 1, quantity: 2, pasted: false, reserved: 0 }];
  const opened = renderToStaticMarkup(<CycloStickersPersistentAlbum snapshot={snapshot} initialState={state} initialTab="boosters" />);
  expect(opened.match(/>Coller dans mon album<\/button>/g)).toHaveLength(1);
  expect(opened).toContain("Double dans ce sachet");

  state.owned[0].pasted = true;
  const pasted = renderToStaticMarkup(<CycloStickersPersistentAlbum snapshot={snapshot} initialState={state} initialTab="boosters" />);
  expect(pasted).toContain("Collée dans l’album");
  expect(pasted).not.toContain(">Coller dans mon album<");
});

it("shows available and reserved duplicate copies while excluding single stickers", () => {
  const snapshot = createCycloStickersFinalSnapshot(createFinalCycloStickersSourceFixture());
  const state = createCycloStickersPersistentStateFixture();
  state.owned = [
    { cardNumber: 1, quantity: 4, pasted: true, reserved: 1 },
    { cardNumber: 2, quantity: 1, pasted: false, reserved: 0 },
  ];
  const html = renderToStaticMarkup(<CycloStickersPersistentAlbum snapshot={snapshot} initialState={state} initialTab="duplicates" />);
  expect(html).toContain("Inventaire des doubles");
  expect(html).toContain("N° 01");
  expect(html).not.toContain("N° 02");
  expect(html).toContain("<b>2</b> en stock");
  expect(html).toContain("<b>1</b> en réservation");
});
