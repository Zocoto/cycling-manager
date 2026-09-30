import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260930103000_mark_deleted_director_messages_read.sql",
  ),
  "utf8",
).toLowerCase();

describe("director message read lifecycle", () => {
  it("acquitte un message avant sa suppression individuelle", () => {
    const functionStart = migration.indexOf(
      "create or replace function public.delete_current_director_message(",
    );
    const markRead = migration.indexOf(
      "set read_at = coalesce(message.read_at, now())",
      functionStart,
    );
    const messageDelete = migration.indexOf(
      "delete from public.sporting_director_messages",
      functionStart,
    );

    expect(markRead).toBeGreaterThan(functionStart);
    expect(messageDelete).toBeGreaterThan(markRead);
  });

  it("acquitte aussi les messages compris dans un nettoyage collectif", () => {
    const functionStart = migration.indexOf(
      "create or replace function public.delete_current_director_messages(",
    );
    const functionBody = migration.slice(functionStart);
    const markRead = functionBody.indexOf(
      "set read_at = coalesce(message.read_at, now())",
    );
    const tombstones = functionBody.indexOf(
      "insert into public.sporting_director_message_deletions",
    );
    const messageDelete = functionBody.indexOf(
      "delete from public.sporting_director_messages",
    );

    expect(markRead).toBeGreaterThan(0);
    expect(tombstones).toBeGreaterThan(markRead);
    expect(messageDelete).toBeGreaterThan(tombstones);
  });
});
