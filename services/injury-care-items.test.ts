import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ stock: [] as unknown[], gifts: [] as unknown[],
  error: false, calls: [] as { table: string; from: number; filters: unknown[] }[], admin: null as unknown, halloween: [] as unknown[] }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => mock.admin }));
vi.mock("@/services/halloween-inventory", () => ({ getCurrentHalloweenInventory: async () => mock.halloween }));
import { getCurrentInjuryCareItems } from "./injury-care-items";
function client() {
  return { from(table: string) {
    let offset = 0, end = 999; const filters: unknown[] = [];
    const query = {
      select: () => query, order: () => query,
      eq: (key: string, value: unknown) => { filters.push(["eq", key, value]); return query; },
      gt: (key: string, value: unknown) => { filters.push(["gt", key, value]); return query; },
      gte: (key: string, value: unknown) => { filters.push(["gte", key, value]); return query; },
      range: (from: number, to: number) => { offset = from; end = to; return query; },
      returns: async () => {
        mock.calls.push({ table, from: offset, filters });
        return { data: (table === "team_item_inventory" ? mock.stock : mock.gifts).slice(offset, end + 1),
          error: mock.error && offset === 1000 ? { message: "unavailable" } : null };
      },
    };
    return query;
  } } as unknown as SupabaseClient;
}
beforeEach(() => {
  mock.stock = [{ quantity: 2, inventory_catalog_items: { id: "catalog-id", item_key: "care", name: "Soin", effect_payload: { recoveryHours: 12 } } }];
  mock.gifts = [{ id: "gift-id", reward_key: "care", daily_reward_catalog: { name: "Soin", effect_payload: { recoveryHours: 12 } } }];
  mock.calls = []; mock.error = false; mock.admin = client(); mock.halloween = [];
});
describe("stock médical ciblé", () => {
  it("keeps the generic catalogue ID expected by the atomic redemption and includes gifts", async () => {
    const result = await getCurrentInjuryCareItems({ supabase: client(), authUserId: "user", teamSeasonId: "current-team-season", gameYear: 4 });
    expect(result).toEqual([{ inventoryId: "catalog-id", catalogKey: "care", name: "Soin", recoveryHours: 12, quantity: 3 }]);
    const stockFilters = mock.calls.find(c => c.table === "team_item_inventory")!.filters;
    expect(stockFilters).toEqual(expect.arrayContaining([["eq", "team_season_id", "current-team-season"], ["gt", "quantity", 0],
      ["eq", "inventory_catalog_items.category", "injury_care"], ["eq", "inventory_catalog_items.status", "active"]]));
    expect(mock.calls.find(c => c.table === "daily_reward_inventory")!.filters).toEqual(expect.arrayContaining([
      ["eq", "status", "available"], ["gte", "expires_after_game_year", 4], ["eq", "daily_reward_catalog.effect_kind", "injury_care"],
    ]));
  });
  it("does not truncate gifts at the PostgREST limit", async () => {
    mock.gifts = Array.from({ length: 1001 }, (_, index) => ({ id: `gift-${index}`, reward_key: "care", daily_reward_catalog: { name: "Soin", effect_payload: { recoveryHours: 12 } } }));
    const result = await getCurrentInjuryCareItems({ supabase: client(), authUserId: "user", teamSeasonId: "current", gameYear: 4 });
    expect(result[0].quantity).toBe(1003);
    expect(mock.calls.filter(c => c.table === "daily_reward_inventory").map(c => c.from)).toEqual([0, 1000]);
  });
  it("rejects a partial stock read so the page can show a retry message", async () => {
    mock.gifts = Array(1001).fill(mock.gifts[0]); mock.error = true;
    await expect(getCurrentInjuryCareItems({ supabase: client(), authUserId: "user", teamSeasonId: "current", gameYear: 4 })).rejects.toThrow("objets de soin disponibles");
  });
  it("includes healing Halloween objects and excludes unrelated potions", async () => {
    mock.halloween = [
      { sourceId: "mummy-bandage", name: "Bandage de momie", availableQuantity: 3 },
      { sourceId: "mummy-resurrection", name: "Résurrection de la momie", availableQuantity: 1 },
      { sourceId: "pumpkin-juice", name: "Jus", availableQuantity: 9 },
    ];
    const items = await getCurrentInjuryCareItems({ supabase: client(), authUserId: "user", teamSeasonId: "current", gameYear: 4 });
    expect(items).toHaveLength(3);
    expect(items.find(i => i.halloweenItem === "mummy-bandage")).toMatchObject({ quantity: 3, recoveryHours: 12, fullRecovery: false });
    expect(items.at(-1)).toMatchObject({ halloweenItem: "mummy-resurrection", fullRecovery: true, quantity: 1 });
  });
});
