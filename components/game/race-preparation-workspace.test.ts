import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "components/game/race-preparation-workspace.tsx"),
  "utf8",
);

describe("race preparation individual missions", () => {
  it("consolidates leader protection into the race lieutenant", () => {
    expect(source).toContain('name="lieutenantRiderId"');
    expect(source).toContain(
      "Protège le leader et l’accompagne dans les moments décisifs.",
    );
    expect(source).not.toContain('name="protectorRiderId"');
    expect(source).not.toContain('label="Protecteur du leader"');
  });

  it("recovers a legacy protector as the lieutenant when editing a plan", () => {
    expect(source).toContain(
      "strategy.lieutenantRiderId ?? strategy.protectorRiderId ??",
    );
  });

  it("regroupe profil, préparatifs et équipements sous chaque étape", () => {
    expect(source).toContain("<StageProfileOverview stage={stage} />");
    expect(source).toContain("Préparatifs sportifs");
    expect(source).toContain("<StageEquipmentSection");
    expect(source).not.toContain("Un montage adapté à chaque étape");
  });
});
