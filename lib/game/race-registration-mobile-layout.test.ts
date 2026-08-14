import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const raceProfile = readProjectFile(
  "app/jeu/courses/[slug]/race-profile-content.tsx",
);
const rewardDetails = readProjectFile(
  "components/game/race-reward-details.tsx",
);

describe("mise en page mobile des inscriptions aux courses", () => {
  it("contraint la colonne d’inscription à la largeur du viewport", () => {
    expect(raceProfile).toContain(
      "grid min-w-0 grid-cols-1 gap-8 xl:grid-cols-",
    );
    expect(raceProfile).toContain(
      '<aside className="w-full min-w-0 max-w-full space-y-5">',
    );
    expect(rewardDetails).toContain(
      "group w-full min-w-0 max-w-full overflow-hidden",
    );
  });

  it("empile les libellés et valeurs sur téléphone avant de rétablir deux colonnes", () => {
    expect(raceProfile).toContain(
      "sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]",
    );
    expect(raceProfile).toContain("text-left text-sm font-black");
    expect(raceProfile).toContain("sm:text-right");
  });

  it("laisse les classements annexes revenir à la ligne sans élargir la page", () => {
    expect(raceProfile).toContain("flex min-w-0 flex-col items-start gap-2");
    expect(raceProfile).toContain("shrink-0 whitespace-nowrap rounded-full");
  });
});

function readProjectFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}
