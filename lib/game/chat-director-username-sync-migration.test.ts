import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261003090000_sync_sporting_director_chat_username.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("sporting director chat username synchronization migration", () => {
  it("synchronise le @ lors d'un changement de nom sans écraser un identifiant explicite", () => {
    expect(migration).toContain(
      "before update of display_name on public.sporting_directors",
    );
    expect(migration).toContain(
      "new.username is not distinct from old.username",
    );
    expect(migration).toContain("new.username := new.display_name");
  });

  it("répercute le nouvel identifiant dans les mentions structurées existantes", () => {
    expect(migration).toContain(
      "after update of display_name, username on public.sporting_directors",
    );
    expect(migration).toContain(
      "when (old.username is distinct from new.username)",
    );
    expect(migration).toContain(
      "mention.mentioned_sporting_director_id = new.id",
    );
    expect(migration).toMatch(
      /refresh_sporting_director_chat_mentions\(\)[\s\S]*security definer/,
    );
    expect(migration).toContain(
      "'@' || old.username,\n    '@' || new.username",
    );
  });

  it("remplace uniquement le compte Giorgos vérifié par @Giorgos", () => {
    expect(migration).toContain(
      "'64ff2464-c0bd-48c0-b39a-04a600495a76'::uuid",
    );
    expect(migration).toContain("'giorgos testingopoulos'");
    expect(migration).toContain("'zocoto'");
    expect(migration).toContain("set username = 'Giorgos'");
    expect(migration).toContain(
      "L''identifiant public @Giorgos est déjà utilisé",
    );
  });
});
