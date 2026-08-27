import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("résilience du Bureau des transferts", () => {
  it("ne bloque plus le rendu sur la maintenance des enchères", () => {
    const service = read("services/transfer-market.ts");
    const overview = service.slice(
      service.indexOf("export async function getTransferMarketOverview"),
      service.indexOf("export async function getRiderTransferManagement"),
    );

    expect(overview).not.toContain("prepareCurrentTransferMarket(admin)");
    expect(overview).not.toContain("settle_current_team_finances");
    expect(overview).toContain('.in("listing_id", listingIds)');
  });

  it("confie la clôture sérialisée à un cron dédié", () => {
    const route = read("app/api/cron/transfer-market/route.ts");
    const config = read("vercel.json");
    const migration = read(
      "supabase/migrations/20260827053000_make_auction_settlement_incremental.sql",
    );

    expect(route).toContain("runTransferMarketMaintenance");
    expect(config).toContain('"/api/cron/transfer-market"');
    expect(migration).toContain("pg_try_advisory_xact_lock");
    expect(migration).toContain("limit 2");
    expect(route).toContain("console.error");
  });
});
