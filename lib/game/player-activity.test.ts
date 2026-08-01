import { describe, expect, it } from "vitest";

import {
  PLAYER_ACTIVITY_MONITOR_ALLOWED_EMAIL,
  canAccessPlayerActivityMonitoring,
  getPlayerActivitySection,
  normalizePlayerActivityInput,
  normalizePlayerActivityLabel,
  normalizePlayerActivityRoute,
} from "@/lib/game/player-activity";

describe("accès au monitoring d’activité", () => {
  it("autorise uniquement le compte administrateur prévu", () => {
    expect(
      canAccessPlayerActivityMonitoring(PLAYER_ACTIVITY_MONITOR_ALLOWED_EMAIL),
    ).toBe(true);
    expect(
      canAccessPlayerActivityMonitoring("  PAUL.LEBLANC22@GMAIL.COM "),
    ).toBe(true);
    expect(canAccessPlayerActivityMonitoring("paul.leblanc22+test@gmail.com")).toBe(false);
    expect(canAccessPlayerActivityMonitoring(null)).toBe(false);
  });
});

describe("normalisation de la télémétrie", () => {
  it("accepte uniquement les routes du jeu", () => {
    expect(normalizePlayerActivityRoute("/jeu/entrainement")).toBe(
      "/jeu/entrainement",
    );
    expect(normalizePlayerActivityRoute(" /jeu//transferts ")).toBe(
      "/jeu/transferts",
    );
    expect(normalizePlayerActivityRoute("/connexion")).toBeNull();
  });

  it("associe les routes à une rubrique lisible", () => {
    expect(getPlayerActivitySection("/jeu")).toEqual({
      key: "bureau",
      label: "Bureau du DS",
    });
    expect(getPlayerActivitySection("/jeu/transferts/encheres")).toEqual({
      key: "transferts",
      label: "Bureau des transferts",
    });
  });

  it("nettoie les libellés sans conserver de contenu libre supplémentaire", () => {
    expect(normalizePlayerActivityLabel("  Changer\n l’entraînement  ")).toBe(
      "Changer l’entraînement",
    );

    expect(
      normalizePlayerActivityInput({
        eventType: "form_submit",
        routePath: "/jeu/entrainement",
        sectionKey: "entrainement",
        actionKey: "form-Changer l’entraînement",
        actionLabel: "Changer l’entraînement",
        deviceType: "mobile",
        formValues: { secret: "ne doit jamais être conservé" },
      }),
    ).toEqual({
      eventType: "form_submit",
      routePath: "/jeu/entrainement",
      sectionKey: "entrainement",
      actionKey: "form-changer-l-entrainement",
      actionLabel: "Changer l’entraînement",
      deviceType: "mobile",
    });
  });

  it("rejette les événements et appareils inconnus", () => {
    expect(
      normalizePlayerActivityInput({
        eventType: "message_content",
        routePath: "/jeu/chat",
        sectionKey: "chat",
        deviceType: "desktop",
      }),
    ).toBeNull();
  });
});
