import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { CHRISTMAS_ITEMS, CHRISTMAS_ADVENT, CHRISTMAS_MILESTONES, CHRISTMAS_CONTRIBUTION_REWARDS, CHRISTMAS_ALBUM_EDITION, getChristmasItem, christmasInventoryItemHref } from "./christmas-catalog";

describe("Christmas production catalog", () => {
  it("preserves every validated pilot item, price, calendar and collective reward", () => {
    const context: Record<string, unknown> = {}; context.window=context; context.globalThis=context;
    for(const file of ["catalogue.js","rules.js","sapin.js"]) runInNewContext(readFileSync(new URL(`../../assets/christmas-preview/${file}`, import.meta.url),"utf8"),context);
    const pilot=context.noelCatalogue as { items: Array<{id:string;price?:number;effect:string}>; advent:unknown[] };
    for(const item of pilot.items) expect(getChristmasItem(item.id)).toMatchObject(JSON.parse(JSON.stringify({ ...item, effect: item.effect.replace("Dans cet aperçu, une reconnaissance prépare", "Une reconnaissance prépare") })));
    expect(CHRISTMAS_ADVENT).toEqual(JSON.parse(JSON.stringify(pilot.advent)));
    expect(CHRISTMAS_MILESTONES).toEqual(JSON.parse(JSON.stringify((context.noelRules as {milestones:unknown[]}).milestones)));
    expect(CHRISTMAS_CONTRIBUTION_REWARDS).toEqual(JSON.parse(JSON.stringify((context.noelTree as {contributionRewards:unknown[]}).contributionRewards)));
    expect(new Set(CHRISTMAS_ITEMS.map(item=>item.id)).size).toBe(CHRISTMAS_ITEMS.length);
  });
  it("uses canonical ordinary inventory and the frozen S4 album rather than duplicates or S5", () => {
    expect(getChristmasItem("personality-reroll")?.delivery).toEqual({kind:"inventory_item",key:"personality-reroll"});
    expect(getChristmasItem("potential-notebook")?.delivery).toEqual({kind:"inventory_item",key:"potential-notebook"});
    expect(getChristmasItem("talent-revealed")?.delivery).toEqual({kind:"daily_reward",key:"talent-revealed"});
    expect(getChristmasItem("boussole-polaire")?.delivery).toEqual({kind:"daily_reward",key:"scouting-week-20"});
    expect(CHRISTMAS_ALBUM_EDITION).toBe("cyclo-stickers-s5-s4-final-v1");
    expect(christmasInventoryItemHref("personality-reroll")).toBe("/jeu/inventaire");
  });
  it("keeps the four contributor prizes distinct from common milestones", () => {
    expect(getChristmasItem("cuissard-quatre-saisons")?.effects).toEqual({ignoreWeatherPenalties:true});
    expect(getChristmasItem("bonnet-course-noel")?.bonuses).toEqual({mountain:2,resistance:2});
    expect(CHRISTMAS_MILESTONES.flatMap(m=>m.items)).not.toContain("bonnet-course-noel");
    expect(CHRISTMAS_ITEMS.filter(i=>i.category==="portrait")).toHaveLength(20);
  });
});
