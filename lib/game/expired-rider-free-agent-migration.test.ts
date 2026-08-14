import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260814090000_repair_expired_rider_free_agents.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");

describe("expired rider free-agent repair", () => {
  it("reconciles every completed expiring contract, not only freshly updated rows", () => {
    expect(migration).toContain(
      "expired_contract.end_season_id = new.id",
    );
    expect(migration).toContain("expired_contract.status = 'completed'");
    expect(migration).toContain(
      "successor.status in ('active', 'planned')",
    );
    expect(migration).not.toContain("returning contract.rider_id");
  });

  it("retires only riders who spent the completed season as free agents", () => {
    expect(migration).toContain(
      "'where rider.status = ''free_agent'''",
    );
    expect(migration).toContain("'if v_has_team then'");
    expect(migration).toContain(
      "jamais un coureur sous contrat sans départ en course",
    );
  });

  it("repairs only current riders with an expired contract and no successor", () => {
    expect(migration).toContain("rating.season_id = v_active_season_id");
    expect(migration).toContain(
      "expired_contract.end_season_id = v_previous_season_id",
    );
    expect(migration).toMatch(
      /update public\.riders as rider[\s\S]*set status = 'free_agent'[\s\S]*where rider\.status = 'active'/,
    );
  });
});
