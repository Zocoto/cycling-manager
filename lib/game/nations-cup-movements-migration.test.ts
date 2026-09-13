import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260913143000_wire_nations_cup_movements.sql",
  ),
  "utf8",
);
const overviewService = readFileSync(
  resolve(process.cwd(), "services/nations-cup.ts"),
  "utf8",
);
const page = readFileSync(
  resolve(process.cwd(), "app/jeu/nations-cup/page.tsx"),
  "utf8",
);

describe("Nations Cup movements", () => {
  it("freezes every seasonal division and group", () => {
    expect(migration).toContain(
      "create table if not exists public.national_federation_nations_cup_assignments",
    );
    expect(migration).toContain("primary key (country_id, season_id)");
    expect(migration).toContain("seed_nations_cup_assignments_on_activation");
    expect(migration).toContain("apply_nations_cup_assignment_to_account");
    expect(migration).toContain("Federation account division anchor missing.");
    expect(migration).toContain(
      "select assignment.division into v_division",
    );
    expect(migration).toContain(
      "subsequent account triggers can reuse",
    );
  });

  it("uses the approved balanced promotion and relegation rules", () => {
    expect(migration).toContain("p_division_rank > p_division_size - 4");
    expect(migration).toContain("p_division = 2 and p_group_rank <= 2");
    expect(migration).toContain("p_group_rank > p_group_size - 2");
    expect(migration).toContain("p_division = 3 and p_group_rank <= 2");
    expect(migration).toContain("p_group_rank > p_group_size - 3");
    expect(migration).toContain("p_division = 4 and p_group_rank <= 2");
  });

  it("shares one projection between the UI and the rollover", () => {
    expect(migration).toContain(
      "get_national_federation_nations_cup_movement_projection",
    );
    expect(migration).toContain("and v_completed_events = v_expected_events");
    expect(overviewService).toContain(
      'admin.rpc("get_national_federation_nations_cup_movement_projection"',
    );
    expect(overviewService).toContain("projectedDivision");
    expect(overviewService).toContain("movementZone");
  });

  it("serializes cross-event saves before checking rider uniqueness", () => {
    const newLock = migration.indexOf("'federation-selection:' || v_identity.country_id::text");
    const patchedCheck = migration.lastIndexOf("v_new_lock || v_check_anchor");
    expect(newLock).toBeGreaterThan(-1);
    expect(patchedCheck).toBeGreaterThan(newLock);
    expect(migration).toContain(
      "This nation-wide lock must be acquired before reading the other slots.",
    );
  });

  it("refreshes an open live standings page without polling all season", () => {
    expect(page).toContain("<NationsCupAutoRefresh");
    expect(page).toContain("overview.currentDayNumber >= 24");
    expect(page).toContain('event.status !== "completed"');
  });
});
