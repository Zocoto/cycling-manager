import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HalloweenCandyGame } from "./halloween-candy-game";
import { HalloweenSkinPortrait, HalloweenSkinPreview } from "./halloween-skin-preview";
import { HALLOWEEN_PREVIEW_ITEMS } from "@/lib/game/halloween-catalog";

const props = { disabled: false, busy: false, drawn: false, pendingGift: false, coins: 24, chosen: null, result: null, onChoose: () => undefined };
describe("bonbons et aperçu des skins", () => {
  it("place exactement deux choix dans la grande illustration", () => {
    const html = renderToStaticMarkup(createElement(HalloweenCandyGame, props));
    expect(html.match(/<button /g)).toHaveLength(2);
    expect(html).toContain('data-candy-color="orange"');
    expect(html).toContain('data-candy-color="violet"');
    expect(html.indexOf("halloween-child")).toBeLessThan(html.indexOf("<button"));
    expect(html).not.toMatch(/Trois couleurs|bonbon vert|halloween-filter/);
    expect(html).toContain("50 % de récompense");
    expect(html).toContain("aucun malus sur votre équipe");
  });
  for (const scenario of [
    { disabled: true, busy: true }, { disabled: true, drawn: true },
    { disabled: true, pendingGift: true }, { disabled: true, coins: 4 },
    { result: "Ce bonbon était vide…" },
  ]) it(`bloque les deux bonbons dans l’état ${JSON.stringify(scenario)}`, () => {
    const html = renderToStaticMarkup(createElement(HalloweenCandyGame, { ...props, ...scenario }));
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
  it("montre le vrai skin sur le portrait personnel, pas une illustration d’inventaire", () => {
    const item = HALLOWEEN_PREVIEW_ITEMS.find(item => item.id === "pumpkin-cap")!;
    const html = renderToStaticMarkup(createElement(HalloweenSkinPortrait, { avatarKey: "director_f_02~halloween~vlad", item }));
    expect(html).toContain('data-halloween-avatar="vlad,cap"');
    expect(html).toContain("Aperçu de Casquette citrouille sur votre portrait");
    expect(html).not.toContain("halloween-item-art");
    const dialog = renderToStaticMarkup(createElement(HalloweenSkinPreview, { avatarKey: "director_f_02~halloween~vlad", item, onClose: () => undefined }));
    expect(dialog).toContain("<dialog");
    expect(dialog).toContain("Votre portrait actuel");
    expect(dialog).toContain("sans achat");
    expect(dialog).not.toContain("Acquérir");
  });
});
