import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260903233000_create_federation_preselections.sql",
  ),
  "utf8",
);

describe("federation preselections migration", () => {
  it("persists versioned lists and one response per selected rider", () => {
    expect(migration).toContain("create table public.national_federation_selection_lists");
    expect(migration).toContain("create table public.national_federation_selection_members");
    expect(migration).toContain("status in ('draft', 'pending_confirmation', 'finalized')");
    expect(migration).toContain("num_nonnulls(professional_rider_id, junior_rider_id) = 1");
  });

  it("enforces quotas, nationality and the one-race Nations Cup rule in SQL", () => {
    expect(migration).toContain("cardinality(v_rider_ids) > v_slot.rider_limit");
    expect(migration).toContain("rider.country_id = v_identity.country_id");
    expect(migration).toContain("other_slot.competition_code = 'nations_cup'");
    expect(migration).toContain("Un coureur ne peut disputer qu’une seule épreuve de Nations Cup");
  });

  it("notifies each owner and includes confirmations in the DS assistant", () => {
    expect(migration).toContain("Présélection nationale à confirmer");
    expect(migration).toContain("'international_selection'");
    expect(migration).toContain("is_important");
    expect(migration).toContain("national_federation_selection_members as federation_member");
    expect(migration).toContain("response_status = 'pending'");
  });

  it("keeps the beta inactive before S3 and restricted to Belgium", () => {
    expect(migration).toContain("v_season.game_year < 3");
    expect(migration).toContain("<> 'BE'");
    expect(migration).toContain("set statement_timeout = '10s'");
    expect(migration).toContain("pg_advisory_xact_lock");
  });
});
