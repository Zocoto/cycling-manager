import { describe, expect, it } from "vitest";

import {
  buildInventoryReturnPath,
  buildObjectivesReturnPath,
  buildStaffMarketReturnPath,
  buildTransferMarketReturnPath,
  sanitizeInventoryReturnPath,
  sanitizeObjectivesReturnPath,
  sanitizeStaffMarketReturnPath,
  sanitizeTransferMarketReturnPath,
  withPageFeedback,
} from "@/lib/game/filtered-page-paths";

describe("filtered page return paths", () => {
  it("conserve tous les filtres valides du marché des transferts", () => {
    const path = buildTransferMarketReturnPath("libres", {
      profile: "Grimpeur",
      country: "fr",
      minimumAge: 20,
      maximumAge: 27,
      rating: "mountain",
      minimumRating: 70,
    });

    expect(path).toBe(
      "/jeu/transferts?onglet=libres&profil=Grimpeur&pays=FR&ageMin=20&ageMax=27&stat=mountain&statMin=70",
    );
    expect(sanitizeTransferMarketReturnPath(`${path}&succes=ancien`)).toBe(path);
  });

  it("ne transporte aucun filtre vers une autre page", () => {
    expect(
      sanitizeTransferMarketReturnPath(
        "/jeu/staff?onglet=marche&metier=trainer",
      ),
    ).toBe("/jeu/transferts?onglet=quotidiennes");
    expect(
      sanitizeStaffMarketReturnPath(
        "//example.com/jeu/staff?onglet=marche&niveau=5",
      ),
    ).toBe("/jeu/staff?onglet=marche");
  });

  it("conserve les filtres du staff après un recrutement", () => {
    const path = buildStaffMarketReturnPath({
      search: "  Martin  ",
      role: "trainer",
      level: 4,
      countryCode: "be",
      trainerSpecialty: "mountain",
    });

    expect(path).toBe(
      "/jeu/staff?onglet=marche&recherche=Martin&metier=trainer&niveau=4&pays=BE&specialite=mountain",
    );
    expect(sanitizeStaffMarketReturnPath(`${path}&erreur=ancienne`)).toBe(path);
  });

  it("conserve les filtres des objectifs et leur ancre", () => {
    const path = buildObjectivesReturnPath({
      type: "secondary",
      status: "completed",
      group: "equipment",
    });

    expect(path).toBe(
      "/jeu/objectifs?type=secondary&statut=completed&groupe=equipment#objectives-list",
    );
    expect(sanitizeObjectivesReturnPath(path)).toBe(path);
  });

  it("conserve uniquement la catégorie active de l’inventaire", () => {
    const path = buildInventoryReturnPath("potential_boost");

    expect(path).toBe("/jeu/inventaire?categorie=potential_boost");
    expect(
      sanitizeInventoryReturnPath(`${path}&erreur=ancienne&inconnu=1`),
    ).toBe(path);
  });

  it("ajoute le retour utilisateur sans effacer les filtres ni l’ancre", () => {
    expect(
      withPageFeedback(
        "/jeu/objectifs?statut=completed#objectives-list",
        "succes",
        "Récompense récupérée",
      ),
    ).toBe(
      "/jeu/objectifs?statut=completed&succes=R%C3%A9compense+r%C3%A9cup%C3%A9r%C3%A9e#objectives-list",
    );
  });
});
