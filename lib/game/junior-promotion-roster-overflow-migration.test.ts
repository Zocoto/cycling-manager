import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260903130000_arbitrate_youth_promotions_at_roster_limit.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");
const youthService = readFileSync(
  resolve(process.cwd(), "services/youth-development.ts"),
  "utf8",
).replaceAll("\r\n", "\n");

describe("next-season junior promotion roster arbitration", () => {
  it("keeps junior promotions flexible while firm commitments remain capped", () => {
    expect(migration).not.toContain("select slot_key from youth_slots");
    expect(migration).toContain(
      "drop trigger if exists enforce_youth_promotion_roster_capacity_before_write",
    );
    expect(migration).toContain(
      "if v_commitment_count - v_replaced_commitment > 35 then",
    );
    expect(migration).not.toContain("new.acquisition_type = 'academy'");
    expect(youthService).toContain("const canScheduleYouthPromotion = true");
  });

  it("projects next season inside the existing compact assistant RPC", () => {
    expect(migration).toContain(
      "create or replace function private.get_team_roster_projection",
    );
    expect(migration).toContain("context.game_year + 1");
    expect(migration).toContain("'nextSeasonRosterProjection'");
    expect(migration).toContain("projection.scheduled_youth_count");
    expect(migration).toContain(
      "'public.get_current_dashboard_assistant_summary()'::regprocedure",
    );
    expect(migration).toContain(
      "v_definition := replace(v_definition, E'\\r\\n', E'\\n');",
    );
  });

  it("retains the best scheduled juniors at J1 and releases the overflow", () => {
    expect(migration).toContain(
      "partition by candidate.team_id, candidate.status",
    );
    expect(migration).toContain("candidate.projected_rating_total desc");
    expect(migration).toContain(
      "35 - coalesce(firm.rider_count, 0)",
    );
    expect(migration).toContain(
      "case when v_youth.promote_to_pro then 'active' else 'free_agent' end",
    );
    expect(migration).toContain(
      "'Promotion annulée — effectif complet'",
    );
  });
});
