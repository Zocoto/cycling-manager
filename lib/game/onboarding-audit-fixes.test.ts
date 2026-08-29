import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("correctifs issus de l’audit d’onboarding", () => {
  it("ne rend l’offre sponsor fictive qu’une seule fois", () => {
    const source = readSource("app/jeu/sponsoring/page.tsx");

    expect(source.match(/<TutorialSponsorPreview \/>/g)).toHaveLength(1);
  });

  it("masque l’e-mail par défaut tant que le profil initial n’est pas validé", () => {
    const formSource = readSource(
      "components/game/sporting-director-profile-form.tsx",
    );
    const pageSource = readSource("app/jeu/directeur-sportif/page.tsx");

    expect(formSource).toContain(
      "!initialCountryId || !initialIsEmailVisible",
    );
    expect(formSource).toContain(
      "defaultChecked={shouldHideEmailByDefault}",
    );
    expect(pageSource).toContain(
      "Boolean(sportingDirector.country_id) &&",
    );
  });

  it("présente l’assistant comme en attente avant la fondation de l’équipe", () => {
    const assistantSource = readSource(
      "components/game/dashboard-assistant.tsx",
    );
    const dashboardSource = readSource("app/jeu/page.tsx");

    expect(assistantSource).toContain("DashboardAssistantAwaitingTeam");
    expect(assistantSource).toContain(
      "votre point quotidien s’activera aussitôt",
    );
    expect(dashboardSource).toContain(
      "hasTeam={Boolean(teamAmateurIdentity || teamSummary)}",
    );
  });
});
