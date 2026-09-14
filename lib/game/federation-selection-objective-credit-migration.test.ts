import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260914113000_persist_manual_federation_selection_credit.sql",
  ),
  "utf8",
);

describe("durable manual federation selection objective credit", () => {
  it("stores the first successful manual submission independently from the current mode", () => {
    expect(migration).toContain(
      "add column if not exists manually_submitted_at timestamptz",
    );
    expect(migration).toContain(
      "set manually_submitted_at = coalesce(manually_submitted_at, now())",
    );
  });

  it("repairs erased credit only from immutable manual publication journal entries", () => {
    expect(migration).toContain(
      "'federation-selection:' || selection_list.id::text || ':published:%'",
    );
    expect(migration).toContain(
      "set manually_submitted_at = manual_publication.first_submitted_at",
    );
  });

  it("aligns downstream federation scoring with the durable audit marker", () => {
    expect(migration).toContain(
      "public.get_national_federation_race_creation_score_base(uuid,uuid)",
    );
    expect(migration).toContain(
      "and selection_list.manually_submitted_at is not null",
    );
  });
});
