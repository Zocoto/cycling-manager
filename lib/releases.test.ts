import { describe, expect, it } from "vitest";

import { latestRelease, releases } from "./releases";

describe("notes de version", () => {
  it("met le Patch 5 en tête des nouveautés", () => {
    expect(latestRelease.version).toBe("0.8.0 · Patch #5");
    expect(latestRelease.anchor).toBe("patch-5");
    expect(latestRelease.title).toContain("change de braquet");
  });

  it("présente le Patch 5 par thèmes sans axe de communication technique", () => {
    const details = latestRelease.features.join("\n");

    for (const topic of [
      "Courses et directs",
      "Calendrier et championnats",
      "Infrastructures et staff",
      "Santé et formation",
      "Sponsors, finances et Fan Club",
      "Matériel et inventaire",
      "Progression et palmarès",
      "Mobile, accessibilité et confort",
    ]) {
      expect(details).toContain(topic);
    }

    expect(
      [latestRelease.title, latestRelease.description, details].join("\n"),
    ).not.toMatch(/performances?|fiabilit/i);
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
