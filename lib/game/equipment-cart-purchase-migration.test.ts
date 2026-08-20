import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260820190000_purchase_equipment_cart.sql",
  ),
  "utf8",
).toLowerCase();

describe("atomic equipment cart purchase migration", () => {
  it("locks the team budget and validates every commercial reference", () => {
    expect(migration).toContain(
      "function public.purchase_current_team_equipment_cart",
    );
    expect(migration).toContain("for update of team_season");
    expect(migration).toContain("acquisition_channel = 'commercial'");
    expect(migration).toContain(
      "trésorerie insuffisante pour régler ce panier",
    );
  });

  it("adds all quantities and debits the grouped total atomically", () => {
    expect(migration).toContain(
      "quantity = public.team_equipment_inventory.quantity + excluded.quantity",
    );
    expect(migration).toContain("cash_balance = cash_balance - v_total_cost");
    expect(migration).toContain(
      "grant execute on function public.purchase_current_team_equipment_cart(jsonb) to authenticated",
    );
  });
});
