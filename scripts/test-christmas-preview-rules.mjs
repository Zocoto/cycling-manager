import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const context = vm.createContext({});
context.window = context;
for (const file of ["catalogue.js", "rules.js", "album-s4.js", "sapin.js"])
  vm.runInContext(readFileSync(new URL(`../assets/christmas-preview/${file}`, import.meta.url), "utf8"), context);
const { settleFlight, normalizeFlightDay, rarity, silverTrade, milestones,
  throwQualities, throwPrecisionOffset, classifyThrow, normalizeThrowQualities } = context.noelRules;
const cards = context.noelAlbumS4;
const { items, advent } = context.noelCatalogue;
const byId = new Map(items.map(item => [item.id, item]));
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const plain = value => JSON.parse(JSON.stringify(value));
const near = (actual, expected, message) => check(Math.abs(actual - expected) < 1e-9, message);

check(JSON.stringify(plain(throwQualities)) === JSON.stringify({
  successful: { label: "Réussi", bonus: 10, lights: 1 },
  super: { label: "Super", bonus: 30, lights: 2 },
  perfect: { label: "Parfait", bonus: 50, lights: 3 },
}), "The three visible precision tiers share one points and lights definition");
check(Object.isFrozen(throwQualities) && Object.values(throwQualities).every(Object.isFrozen), "Precision rewards cannot be changed after initialization");

for (const [size, perfectEdge, superEdge] of [[24, 2.4, 4.8], [58, 3.6, 12]]) {
  check(classifyThrow(0, size) === "perfect", `Centered delivery is perfect at chimney width ${size}`);
  check(classifyThrow(perfectEdge, size) === "perfect" && classifyThrow(perfectEdge + .00001, size) === "super", `Perfect timing boundary is inclusive at chimney width ${size}`);
  check(classifyThrow(superEdge, size) === "super" && classifyThrow(superEdge + .00001, size) === "successful", `Super timing boundary is inclusive at chimney width ${size}`);
}
for (const [error, size] of [[-1, 24], [NaN, 24], [Infinity, 24], ["0", 24], [null, 24], [0, NaN], [0, Infinity], [0, 0], [0, -24]]) {
  check(classifyThrow(error, size) === null, "Invalid precision geometry cannot generate a quality reward");
}

near(throwPrecisionOffset(.275, 58), 8, "A wide chimney's precision marker reaches at most eight logical pixels");
near(throwPrecisionOffset(.825, 58), -8, "The marker oscillates to both sides of the chimney center");
near(throwPrecisionOffset(.275, 24), 4.55, "Small chimneys retain a visibly smaller, bounded oscillation");
near(throwPrecisionOffset(0, 58, Math.PI / 2), 8, "Per-chimney phase is measured in radians");
for (const size of [24, 26, 33, 40, 49, 58]) {
  const amplitude = Math.min(8, (size / 2 - 5) * .65);
  const values = Array.from({ length: 240 }, (_, i) => throwPrecisionOffset(i / 120, size, .37));
  check(values.every(value => Number.isFinite(value) && Math.abs(value) <= amplitude + 1e-9), `Marker remains inside chimney opening ${size}`);
  near(throwPrecisionOffset(.123, size, .37), throwPrecisionOffset(1.223, size, .37), `Oscillation period is exactly 1.1 seconds for chimney ${size}`);
  check(new Set(values.map(value => value.toFixed(4))).size > 100, `The marker moves smoothly with simulation time at chimney ${size}`);
}
check(throwPrecisionOffset(Infinity, 24) === 0 && throwPrecisionOffset(1, NaN) === 0 && throwPrecisionOffset(1, 24, NaN) === 0, "Invalid oscillation inputs never inject NaN into the canvas");
check(Number.isFinite(throwPrecisionOffset(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE)), "Even extreme finite inputs keep marker geometry bounded and finite");

