import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const tutorialCenter = readFileSync(
  join(
    process.cwd(),
    "components/tutorial/tutorial-center-menu.tsx",
  ),
  "utf8",
);

describe("tutorial center mobile layout", () => {
  it("reste contenu dans le viewport et conserve son propre défilement", () => {
    expect(tutorialCenter).toContain(
      "mobile-dock-clearance fixed inset-x-3 bottom-3",
    );
    expect(tutorialCenter).toContain(
      "bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
    );
    expect(tutorialCenter).toContain("max-h-[72vh]");
    expect(tutorialCenter).toContain("max-h-[min(72dvh,42rem)]");
    expect(tutorialCenter).toContain(
      "min-h-0 flex-1 overflow-y-auto overscroll-contain",
    );
  });

  it("conserve le menu ancré au header sur les écrans plus larges", () => {
    expect(tutorialCenter).toContain(
      "sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full",
    );
  });

  it("propose un fond mobile et une fermeture toujours visible", () => {
    expect(tutorialCenter).toContain(
      "fixed inset-0 z-[130] bg-[#071A17]/45",
    );
    expect(
      tutorialCenter.match(
        /aria-label=\{isEnglish \? "Close the tutorial centre" : "Fermer le centre des didacticiels"\}/g,
      ),
    ).toHaveLength(2);
    expect(tutorialCenter).toContain(
      'document.documentElement.style.overflow = "hidden"',
    );
  });
});
