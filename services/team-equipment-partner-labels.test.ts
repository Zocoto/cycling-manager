import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const partnerService = readFileSync(
  new URL("./team-equipment-partner.ts", import.meta.url),
  "utf8",
);
const partnerPage = readFileSync(
  new URL("../app/jeu/materiel/equipementier/page.tsx", import.meta.url),
  "utf8",
);

describe("libellés des bonus équipementier", () => {
  it("nomme la statistique breakaway Baroudeur dans tous les affichages", () => {
    expect(partnerService).toContain('breakaway: "Baroudeur"');
    expect(partnerPage).toContain('breakaway: "Baroudeur"');
    expect(partnerService).not.toContain('breakaway: "Échappée"');
    expect(partnerPage).not.toContain('breakaway: "Échappée"');
  });

  it("conserve le libellé distinct de réputation en échappée", () => {
    expect(partnerPage).toContain("réputation en échappée");
  });
});
