import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { HALLOWEEN_PREVIEW_ITEMS } from "./halloween-catalog";
import { getHalloweenObtainedLimit, getHalloweenPurchaseLimit, isHalloweenPurchaseLimitReached } from "./halloween-shop";

const item = (id: string) => HALLOWEEN_PREVIEW_ITEMS.find((entry) => entry.id === id)!;

describe("Halloween consumable economy", () => {
  it("uses the new prices for all thirteen paid consumables", () => {
    expect(Object.fromEntries(HALLOWEEN_PREVIEW_ITEMS.filter((entry) => entry.kind === "consumable" && entry.price !== null).map((entry) => [entry.id, entry.price]))).toEqual({
      "pumpkin-juice": 12, "mummy-bandage": 16, "scouts-candy": 20, "gravediggers-hourglass": 24,
      "midnight-chocolate": 16, "spectres-tea": 100, "giants-syrup": 100, "immortality-pact": 1800,
      "mummy-resurrection": 720, "full-moon-elixir": 560, "cursed-builders-seal": 900,
      "witches-star": 3600, "youth-fountain": 6000,
    });
    expect(item("anti-curse-salt").price).toBeNull();
  });
  it("matches the reviewed server catalog and quotas", () => {
    const migration = readFileSync("supabase/migrations/20261012120000_repeat_halloween_consumables.sql", "utf8");
    const rows = [...migration.matchAll(/\('([a-z-]+)',(\d+),(\d+),(\d+)\)/g)];
    expect(rows).toHaveLength(13);
    for (const [, id, price, obtained, purchase] of rows) {
      expect(item(id).price).toBe(Number(price));
      expect(getHalloweenObtainedLimit(item(id))).toBe(Number(obtained));
      expect(getHalloweenPurchaseLimit(item(id))).toBe(Number(purchase));
    }
  });
  it("allows buying a relic again after its first use, up to five purchases", () => {
    for (const entry of HALLOWEEN_PREVIEW_ITEMS.filter((entry) => entry.relic)) {
      expect(getHalloweenPurchaseLimit(entry)).toBe(5);
      expect(isHalloweenPurchaseLimitReached(entry, 1, 1)).toBe(false);
      expect(isHalloweenPurchaseLimitReached(entry, 5, 5)).toBe(true);
      expect(entry.relic!.limit).not.toMatch(/Une utilisation|1 achat|une fois/i);
    }
  });
  it("preserves one extra podium gift for other relics, but caps bought or drawn stars at five", () => {
    expect(getHalloweenObtainedLimit(item("full-moon-elixir"))).toBe(6);
    expect(isHalloweenPurchaseLimitReached(item("full-moon-elixir"), 4, 5)).toBe(false);
    expect(isHalloweenPurchaseLimitReached(item("witches-star"), 0, 5)).toBe(true);
    expect(isHalloweenPurchaseLimitReached(item("witches-star"), 1, 2)).toBe(false);
  });
  it("retains ordinary, transformation and cosmetic quotas independently of price", () => {
    expect(getHalloweenPurchaseLimit(item("spectres-tea"))).toBe(30);
    expect(getHalloweenPurchaseLimit(item("lord-vlad"))).toBe(1);
    expect(getHalloweenPurchaseLimit(item("vampire-kiss"))).toBe(10);
    expect(isHalloweenPurchaseLimitReached(item("spectres-tea"), 29, 29)).toBe(false);
    expect(isHalloweenPurchaseLimitReached(item("spectres-tea"), 30, 30)).toBe(true);
    expect(isHalloweenPurchaseLimitReached(item("lord-vlad"), 0, 1)).toBe(true);
    expect(item("spectres-tea").bodyChange!.limit).toContain("Plusieurs doses");
    expect(item("giants-syrup").bodyChange!.limit).toContain("Plusieurs doses");
  });
});