const qualityCounts = (successful = 0, superCount = 0, perfect = 0) => ({ successful, super: superCount, perfect });
const tierRuns = [
  settleFlight(null, 3660, 14, false, "quality-successful", qualityCounts(14)),
  settleFlight(null, 3940, 14, false, "quality-super", qualityCounts(0, 14)),
  settleFlight(null, 4220, 14, false, "quality-perfect", qualityCounts(0, 0, 14)),
];
check(tierRuns.map(run => run.grelots).join() === "41,43,45", "Equal complete deliveries still distinguish successful, super and perfect runs in Grelots");
check(tierRuns.map(run => run.lights).join() === "14,28,42", "The same fourteen gifts contribute one, two or three lights each according to quality");
check(tierRuns.every(run => run.result.deliveries === 14 && run.result.lights === run.lights), "Gift counts remain distinct from accumulated light counts");
check(tierRuns.every(run => run.result.history[0].lights === run.lights && run.result.history[0].qualities), "Each run persists its qualities and derived lights");
const mixedCounts = Object.freeze(qualityCounts(1, 2, 3));
const mixed = settleFlight(null, 1700, 6, false, "quality-mixed", mixedCounts);
check(mixed.lights === 14 && mixed.result.deliveries === 6 && mixed.result.lights === 14, "Mixed precision contributes fourteen lights for six actual gifts");
check(JSON.stringify(plain(normalizeThrowQualities(undefined, 5))) === JSON.stringify(qualityCounts(5)), "Missing legacy counts mean ordinary successful deliveries");
check(normalizeThrowQualities(mixedCounts, 6) !== mixedCounts && JSON.stringify(plain(mixedCounts)) === JSON.stringify(qualityCounts(1, 2, 3)), "Normalizing qualities copies rather than mutates caller counts");
const invalidCounts = [null, [], "perfect", 3, {}, { successful: 6, super: 0 },
  { ...qualityCounts(6), lights: 999 }, qualityCounts(-1, 7), qualityCounts(5.5, .5), qualityCounts(NaN), qualityCounts(Infinity), qualityCounts(15), qualityCounts(5)];
for (const counts of invalidCounts) {
  check(settleFlight(null, 1700, 6, false, "quality-invalid", counts) === null, "Malformed, incomplete, extra or inconsistent quality counts cannot be rewarded");
}
check(normalizeThrowQualities(undefined, 15) === null && normalizeThrowQualities(undefined, -.1) === null, "Standalone count validation also enforces the fourteen-gift limit");
const mixedSecond = settleFlight(mixed.result, 2000, 2, true, "quality-extra", qualityCounts(0, 0, 2));
check(mixedSecond.lights === 6 && mixedSecond.result.lights === 20 && mixedSecond.result.deliveries === 8, "A Second tour adds its full six lights without changing the six previous gift deliveries");
check(settleFlight(mixedSecond.result, 2000, 2, true, "quality-extra", qualityCounts(0, 0, 2)) === null, "A precision-rated run identifier can never pay twice");
check(settleFlight(mixedSecond.result, 2000, 2, false, "quality-practice", qualityCounts(0, 0, 2)) === null, "Practice remains without rewards even for perfect throws");
const mixedBefore = JSON.stringify(mixedSecond.result);
const normalizedMixed = normalizeFlightDay(mixedSecond.result);
check(normalizedMixed.lights === 20 && normalizedMixed.deliveries === 8 && JSON.stringify(mixedSecond.result) === mixedBefore, "Re-reading new history preserves all lights and original input without crediting anything");
for (const badLights of [-1, 1.5, 19, Infinity, "20"]) {
  check(normalizeFlightDay({ ...mixedSecond.result, lights: badLights }) === null, "Invalid or inconsistent new daily light totals are rejected");
}
for (const changes of [{ lights: 43 }, { lights: -1 }, { lights: 1.5 }, { lights: "14" }, { qualities: null }, { qualities: { ...mixedCounts, forged: 1 } }]) {
  check(normalizeFlightDay({ history: [{ ...mixed.result.history[0], ...changes }] }) === null, "Malformed stored run lights or qualities cannot inflate future rewards");
}
const migratedQuality = normalizeFlightDay({ history: [
  { runId: "legacy-history", score: 1100, deliveries: 5, reward: 18 },
  mixed.result.history[0],
] });
check(migratedQuality.deliveries === 11 && migratedQuality.lights === 19 && migratedQuality.reward === 41,
  "Legacy successful runs and new quality-rated runs normalize together without retroactive bonus lights");

