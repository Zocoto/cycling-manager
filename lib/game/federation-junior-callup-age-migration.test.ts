import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261002210000_guard_federation_junior_callup_age.sql",
  ),
  "utf8",
).replaceAll("\r", "");

describe("federation junior call-up age guard", () => {
  it("guards manual lists with the same inclusive 16-18 age rule", () => {
    expect(migration).toContain(
      "v_season.game_year - rider.birth_game_year between 16 and 18",
    );
    expect(migration).toContain(
      "public.save_national_federation_preselection(text,text,uuid[])",
    );
  });

  it("removes only active-season pending invalid invitations and their messages", () => {
    expect(migration).toContain("season.status = 'active'");
    expect(migration).toContain("member.response_status = 'pending'");
    expect(migration).toContain("not between 16 and 18");
    expect(migration).toContain("delete from public.sporting_director_messages");
    expect(migration).toContain(
      "delete from public.national_federation_selection_members",
    );
    expect(migration).not.toContain("response_status = 'confirmed'");
  });
});
