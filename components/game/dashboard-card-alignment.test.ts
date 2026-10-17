import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const dashboardPage = readFileSync(
  join(process.cwd(), "app/jeu/page.tsx"),
  "utf8",
);

describe("alignement des cartes principales du bureau", () => {
  it("makes the DS portrait prominent and keeps identity and sponsor columns flexible", () => {
    const identity = dashboardPage.slice(
      dashboardPage.indexOf("function DirectorIdentity("),
      dashboardPage.indexOf("function TeamSponsorInformation("),
    );
    expect(identity).toContain('size="dashboard"');
    expect(identity).toContain("h-24 w-24");
    expect(identity).toContain("sm:h-32 sm:w-32");
    expect(identity).toContain("break-words");
    expect(identity).not.toContain("truncate text-xl");
    expect(dashboardPage).toContain("md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]");
    expect(dashboardPage).not.toContain("pt-1 sm:min-w-40");
    expect(dashboardPage).toContain('data-tutorial-id="dashboard-director-profile"');
  });

  it("étire la carte Effectif jusqu’au bas de la carte du DS sur desktop", () => {
    expect(dashboardPage).toContain(
      'className="grid gap-4 sm:gap-6 xl:h-full xl:grid-rows-[auto_1fr]"',
    );
    expect(dashboardPage).toContain(
      "group relative isolate flex h-full flex-col",
    );
    expect(dashboardPage).not.toContain(
      'className="grid content-start gap-6"',
    );
  });

  it("affiche deux rangees de cinq mini-avatars sans deborder sur mobile", () => {
    expect(dashboardPage).toContain(".slice(0, 11)");
    expect(dashboardPage).toContain("riders.slice(1, 6)");
    expect(dashboardPage).toContain("riders.slice(6, 11)");
    expect(dashboardPage).toContain(
      'className="h-8 w-8 border-2 border-[#9BE0BC]/40 shadow-lg sm:h-12 sm:w-12"',
    );
    expect(dashboardPage).toContain(
      'className="flex items-center justify-center gap-1.5 sm:gap-3"',
    );
  });

  it("explicite la boutique dans la rubrique Fanclub", () => {
    expect(dashboardPage).toContain('title="Fanclub / Boutique"');
    expect(dashboardPage).not.toContain('title="Fan Club"');
  });

  it("réserve le raccourci du maillot amateur aux équipes sans sponsor actif", () => {
    expect(dashboardPage).toContain(
      "{!teamSponsorIdentity ? <JerseyShortcut /> : null}",
    );
    expect(dashboardPage.match(/<JerseyShortcut \/>/g)).toHaveLength(1);
    expect(dashboardPage).toContain('href="/jeu/maillot"');
    expect(dashboardPage).toContain("getActiveTeamSponsorIdentity(dashboardTeamId)");
  });
});
