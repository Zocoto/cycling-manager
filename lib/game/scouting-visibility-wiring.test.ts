import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("branchement de la Loupe du recruteur", () => {
  it("révèle uniquement les coureurs libres sur le marché", () => {
    const service = read("services/transfer-market.ts");

    expect(service).toContain(
      "scoutingVisibility.active && listing.seller_team_id === null",
    );
    expect(service).toContain(
      "scoutingVisibility.active && searchRow.team_id === null",
    );
  });

  it("utilise le rapport exact pour les candidats juniors", () => {
    const service = read("services/youth-development.ts");

    expect(service).toContain("scoutingVisibility.active");
    expect(service).toMatch(
      /scoutingReport: revealExactValues[\s\S]*createExactTransferScoutingReport/,
    );
  });

  it("couvre aussi la fiche et l’aperçu rapide d’un coureur libre", () => {
    const profile = read("services/public-rider-profile.ts");
    const preview = read("services/rider-quick-preview.ts");

    expect(profile).toContain(
      'rider.status === "free_agent" && scoutingVisibility.active',
    );
    expect(preview).toContain(
      'rider.status === "free_agent" && scoutingVisibility.active',
    );
  });
});
