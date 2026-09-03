import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260903190000_allow_regenerated_sponsor_offers.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("régénération des offres sponsors", () => {
  it("libère les anciennes offres retirées et expirées", () => {
    expect(migration).toContain(
      "drop index if exists public.sponsor_offers_recipient_season_sponsor_unique_idx",
    );
    expect(migration).toContain(
      "where status in ('draft', 'open', 'accepted')",
    );
    expect(migration).not.toContain("'withdrawn'");
    expect(migration).not.toContain("'expired'");
  });

  it("conserve l'unicité des offres utilisables par destinataire", () => {
    expect(migration).toContain(
      "sporting_director_id,\n    season_id,\n    sponsor_id",
    );
  });
});
