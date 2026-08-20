import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260820150000_assign_physiotherapist_matrix.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("physiotherapist assignment matrix migration", () => {
  it("limits the RPC to the authenticated manager's active team", () => {
    expect(migration).toContain("director.auth_user_id = auth.uid()");
    expect(migration).toContain("team_assignment.role = 'general_manager'");
    expect(migration).toContain("team_assignment.status = 'active'");
    expect(migration).toContain("contract.team_id = v_team_id");
  });

  it("validates one physiotherapist per rider and every capacity", () => {
    expect(migration).toContain("count(distinct requested.rider_id)");
    expect(migration).toContain(
      "having count(*) > public.get_physiotherapist_rider_capacity(member.level)",
    );
    expect(migration).toContain("rider_contract.status = 'active'");
    expect(migration).toContain("member.role = 'physiotherapist'");
  });

  it("replaces the complete matrix atomically", () => {
    expect(migration).toContain("for update of contract");
    expect(migration).toContain("set status = 'ended', ended_at = now()");
    expect(migration).toContain("not exists (\n      select 1");
    expect(migration).toContain(
      "insert into public.staff_rider_assignments",
    );
    expect(migration).toContain(
      "grant execute on function public.assign_current_team_physiotherapist_matrix(jsonb) to authenticated",
    );
  });
});
