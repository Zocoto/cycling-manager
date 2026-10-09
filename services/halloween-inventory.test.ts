import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, eq, responses, equipment } = vi.hoisted(() => ({
  from: vi.fn(), eq: vi.fn(), responses: new Map<string, unknown>(), equipment: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ from }) }));
vi.mock("@/services/team-equipment", () => ({ getCurrentTeamEquipmentOverview: equipment }));
import { getCurrentHalloweenInventory } from "./halloween-inventory";
import { getCurrentTeamInventoryOverview } from "./team-inventory";

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
  it("ne crée pas de portefeuille pour un non-participant", async () => {
    responses.set("halloween_wallets", { data: null, error: null });
    expect(await getCurrentHalloweenInventory("non-participant")).toEqual([]);
  });
  it("remonte une erreur au lieu de faire passer un stock absent pour une réussite", async () => {
    responses.set("halloween_wallets", { data: null, error: { message: "indisponible" } });
    await expect(getCurrentHalloweenInventory("zocoto-auth-id")).rejects.toThrow("indisponible");
  });
});
