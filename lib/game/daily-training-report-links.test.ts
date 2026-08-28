import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("daily training report entry points", () => {
  it("links the senior and junior sections to their dedicated reports", () => {
    const trainingPage = readFileSync(
      "app/jeu/entrainement/page.tsx",
      "utf8",
    );
    const academyPage = readFileSync(
      "app/jeu/centre-de-formation/page.tsx",
      "utf8",
    );
    const assistant = readFileSync(
      "lib/game/dashboard-assistant.ts",
      "utf8",
    );

    expect(trainingPage).toContain('href="/jeu/entrainement/rapport"');
    expect(academyPage).toContain(
      'href="/jeu/centre-de-formation/rapport-entrainement"',
    );
    expect(assistant).toContain('href: "/jeu/entrainement/rapport"');
    expect(assistant).toContain(
      'href: "/jeu/centre-de-formation/rapport-entrainement"',
    );
  });
});
