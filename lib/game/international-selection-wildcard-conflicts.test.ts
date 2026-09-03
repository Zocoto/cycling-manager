import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260904012000_warn_and_cancel_conflicting_wildcards.sql",
  ),
  "utf8",
).toLowerCase();
const page = readFileSync(
  join(process.cwd(), "app/jeu/selections-internationales/page.tsx"),
  "utf8",
);
const service = readFileSync(
  join(process.cwd(), "services/international-championship-selections.ts"),
  "utf8",
);

describe("international selection WildCard conflicts", () => {
  it("reports only pending requested WildCards in the same day slot", () => {
    expect(migration).toContain("registration.status = 'pending'");
    expect(migration).toContain("registration.entry_method = 'requested'");
    expect(migration).toContain(
      "other_stage.day_slot = target_stage.day_slot",
    );
    expect(migration).toContain(
      "get_rider_selection_conflicting_wildcards",
    );
  });

  it("prevents an unanswered invitation from cancelling a WildCard", () => {
    expect(migration).toContain("v_candidate_response_status = 'confirmed'");
    expect(migration).toContain(
      "or cardinality(\n      public.get_rider_selection_conflicting_wildcards(",
    );
    expect(migration.indexOf("v_candidate_response_status = 'confirmed'")).toBeLessThan(
      migration.indexOf("set status = 'withdrawn'", migration.indexOf("v_candidate_response_status = 'confirmed'")),
    );
  });

  it("keeps a team request alive while another proposed rider remains", () => {
    expect(migration).toContain(
      "remaining_roster.status in ('selected', 'confirmed')",
    );
    expect(migration).toContain(
      "set status = 'withdrawn', decided_at = now()",
    );
  });

  it("shows and acknowledges the pending request before acceptance", () => {
    expect(service).toContain("conflictingWildcardRaceNames");
    expect(page).toContain("Une demande de WildCard est en cours");
    expect(page).toContain('value={`wildcard:${raceName}`}');
    expect(migration).toContain(
      "'wildcard:' || wildcard_conflict.race_name",
    );
  });

  it("refreshes the mailbox when a request or its roster changes", () => {
    expect(migration).toContain(
      "refresh_selection_messages_after_race_roster_change",
    );
    expect(migration).toContain(
      "refresh_selection_messages_after_registration_change",
    );
    expect(migration).toContain("une demande de wildcard est en cours");
  });
});
