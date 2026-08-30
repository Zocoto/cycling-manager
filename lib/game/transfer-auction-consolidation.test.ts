import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = read("app/jeu/transferts/page.tsx");
const service = read("services/transfer-market.ts");
const saleConsole = read(
  "components/game/director-rider-sale-console.tsx",
);
const riderProfile = read("app/jeu/coureurs/[identifiant]/page.tsx");
const listingCard = read("components/game/rider-transfer-listing-card.tsx");
const scoutingPanel = read("components/game/transfer-scouting-report.tsx");
const transferActions = read("app/jeu/transferts/actions.ts");

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

  it("propose aussi la mise en vente depuis la fiche du coureur", () => {
    expect(riderProfile).toContain("RiderTransferListingCard");
    expect(listingCard).toContain("createDirectorListingAction");
    expect(listingCard).toContain("Mettre en vente pendant 24 h");
    expect(listingCard).toContain("activeListing");
    expect(transferActions).toContain(
      "buildRiderReturnPath(requestedReturnPath, riderId)",
    );
  });

  it("révèle les notes exactes sur toutes les enchères créées par un DS", () => {
    expect(service).toContain(
      'revealExactValues: listing.listing_type === "director"',
    );
    expect(scoutingPanel).toContain('exactDataLabel = "Données exactes"');
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
