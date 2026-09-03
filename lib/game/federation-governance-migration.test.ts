import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260903230000_create_federation_elections.sql",
  ),
  "utf8",
);

describe("federation governance migration", () => {
  it("stores elections, the frozen electorate, secret votes, terms and journal entries", () => {
    expect(migration).toContain("create table public.national_federation_elections");
    expect(migration).toContain("create table public.national_federation_electorate");
    expect(migration).toContain("create table public.national_federation_candidates");
    expect(migration).toContain("create table public.national_federation_votes");
    expect(migration).toContain("create table public.national_federation_terms");
    expect(migration).toContain("create table public.national_federation_journal_entries");
    expect(migration).toContain("unique (election_id, team_id)");
    expect(migration).not.toContain("national_federation_votes_select_authenticated");
  });

  it("enforces the J21-J28 calendar and guarantees automatic governance", () => {
    expect(migration).toContain("not between 21 and 24");
    expect(migration).toContain("not between 25 and 28");
    expect(migration).toContain("then 'automatic'");
    expect(migration).toContain("'Gestion automatique reconduite'");
    expect(migration).toContain("country.iso_alpha2 = 'BE'");
  });

  it("keeps mutations bounded, serialized and idempotent", () => {
    expect(migration).toContain("set statement_timeout = '30s'");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("on conflict (source_reference) do nothing");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("sporting_director_messages");
  });
});
