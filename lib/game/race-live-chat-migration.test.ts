import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260730170000_persist_race_chat_across_stages.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("race live chat persistence migration", () => {
  it("rattache les anciens messages a leur edition de course", () => {
    expect(migration).toContain(
      "add column race_edition_id uuid",
    );
    expect(migration).toContain(
      "set race_edition_id = stage.race_edition_id",
    );
    expect(migration).toContain(
      "alter column race_edition_id set not null",
    );
  });

  it("indexe le salon commun a toutes les etapes", () => {
    expect(migration).toContain(
      "on public.race_live_messages (race_edition_id, created_at desc)",
    );
  });

  it("refuse de rattacher un message a la mauvaise edition", () => {
    expect(migration).toContain(
      "create or replace function public.ensure_race_live_message_edition()",
    );
    expect(migration).toContain(
      "new.race_edition_id <> v_race_edition_id",
    );
    expect(migration).toContain(
      "before insert or update of stage_id, race_edition_id",
    );
  });
});
