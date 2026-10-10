import { describe, expect, it } from "vitest";
import { halloweenAvatarArts, originalHalloweenAvatarKey, previewHalloweenAvatarKey } from "./halloween-avatar";
import { HALLOWEEN_PREVIEW_ITEMS } from "./halloween-catalog";
import { resolveSportingDirectorAvatar } from "../sporting-director-avatar";

describe("essayage Halloween sans sauvegarde", () => {
  for (const item of HALLOWEEN_PREVIEW_ITEMS.filter(item => item.kind !== "consumable")) {
    it(`compose le rendu natif de ${item.id}`, () => {
      const original = "director_f_02~halloween~cap,web";
      const preview = previewHalloweenAvatarKey(original, item.id);
      expect(halloweenAvatarArts(preview)).toContain(item.id === "headless-skin" ? "headless" : item.art);
      expect(originalHalloweenAvatarKey(preview)).toBe("director_f_02");
      expect(resolveSportingDirectorAvatar(preview)).toEqual(resolveSportingDirectorAvatar(original));
      expect(original).toBe("director_f_02~halloween~cap,web");
    });
  }
  it("cumule les cadres compatibles et remplace uniquement la tenue", () => {
    const key = "director_m_01~halloween~headless,web,cap,bat";
    expect(halloweenAvatarArts(previewHalloweenAvatarKey(key, "spectral-wheel"))).toEqual(["headless", "web", "cap", "bat", "wheel"]);
    expect(halloweenAvatarArts(previewHalloweenAvatarKey(key, "lord-vlad"))).toEqual(["web", "cap", "bat", "vlad"]);
  });
  it("affiche l’accessoire hors malédiction et reproduit la transformation du serveur", () => {
    expect(halloweenAvatarArts(previewHalloweenAvatarKey("director_f_01~halloween~mummy,cap", "lord-vlad"))).toEqual(["cap", "vlad"]);
    expect(halloweenAvatarArts(previewHalloweenAvatarKey("director_f_01~halloween~vlad,cap,web", "vampire-kiss"))).toEqual(["cap", "web", "vampire"]);
  });
  it("ne transforme pas un consommable en skin et supporte l’absence de portrait", () => {
    expect(previewHalloweenAvatarKey("director_f_01", "pumpkin-juice")).toBe("director_f_01");
    expect(previewHalloweenAvatarKey(null, "pumpkin-cap")).toBe("director_m_01~halloween~cap");
  });
});
