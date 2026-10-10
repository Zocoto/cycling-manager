import { describe, expect, it } from "vitest";
import { composeHalloweenAvatarKey, halloweenAvatarArts, halloweenAvatarWardrobe, parseHalloweenAvatarSelection, toggleHalloweenAvatarItem } from "./halloween-avatar";
import { decodeCustomSportingDirectorAvatar, encodeSportingDirectorAvatar, resolveSportingDirectorAvatar } from "../sporting-director-avatar";
import { readFileSync } from "node:fs";
import { HALLOWEEN_PREVIEW_ITEMS } from "./halloween-catalog";

describe("collection personnelle Halloween", () => {
  it("n'expose que les cosmétiques réellement possédés et conserve les achats non portés", () => {
    expect(halloweenAvatarWardrobe({ "lord-vlad": 1, "pumpkin-cap": 1, "devil-trident": 0, "pumpkin-juice": 5, "pocket-bat": "1" }, { outfit: "lord-vlad", accessory: "devil-trident" }))
      .toEqual({ owned: ["lord-vlad", "pumpkin-cap"], selected: ["lord-vlad"] });
    expect(halloweenAvatarWardrobe()).toEqual({ owned: [], selected: [] });
  });
  it("autorise le cumul du fond, des accessoires, de la casquette et de la tenue", () => {
    let items = toggleHalloweenAvatarItem([], "lord-vlad");
    for (const id of ["pumpkin-cap", "halloween-background", "devil-trident", "pocket-bat", "ghost-scarf", "spectral-wheel", "cobweb-frame"] as const) items = toggleHalloweenAvatarItem(items, id);
    expect(items).toHaveLength(8);
    expect(halloweenAvatarArts(composeHalloweenAvatarKey("director_f_02", items))).toHaveLength(8);
    expect(toggleHalloweenAvatarItem(items, "devil-trident")).toEqual(items.filter(id => id !== "devil-trident"));
    expect(toggleHalloweenAvatarItem(items, "headless-skin")).not.toContain("lord-vlad");
    expect(toggleHalloweenAvatarItem(items, "headless-skin")).toHaveLength(8);
  });
  it("préserve le visage, les lunettes, la tenue native et la malédiction temporaire", () => {
    const config = { ...resolveSportingDirectorAvatar("director_f_02"), glasses: "square" as const, outfit: "patron" as const };
    const base = encodeSportingDirectorAvatar(config);
    const key = composeHalloweenAvatarKey(base, ["lord-vlad", "pumpkin-cap", "pocket-bat"], "mummy");
    expect(resolveSportingDirectorAvatar(key)).toEqual(config);
    expect(decodeCustomSportingDirectorAvatar(base)?.outfit).toBe("patron");
    expect(halloweenAvatarArts(key)).toEqual(["cap", "bat", "mummy"]);
    expect(composeHalloweenAvatarKey(base + "~halloween~mummy", [])).toBe(base);
  });
  it("distingue les anciens formulaires de la désélection volontaire", () => {
    expect(parseHalloweenAvatarSelection(null)).toBeNull();
    expect(parseHalloweenAvatarSelection("[]")).toEqual([]);
    expect(parseHalloweenAvatarSelection('["spectral-wheel","cobweb-frame","devil-trident"]')).toHaveLength(3);
    for (const value of ['null', '{}', 'oops', '["pumpkin-juice"]', '["lord-vlad","headless-skin"]', '["pocket-bat","pocket-bat"]', '"x"']) expect(() => parseHalloweenAvatarSelection(value)).toThrow();
  });
  it("aligne les nouveaux prix affichés avec les prix imposés côté serveur", () => {
    const migration = readFileSync("supabase/migrations/20261010180000_halloween_avatar_wardrobe.sql", "utf8");
    const prices = Object.fromEntries([...migration.matchAll(/\('([a-z-]+)',(\d+)\)/g)].map(match => [match[1], Number(match[2])]));
    for (const item of HALLOWEEN_PREVIEW_ITEMS.filter(item => item.kind === "cosmetic" && item.price)) expect(prices[item.id]).toBe(item.price);
    expect(Object.keys(prices)).toHaveLength(8);
    expect(HALLOWEEN_PREVIEW_ITEMS.find(item => item.id === "pumpkin-juice")?.price).toBe(6);
  });
  it("valide toujours les récompenses sur la configuration native, sans suffixe", () => {
    const action = readFileSync("app/jeu/directeur-sportif/actions.ts", "utf8");
    expect(action).toContain('originalHalloweenAvatarKey(getFormValue(');
    expect(action).toContain('parseHalloweenAvatarSelection(formData.get("halloweenCosmetics"))');
    expect(action).toContain('p_user: user.id');
  });
});
