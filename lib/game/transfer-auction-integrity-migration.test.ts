import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const auctionMigration = read(
  "supabase/migrations/20260824100000_bind_auction_bids_and_extend_late_closes.sql",
);
const repairMigration = read(
  "supabase/migrations/20260824101000_repair_gambo_foe_auction.sql",
);
const transferPage = read("app/jeu/transferts/page.tsx");

describe("intégrité des enchères", () => {
  it("rend la meilleure offre acceptée ferme à la clôture", () => {
    expect(auctionMigration).toContain(
      "order by candidate.amount desc, candidate.created_at asc",
    );
    expect(auctionMigration).toContain("limit 1");
    expect(auctionMigration).toContain(
      "perform public.complete_transfer_listing(",
    );
    expect(auctionMigration).not.toContain(
      "v_available >= v_bid.amount + v_listing.salary_per_season",
    );
    expect(auctionMigration).not.toContain(
      "get_projected_transfer_budget(v_team_season_id)",
    );
  });

  it("repousse chaque échéance de trente minutes après une offre tardive", () => {
    expect(auctionMigration).toContain(
      "v_listing.closes_at - now() < interval '10 minutes'",
    );
    expect(auctionMigration).toContain(
      "set closes_at = closes_at + interval '30 minutes'",
    );
    expect(transferPage).toContain(
      "toute offre placée dans les 10 dernières minutes repousse la fin de 30 minutes.",
    );
    expect(transferPage).toContain("autant de fois que nécessaire");
  });

  it("répare Foé, les deux trésoreries et les échéances futures", () => {
    expect(repairMigration).toContain(
      "v_altimax_bid constant numeric := 23200",
    );
    expect(repairMigration).toContain(
      "v_ecuador_bid constant numeric := 23700",
    );
    expect(repairMigration).toContain(
      "set team_id = v_ecuador_team_id",
    );
    expect(repairMigration).toContain("and status = 'pending'");
    expect(repairMigration).toContain("v_moved_salary_count <> 3");
    expect(repairMigration).toContain("cash_balance + v_altimax_bid");
    expect(repairMigration).toContain("cash_balance - v_ecuador_bid");
  });

  it("attribue un cadeau de niveau 6 ou 7 et un courrier à chaque DS", () => {
    expect(repairMigration).toContain("catalog.importance in (6, 7)");
    expect(repairMigration).toContain(
      "create table public.transfer_auction_compensation_grants",
    );
    expect(repairMigration).toContain("source_auction_compensation_id");
    expect(repairMigration).toContain(
      "insert into public.sporting_director_messages",
    );
    expect(repairMigration).toContain(
      "'auction-correction:' || v_listing_id::text || ':altimax'",
    );
    expect(repairMigration).toContain(
      "'auction-correction:' || v_listing_id::text || ':ecuador'",
    );
  });
});

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8").toLowerCase();
}
