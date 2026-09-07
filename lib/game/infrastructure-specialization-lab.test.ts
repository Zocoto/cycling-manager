import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FEDERATION_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS,
  TEAM_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS,
} from "./infrastructure-specializations";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("laboratoire privé des spécialisations", () => {
  it("propose trois choix de puissance égale pour chaque bâtiment", () => {
    expect(TEAM_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS).toHaveLength(13);
    expect(FEDERATION_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS).toHaveLength(9);

    for (const proposal of [
      ...TEAM_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS,
      ...FEDERATION_INFRASTRUCTURE_SPECIALIZATION_PROPOSALS,
    ]) {
      expect(proposal.options).toHaveLength(3);
      expect(new Set(proposal.options.map((option) => option.code)).size).toBe(3);
      expect(proposal.options.every((option) => option.powerBudget === 100)).toBe(true);
      expect(proposal.options.every((option) => option.guardrail.length > 0)).toBe(true);
    }
  });

  it("protège la page côté serveur avec l’identité authentifiée de Roger", () => {
    const page = read("app/jeu/laboratoire-specialisations/page.tsx");

    expect(page).toContain("PRIVATE_REVIEWER_DIRECTOR_ID");
    expect(page).toContain('.eq("auth_user_id", user.id)');
    expect(page).toContain("notFound()");
    expect(page).toContain("robots: { index: false, follow: false }");
  });

  it("reste débranché du gameplay et absent des navigations", () => {
    const lab = read("components/game/infrastructure-specialization-lab.tsx");
    const desktopNavigation = read("components/game/game-navigation-menu.tsx");
    const mobileNavigation = read("components/game/mobile-game-navigation.tsx");

    expect(lab).toContain('data-persistence="local-only"');
    expect(lab).not.toContain("<form");
    expect(lab).not.toContain("action=");
    expect(desktopNavigation).not.toContain("laboratoire-specialisations");
    expect(mobileNavigation).not.toContain("laboratoire-specialisations");
  });
});
