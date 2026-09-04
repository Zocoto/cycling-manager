import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260904020000_create_night_auction_trophy.sql",
  ),
  "utf8",
);

describe("night auction trophy migration", () => {
  it("awards every human participant when a daily auction reaches 22 h Paris time", () => {
    expect(migration).toContain("private.award_night_auction_trophies");
    expect(migration).toContain("v_listing.listing_type <> 'daily'");
    expect(migration).toContain("time '22:00') at time zone 'Europe/Paris'");
    expect(migration).toContain("from public.transfer_market_bids as bid");
    expect(migration).toContain("from public.alpha_bot_managers as bot");
    expect(migration).toContain("after insert on public.transfer_market_bids");
    expect(migration).toContain(
      "after update of closes_at on public.transfer_market_listings",
    );
    expect(migration).toContain(
      "after update of status on public.transfer_market_listings",
    );
    expect(migration).toContain("or v_now < (");
  });

  it("is idempotent and backfills auctions that already reached the threshold", () => {
    expect(migration).toContain(
      "on conflict (sporting_director_id, trophy_key) do nothing",
    );
    expect(migration).toContain("select listing.id");
    expect(migration).toContain(
      "perform private.award_night_auction_trophies(v_listing.id)",
    );
  });

  it("credits the announced gains and protects the Cernes skin in the database", () => {
    expect(migration).toContain("experience_points = experience_points + 250");
    expect(migration).toContain("reputation_points = reputation_points + 15");
    expect(migration).toContain("cash_balance = cash_balance + 50000");
    expect(migration).toContain("v_cheek_key <> 'dark-circles'");
    expect(migration).toContain("'.',\n    11");
    expect(migration).toContain("trophy_key = 'jusqu_au_bout_de_la_nuit'");
    expect(migration).toContain("le skin Cernes pour votre avatar");
  });
});
