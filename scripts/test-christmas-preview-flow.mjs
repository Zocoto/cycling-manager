import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Real preview scripts, a minimal local DOM, and a fake iframe transport.
// No gameplay hooks, credentials, network or production accounts are used.
const base = new URL("../assets/christmas-preview/", import.meta.url);
const source = name => readFileSync(new URL(name, base), "utf8");
const storeKey = "cyclostratege-pilote-noel-v2";
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
function same(actual, expected, message) { assert.deepEqual(actual, expected, message); checks++; }
const plain = value => JSON.parse(JSON.stringify(value));

function preview(seed = {}, hash = "#tournee") {
  const elements = new Map(), documentListeners = new Map(), windowListeners = new Map();
  const storage = new Map([[storeKey, JSON.stringify(seed)]]);
  const acknowledgements = [];
  const treeRenders = [];
  class Element {
    constructor() {
      this.dataset = {}; this.style = {}; this.hidden = false; this.value = "";
      this.open = false; this.children = []; this.attributes = new Map(); this.listeners = new Map();
      this._text = ""; this._html = "";
      this.classList = { contains: () => false, toggle() {}, add() {}, remove() {} };
    }
    set textContent(value) { this._text = String(value); this._html = ""; }
    get textContent() { return this._text; }
    set innerHTML(value) { this._html = String(value); this._text = ""; }
    get innerHTML() { return this._html; }
    set src(value) { this.setAttribute("src", value); }
    get src() { return this.getAttribute("src"); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    removeAttribute(name) { this.attributes.delete(name); }
    append(child) { this.children.push(child); if (child.id) elements.set("#" + child.id, child); }
    addEventListener(name, handler) { this.listeners.set(name, handler); }
    querySelectorAll() { return []; }
    querySelector(selector) { return element(selector); }
    focus() {}
    close() { this.open = false; }
    showModal() { this.open = true; }
  }
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  }
  const views = ["noel", "tournee", "avent", "boutique", "sapin", "inventaire", "bureau", "gazette"].map(view => {
    const node = new Element(); node.dataset.view = view; return node;
  });
  const frameWindow = { postMessage: (data, origin) => acknowledgements.push({ data: plain(data), origin }) };
  element("#tournee-frame").contentWindow = frameWindow;
  element("#tournee-frame").dataset.src = "tournee.html";
  const document = {
    querySelector: element,
    querySelectorAll(selector) {
      if (selector === "[data-view]") return views;
      if (selector === "[data-balance]" || selector === "[data-advent-open]") return [element(selector)];
      return [];
    },
    createElement: () => new Element(),
    addEventListener: (name, handler) => documentListeners.set(name, handler),
  };
  const scope = {
    document, console,
    location: { hash, origin: "https://christmas-preview.example.test" },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
    setTimeout: () => 1, clearTimeout() {}, scrollTo() {}, confirm: () => true,
    crypto: { getRandomValues: values => values.fill(1234567) },
    addEventListener: (name, handler) => windowListeners.set(name, handler),
    drawNoelPortrait() {}, drawNoelItem() {}, noelAdvent: { render() {} },
  };
  scope.window = scope;
  vm.createContext(scope);
  for (const file of ["catalogue.js", "rules.js", "album-s4.js", "sapin.js"])
    vm.runInContext(source(file), scope, { filename: file });
  const renderTree = scope.noelTree.render;
  scope.noelTree = { ...scope.noelTree, render: options => {
    treeRenders.push(plain({ total: options.total, personal: options.personal, participants: options.participants, contributors: options.contributors }));
    renderTree(options);
  } };
  vm.runInContext(source("noel.js"), scope, { filename: "noel.js" });
  const field = element("#preview-day");
  field.listeners.get("change")(); // Persist the normal loaded defaults through the real UI handler.
  const click = (action, id) => {
    const button = { dataset: { action, id }, disabled: false };
    documentListeners.get("click")({ target: { closest: () => button } });
  };
  const message = (payload, extras = {}) => windowListeners.get("message")({
    source: frameWindow, origin: scope.location.origin, data: payload, ...extras,
  });
  return {
    state: () => JSON.parse(storage.get(storeKey)), click, message, acknowledgements,
    items: plain(scope.noelCatalogue.items), advent: plain(scope.noelCatalogue.advent), element,
    start: runId => message({ type: "noel:tournee-demarree", runId }),
    finish: (runId, score = 1100, deliveries = 5) => message({ type: "noel:tournee-terminee", runId, score, deliveries }),
    summary: () => element("#flight-result").innerHTML,
    tree: () => treeRenders.at(-1),
  };
}

