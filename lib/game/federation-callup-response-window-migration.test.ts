import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261004083000_split_federation_selection_and_callup_deadlines.sql",
  "utf8",
).replaceAll("\r", "");
const selectionService = readFileSync(
  "services/federation-selections.ts",
  "utf8",
).replaceAll("\r", "");

describe("federation call-up response window", () => {
  it("keeps H-24 for Worlds and gives CC/Nations Cup until H-1", () => {
    expect(migration).toContain(
      "p_competition_code = 'world_championship'",
    );
    expect(migration).toContain("then interval '24 hours'");
    expect(migration).toContain("else interval '1 hour'");
  });

  it("uses the response deadline for replies, expiry and replacements", () => {
    expect(migration).toContain(
      "public.assert_federation_callup_response_open",
    );
    expect(migration).toContain(
      "public.prepare_due_automatic_federation_professional_lineups",
    );
    expect(migration).toContain(
      "public.refill_national_federation_professional_selection",
    );
    expect(
      migration.match(
        /get_national_federation_callup_response_closes_at/g,
      )?.length,
    ).toBeGreaterThanOrEqual(8);
  });

  it("does not reopen the president selection deadline", () => {
    expect(migration).not.toContain(
      "create or replace function public.get_national_federation_selection_schedule(",
    );
    expect(selectionService).toContain(
      "isFederationCallupResponseOpen",
    );
    expect(selectionService).toContain(
      'slot.rider_category === "junior"',
    );
  });
});
