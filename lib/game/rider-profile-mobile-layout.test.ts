import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const riderPage = readFileSync(
  join(process.cwd(), "app/jeu/coureurs/[identifiant]/page.tsx"),
  "utf8",
);

const deferredProgression = readFileSync(
  join(process.cwd(), "components/game/deferred-rider-progression.tsx"),
  "utf8",
);
const progressionChart = readFileSync(
  join(process.cwd(), "components/game/rider-progression-chart.tsx"),
  "utf8",
);
const riderActions = readFileSync(
  join(process.cwd(), "app/jeu/coureurs/actions.ts"),
  "utf8",
);

describe("mise en page mobile de la fiche coureur", () => {
  it("retire le libellé technique tout en gardant l'aide alignée à droite", () => {
    expect(riderPage).not.toContain(
      "Fiche ouverte indépendamment de votre espace de jeu",
    );
    expect(riderPage).toContain('className="mb-4 flex justify-end"');
    expect(riderPage).toContain(
      "<TutorialLaunchButton tutorialKey={ROSTER_TUTORIAL_KEY} iconOnly />",
    );
  });

  it("sépare les maillots de champion de l’identité d’équipe sur PC et téléphone", () => {
    expect(riderPage).toContain(
      'lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center xl:grid-cols-[auto_minmax(0,1fr)_minmax(360px,400px)]',
    );
    expect(riderPage).toContain(
      'className="space-y-3 lg:col-span-2 xl:col-span-1"',
    );
    expect(riderPage).toContain("data-champion-jerseys");
    expect(riderPage).toContain(
      "grid-cols-[repeat(auto-fit,minmax(5rem,1fr))]",
    );
    expect(riderPage).toContain("data-current-team-identity");
    expect(riderPage).toContain(
      "grid-cols-[5rem_minmax(0,1fr)]",
    );
    expect(riderPage).toContain(
      "relative block min-w-0 overflow-hidden rounded-2xl",
    );
    expect(riderPage).not.toContain(
      "flex max-w-full shrink-0 flex-wrap items-end",
    );
  });

  it("équilibre les tuiles visibles et place la gestion sous le profil sportif", () => {
    expect(riderPage).toContain(
      'className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]"',
    );
    expect(riderPage).toContain(
      '<aside className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">',
    );
    expect(riderPage).toMatch(
      /data-tutorial-id="rider-profile-naturalization"[\s\S]*data-tutorial-id="rider-profile-contract"/,
    );
    expect(riderPage).toMatch(
      /data-tutorial-id="rider-profile-naturalization"\s+className="xl:col-span-2"/,
    );
    expect(riderPage).toContain(
      'className="grid min-w-0 gap-5 lg:grid-cols-2 xl:col-span-2"',
    );
    expect(riderPage).toContain('title="Palmarès et historique"');
    expect(riderPage).toContain('tutorialId="rider-profile-history"');
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

  it("charge le graphe au clic sans perturber la navigation mobile", () => {
    expect(riderPage).toContain("<DeferredRiderProgression");
    expect(riderPage).not.toContain("getRiderProgressionHistories");
    expect(deferredProgression).toContain("dynamic(");
    expect(deferredProgression).toContain("Afficher le graphe");
    expect(deferredProgression).not.toContain("fixed");
    expect(progressionChart).toContain("touch-pan-y");
    expect(progressionChart).toContain("overflow-x-clip");
    expect(riderActions).toContain("supabase.auth.getUser()");
    expect(riderActions).toContain("!profile.canManage");
  });
});
