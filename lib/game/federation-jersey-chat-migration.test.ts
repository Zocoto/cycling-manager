import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260903100000_add_federation_jerseys_and_lounge.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("federation jersey and lounge migration", () => {
  it("keeps the lounge private and all writes behind guarded RPCs", () => {
    expect(migration).toContain("create policy federation_chat_select_affiliated");
    expect(migration).toContain(
      "public.is_current_team_affiliated_with_country(country_id)",
    );
    expect(migration).not.toContain("create policy federation_chat_insert");
    expect(migration).toContain(
      "director.auth_user_id = (select auth.uid())",
    );
    expect(migration).toContain("security definer\nset search_path = ''");
  });

  it("rate-limits chat and uses its country cursor index", () => {
    expect(migration).toContain(
      "federation_chat_country_created_idx",
    );
    expect(migration).toContain("interval '2 seconds'");
    expect(migration).toContain("interval '1 minute'");
    expect(migration).toContain("pg_catalog.pg_advisory_xact_lock");
    expect(migration).toContain("add table public.federation_chat_messages");
  });

  it("publishes atomically, limits payloads and bounds jersey history", () => {
    expect(migration).toContain(
      "create or replace function public.publish_national_federation_jersey",
    );
    expect(migration).toContain("<> 'BE'");
    expect(migration).toContain("octet_length(p_design::text) > 20000");
    expect(migration).toContain("jsonb_array_length(p_design -> 'elements')");
    expect(migration).toContain("on conflict (country_id) do update");
    expect(migration).toContain("limit 12");
  });
});
