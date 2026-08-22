import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readProjectFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("navigation vers les fiches de course", () => {
  it("utilise uniquement la page canonique pour une course standard", () => {
    const canonicalPage = readProjectFile(
      "app/jeu/courses/[slug]/page.tsx",
    );
    const content = readProjectFile(
      "app/jeu/courses/[slug]/race-profile-content.tsx",
    );

    expect(canonicalPage).toContain(
      'from "./race-profile-content"',
    );
    expect(content).toContain(
      "export async function RaceProfileContent",
    );
    expect(content).toContain('id="inscription"');
  });

  it("interdit le retour d'une route de course interceptee sous le calendrier", () => {
    expect(
      existsSync(
        join(
          process.cwd(),
          "app/jeu/calendrier/@modal",
        ),
      ),
    ).toBe(false);
    expect(
      existsSync(
        join(
          process.cwd(),
          "components/game/course-modal.tsx",
        ),
      ),
    ).toBe(false);
  });

  it("force les inscriptions a quitter l'arbre de navigation client", () => {
    const appLink = readProjectFile(
      "components/ui/app-link.tsx",
    );

    expect(appLink).toContain(
      "isRaceRegistrationHref",
    );
    expect(appLink).toContain(
      'data-navigation-mode="document"',
    );
    expect(appLink).toContain("<a");
  });

  it("conserve aussi une page canonique dediee au Criterium du didacticiel", () => {
    const canonicalPage = readProjectFile(
      "app/jeu/courses/criterium-de-la-decouverte/page.tsx",
    );

    expect(canonicalPage).toContain(
      'from "./criterium-race-content"',
    );
  });

  it("utilise les claims locaux sur le premier rendu serveur de la course", () => {
    const content = readProjectFile(
      "app/jeu/courses/[slug]/race-profile-content.tsx",
    );

    expect(content).toContain(
      'import { getAuthenticatedUser } from "@/lib/supabase/authenticated-user"',
    );
    expect(content).toContain(
      "await getAuthenticatedUser(supabase)",
    );
    expect(content).not.toContain(".auth.getUser(");
  });

  it("limite le chargement du calendrier à la course demandée", () => {
    const content = readProjectFile(
      "app/jeu/courses/[slug]/race-profile-content.tsx",
    );

    expect(content).toContain("getActiveSeasonRaceCalendar(supabase, new Date(), {");
    expect(content).toContain("raceSlug: slug");
  });
});
