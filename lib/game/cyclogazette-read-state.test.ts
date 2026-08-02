import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260802091000_add_cyclogazette_read_receipts.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("accusés de lecture de La Cyclogazette", () => {
  it("conserve un reçu durable par Directeur Sportif", () => {
    expect(migration).toContain(
      "create table public.cyclogazette_read_receipts",
    );
    expect(migration).toContain("sporting_director_id uuid primary key");
    expect(migration).toContain("last_read_edition_id uuid");
    expect(migration).toContain("last_read_published_at timestamptz not null");
  });

  it("protège la lecture et l’écriture derrière des RPC authentifiées", () => {
    expect(migration).toContain(
      "create or replace function public.has_unread_cyclogazette_editions()",
    );
    expect(migration).toContain(
      "create or replace function public.mark_cyclogazette_read(\n  p_edition_id uuid default null\n)",
    );
    expect(migration).toContain("security definer\nset search_path = ''");
    expect(migration).toContain("to authenticated, service_role");
    expect(migration).toContain("or edition.id = p_edition_id");
    expect(migration).toContain("greatest(");
  });

  it("active la notification temps réel des nouvelles éditions", () => {
    expect(migration).toContain("alter publication supabase_realtime");
    expect(migration).toContain("add table public.cyclogazette_editions");
  });
});
