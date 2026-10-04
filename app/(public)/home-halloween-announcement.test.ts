import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const homepage = readFileSync(join(root, "app/(public)/page.tsx"), "utf8");

describe("annonce publique Halloween", () => {
  it("place l’Équipier sans tête en une, en français et en anglais", () => {
    const halloween = homepage.indexOf(
      "La nuit tombe : l’Équipier sans tête entre en chasse",
    );
    const seasonThree = homepage.indexOf(
      "La Saison 3 donne le pouvoir aux fédérations",
    );

    expect(halloween).toBeGreaterThan(-1);
    expect(halloween).toBeLessThan(seasonThree);
    expect(homepage).toContain("une ribambelle de gains");
    expect(homepage).toContain('dateLabel: "Bientôt"');
    expect(homepage).toContain('dateLabel: "Coming soon"');
    expect(homepage).not.toContain("Du 4 octobre au 2 novembre");
    expect(homepage).not.toContain("From 4 October to 2 November");
    expect(homepage).toContain(
      "Night falls: the Headless Domestique joins the chase",
    );
    expect(homepage).toContain("from eerie surprises to the rarest rewards");
  });

  it("utilise la capture réelle de l’événement déjà présent dans le jeu", () => {
    expect(
      existsSync(
        join(
          root,
          "public/images/announcements/halloween-2026-gameplay.png",
        ),
      ),
    ).toBe(true);
    expect(homepage).toContain(
      'image: "/images/announcements/halloween-2026-gameplay.png"',
    );
    expect(homepage).toContain('className="object-cover object-top"');
  });
});
