import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260919120000_expose_active_welcome_campaign.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("public welcome campaign projection", () => {
  it("n’expose que la campagne réellement active", () => {
    expect(migration).toContain(
      "statement_timestamp() >= campaign.starts_at",
    );
    expect(migration).toContain(
      "statement_timestamp() < campaign.ends_at",
    );
    expect(migration).toContain("limit 1");
  });

  it("garde les tables privées et réserve la lecture au serveur", () => {
    expect(migration).toContain(
      "from private.new_director_welcome_campaigns as campaign",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
