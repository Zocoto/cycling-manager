import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, eq, responses, equipment } = vi.hoisted(() => ({
  from: vi.fn(), eq: vi.fn(), responses: new Map<string, unknown>(), equipment: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from }) }));
vi.mock("@/services/team-equipment", () => ({ getCurrentTeamEquipmentOverview: equipment }));
import { getCurrentHalloweenInventory } from "./halloween-inventory";
import { getCurrentTeamInventoryOverview } from "./team-inventory";
import { getHalloweenAvatarWardrobe } from "./halloween-avatar-wardrobe";
import { HALLOWEEN_PREVIEW_ITEMS } from "@/lib/game/halloween-catalog";

describe("lecture de l’inventaire Halloween du DS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    responses.clear();
    responses.set("halloween_wallets", { data: { inventory: { "spectres-tea": 2 }, cosmetics: {} }, error: null });
    responses.set("inventory_catalog_items", { data: [], error: null });
    responses.set("team_item_inventory", { data: [], error: null });
    responses.set("team_seasons", { data: { scouting_reports_revealed_until: null }, error: null });
    from.mockImplementation(table => {
      const query = { select: () => query, eq: (...args: unknown[]) => { eq(...args); return query; },
        gt: () => query, returns: async () => responses.get(table), maybeSingle: async () => responses.get(table) };
      return query;
    });
    equipment.mockResolvedValue({ teamSeasonId: "season-team", teamName: "Équipe", seasonName: "S4",
      currency: "EUR", catalog: [], assignments: [], pendingAssignments: [] });
  });
  it("lit uniquement le portefeuille du joueur connecté et de cette édition", async () => {
    const items = await getCurrentHalloweenInventory("zocoto-auth-id");
    expect(items[0].quantity).toBe(2);
    expect(from).toHaveBeenCalledWith("halloween_wallets");
    expect(eq).toHaveBeenCalledWith("edition_id", "halloween-2026");
    expect(eq).toHaveBeenCalledWith("user_id", "zocoto-auth-id");
  });
  it("inclut les potions dans les objets et les compteurs de l’inventaire principal", async () => {
    const overview = await getCurrentTeamInventoryOverview("zocoto-auth-id");
    expect(overview?.items[0]).toMatchObject({ name: "Tisane du spectre", quantity: 2, source: "halloween" });
    expect(overview?.summary).toMatchObject({ references: 1, totalUnits: 2, availableUnits: 2 });
  });
  it("réserve les accessoires acquis à la garde-robe tout en conservant les objets utilisables", async () => {
    const cosmetics = HALLOWEEN_PREVIEW_ITEMS.filter((item) => item.kind === "cosmetic");
    const inventory: Readonly<Record<string, number>> = Object.freeze({
      ...Object.fromEntries(cosmetics.map((item) => [item.id, 1])),
      "spectres-tea": 2, "vampire-kiss": 1, "headless-frame-claim": 1,
    });
    const selected = Object.freeze({ frame: "spectral-wheel", background: "halloween-background", accessory: "devil-trident" });
    responses.set("halloween_wallets", { data: { inventory, cosmetics: selected }, error: null });

    const overview = await getCurrentTeamInventoryOverview("zocoto-auth-id");
    expect(overview?.items.map((item) => item.sourceId).sort()).toEqual(["headless-frame-claim", "spectres-tea", "vampire-kiss"]);
    expect(overview?.summary).toMatchObject({ references: 3, totalUnits: 4, availableUnits: 4 });

    const wardrobe = await getHalloweenAvatarWardrobe("zocoto-auth-id");
    expect(wardrobe.owned.sort()).toEqual(cosmetics.map((item) => item.id).sort());
    expect(wardrobe.selected.sort()).toEqual(["devil-trident", "halloween-background", "spectral-wheel"]);
    expect(Object.values(selected).sort()).toEqual(["devil-trident", "halloween-background", "spectral-wheel"]);
    for (const item of cosmetics) expect(inventory[item.id]).toBe(1);
    expect(inventory["spectres-tea"]).toBe(2);
  });
  it("ne crée pas de portefeuille pour un non-participant", async () => {
    responses.set("halloween_wallets", { data: null, error: null });
    expect(await getCurrentHalloweenInventory("non-participant")).toEqual([]);
  });
  it("remonte une erreur au lieu de faire passer un stock absent pour une réussite", async () => {
    responses.set("halloween_wallets", { data: null, error: { message: "indisponible" } });
    await expect(getCurrentHalloweenInventory("zocoto-auth-id")).rejects.toThrow("indisponible");
  });
});
