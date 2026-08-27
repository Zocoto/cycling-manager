import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260827153000_speed_up_auction_settlement.sql",
  ),
  "utf8",
);
const service = readFileSync(
  resolve(process.cwd(), "services/transfer-market.ts"),
  "utf8",
);
const route = readFileSync(
  resolve(process.cwd(), "app/api/cron/transfer-market/route.ts"),
  "utf8",
);

describe("transfer market settlement performance", () => {
  it("does not rebuild an already provisioned future calendar per winner", () => {
    expect(migration).toMatch(/then\s+return v_next_id;/);
    expect(migration).toContain("perform public.provision_season_race_calendar");
    expect(migration).toContain("if not exists (");
  });

  it("keeps settlement incremental and reads the top binding bid directly", () => {
    expect(migration).toContain("limit 2");
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain(
      "order by bid.amount desc, bid.created_at asc, bid.id asc, bid.team_id",
    );
    expect(migration).not.toContain("select distinct on (bid.team_id)");
    expect(migration).toContain("transfer_market_open_closes_idx");
  });

  it("reports separate settlement timings", () => {
    expect(service).toContain("firstSettlementDurationMs");
    expect(service).toContain("secondSettlementDurationMs");
    expect(route).toContain("transfer_market_maintenance_completed");
  });
});
