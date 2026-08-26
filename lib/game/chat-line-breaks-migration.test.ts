import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260826100000_preserve_chat_line_breaks.sql",
);

describe("chat line breaks migration", () => {
  const migration = readFileSync(migrationPath, "utf8").toLowerCase();

  it("normalizes horizontal whitespace without consuming newlines", () => {
    expect(migration).toContain(
      "create or replace function public.normalize_chat_message_text",
    );
    expect(migration).toContain("'[[:blank:]]+'");
    expect(migration).toContain("e' *\\n *'");
  });

  it.each([
    "public.post_global_chat_message(text,text,uuid)",
    "public.edit_current_global_chat_message(uuid,text,text,text)",
    "public.post_current_direct_message(uuid,text)",
    "public.edit_current_direct_message(uuid,text)",
  ])("patches %s", (signature) => {
    expect(migration).toContain(signature);
  });

  it("keeps the deployed function contracts and reloads the API schema", () => {
    expect(migration).toContain("pg_get_functiondef");
    expect(migration).toContain("overlay(");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });
});
