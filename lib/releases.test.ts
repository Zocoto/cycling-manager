import { describe, expect, it } from "vitest";

import { latestRelease, releases } from "./releases";

describe("notes de version", () => {
  it("met la version 0.9.0 en tête des nouveautés", () => {
    expect(latestRelease.version).toBe("0.9.0");
    expect(latestRelease.anchor).toBe("gazette-games");
    expect(latestRelease.title).toContain("page des jeux");
  });

  it("présente les jeux, leurs gains, objectifs et trophée", () => {
    const details = latestRelease.features.join("\n");
    expect(details).toContain("Sudoku");
    expect(details).toContain("mots croisés");
    expect(details).toContain("1 000 €");
    expect(details).toContain("Six nouveaux objectifs");
    expect(details).toContain("Joueur invétéré");
  });

  it("detaille chaque nouveau batiment et les autres livraisons majeures", () => {
    const patch4 = releases.find((release) => release.version === "Patch #4");

    expect(patch4).toBeDefined();
    if (!patch4) {
      throw new Error("La note du Patch 4 doit rester disponible.");
    }


    const details = patch4.features.join("\n");
    for (const topic of [
      "Centre d\u2019entra\u00eenement",
      "Piste indoor",
      "Centre de cryoth\u00e9rapie",
      "Soufflerie",
      "Laboratoire R&D",
      "Centre d\u2019accueil international",
      "Centre m\u00e9t\u00e9o",
      "Media Center",
      "Championnats du monde",
      "Calendrier",
      "Contrats et sponsoring",
    ]) {
      expect(details).toContain(topic);
    }
  });
});
