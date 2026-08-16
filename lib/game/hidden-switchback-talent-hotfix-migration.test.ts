import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260816170000_fix_hidden_switchback_talent_dossier.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");

describe("hidden switchback talent dossier hotfix", () => {
  it("restores the advertised one-star boost", () => {
    expect(migration).toContain("item.item_key = 'classified-talent-dossier'");
    expect(migration).toContain("'{potentialBonus}'");
    expect(migration).toContain("'1'::jsonb");
  });

  it("repairs only applications that recorded the erroneous four steps", () => {
    expect(migration).toContain("application.potential_bonus = 4");
    expect(migration).toContain(
      "rider.potential_steps - affected.application_count * 2",
    );
    expect(migration).toContain("set potential_bonus = 2");
  });
});
