import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const page = readFileSync(
  join(process.cwd(), "app/jeu/effectif/page.tsx"),
  "utf8",
);
const component = readFileSync(
  join(process.cwd(), "components/game/team-contract-management.tsx"),
  "utf8",
);
const action = readFileSync(
  join(process.cwd(), "app/jeu/effectif/actions.ts"),
  "utf8",
);

describe("roster contract management tab", () => {
  it("adds a dedicated third roster view", () => {
    expect(page).toContain('requestedView === "contrats"');
    expect(page).toContain('href="/jeu/effectif?vue=contrats"');
    expect(page).toContain("<TeamContractManagement");
  });

  it("keeps contractual columns out of the sporting roster view", () => {
    expect(page).not.toContain('sortKey="salary"');
    expect(page).not.toContain('sortKey="contract"');
    expect(page).not.toContain("rider.salary_per_season");
    expect(page).not.toContain("rider.contract_end_season_name");
  });

  it("loads roster enrichments in parallel without the obsolete dashboard summary", () => {
    const enrichmentBlock = page.slice(
      page.indexOf("const riderIds"),
      page.indexOf("const equipmentRatingBonusesByRiderId"),
    );

    expect(page).not.toContain("get_current_team_dashboard_summary");
    expect(enrichmentBlock).toContain("await Promise.all([");
    expect(enrichmentBlock.match(/\bawait\b/g)).toHaveLength(1);
    expect(enrichmentBlock).toContain("getActiveNationalChampionshipTitlesForRiders");
    expect(enrichmentBlock).toContain("getActiveContinentalChampionshipTitlesForRiders");
    expect(enrichmentBlock).toContain("getActiveWorldChampionshipTitlesForRiders");
    expect(enrichmentBlock).toContain("getRiderEquipmentEffectsByRiderId");
  });

  it("shows the bulk decision and every contract state", () => {
    expect(component).toContain("Prolongation groupée");
    expect(component).toContain("Prolonger les ${overview.eligibleCount} contrats");
    expect(component).toContain("Déjà prolongé");
    expect(component).toContain("Déjà couvert");
    expect(component).toContain("Départ programmé");
  });

  it("uses a server-derived bulk action without accepting rider identifiers", () => {
    expect(action).toContain('"renew_all_current_team_riders"');
    expect(action).not.toContain('formData.get("riderId")');
    expect(action).toContain('revalidatePath("/jeu/finances")');
  });
});
