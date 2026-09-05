import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260801103000_virtual_partner_equipment_and_resale.sql",
  ),
  "utf8",
);
const equipmentService = readFileSync(
  join(process.cwd(), "services/team-equipment.ts"),
  "utf8",
);
const inventoryService = readFileSync(
  join(process.cwd(), "services/team-inventory.ts"),
  "utf8",
);

describe("matériel équipementier virtuel", () => {
  it("nettoie les anciens stocks et interdit leur retour dans l’inventaire", () => {
    expect(migration).toContain(
      "delete from public.team_equipment_inventory as inventory",
    );
    expect(migration).toContain(
      "item.acquisition_channel = 'equipment_partner'",
    );
    expect(migration).toContain(
      "prevent_physical_partner_equipment_inventory",
    );
  });

  it("autorise sans contingent le cœur de gamme et les séries acceptées", () => {
    expect(migration).toContain("product.offer_type = 'core'");
    expect(migration).toContain("offer.status = 'claimed'");
    expect(equipmentService).toContain("partnerAvailableItemIds");
    expect(equipmentService).toContain("item.isUnlimited ||");
  });

  it("exclut les références partenaire mais conserve les prototypes R&D", () => {
    expect(inventoryService).toContain(
      'item.channel !== "equipment_partner" && item.ownedQuantity > 0',
    );
    expect(inventoryService).not.toContain(
      'item.channel === "commercial" && item.ownedQuantity > 0',
    );
  });
});

describe("revente du matériel", () => {
  it("n’autorise que les pièces commerciales réellement libres", () => {
    expect(migration).toContain(
      "v_item.acquisition_channel <> 'commercial'",
    );
    expect(migration).toContain(
      "v_inventory.quantity <= coalesce(v_used, 0)",
    );
  });

  it("crédite la trésorerie et journalise la transaction", () => {
    expect(migration).toContain(
      "cash_balance = cash_balance + v_item.resale_price",
    );
    expect(migration).toContain("'equipment-resale:'");
  });
});
