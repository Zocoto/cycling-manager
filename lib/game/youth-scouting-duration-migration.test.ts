import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260801100000_enforce_youth_scouting_minimum_duration.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("youth scouting minimum duration migration", () => {
  it("refuse les missions de moins de trois jours dans la fonction SQL", () => {
    expect(migration).toContain(
      "if p_duration_days not between 3 and 7 then",
    );
    expect(migration).toContain(
      "La mission doit durer entre 3 et 7 jours.",
    );
    expect(migration).not.toContain(
      "if p_duration_days not between 1 and 7 then",
    );
  });

  it("conserve les protections et les droits de la fonction", () => {
    expect(migration).toContain("security definer\nset search_path = public");
    expect(migration).toContain(
      "from public, anon;\ngrant execute on function",
    );
    expect(migration).toContain("to authenticated, service_role;");
  });
});
