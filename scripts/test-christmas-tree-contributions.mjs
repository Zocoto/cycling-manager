import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const context = vm.createContext({});
context.window = context;
for (const file of ["catalogue.js", "rules.js", "sapin.js"]) {
  vm.runInContext(readFileSync(new URL(`../assets/christmas-preview/${file}`, import.meta.url), "utf8"), context);
}
const { rankContributors, contributionPrize, contributionRewards, render } = context.noelTree;
const plain = value => JSON.parse(JSON.stringify(value));
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }

const contributors = [
  { id: "a", name: "Petit score", lights: 15, score: 100 },
  { id: "b", name: "Gros score", lights: 4, score: 7000 },
  { id: "c", name: "Égalité", lights: 15, score: 0 },
  { id: "d", name: "Toi", lights: 6, isCurrent: true },
];
const before = JSON.stringify(contributors);
const ranked = plain(rankContributors(contributors));
check(ranked[0].lights === 15 && ranked[1].lights === 15 && ranked.at(-1).id === "b", "Ranking uses cumulative lights, never score");
check(ranked[0].rank === 1 && ranked[1].rank === 1 && ranked[2].rank === 3, "Equal lights share rank and reward");
check(JSON.stringify(contributors) === before, "Ranking never mutates source contributions");
check(rankContributors([
  { id: "a", name: "First", lights: 1 }, { id: "a", name: "Duplicate", lights: 40 },
  { id: "bad", name: "Bad", lights: -1 }, { id: "fraction", name: "Fraction", lights: 2.5 },
  { id: "nan", name: "NaN", lights: NaN }, { id: "zero", name: "Zero", lights: 0 }, null,
]).length === 1, "Invalid or repeated contributors never enter the ranking");
for (let rank = 1; rank <= 10; rank++) check(!!contributionPrize(rank), `Rank ${rank} has a prize`);
check(contributionPrize(0) === null && contributionPrize(11) === null, "Only the top ten ranks receive proposed gear");
check(contributionRewards.every((reward, index) => reward.from === (index ? contributionRewards[index - 1].to + 1 : 1)), "Prize bands cover ranks without gaps or overlaps");
const strength = reward => Object.values(reward.bonuses).reduce((total, bonus) => total + bonus, 0);
check(contributionRewards.slice(1).every((reward, index, statRewards) => !index || strength(reward) < strength(statRewards[index - 1])), "Stat bonus budgets decrease below the unique first-place effect");
check(contributionPrize(1).slot === "bib_shorts" && contributionPrize(1).effects.ignoreWeatherPenalties === true && Object.keys(contributionPrize(1).bonuses).length === 0, "First place grants the unique weather-protecting shorts without invented rating bonuses");
check(contributionPrize(2).slot === "frame" && contributionPrize(3).slot === "frame" && contributionPrize(1).slot !== "frame", "The frame is reserved to second and third place");
check(contributionPrize(4).id === "bonnet-course-noel" && contributionPrize(6).id === "bonnet-course-noel", "Fourth through sixth place receive the racing helmet-beanie");
check(contributionRewards.every(reward => ["bib_shorts", "frame", "helmet", "gloves"].includes(reward.slot)) && contributionRewards.every(reward => reward.type !== "Groupe"), "Every prize uses an existing game equipment slot, with no groupset");
const art = {}, panel = {};
const itemById = new Map(context.noelCatalogue.items.map(item => [item.id, item]));
render({ art, panel, total: 14000, personal: 6, participants: 12, claimed: [], milestones: context.noelRules.milestones, itemById,
  contributors: Array.from({ length: 12 }, (_, index) => ({ id: String(index), name: index === 11 ? '<script>alert("x")</script>' : `DS ${index}`, lights: 20 - index, isCurrent: index === 11 })) });
check((panel.innerHTML.match(/class="contributor-rank"/g) ?? []).length === 11, "Ten leaders plus personal position are visible when outside top ten");
check(panel.innerHTML.includes("&lt;script&gt;") && !panel.innerHTML.includes('<script>alert("x")</script>'), "Contributor names are HTML escaped");
check(panel.innerHTML.includes("Réussi : 1 lumière · Super : 2 · Parfait : 3") && panel.innerHTML.includes("validée à la fin"), "Tree explains how the validated quality of completed deliveries lights the garland");
check(panel.innerHTML.includes('aria-label="Lumières de tout le peloton"') && panel.innerHTML.includes("lumières avant le prochain palier"), "Shared progress and remaining milestones are counted in lights rather than delivered gifts");
check(panel.innerHTML.includes("Talent révélé") && panel.innerHTML.includes("Nouveau chapitre"), "Intermediate talent and personality rewards are visible");
check(panel.innerHTML.includes("Classement final du 31 décembre") && panel.innerHTML.includes("même rang et même cadeau"), "Preview clearly presents final ranking prizes and tie rule");
check(panel.innerHTML.includes("tous tes Seconds tours compris") && panel.innerHTML.includes("Les entraînements sans gains"), "Contribution totals cover the whole event and paid extra runs, excluding training runs");
render({ art, panel, total: 200, personal: 10, participants: 11, claimed: [], milestones: context.noelRules.milestones, itemById,
  contributors: Array.from({ length: 11 }, (_, index) => ({ id: String(index), name: `DS ${index}`, lights: index < 9 ? 30 - index : 10, isCurrent: index === 10 })) });
check((panel.innerHTML.match(/class="contributor-rank"/g) ?? []).length === 11 && !panel.innerHTML.includes("Ta contribution hors du top 10"), "All tied tenth-place contributors remain in top ten");
check(context.noelRules.milestones.every(milestone => !milestone.items.includes("bonnet-course-noel")), "Helmet-beanie never enters shared tree rewards");
check(plain(contributionPrize(4).bonuses).mountain === 2 && plain(contributionPrize(4).bonuses).resistance === 2 && Object.keys(contributionPrize(4).bonuses).length === 2, "The ranking helmet keeps exactly +2 mountain and +2 resistance");
render({ art, panel, total: 23500, personal: 0, participants: 1, claimed: [], milestones: context.noelRules.milestones, itemById });
check(!art.innerHTML.includes("sapin-bonnet") && !art.innerHTML.includes('class="sapin-star is-lit"'), "The removed helmet ornament does not appear under the still-locked final star");
check(panel.innerHTML.includes("Cuissard Quatre Saisons") && panel.innerHTML.includes("Bonnet de course de Noël") && !panel.innerHTML.includes("Dérailleur du lutin grognon"), "New original contribution prizes replace the groupset in the displayed ranking");
render({ art, panel, total: 0, personal: 0, participants: 0, claimed: [], milestones: context.noelRules.milestones, itemById });
check(panel.innerHTML.includes("attend ses premiers éclaireurs"), "Empty ranking invites first contribution");
check(!art.innerHTML.includes("sapin-bonnet") && art.innerHTML.includes('class="sapin-star"'), "The shared tree retains its potential star without a ranking-only helmet decoration");
render({ art, panel, total: 499, personal: 0, participants: 1, claimed: [], milestones: context.noelRules.milestones, itemById });
check(panel.innerHTML.includes("1 lumière avant le prochain palier"), "A single remaining quality light uses the singular unit");
console.log(`Passed ${checks} Christmas contribution ranking, prizes and tree checks.`);
