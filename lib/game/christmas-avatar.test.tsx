import { CHRISTMAS_ITEMS } from "./christmas-catalog";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CHRISTMAS_AVATAR_ITEMS, christmasAvatarArts, christmasAvatarWardrobe, composeChristmasAvatarKey, parseChristmasAvatarSelection, toggleChristmasAvatarItem } from "./christmas-avatar";
import { halloweenAvatarArts, originalHalloweenAvatarKey } from "./halloween-avatar";
import { resolveSportingDirectorAvatar } from "../sporting-director-avatar";
import { ChristmasAvatarBackground, ChristmasAvatarOverlay } from "@/components/game/christmas-avatar-overlay";

describe("Christmas wardrobe persistence and compatibility", () => {
 it("keeps all approved cosmetics distinct and renders each one", () => {
  expect(CHRISTMAS_AVATAR_ITEMS).toEqual(CHRISTMAS_ITEMS.filter(item=>item.category==="portrait").map(({id,name,slot})=>({id,name,slot})));
  expect(CHRISTMAS_AVATAR_ITEMS).toHaveLength(20);
  for (const item of CHRISTMAS_AVATAR_ITEMS) {
   const markup=renderToStaticMarkup(<svg><ChristmasAvatarBackground arts={[item.id]}/><ChristmasAvatarOverlay arts={[item.id]}/></svg>);
   expect(markup).toContain(`data-christmas-art="${item.id}"`);
  }
 });
 it("preserves the base portrait and all Halloween effects", () => {
  const original="director_m_01~halloween~cap,bat,vampire";
  const key=composeChristmasAvatarKey(original,["lunettes-givre","avent-cadre-givre"]);
  expect(originalHalloweenAvatarKey(key)).toBe("director_m_01");
  expect(halloweenAvatarArts(key)).toEqual(["cap","bat","vampire"]);
  expect(christmasAvatarArts(key)).toEqual(["lunettes-givre","avent-cadre-givre"]);
  expect(resolveSportingDirectorAvatar(key)).toEqual(resolveSportingDirectorAvatar(original));
  expect(composeChristmasAvatarKey(key,[])).toBe(original);
 });
 it("offers only genuinely owned cosmetics and allows compatible accessories", () => {
  expect(christmasAvatarWardrobe({"bonnet-relais":1,"lunettes-givre":0,"bois-renne":"1"},{chapeau:"bonnet-relais",lunettes:"lunettes-givre"})).toEqual({owned:["bonnet-relais"],selected:["bonnet-relais"]});
  const selected=toggleChristmasAvatarItem(["bonnet-relais","lunettes-givre","cache-cou-renne"],"bois-renne");
  expect(selected).toEqual(["lunettes-givre","cache-cou-renne","bois-renne"]);
  expect(toggleChristmasAvatarItem(selected,"bois-renne")).toEqual(["lunettes-givre","cache-cou-renne"]);
 });
 it("distinguishes older forms, explicit removal and invalid slot collisions", () => {
  expect(parseChristmasAvatarSelection(null)).toBeNull();
  expect(parseChristmasAvatarSelection("[]")).toEqual([]);
  expect(parseChristmasAvatarSelection('["lunettes-givre","cache-cou-renne","bonnet-relais"]')).toHaveLength(3);
  expect(()=>parseChristmasAvatarSelection('["bois-renne","bonnet-relais"]')).toThrow();
  expect(()=>parseChristmasAvatarSelection('["not-owned-anywhere"]')).toThrow();
 });
});
