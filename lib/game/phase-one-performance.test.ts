import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("phase one performance safeguards", () => {
  it("keeps selection maintenance in the settlement cron, not the page read", () => {
    const page = readSource("app/jeu/selections-internationales/page.tsx");
    const cron = readSource("app/api/cron/race-settlements/[slot]/route.ts");

    expect(page).toContain("processDue: false");
    expect(cron).toContain("processDueInternationalChampionshipSelections(now)");
  });

  it("defers offscreen painting on the heaviest repeated cards", () => {
    for (const source of [
      readSource("app/jeu/entrainement/page.tsx"),
      readSource("app/jeu/effectif/page.tsx"),
      readSource("components/game/equipment-commercial-shop.tsx"),
    ]) {
      expect(source).toContain("[content-visibility:auto]");
      expect(source).toContain("[contain-intrinsic-size:auto_");
    }
  });

  it("lifts training-card paint containment while a report is consulted", () => {
    const trainingPage = readSource("app/jeu/entrainement/page.tsx");

    expect(trainingPage).toContain("hover:[content-visibility:visible]");
    expect(trainingPage).toContain("focus-within:[content-visibility:visible]");
    expect(trainingPage).toContain(
      "has-[details[open]]:[content-visibility:visible]",
    );
  });
});
