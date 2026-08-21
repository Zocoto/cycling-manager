import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260821233000_add_negative_cyclogazette_reactions.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");

describe("Cyclogazette negative interview reactions migration", () => {
  it("extends both the table constraint and RPC whitelist", () => {
    const completePalette =
      "('😂', '👏', '🔥', '🤝', '❤️', '👎', '🙄', '😡', '🤡')";

    expect(migration).toContain(
      "drop constraint post_race_interview_answer_reactions_emoji_allowed",
    );
    expect(
      migration.match(new RegExp(escapeRegExp(completePalette), "gu")),
    ).toHaveLength(2);
  });

  it("preserves authenticated access and interview ownership protections", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("if auth.uid() is null then");
    expect(migration).toContain(
      "v_interview.sporting_director_id = v_director_id",
    );
    expect(migration).toContain(
      "grant execute\non function public.toggle_post_race_interview_answer_reaction(uuid, text, text)\nto authenticated",
    );
  });
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
