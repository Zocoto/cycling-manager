import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const page = readFileSync(
  join(process.cwd(), "app/jeu/parrainage/page.tsx"),
  "utf8",
);

describe("referral exclusive rewards presentation", () => {
  it("shows the Fedora as a distinct gain below the Patron outfit", () => {
    const outfitIndex = page.indexOf("Tenue du Parrain");
    const fedoraIndex = page.indexOf("Fedora du Don");

    expect(outfitIndex).toBeGreaterThan(-1);
    expect(fedoraIndex).toBeGreaterThan(outfitIndex);
    expect(page).toContain("<PatronFedoraIcon");
    expect(page).toContain("25 filleuls");
  });

  it("keeps both locked and unlocked states explicit", () => {
    expect(page).toContain("Fedora débloqué");
    expect(page).toContain("avant ce gain");
    expect(page).toContain("overview.patronHatUnlocked");
  });
});
