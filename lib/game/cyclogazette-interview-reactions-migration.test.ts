import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260816210000_create_interview_answer_reactions.sql",
  ),
  "utf8",
).replaceAll("\r\n", "\n");

describe("Cyclogazette interview answer reactions migration", () => {
  it("stores one toggle per DS, answer and emoji", () => {
    expect(migration).toContain(
      "primary key (\n    interview_id,\n    question_id,\n    sporting_director_id,\n    emoji\n  )",
    );
    expect(migration).toContain(
      "emoji in ('😂', '👏', '🔥', '🤝', '❤️')",
    );
    expect(migration).toContain(
      "toggle_post_race_interview_answer_reaction",
    );
  });

  it("allows only authenticated reactions on another DS's published answer", () => {
    expect(migration).toContain("if auth.uid() is null then");
    expect(migration).toContain("v_interview.status <> 'submitted'");
    expect(migration).toContain(
      "v_interview.sporting_director_id = v_director_id",
    );
    expect(migration).toContain(
      "from jsonb_array_elements(v_interview.answers) as answer",
    );
    expect(migration).toContain(
      "Vous ne pouvez pas réagir à votre propre interview.",
    );
  });
});
