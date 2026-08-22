import { describe, expect, it } from "vitest";

import { getMobileMoreNavigationGroups } from "./mobile-navigation";

describe("mobile navigation overflow", () => {
  it("retire les destinations déjà affichées dans le header et le dock", () => {
    const groups = getMobileMoreNavigationGroups([
      {
        label: "Essentiel",
        links: [
          ["Bureau", "/jeu"],
          ["Profil", "/jeu/directeur-sportif"],
        ],
      },
      {
        label: "Sportif",
        links: [
          ["Effectif", "/jeu/effectif"],
          ["Classements", "/jeu/classements"],
        ],
      },
      {
        label: "Communauté",
        links: [
          ["Chat", "/jeu/chat"],
          ["Recherche", "/jeu/recherche"],
        ],
      },
    ]);

    expect(groups).toEqual([
      {
        label: "Essentiel",
        links: [["Profil", "/jeu/directeur-sportif"]],
      },
      {
        label: "Sportif",
        links: [["Classements", "/jeu/classements"]],
      },
    ]);
  });
});
