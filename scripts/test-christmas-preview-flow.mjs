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
  const acknowledgements = [], sniperMessages = [];
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
  const frameWindow = { postMessage: (data, origin) => (data.type === "noel:tournee-lunette" ? sniperMessages : acknowledgements).push({ data: plain(data), origin }) };
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
    state: () => JSON.parse(storage.get(storeKey)), click, message, acknowledgements, sniperMessages,
    items: plain(scope.noelCatalogue.items), advent: plain(scope.noelCatalogue.advent), element,
    start: (runId, sniper = false) => message({ type: "noel:tournee-demarree", runId, sniper }),
    finish: (runId, score = 1100, deliveries = 5, qualities) => message({ type: "noel:tournee-terminee", runId, score, deliveries, qualities }),
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
  same(p.acknowledgements[0].data, { type: "noel:tournee-bilan", runId: "first", grelots: 18, lights: 5, deliveries: 5, qualities: { successful: 5, super: 0, perfect: 0 }, practice: false, retry: false, improved: true }, "Iframe receives the authoritative two-currency balance and normalized quality counts");
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
  same(p.acknowledgements[1].data, { type: "noel:tournee-bilan", runId: "practice", grelots: 0, lights: 0, deliveries: 8, qualities: { successful: 8, super: 0, perfect: 0 }, practice: true, retry: false, improved: false }, "Practice still receives an explicit zero/zero balance");
  check(p.summary().includes("Tournée d’entraînement") && p.summary().includes("Aucun nouveau gain"), "Practice explains why both gains are zero");
}
{
  const balances = [];
  for (const [quality, score, lights, grelots] of [["successful", 1100, 5, 18], ["super", 1320, 10, 20], ["perfect", 1540, 15, 22]]) {
    const p = preview(), before = p.state();
    const qualities = { successful: 0, super: 0, perfect: 0, [quality]: 5 };
    p.start("quality-" + quality); p.finish("quality-" + quality, score, 5, qualities);
    same(p.state().balance, before.balance + grelots, `${quality}: the actual score determines Grelots`);
    same(p.state().deliveries, before.deliveries + lights, `${quality}: five deliveries credit their quality-weighted lights`);
    same(p.state().runs[12].deliveries, 5, `${quality}: real delivered gifts remain distinct from lights`);
    same(p.state().runs[12].lights, lights, `${quality}: daily result persists separate lights`);
    same(p.state().runs[12].history[0].qualities, qualities, `${quality}: normalized quality counts are retained`);
    check(p.summary().includes(`+${lights}`) && p.summary().includes(`${lights} lumières`), `${quality}: summary shows quality-weighted lights`);
    balances.push({ balance: p.state().balance, lights: p.state().deliveries });
    const settled = p.state();
    p.finish("quality-" + quality, 7000, 14, { successful: 0, super: 0, perfect: 14 });
    same(p.state(), settled, `${quality}: repeated final messages cannot replace already settled quality`);
  }
  check(balances[0].balance < balances[1].balance && balances[1].balance < balances[2].balance
    && balances[0].lights < balances[1].lights && balances[1].lights < balances[2].lights,
  "Better throw quality and its higher score improve both currencies for the same delivery count");
}
{
  const invalid = [null, {}, [], { successful: 5, super: 0 }, { successful: 6, super: 0, perfect: 0 },
    { successful: -1, super: 6, perfect: 0 }, { successful: 4.5, super: .5, perfect: 0 },
    { successful: 5, super: 0, perfect: 0, lights: 999 }, { successful: NaN, super: 0, perfect: 0 }];
  for (const qualities of invalid) {
    const p = preview(), before = p.state();
    p.start("bad-quality"); p.finish("bad-quality", 1100, 5, qualities);
    same(p.state(), before, "Invalid quality counters cannot credit or settle a run");
    same(p.acknowledgements.length, 0, "Invalid quality counters receive no authoritative balance");
    p.finish("bad-quality", 1100, 5, { successful: 1, super: 2, perfect: 2 });
    same(p.state().deliveries, before.deliveries + 11, "A corrected final message still settles the unconsumed run once");
    same(p.acknowledgements.length, 1, "Exactly one corrected quality balance is acknowledged");
  }
}
{
  const p = preview(), before = p.state();
  p.start("untrusted-lights");
  const payload = { type: "noel:tournee-terminee", runId: "untrusted-lights", score: 1540, deliveries: 5,
    qualities: { successful: 0, super: 0, perfect: 5 }, lights: 999999 };
  p.message(payload, { source: {} }); p.message(payload, { origin: "https://other.example.test" });
  same(p.state(), before, "Quality payloads from a different iframe or origin do not settle the active run");
  p.message(payload);
  same(p.state().deliveries, before.deliveries + 15, "Arbitrary client light fields are ignored in favor of validated quality counts");
  same(p.acknowledgements[0].data.lights, 15, "The iframe sees only the rule-derived light balance");
  const paid = p.state();
  p.start("perfect-practice"); p.finish("perfect-practice", 7000, 14, { successful: 0, super: 0, perfect: 14 });
  same(p.state().balance, paid.balance, "Even a perfect practice run never credits Grelots");
  same(p.state().deliveries, paid.deliveries, "Even a perfect practice run never credits lights");
  same(p.acknowledgements.at(-1).data.qualities.perfect, 14, "A practice balance preserves its actual throw quality despite zero rewards");
}
{
  const p = preview({ balance: 500, deliveries: 5, quantities: { "grelot-repechage": 1 },
    runs: { 12: { score: 1100, deliveries: 5, reward: 18 } } });
  p.click("inventory-item", "grelot-repechage"); p.click("use-item", "grelot-repechage");
  p.start("quality-retry");
  const before = p.state();
  p.finish("quality-retry", 1320, 5, { successful: 1, super: 1, perfect: 1 });
  same(p.state(), before, "An invalid quality message does not consume the armed Second tour credit");
  p.finish("quality-retry", 1320, 5, { successful: 1, super: 2, perfect: 2 });
  same(p.state().runs[12].deliveries, 10, "The Second tour adds its five real deliveries to the previous five");
  same(p.state().runs[12].lights, 16, "The Second tour adds eleven quality lights to the five historical lights");
  same(p.state().deliveries, 16, "Only the new quality lights are added to the persisted personal balance");
  same(p.state().retryDays, [], "Only the valid quality result consumes the Second tour credit");
  check(p.summary().includes("16 lumières") && p.summary().includes("Super : 2") && p.summary().includes("Parfait : 2"), "The summary distinguishes cumulative light totals and per-run quality");
  const restored = preview(p.state());
  same(restored.state().balance, p.state().balance, "Reloading a quality history never recredits Grelots");
  same(restored.state().deliveries, 16, "Reloading a quality history never recredits lights");
  same(restored.state().runs[12], p.state().runs[12], "Normalized quality run history is stable across reloads");
  const historyOnly = preview({ ...p.state(), lastFlight: null });
  check(historyOnly.summary().includes("+11") && historyOnly.summary().includes("5/14 cadeaux livrés") && historyOnly.summary().includes("16 lumières"),
    "A history-only restored summary uses the latest run's eleven lights, five real deliveries, and sixteen daily lights");
  same(historyOnly.state().deliveries, 16, "Rendering the history-only quality balance never adds its lights again");
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
  same(p.state().runs[12].lights, 5, "Historical result lights normalize to the original delivered amount");
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
{
  const helmetId = "bonnet-course-noel";
  const locked = preview({ communityLights: 23499, deliveries: 0, quantities: {} }, "#sapin");
  const before = locked.state(); locked.click("claim-tree", "23500");
  same(locked.state(), before, "The 23,500-light collective tier remains locked below its threshold");
  const collective = preview({ communityLights: 23500, deliveries: 0, quantities: {} }, "#inventaire");
  collective.click("claim-tree", "23500");
  same(collective.state().quantities[helmetId], undefined, "The collective tier no longer gives every player a contributor helmet");
  same(collective.state().quantities["booster-noel"], 2, "The collective tier preserves both existing booster prizes");
  same(collective.state().quantities["vignette-renne"], 2, "The collective tier preserves both existing rare stickers");
  const claimed = collective.state(); collective.click("claim-tree", "23500");
  same(collective.state(), claimed, "Claiming the collective tier twice never duplicates its gifts");
  const p = preview({ quantities: { [helmetId]: 1 } }, "#inventaire");
  p.click("inventory-item", helmetId);
  check(p.element("#dialog-body").innerHTML.includes("Casque") && p.element("#dialog-body").innerHTML.includes("+2 MON · +2 RES"), "The inventory identifies helmet equipment and its exact bonuses");
  p.element("#item-target").value = "rider-a"; p.click("use-item", helmetId);
  same(p.state().riderEquipment["rider-a"], { helmet: helmetId }, "The helmet equips the selected rider's helmet slot");
  same(p.state().quantities[helmetId], 1, "Equipping keeps the permanent equipment in inventory");
  same(p.state().equipped, {}, "A rider helmet never becomes a DS portrait hat");
  p.click("inventory-item", helmetId); p.element("#item-target").value = "rider-a"; p.click("use-item", helmetId);
  same(p.state().riderEquipment["rider-a"], { helmet: helmetId }, "Re-equipping the same helmet does not stack rating increments");
  p.click("inventory-item", helmetId); p.element("#item-target").value = "rider-b"; p.click("use-item", helmetId);
  same(p.state().riderEquipment["rider-a"], {}, "Transferring removes the helmet from the first rider");
  same(p.state().riderEquipment["rider-b"], { helmet: helmetId }, "The single helmet moves to the second rider");
  same(p.state().quantities[helmetId], 1, "Transferring neither duplicates nor consumes the helmet");
  const restored = preview(p.state(), "#inventaire");
  same(restored.state().riderEquipment, p.state().riderEquipment, "The equipped rider helmet survives reloading the preview");
  const unavailable = preview({ quantities: {}, riderEquipment: {} });
  unavailable.element("#item-target").value = "rider-a"; unavailable.click("use-item", helmetId);
  same(unavailable.state().riderEquipment, {}, "A forged equip action cannot grant an unowned helmet");
  const migrated = preview({ milestones: [23500], quantities: {}, balance: 100 });
  same(migrated.state().quantities[helmetId], undefined, "An old collective tier never retroactively creates a contributor helmet");
  same(migrated.state().balance, 100, "Updating an old preview tier grants no extra currency");
  same(preview(migrated.state()).state().quantities[helmetId], undefined, "Reloading the preview does not grant a contributor helmet");
}
{
  const sniperId = "lunette-sniper-cadeaux";
  const scope = catalog.find(item => item.id === sniperId);
  check(scope?.price === 10 && scope.category === "gestion" && scope.useKind === "sniper" && !("limit" in scope), "The gift sniper scope costs ten Grelots and can be bought repeatedly");
  const p = preview({ quantities: {} });
  p.message({ type: "noel:tournee-prete", runId: "ready-without-scope" });
  same(p.sniperMessages.at(-1).data, { type: "noel:tournee-lunette", available: 0, prepared: false }, "A fresh mini-game receives zero automatic throws without an owned scope");
  p.start("without-scope", true);
  check(p.sniperMessages.at(-1).data.active === false && p.sniperMessages.at(-1).data.available === 0, "Requesting automatic launch without stock is explicitly refused");
  same(p.state().quantities[sniperId], undefined, "A refused automatic launch neither invents nor consumes a scope");
  p.finish("without-scope");
  same(p.state().runs[12].reward, 18, "A refused scope does not prevent the ordinary run from settling");
}
{
  const sniperId = "lunette-sniper-cadeaux";
  const p = preview({ quantities: { [sniperId]: 2 } }, "#inventaire");
  p.click("inventory-item", sniperId); p.click("use-item", sniperId);
  same(p.state().quantities[sniperId], 2, "Preparing the scope preserves stock until departure");
  same(p.state().sniperPrepared, true, "Preparing the scope arms exactly the next departure");
  const prepared = p.state(); p.click("use-item", sniperId);
  same(p.state(), prepared, "Preparing twice does not stack scope effects or consume a second item");
  const restored = preview(p.state());
  restored.element("#preview-day").value = "13"; restored.element("#preview-day").listeners.get("change")();
  restored.message({ type: "noel:tournee-prete", runId: "ready-after-reload" });
  same(restored.sniperMessages.at(-1).data.prepared, true, "A prepared, unused scope survives reloading and changing the preview day");
  restored.start("assisted-a", true);
  same(restored.state().quantities[sniperId], 1, "One assisted departure consumes exactly one scope");
  same(restored.state().sniperPrepared, false, "Departing clears the one-run preparation");
  check(restored.sniperMessages.at(-1).data.active === true && restored.sniperMessages.at(-1).data.runId === "assisted-a", "The iframe receives an authorization bound to this precise run");
  const started = restored.state(); restored.start("assisted-a", true);
  same(restored.state(), started, "A repeated departure message for the same run never consumes another scope");
  restored.click("use-item", sniperId);
  same(restored.state(), started, "An ongoing run cannot reserve or consume another scope");
  restored.finish("assisted-a");
  restored.message({ type: "noel:tournee-prete", runId: "assisted-a" });
  same(restored.sniperMessages.at(-1).data.prepared, false, "Finishing does not automatically prepare the next scope even with spare stock");
  restored.start("manual-b"); restored.finish("manual-b");
  same(restored.state().quantities[sniperId], 1, "The following manual run preserves the spare scope");
  const after = preview(restored.state()); const beforeOldMessage = after.state();
  after.start("assisted-a", true);
  same(after.state(), beforeOldMessage, "Replaying an old assisted run after reload cannot consume the spare scope");
}
{
  const sniperId = "lunette-sniper-cadeaux";
  const p = preview({ quantities: { [sniperId]: 1 }, sniperPrepared: true });
  p.start("manual-prepared", false);
  same(p.state().quantities[sniperId], 1, "Unchecking the option before departure preserves the item");
  same(p.state().sniperPrepared, false, "A manual departure also clears preparation so a later run is not silently assisted");
  p.finish("manual-prepared"); p.start("last-scope", true);
  check(p.sniperMessages.at(-1).data.active === true && p.sniperMessages.at(-1).data.available === 0, "Using the last scope authorizes its run even though remaining stock is zero");
  p.message({ type: "noel:tournee-prete", runId: "new-iframe-after-abandon" });
  same(p.state().quantities[sniperId], 0, "Reloading or abandoning an assisted run never refunds the used scope");
  const abandoned = p.state(); p.finish("last-scope");
  same(p.state(), abandoned, "An abandoned run cannot return later to settle rewards");
  p.click("buy", sniperId); p.click("use-item", sniperId);
  same(p.state().sniperPrepared, true, "After reloading the iframe, a fresh purchased scope can be prepared instead of being stuck behind the abandoned run");
  const reloaded = preview(p.state()); const before = reloaded.state();
  reloaded.start("last-scope", true);
  same(reloaded.state(), before, "An abandoned run identifier cannot be billed again after page reload");
  const messagesBefore = reloaded.sniperMessages.length;
  reloaded.message({ type: "noel:tournee-demarree", runId: "forged-auto", sniper: true }, { origin: "https://other.example.test" });
  reloaded.message({ type: "noel:tournee-demarree", runId: "forged-auto", sniper: true }, { source: {} });
  same(reloaded.state(), before, "A different source or origin cannot consume a prepared scope");
  same(reloaded.sniperMessages.length, messagesBefore, "A foreign source or origin never receives scope authorization");
}
{
  const sniperId = "lunette-sniper-cadeaux";
  const p = preview({ quantities: { [sniperId]: 2 } }, "#inventaire");
  p.click("use-item", sniperId);
  p.message({ type: "noel:tournee-lunette-choix", prepared: false });
  same(p.state().sniperPrepared, false, "Unchecking the scope in the mini-game clears the persisted preparation");
  same(p.state().quantities[sniperId], 2, "Unchecking a prepared scope preserves every owned item");
  p.click("buy", "boussole-polaire");
  same(p.sniperMessages.at(-1).data.prepared, false, "An unrelated shop purchase and commit cannot recheck the scope after a manual choice");
  const restored = preview(p.state());
  restored.message({ type: "noel:tournee-prete", runId: "ready-after-uncheck" });
  same(restored.sniperMessages.at(-1).data.prepared, false, "A reload preserves the player's unchecked scope choice");
  restored.message({ type: "noel:tournee-lunette-choix", prepared: true });
  same(restored.state().sniperPrepared, true, "Checking an owned scope arms the same persisted preparation as inventory use");
  same(restored.state().quantities[sniperId], 2, "Checking a scope never consumes it before departure");
  restored.start("choice-start", true);
  const running = restored.state(), beforeMessages = restored.sniperMessages.length;
  restored.message({ type: "noel:tournee-lunette-choix", prepared: true });
  restored.message({ type: "noel:tournee-lunette-choix", prepared: false });
  same(restored.state(), running, "Checkbox messages during an active run cannot change its preparation, grant or inventory");
  same(restored.sniperMessages.length, beforeMessages, "In-run preparation changes are ignored without an extra authorization");
  const empty = preview({ quantities: {} }), before = empty.state();
  empty.message({ type: "noel:tournee-lunette-choix", prepared: true });
  same(empty.state(), before, "A scope choice with no stock cannot arm free assistance");
  empty.message({ type: "noel:tournee-lunette-choix", prepared: false });
  same(empty.state().sniperPrepared, false, "Disabling the option remains harmless with no stock");
  const other = preview({ quantities: { [sniperId]: 1 } }), otherBefore = other.state();
  const otherMessages = other.sniperMessages.length;
  other.message({ type: "noel:tournee-lunette-choix", prepared: true }, { origin: "https://other.example.test" });
  other.message({ type: "noel:tournee-lunette-choix", prepared: true }, { source: {} });
  other.message({ type: "noel:tournee-lunette-choix", prepared: "true" });
  same(other.state(), otherBefore, "Foreign origins, foreign frames and non-boolean scope choices cannot arm assistance");
  same(other.sniperMessages.length, otherMessages, "Invalid preparation messages never receive an authorization response");
}
console.log(`Passed ${checks} Christmas preview purchase, run balance and replay flow checks.`);
