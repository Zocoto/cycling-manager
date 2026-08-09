import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260809163000_backfill_named_global_chat_reactions.sql",
  ),
  "utf8",
);

const service = readFileSync(
  resolve(process.cwd(), "services/global-chat.ts"),
  "utf8",
);

describe("global chat named reactions hotfix", () => {
  it("adds and backfills columns when the reactions table already exists", () => {
    expect(migration).toContain(
      "add column if not exists reactor_display_name text",
    );
    expect(migration).toContain("add column if not exists team_id uuid");
    expect(migration).toContain(
      "add column if not exists team_display_name text",
    );
    expect(migration).toContain(
      "update public.global_chat_message_reactions as reaction",
    );
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it("keeps the message feed available if optional reactions fail", () => {
    expect(service).toMatch(
      /if \(reactionsResult\.error\) \{[\s\S]*console\.error\([\s\S]*return result;/,
    );
  });
});
