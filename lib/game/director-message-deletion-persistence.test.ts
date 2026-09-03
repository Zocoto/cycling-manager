import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260904013000_preserve_deleted_director_messages.sql",
  ),
  "utf8",
).toLowerCase();

describe("durable director message deletion", () => {
  it("records an individual deletion before removing the message", () => {
    const functionStart = migration.indexOf(
      "create or replace function public.delete_current_director_message(",
    );
    const tombstoneInsert = migration.indexOf(
      "insert into public.sporting_director_message_deletions",
      functionStart,
    );
    const messageDelete = migration.indexOf(
      "delete from public.sporting_director_messages",
      functionStart,
    );

    expect(tombstoneInsert).toBeGreaterThan(functionStart);
    expect(messageDelete).toBeGreaterThan(tombstoneInsert);
  });

  it("records every message included in a bulk cleanup", () => {
    const functionStart = migration.indexOf(
      "create or replace function public.delete_current_director_messages(",
    );
    const functionBody = migration.slice(functionStart);

    expect(functionBody).toContain(
      "insert into public.sporting_director_message_deletions",
    );
    expect(functionBody).toContain(
      "on conflict (sporting_director_id, source_reference)",
    );
    expect(functionBody).toContain(
      "when 'older_than_7_days' then message.sent_at < now() - interval '7 days'",
    );
  });

  it("blocks every automatic producer from recreating a deleted source", () => {
    expect(migration).toContain(
      "before insert on public.sporting_director_messages",
    );
    expect(migration).toContain(
      "deletion.source_reference = new.source_reference",
    );
    expect(migration).toContain("return null;");
  });

  it("keeps system expiration separate from an explicit DS deletion", () => {
    expect(migration).not.toContain(
      "create or replace function public.purge_expired_director_messages",
    );
  });
});
