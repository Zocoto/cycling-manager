import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const riderPage = readFileSync(
  join(process.cwd(), "app/jeu/coureurs/[identifiant]/page.tsx"),
  "utf8",
);

describe("mise en page mobile de la fiche coureur", () => {
  it("place le contrat dans la colonne latérale et libère toute la largeur pour l’historique", () => {
    expect(riderPage).toContain(
      'className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]"',
    );
    expect(riderPage).toMatch(
      /data-tutorial-id="rider-profile-naturalization"[\s\S]*data-tutorial-id="rider-profile-contract"/,
    );
    expect(riderPage).toMatch(
      /data-tutorial-id="rider-profile-contract"\s+className="min-w-0 space-y-5"/,
    );
    expect(riderPage).toMatch(
      /data-tutorial-id="rider-profile-history"\s+className="mt-6 min-w-0"/,
    );
    expect(riderPage).not.toContain(
      "lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]",
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