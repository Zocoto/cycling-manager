import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readProjectFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("navigation vers les fiches de course", () => {
  it("partage le même composant serveur entre la page directe et la modale du calendrier", () => {
    const canonicalPage = readProjectFile(
      "app/jeu/courses/[slug]/page.tsx",
    );
    const interceptedPage = readProjectFile(
      "app/jeu/calendrier/@modal/(..)courses/[slug]/page.tsx",
    );
    const content = readProjectFile(
      "app/jeu/courses/[slug]/race-profile-content.tsx",
    );

    expect(canonicalPage).toContain(
      'from "./race-profile-content"',
    );
    expect(interceptedPage).toContain(
      'from "@/app/jeu/courses/[slug]/race-profile-content"',
    );
    expect(interceptedPage).not.toContain(
      'from "@/app/jeu/courses/[slug]/page"',
    );
    expect(content).toContain(
      "export async function RaceProfileContent",
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

  it("applique aussi le partage de contenu au Critérium du didacticiel", () => {
    const canonicalPage = readProjectFile(
      "app/jeu/courses/criterium-de-la-decouverte/page.tsx",
    );
    const interceptedPage = readProjectFile(
      "app/jeu/calendrier/@modal/(..)courses/criterium-de-la-decouverte/page.tsx",
    );

    expect(canonicalPage).toContain(
      'from "./criterium-race-content"',
    );
    expect(interceptedPage).toContain(
      'from "@/app/jeu/courses/criterium-de-la-decouverte/criterium-race-content"',
    );
    expect(interceptedPage).not.toContain(
      'from "@/app/jeu/courses/criterium-de-la-decouverte/page"',
    );
  });
});