// Every ordinary consumable can be bought beyond its former quota, until cash runs out.
const catalog = preview().items;
for (const item of catalog.filter(item => !item.source && item.category !== "portrait")) {
  const p = preview({ balance: item.price * 7, quantities: {}, bought: {} }, "#boutique");
  for (let i = 0; i < 7; i++) p.click("buy", item.id);
  same(p.state().quantities[item.id], 7, `${item.id}: seven repeat purchases are permitted`);
  same(p.state().balance, 0, `${item.id}: exactly seven prices are paid`);
  const before = p.state();
  p.click("buy", item.id);
  same(p.state(), before, `${item.id}: an empty wallet blocks another purchase`);
}
{
  const p = preview({ quantities: { "boussole-polaire": 3 }, bought: {} });
  let expiry = Date.UTC(2026, 11, 12, 12);
  for (let i = 0; i < 3; i++) {
    p.click("inventory-item", "boussole-polaire"); p.click("use-item", "boussole-polaire");
    const nextExpiry = Date.parse(p.state().scoutingUntil);
    same(nextExpiry - expiry, 7 * 86400000, "Every owned compass extends the duration by seven days");
    expiry = nextExpiry;
  }
  same(p.state().quantities["boussole-polaire"], 0, "Three compasses can be used despite the former one-use cap");
}
{
  const p = preview({ opened: [3], quantities: { "bonnet-relais": 1 }, balance: 540 });
  const exclusive = p.advent[2].itemId;
  check(catalog.some(item => item.id === exclusive && item.source === "avent"), "Day three now grants an Advent-exclusive skin");
  same(p.state().quantities[exclusive], 1, "Previously opened day receives its new exclusive skin");
  same(p.state().quantities["bonnet-relais"], 1, "The previously received shop skin is preserved");
  same(p.state().balance, 540, "Migrating an opened window never charges or grants extra Grelots");
  const reopened = preview(p.state());
  same(reopened.state().quantities[exclusive], 1, "Reloading never duplicates the exclusive replacement");
}
{
  const skin = catalog.find(item => !item.source && item.category === "portrait");
  const p = preview({ balance: skin.price * 3, quantities: {}, bought: {} });
  p.click("buy", skin.id); p.click("buy", skin.id);
  same(p.state().quantities[skin.id], 1, "A shop cosmetic remains unique");
  same(p.state().balance, skin.price * 2, "A duplicate cosmetic costs nothing");
  const historical = preview({ balance: 1000, quantities: {}, bought: { [skin.id]: 1 } });
  const before = historical.state(); historical.click("buy", skin.id);
  same(historical.state(), before, "Purchase history also preserves cosmetic uniqueness");
}
{
  const exclusive = catalog.filter(item => item.source === "avent" || item.source === "sapin");
  check(exclusive.some(item => item.source === "avent") && exclusive.some(item => item.source === "sapin"), "Both exclusive reward sources exist");
  const p = preview({ balance: 10000 }, "#boutique");
  const before = p.state();
  for (const item of exclusive) {
    p.click("shop-item", item.id); p.click("buy", item.id);
    check(!p.element("#pilot-dialog").open, `${item.id}: no purchase dialog opens for exclusive rewards`);
    check(!p.element("#shop-grid").innerHTML.includes(`data-id="${item.id}"`), `${item.id}: not listed for sale`);
  }
  same(p.state(), before, "Exclusive rewards cannot be bought through forged action buttons");
}
{
  const p = preview();
  const before = p.state();
  p.start("first"); p.finish("first");
  same(p.state().balance, before.balance + 18, "First paid run adds its actual Grelots");
  same(p.state().deliveries, before.deliveries + 5, "First paid run adds five collective lights");
  same(p.acknowledgements[0].data, { type: "noel:tournee-bilan", runId: "first", grelots: 18, lights: 5, deliveries: 5, practice: false, retry: false, improved: true }, "Iframe receives the authoritative two-currency balance");
  check(p.summary().includes("run-summary-grelots") && p.summary().includes("+18") && p.summary().includes("run-summary-lights") && p.summary().includes("+5"), "The visible summary identifies both real gains");
  check(!/points|\bpts\b/i.test(p.summary()), "Run summary never exposes the internal score");
  const paid = p.state(), summary = p.summary();
  p.finish("first", 2200, 8);
  same(p.state(), paid, "A duplicate end message never pays again");
  same(p.summary(), summary, "A duplicate end message never changes the already displayed balance");
  same(p.acknowledgements.length, 1, "Duplicate end messages do not send a second balance");
  p.start("practice"); p.finish("practice", 2200, 8);
  same(p.state().balance, paid.balance, "Practice does not add Grelots");
  same(p.state().deliveries, paid.deliveries, "Practice does not add collective lights");
  same(p.acknowledgements[1].data, { type: "noel:tournee-bilan", runId: "practice", grelots: 0, lights: 0, deliveries: 8, practice: true, retry: false, improved: false }, "Practice still receives an explicit zero/zero balance");
  check(p.summary().includes("Tournée d’entraînement") && p.summary().includes("Aucun nouveau gain"), "Practice explains why both gains are zero");
}
{
  const p = preview({ balance: 500, deliveries: 5, runs: { 12: { score: 1100, deliveries: 5, reward: 18 } } });
  p.click("inventory-item", "grelot-repechage"); p.click("use-item", "grelot-repechage");
  same(p.state().quantities["grelot-repechage"], 0, "Arming a retry consumes one owned item");
  p.start("retry"); p.finish("retry", 2200, 8);
  same(p.state().balance, 528, "Second tour credits its full twenty-eight Grelots");
  same(p.state().deliveries, 13, "Second tour adds all eight collective lights");
  same(p.state().runs[12].score, 3300, "Daily scores add rather than replacing the previous result");
  same(p.state().runs[12].count, 2, "The historical run and the new Second tour both count");
  same(p.state().retryDays, [], "A completed retry is disarmed");
  check(p.summary().includes("+28") && p.summary().includes("+8") && p.summary().includes("Cumul du jour") && p.summary().includes("46 Grelots"), "Second tour summary identifies this run's gains and the daily aggregate");
  p.click("buy", "grelot-repechage"); p.click("inventory-item", "grelot-repechage"); p.click("use-item", "grelot-repechage");
  const before = p.state();
  p.start("worse-retry"); p.finish("worse-retry", 100, 1);
  same(p.state().balance, before.balance + 8, "A weaker Second tour adds its own eight Grelots");
  same(p.state().deliveries, before.deliveries + 1, "A weaker Second tour adds its own collective light");
  same(p.state().runs[12].score, before.runs[12].score + 100, "A weaker run also adds to the daily score");
  same(p.state().runs[12].count, 3, "Three paid tours remain individually recorded");
  const paid = p.state();
  p.start("unpaid"); p.finish("unpaid", 7000, 14);
  same(p.state().balance, paid.balance, "A third replay without another item cannot award Grelots");
  same(p.state().deliveries, paid.deliveries, "A replay without another item cannot award lights");
  const restored = preview(p.state()), afterReload = restored.state();
  restored.start("retry"); restored.finish("retry", 7000, 14);
  same(restored.state(), afterReload, "A completed run identifier cannot be replayed for rewards after reload");
}
{
  const p = preview(), before = p.state();
  p.finish("never-started");
  same(p.state(), before, "Finishing without a started run is ignored");
  p.start("old"); p.start("current"); p.finish("old", 7000, 14);
  same(p.state(), before, "A stale run cannot settle the active run");
  same(p.acknowledgements.length, 0, "Stale end message gets no acknowledgement");
  p.finish("current");
  same(p.acknowledgements[0].data.runId, "current", "Only the current run settles");
  const after = p.state();
  p.finish("old");
  same(p.state(), after, "An older end remains harmless after the current settlement");
  p.message({ type: "noel:tournee-demarree", runId: "forged" }, { source: {} });
  p.message({ type: "noel:tournee-demarree", runId: "forged" }, { origin: "https://other.example.test" });
  p.finish("forged");
  same(p.state(), after, "A different source window or origin cannot start a payable run");
}
{
  const p = preview({ day: 9, balance: 0, quantities: {}, opened: [] });
  p.click("claim-advent", "9");
  same(p.state().quantities["grelot-repechage"], 1, "Advent day nine grants the same Second tour consumable as the shop");
  p.click("inventory-item", "grelot-repechage"); p.click("use-item", "grelot-repechage");
  same(p.state().quantities["grelot-repechage"], 1, "Before the daily paid run the extra-run consumable is preserved");
  p.start("advent-first"); p.finish("advent-first");
  p.click("inventory-item", "grelot-repechage"); p.click("use-item", "grelot-repechage");
  p.start("advent-extra"); p.finish("advent-extra", 100, 1);
  same(p.state().runs[9].reward, 26, "The Advent Second tour adds its full eight Grelots even with a weaker result");
  same(p.state().runs[9].deliveries, 6, "The Advent Second tour adds its one new light to the first five");
}
{
  const p = preview({ quantities: { "grelot-repechage": 3 } });
  p.start("first"); p.finish("first");
  p.start("ongoing-practice");
  p.click("inventory-item", "grelot-repechage"); p.click("use-item", "grelot-repechage");
  same(p.state().quantities["grelot-repechage"], 3, "An ongoing practice run cannot consume or retrospectively receive an extra-run credit");
  p.finish("ongoing-practice");
  p.click("inventory-item", "grelot-repechage"); p.click("use-item", "grelot-repechage");
  p.click("inventory-item", "grelot-repechage"); p.click("use-item", "grelot-repechage");
  same(p.state().quantities["grelot-repechage"], 2, "Arming twice preserves the second item while one extra run is already ready");
  const restored = preview(p.state());
  same(restored.state().retryDays, [12], "An armed paid extra run survives reload");
  restored.start("first"); restored.finish("first", 7000, 14);
  same(restored.state().retryDays, [12], "Replaying an old run identifier cannot consume the newly armed credit");
  restored.start("next-valid"); restored.finish("next-valid", 0, 0);
  same(restored.state().runs[12].count, 2, "The valid extra run settles once after reload");
  same(restored.state().retryDays, [], "Only completing the valid new paid run clears its extra-run credit");
}
{
  const p = preview({ balance: 500, deliveries: 5, runs: { 12: { score: 1100, deliveries: 5, reward: 18 } } });
  same(p.state().balance, 500, "Migrating historical best-run storage never grants retroactive currency");
  same(p.state().deliveries, 5, "Migrating historical best-run storage never changes prior tree lights");
  same(p.state().runs[12].count, 1, "A historical daily result is preserved as one completed run");
  const restored = preview(p.state());
  same(restored.state().runs[12], p.state().runs[12], "Repeated storage migrations leave cumulative daily history unchanged");
}
{
  const p = preview({ quantities: { "personality-reroll": 2 } }, "#inventaire");
  p.click("inventory-item", "personality-reroll");
  p.element("#item-target").value = "rider-a";
  p.click("use-item", "personality-reroll");
  const first = p.state().personalities["rider-a"];
  check(first && first !== "assidu", "Personality consumable always replaces the rider's current character");
  same(p.state().quantities["personality-reroll"], 1, "A personality change consumes exactly one item");
  p.click("inventory-item", "personality-reroll");
  p.element("#item-target").value = "rider-a";
  p.click("use-item", "personality-reroll");
  check(p.state().personalities["rider-a"] !== first, "A repeat personality change excludes the newly current character as well");
  same(p.state().quantities["personality-reroll"], 0, "A second personality change consumes its own second item");
  same(p.state().personalities["rider-b"], undefined, "Changing one rider leaves the other rider's character untouched");
  check(p.state().log[0].message.includes("→"), "The new character is revealed in the result after consumption");
}
{
  const p = preview({ quantities: { "talent-revealed": 2 } });
  p.click("inventory-item", "talent-revealed");
  p.element("#item-target").value = "rider-a";
  p.element("#item-ability").value = "flahute";
  p.click("use-item", "talent-revealed");
  same(p.state().abilities["rider-a"], ["flahute"], "The collective talent item reveals the chosen existing capability");
  same(p.state().quantities["talent-revealed"], 1, "One talent consumes one earned item");
  p.click("inventory-item", "talent-revealed");
  p.element("#item-target").value = "rider-a";
  p.element("#item-ability").value = "flahute";
  p.click("use-item", "talent-revealed");
  same(p.state().quantities["talent-revealed"], 1, "A duplicate capability preserves the talent item");
  const full = preview({ quantities: { "talent-revealed": 1 }, abilities: { "rider-a": ["flahute", "panache", "locomotive", "giclette"] } });
  full.click("inventory-item", "talent-revealed"); full.element("#item-target").value = "rider-a"; full.element("#item-ability").value = "pistard";
  full.click("use-item", "talent-revealed");
  same(full.state().quantities["talent-revealed"], 0, "A distinct capability remains available without inventing a four-capability limit");
  check(full.state().abilities["rider-a"].includes("pistard"), "An existing rider's talents are preserved when the chosen new talent is revealed");
}
{
  for (const [communityLights, personal] of [[4200, 0], [4200, 23], [500, 250], [0, 7]]) {
    const p = preview({ communityLights, deliveries: personal, participants: 42 }, "#sapin");
    const tree = p.tree();
    same(tree.contributors.reduce((total, row) => total + row.lights, 0), communityLights + personal, "Contributor lights sum exactly to collective progress, including rounding remainder");
    same(tree.total, communityLights + personal, "Tree progress includes personal paid deliveries once");
    same(tree.contributors.filter(row => row.isCurrent).length, personal ? 1 : 0, "Personal contribution is represented once and never duplicated among local sample DS");
    check(tree.contributors.every(row => Number.isInteger(row.lights) && row.lights >= 0), "Every contributor has non-negative whole light counts");
  }
}
console.log(`Passed ${checks} Christmas preview purchase, run balance and replay flow checks.`);
