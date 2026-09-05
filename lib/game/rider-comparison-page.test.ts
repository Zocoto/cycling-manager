import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const launcher = readFileSync(
  resolve(process.cwd(), "components/game/rider-comparison-launcher.tsx"),
  "utf8",
);
const view = readFileSync(
  resolve(process.cwd(), "components/game/rider-comparison-view.tsx"),
  "utf8",
);
const page = readFileSync(
  resolve(
    process.cwd(),
    "app/jeu/coureurs/[identifiant]/comparer/[comparaison]/page.tsx",
  ),
  "utf8",
);
const profilePage = readFileSync(
  resolve(process.cwd(), "app/jeu/coureurs/[identifiant]/page.tsx"),
  "utf8",
);
const rosterPage = readFileSync(
  resolve(process.cwd(), "app/jeu/effectif/page.tsx"),
  "utf8",
);

describe("rider comparison page", () => {
  it("launches a selected roster comparison in a new tab", () => {
    expect(launcher).toContain("Comparer à");
    expect(launcher).toContain("RiderComparisonOptionsContext");
    expect(launcher).toContain('window.open(');
    expect(launcher).toContain('"_blank"');
    expect(launcher).toContain('"noopener,noreferrer"');
    expect(profilePage).toContain("<RiderComparisonLauncher");
    expect(rosterPage).toContain("<RiderComparisonLauncher");
  });

  it("restricts the second rider to the authenticated director roster", () => {
    expect(page).toContain("getCurrentTeamRiderComparisonOptions(supabase)");
    expect(page).toContain("comparisonBelongsToViewerTeam");
    expect(page).toContain("sourceRiderId === comparisonRiderId");
    expect(page).toContain("notFound()");
  });

  it("renders two colored radars, red winner arrows and no management data", () => {
    expect(view).toContain('data-radar-layer="left-rider"');
    expect(view).toContain('data-radar-layer="right-rider"');
    expect(view).toContain("La flèche rouge pointe vers la meilleure valeur");
    expect(view).toContain("Nationalité");
    expect(view).toContain("Expérience de course");
    expect(view).not.toContain("privateContract");
    expect(view).not.toContain("RiderEquipmentLoadout");
    expect(view).not.toContain("CareerPalmares");
    expect(view).not.toContain("RiderTransferListing");
  });
});
