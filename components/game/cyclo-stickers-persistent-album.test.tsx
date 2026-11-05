import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { createCycloStickersFinalSnapshot } from "@/lib/game/cyclo-stickers-final-snapshot";
import { createFinalCycloStickersSourceFixture } from "@/lib/game/cyclo-stickers-final-snapshot.fixture";
import { createCycloStickersPersistentStateFixture } from "@/lib/game/cyclo-stickers-persistence.fixture";
import { CycloStickersPersistentAlbum } from "./cyclo-stickers-persistent-album";

it("renders the authenticated owner and empty server stock without demonstration grants", () => {
  const html = renderToStaticMarkup(<CycloStickersPersistentAlbum snapshot={createCycloStickersFinalSnapshot(createFinalCycloStickersSourceFixture())} initialState={createCycloStickersPersistentStateFixture()} initialTab="boosters" />);
  expect(html).toContain("Collectionneur réel de recette");
  expect(html).toContain("Aucun sachet fermé");
  expect(html).not.toContain("Abbaye du Lion");
  expect(html).not.toContain("Réinitialiser uniquement cet essai");
  expect(html).not.toContain("Deux cartes et deux sachets d’essai");
  expect(html).not.toContain("collectionneurs sont fictifs");
});

it("renders only real collectors and protects already pasted special cards", () => {
  const state = createCycloStickersPersistentStateFixture();
  state.owned = [{ cardNumber: 68, quantity: 1, pasted: true, reserved: 0 }];
  const html = renderToStaticMarkup(<CycloStickersPersistentAlbum snapshot={createCycloStickersFinalSnapshot(createFinalCycloStickersSourceFixture())} initialState={state} initialTab="trades" />);
  expect(html).toContain("Propositions reçues");
  expect(html).not.toContain("Collectionneur démo");
  expect(html).not.toContain("Simuler l’acceptation");
  expect(html).not.toContain("Décoller pour le test");
});
