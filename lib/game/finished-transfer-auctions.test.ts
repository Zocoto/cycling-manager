import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const page = read("app/jeu/transferts/page.tsx");
const service = read("services/transfer-market.ts");

describe("historique journalier des enchères terminées", () => {
  it("conserve les ventes DS clôturées pendant la journée en cours", () => {
    expect(service).toContain("recentlyEndedCutoff");
    expect(service).toContain(
      "and(listing_type.eq.director,status.neq.open,closes_at.gte.${recentlyEndedCutoff})",
    );
    expect(service).toContain("isTransferListingVisibleOnMarketDate");
    expect(service).toContain("listing.settled_at ?? listing.closes_at");
  });

  it("place toujours les enchères actives avant les enchères terminées", () => {
    expect(service).toContain("mappedListings.sort(compareTransferMarketListings)");
    expect(service).toContain(
      "if (leftIsOpen !== rightIsOpen) return leftIsOpen ? -1 : 1",
    );
    expect(page.indexOf("activeListings.map")).toBeLessThan(
      page.indexOf("finishedListings.map"),
    );
  });

  it("grise et estampille explicitement les enchères terminées", () => {
    expect(page).toContain('data-auction-status={isFinished ? "finished" : "active"}');
    expect(page).toContain("Enchère terminée");
    expect(page).toContain("Enchères terminées");
    expect(page).toContain("Équipe gagnante");
    expect(page).toContain("bg-[#E9ECEA]/70");
  });

  it("affiche le résultat officiel et garde la console vendeur active uniquement", () => {
    expect(service).toContain("listing.winning_team_id");
    expect(service).toContain("toNumber(listing.winning_bid)");
    expect(page).toContain('listing.status === "open"');
  });
});

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}
