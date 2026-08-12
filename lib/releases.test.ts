import { describe, expect, it } from "vitest";

import { latestRelease } from "./releases";

describe("Patch 4 release note", () => {
  it("detaille chaque nouveau batiment et les autres livraisons majeures", () => {
    expect(latestRelease.version).toBe("Patch #4");

    const details = latestRelease.features.join("\n");
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
