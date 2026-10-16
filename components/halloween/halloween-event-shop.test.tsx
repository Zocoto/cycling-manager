import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HalloweenEvent } from "./halloween-event";
import { HALLOWEEN_START, HALLOWEEN_END, HALLOWEEN_SHOP_END, type HalloweenState } from "@/lib/game/halloween-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const state: HalloweenState = {
  state: "open", startsAt: HALLOWEEN_START, endsAt: HALLOWEEN_END, shopEndsAt: HALLOWEEN_SHOP_END,
  joined: true, coins: 100000, tickets: 0, inventory: {}, obtained: {}, purchases: {}, cosmetics: {},
  curse: null, pendingGift: null, bandages: 0, attempts: 0, drawn: false, activeRun: null,
  ranking: [], dailyRanking: [], riders: [], targets: [], projects: [],
};
const card = (initial: HalloweenState, id: string) => {
  const html = renderToStaticMarkup(createElement(HalloweenEvent, { initial, initialTab: "boutique" }));
  return html.split(`id="halloween-item-${id}"`)[1].split("</article>")[0];
};

describe("boutique Halloween réutilisable", () => {
  it("keeps the juice purchase enabled above the old quota, but still requires enough coins", () => {
    const initial = { ...state, purchases: { "pumpkin-juice": 30 }, obtained: { "pumpkin-juice": 35 } };
    const html = card(initial,"pumpkin-juice");
    expect(html).not.toContain('disabled=""');
    expect(html).toContain("Sans limite d’achat");
    expect(html).not.toContain("Infinity");
    expect(card({ ...initial, coins: 11 },"pumpkin-juice")).toContain('disabled=""');
  });
  it("permits another relic purchase after obtaining or using the first dose", () => {
    for (const id of ["witches-star", "immortality-pact", "youth-fountain"]) {
      const html = card({ ...state, purchases: { [id]: 1 }, obtained: { [id]: 1 } }, id);
      expect(html).toContain("5 ");
      expect(html).not.toContain('disabled=""');
      expect(html).not.toMatch(/1 utilisation|une.*carrière/i);
    }
  });
  it("disables the fifth-obtained star and fifth-purchased relic without restricting ordinary potions", () => {
    expect(card({ ...state, obtained: { "witches-star": 5 } }, "witches-star")).toContain('disabled=""');
    expect(card({ ...state, purchases: { "immortality-pact": 5 } }, "immortality-pact")).toContain('disabled=""');
    const tea = card({ ...state, obtained: { "spectres-tea": 2 }, purchases: { "spectres-tea": 2 } }, "spectres-tea");
    expect(tea).toContain("100 roues");
    expect(tea).toContain("Plusieurs doses possibles");
    expect(tea).not.toContain('disabled=""');
  });
});
