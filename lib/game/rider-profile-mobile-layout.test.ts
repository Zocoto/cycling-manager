import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const riderPage = readFileSync(
  join(process.cwd(), "app/jeu/coureurs/[identifiant]/page.tsx"),
  "utf8",
);

describe("mise en page mobile de la fiche coureur", () => {
  it("empêche l’historique d’élargir la grille et la carte Contrat", () => {
    expect(riderPage).toContain(
      'className="mt-7 grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]"',
    );
    expect(riderPage).toMatch(
      /data-tutorial-id="rider-profile-history"\s+className="min-w-0"/,
    );
    expect(riderPage).toMatch(
      /data-tutorial-id="rider-profile-contract"\s+className="min-w-0 space-y-5"/,
    );
  });

  it("affiche l’historique sous forme de cartes sans tableau large sur téléphone", () => {
    expect(riderPage).toContain(
      'className="grid gap-3 border-t border-[#315B3E]/10 bg-[#F3F8F5] p-4 md:hidden"',
    );
    expect(riderPage).toContain(
      'className="hidden max-w-full overflow-x-auto overscroll-x-contain border-t border-[#315B3E]/10 md:block"',
    );
    expect(riderPage).toContain("function MobileHistoryValue");
  });

  it("autorise le contenu du contrat à revenir à la ligne", () => {
    expect(riderPage).toContain(
      'className="min-w-0 max-w-full overflow-hidden rounded-[2rem] border border-[#D6A93D]/30',
    );
    expect(riderPage).toContain(
      '<dd className="min-w-0 break-words text-right font-black">',
    );
    expect(riderPage).toContain("w-full min-w-0 whitespace-normal");
  });
});