import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const homepage = readFileSync(join(root, "app/(public)/page.tsx"), "utf8");

describe("annonce publique de la Saison 3", () => {
  it("place la gestion fédérale avant l’ancienne annonce sans supprimer l’historique", () => {
    const seasonThree = homepage.indexOf(
      "La Saison 3 donne le pouvoir aux fédérations",
    );
    const previousAnnouncement = homepage.indexOf(
      "Le parrainage passe à la vitesse supérieure",
    );

    expect(seasonThree).toBeGreaterThan(-1);
    expect(previousAnnouncement).toBeGreaterThan(seasonThree);
    expect(homepage).toContain('href: "/jeu/federation"');
    expect(homepage).toContain(
      'image: "/images/announcements/saison-3-federations.webp"',
    );
  });

  it("livre le visuel web et le format Instagram avec sa publication", () => {
    expect(
      existsSync(
        join(
          root,
          "public/images/announcements/saison-3-federations.webp",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(root, "public/social/saison-3-federations-instagram.png"),
      ),
    ).toBe(true);
    expect(
      existsSync(join(root, "content/social/saison-3-federations-instagram.md")),
    ).toBe(true);
  });
});
