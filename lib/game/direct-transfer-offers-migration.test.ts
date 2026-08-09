import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260809140000_add_direct_transfer_offers_and_rider_dismissals.sql",
  ),
  "utf8",
);

describe("direct transfer offers and rider dismissals", () => {
  it("stores direct offers and exposes authenticated commands only", () => {
    expect(migration).toContain("create table public.direct_transfer_offers");
    expect(migration).toContain("direct_transfer_offers_one_pending_per_buyer_rider_idx");
    expect(migration).toContain("public.submit_direct_transfer_offer");
    expect(migration).toContain("public.respond_to_direct_transfer_offer");
    expect(migration).toContain(
      "grant execute on function public.submit_direct_transfer_offer(uuid, numeric)",
    );
  });

  it("reserves the transfer fee and first salary across both offer systems", () => {
    expect(migration).toContain("public.get_team_transfer_reserved_budget");
    expect(migration).toContain(
      "offer.offered_amount + offer.salary_per_season",
    );
    expect(migration).toContain(
      "v_amount + v_salary",
    );
    expect(migration).toContain(
      "p_amount + v_listing.salary_per_season",
    );
  });

  it("accepts atomically and records a one-season incoming contract", () => {
    expect(migration).toContain("set status = 'accepted'");
    expect(migration).toContain("'direct_offer'");
    expect(migration).toContain(
      "v_context.season_id, v_offer.salary_per_season",
    );
    expect(migration).toContain("transfer_fee");
    expect(migration).toContain("direct-transfer-purchase:");
    expect(migration).toContain("direct-transfer-sale:");
  });

  it("pays every remaining installment before making the rider a free agent", () => {
    expect(migration).toContain(
      "public.calculate_rider_dismissal_compensation",
    );
    expect(migration).toContain("pg_catalog.generate_series(1, 4)");
    expect(migration).toContain("public.dismiss_current_team_rider");
    expect(migration).toContain("'rider-dismissal:'");
    expect(migration).toContain("set status = 'free_agent'");
  });

  it("uses the existing mailbox and departure cleanup pipeline", () => {
    expect(migration).toContain("public.sporting_director_messages");
    expect(migration).toContain(
      "public.cancel_pending_direct_transfer_offers",
    );
    expect(migration).toContain("/jeu/transferts?onglet=offres");
    expect(migration).toContain("set status = 'terminated'");
    expect(migration).toContain("set status = 'cancelled'");
    expect(migration).not.toContain("pg_cron");
  });
});
