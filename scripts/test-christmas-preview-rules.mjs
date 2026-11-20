import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const context = vm.createContext({});
context.window = context;
for (const file of ["catalogue.js", "rules.js", "album-s4.js", "sapin.js"])
  vm.runInContext(readFileSync(new URL(`../assets/christmas-preview/${file}`, import.meta.url), "utf8"), context);
const { settleFlight, rarity, silverTrade, milestones } = context.noelRules;
const cards = context.noelAlbumS4;
const { items, advent } = context.noelCatalogue;
const byId = new Map(items.map(item => [item.id, item]));
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };

const first = settleFlight(null, 1100, 5);
check(first.grelots === 18 && first.lights === 5, "First run awards both currencies");
check(settleFlight(first.result, 3000, 12) === null, "Practice never rewards again");
const retry = settleFlight(first.result, 2200, 8, true);
check(retry.grelots === 10 && retry.lights === 3, "Second chance pays only the improvement");
const worse = settleFlight(retry.result, 100, 1, true);
check(worse.grelots === 0 && worse.lights === 0 && worse.result.score === 2200, "A worse retry keeps the best run");
check(settleFlight(null, 7001, 1) === null && settleFlight(null, 100, 15) === null, "Invalid game messages rejected");
for (const [roll, expected] of [[0, "holographic"], [.099999, "holographic"], [.1, "gold"], [.299999, "gold"], [.3, "silver"], [.999999, "silver"]])
  check(rarity(roll, true) === expected, `Precious draw boundary ${roll}`);
const draws = Array.from({ length: 10000 }, (_, i) => rarity((i + .5) / 10000, true));
check(draws.filter(r => r === "holographic").length === 1000 && draws.filter(r => r === "gold").length === 2000 && draws.filter(r => r === "silver").length === 7000, "10/20/70 odds independent of card pool sizes");
for (const key of ["bronze", "silver", "gold", "holographic"])
  check(cards.some(card => card.rarity === key), `Real S4 has a ${key} pool`);
const silver = cards.filter(card => card.rarity === "silver");
const owned = { [silver[0].number]: 4, [silver[1].number]: 1 };
const before = JSON.stringify(owned);
const trade = silverTrade(owned, cards, .9999);
check(trade.payment.length === 3 && trade.payment.every(number => number === silver[0].number), "Three surplus copies pay for trade, preserving unique copies");
check(!owned[trade.card.number] && trade.card.rarity === "silver", "Trade yields a missing S4 silver");
check(JSON.stringify(owned) === before, "Trade preparation never mutates inventory");
check(silverTrade({ [silver[0].number]: 3 }, cards, 0) === null, "Not enough duplicates preserves consumable");
check(silverTrade(Object.fromEntries(silver.map(c => [c.number, 5])), cards, 0) === null, "Complete silver chapter preserves consumable");
check(new Set(items.map(item => item.id)).size === items.length, "Catalog identifiers are unique");
check(!byId.has("billet-neige") && !byId.has("lettre-relais"), "Removed items no longer enter rewards");
check(advent.length === 24 && advent.every(entry => entry.kind !== "item" || byId.has(entry.itemId)), "All Advent gifts exist");
const adventSkins = advent.filter(entry => entry.kind === "item" && byId.get(entry.itemId)?.category === "portrait");
check(adventSkins.length === 5 && adventSkins.every(entry => byId.get(entry.itemId).source === "avent" && !("price" in byId.get(entry.itemId))), "Five Advent cosmetics are exclusive and unavailable for purchase");
check(items.filter(item => item.category !== "portrait").every(item => !("limit" in item)), "Consumable purchases have no numerical cap");
check(items.every(item => !("proposal" in item) && !item.description.includes("Proposition")), "Validated items have no proposal labels");
check(milestones.length === 9 && milestones.at(-1).goal === 28000, "Nine visible collective goals");
check(milestones.every((m, i) => m.items.every(id => byId.has(id)) && (!i || m.goal > milestones[i - 1].goal)), "Every tier has valid rewards and increasing goals");
check(milestones.at(-1).items[0] === "potential-notebook" && byId.get("potential-notebook").source === "sapin", "Summit reuses the existing potential consumable");
check(context.noelTree.garlandProgress(0, milestones) === 0 && context.noelTree.garlandProgress(28000, milestones) === 1, "Garland goes from dark to fully lit");
check(context.noelTree.garlandProgress(6500, milestones) === 4 / 9, "Garland checkpoints match reward milestones");
console.log(`Passed ${checks} Christmas preview reward, rarity and catalog checks.`);
