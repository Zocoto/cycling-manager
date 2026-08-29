import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = read("app/jeu/transferts/page.tsx");
const service = read("services/transfer-market.ts");
const saleConsole = read(
  "components/game/director-rider-sale-console.tsx",
);

describe("regroupement des enchères et console vendeur", () => {
  it("regroupe les annonces quotidiennes et DS dans Enchères", () => {
    expect(page).toContain('{ id: "quotidiennes", label: "Enchères" }');
    expect(page).toContain("listings={overview.auctionListings}");
    expect(service).toContain("auctionListings: mappedListings");
  });

  it("réserve Vente de coureur au parcours vendeur", () => {
    expect(page).toContain('label: "Vente de coureur"');
    expect(page).toContain("listing.sellerTeamId === overview.teamId");
    expect(page).toContain('title="Coureurs en vente"');
    expect(saleConsole).toContain("window.confirm");
    expect(saleConsole).toContain("createDirectorListingAction");
  });

  it("identifie clairement chaque origine sur les tuiles", () => {
    for (const label of [
      "Enchère quotidienne",
      "Enchère fête nationale",
      "Enchère DS",
    ]) {
      expect(page).toContain(label);
    }
  });
});

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}
