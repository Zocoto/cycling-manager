import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260904010000_require_fresh_selection_conflict_acknowledgement.sql",
  ),
  "utf8",
).toLowerCase();
const action = readFileSync(
  join(process.cwd(), "app/jeu/selections-internationales/actions.ts"),
  "utf8",
);
const page = readFileSync(
  join(process.cwd(), "app/jeu/selections-internationales/page.tsx"),
  "utf8",
);
const service = readFileSync(
  join(process.cwd(), "services/international-championship-selections.ts"),
  "utf8",
);

describe("fresh international selection conflict acknowledgement", () => {
  it("refuses a stale confirmation before applying selection priority", () => {
    expect(migration).toContain(
      "respond_to_international_selection_with_conflict_ack",
    );
    expect(migration).toContain(
      "v_current_conflicts is distinct from v_acknowledged_conflicts",
    );
    expect(migration.indexOf("v_current_conflicts is distinct")).toBeLessThan(
      migration.indexOf(
        "perform public.respond_to_international_championship_selection(",
      ),
    );
    expect(migration).toContain(
      "other_stage.day_slot = target_stage.day_slot",
    );
  });

  it("passes exactly the conflicts rendered to the manager", () => {
    expect(page).toContain('name="acknowledgedConflict"');
    expect(page).toContain('value={`course:${raceName}`}');
    expect(page).toContain('value={`activité:${campName}`}');
    expect(action).toContain('.getAll("acknowledgedConflict")');
    expect(service).toContain(
      '"respond_to_international_selection_with_conflict_ack"',
    );
    expect(service).toContain("p_acknowledged_conflicts: acknowledgedConflicts");
  });

  it("refreshes existing invitations whenever a camp changes", () => {
    expect(migration).toContain(
      "refresh_selection_messages_after_form_camp_change",
    );
    expect(migration).toContain(
      "refresh_selection_messages_after_reconnaissance_rider_change",
    );
    expect(migration).toContain(
      "perform public.sync_director_international_selection_message(",
    );
  });

  it("repairs only the audited Socrates reconnaissance and refund", () => {
    expect(migration).toContain(
      "0dc7c2b6-d8e1-4d54-b1c8-70512a3ff85f",
    );
    expect(migration).toContain(
      "11ef18da-6675-4bcc-8ea3-07279a9d0d4a",
    );
    expect(migration).toContain("reconnaissance.total_price = 20000");
    expect(migration).toContain("set cash_balance = team_season.cash_balance + 20000");
    expect(migration).toContain("set status = 'cancelled'");
  });
});
