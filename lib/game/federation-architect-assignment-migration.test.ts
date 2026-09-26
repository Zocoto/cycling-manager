import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260926110000_fix_federation_architect_assignments.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

const teamInfrastructureService = readFileSync(
  resolve(process.cwd(), "services/team-infrastructures.ts"),
  "utf8",
).replace(/\r\n/g, "\n");

describe("federation architect assignment hotfix", () => {
  it("resolves the affiliation from the construction country", () => {
    expect(migration).toContain(
      "from public.get_current_federation_identity(v_country_code)",
    );
    expect(migration).not.toContain(
      "from public.get_current_federation_identity('BE')",
    );
  });

  it("serialises and rejects cross-scope double booking", () => {
    expect(migration).toContain(
      "'architect-assignment:' || p_staff_contract_id::text",
    );
    expect(migration).toContain(
      "prevent_team_project_architect_double_booking",
    );
    expect(migration).toContain(
      "prevent_federation_architect_double_booking",
    );
    expect(migration).toContain(
      "Cet architecte travaille déjà sur un chantier fédéral.",
    );
    expect(migration).toContain(
      "Cet architecte travaille déjà sur un chantier de son équipe.",
    );
  });

  it("immediately refunds the federation and shortens the project", () => {
    expect(migration).toContain("balance = balance + v_refund");
    expect(migration).toContain("final_duration_days = v_new_duration");
    expect(migration).toContain("completes_game_day_index = greatest(");
    expect(migration).toContain("'refund',");
    expect(migration).toContain("'savedDays', v_saved_days");
  });

  it("removes federally assigned architects from team construction choices", () => {
    expect(teamInfrastructureService).toContain(
      'from("national_federation_project_architects")',
    );
    expect(teamInfrastructureService).toContain(
      'from("national_federation_infrastructure_projects")',
    );
    expect(teamInfrastructureService).toContain(
      "federallyBusyContractIds.has(contract.id)",
    );
  });
});