const first = settleFlight(null, 1100, 5, false, "first");
check(first.grelots === 18 && first.lights === 5, "First run awards both currencies");
check(settleFlight(first.result, 3000, 12, false, "practice") === null, "Practice never rewards again");
const retry = settleFlight(first.result, 2200, 8, true, "second");
check(retry.grelots === 28 && retry.lights === 8, "Second tour pays its full own rewards");
check(retry.result.score === 3300 && retry.result.deliveries === 13 && retry.result.reward === 46 && retry.result.count === 2, "Both paid runs accumulate in the daily result");
const worse = settleFlight(retry.result, 100, 1, true, "third");
check(worse.grelots === 8 && worse.lights === 1 && worse.result.score === 3400 && worse.result.count === 3, "A weaker new tour also adds its full rewards");
check(settleFlight(worse.result, 7000, 14, true, "second") === null, "A previously settled run identifier can never pay again");
check(settleFlight(null, 7001, 1, false, "invalid-score") === null && settleFlight(null, 100, 15, false, "invalid-deliveries") === null, "Invalid game messages rejected");
check(settleFlight(null, 100, 1, false) === null && settleFlight(null, 100, 1, false, "") === null, "Each paid run requires its unique identifier");
const legacy = normalizeFlightDay({ score: 1100, deliveries: 5, reward: 18 });
check(legacy.score === 1100 && legacy.deliveries === 5 && legacy.reward === 18 && legacy.count === 1 && legacy.history.length === 1, "Previous best-result storage migrates as one historical paid run");
check(legacy.lights === 5 && legacy.history[0].lights === 5 && legacy.history[0].qualities.successful === 5, "Old storage keeps exactly its previously credited five lights");
check(normalizeFlightDay({ score: 1100, deliveries: 5, reward: 18 }).reward === legacy.reward, "Storage normalization grants no new reward");
check(normalizeFlightDay({ score: -1, deliveries: 5, reward: 18 }) === null, "Invalid saved daily results cannot arm extra paid tours");
const legacyRetry = settleFlight(legacy, 2200, 8, true, "legacy-second");
check(legacyRetry.result.reward === 46 && legacyRetry.grelots === 28, "An extra run after migration pays only the new tour's full reward");
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
check(milestones.find(m => m.goal === 10000).items.includes("talent-revealed") && milestones.find(m => m.goal === 14000).items.includes("personality-reroll"), "Intermediate collective tiers grant a talent and a personality change");
check(milestones.at(-1).items[0] === "potential-notebook" && byId.get("potential-notebook").source === "sapin", "Summit reuses the existing potential consumable");
const helmet = byId.get("bonnet-course-noel");
check(helmet.name === "Bonnet de course de Noël" && helmet.category === "equipment" && helmet.equipmentSlot === "helmet" && !("slot" in helmet), "The racing Christmas hat is rider helmet equipment, separate from portrait hats");
check(JSON.stringify(helmet.bonuses) === JSON.stringify({ mountain: 2, resistance: 2 }), "The helmet grants exactly +2 mountain and +2 resistance, no other rating");
check(helmet.source === "contribution" && !("price" in helmet) && milestones.every(milestone => !milestone.items.includes(helmet.id)), "The exclusive helmet is reserved to contribution ranking, never collective tree rewards or shop");
check(milestones.at(-2).goal === 23500 && milestones.at(-2).items.length === 4, "The penultimate tree milestone preserves its two boosters and two precious stickers");
check(context.noelTree.garlandProgress(0, milestones) === 0 && context.noelTree.garlandProgress(28000, milestones) === 1, "Garland goes from dark to fully lit");
check(context.noelTree.garlandProgress(6500, milestones) === 4 / 9, "Garland checkpoints match reward milestones");
console.log(`Passed ${checks} Christmas preview reward, rarity and catalog checks.`);
