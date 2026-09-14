import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260914110000_split_professional_nations_cup_heats.sql",
  ),
  "utf8",
);

describe("professional Nations Cup table heats", () => {
  it("creates one real edition for each frozen division/group table", () => {
    expect(migration).toContain(
      "create table public.national_federation_nations_cup_heats",
    );
    expect(migration).toContain(
      "group by assignment.division, assignment.group_code",
    );
    expect(migration).toContain(
      "v_pool.field_limit, v_host_country_id",
    );
    expect(migration).not.toContain("0, 'closed', 200");
    expect(migration).toContain("pool_key = 'd4-' || lower(group_code)");
    expect(migration).toContain("set rider_limit = 1");
  });

  it("resolves schedules and startlists to the country's exact table", () => {
    expect(migration).toContain(
      "create or replace function public.get_national_federation_selection_target",
    );
    expect(migration).toContain(
      "heat.group_code is not distinct from assignment.group_code",
    );
    expect(migration).toContain(
      "from public.get_national_federation_selection_target(",
    );
    expect(migration).toContain(
      "v_linked_edition_id is distinct from v_edition_id",
    );
    expect(migration).toContain(
      "set status = 'withdrawn', decided_at = now()",
    );
  });

  it("repairs S3 safely and keeps every future season on the heat model", () => {
    expect(migration).toContain(
      "create or replace function public.ensure_professional_nations_cup",
    );
    expect(migration).toContain(
      "where target.status = 'planned'",
    );
    expect(migration).toContain(
      "select public.ensure_due_professional_nations_cup();",
    );
    expect(migration).toContain(
      "select public.sync_due_national_federation_championship_lineups(now(), true);",
    );
  });
});
