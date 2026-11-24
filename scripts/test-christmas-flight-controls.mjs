import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Exercise the shipped browser handlers and animation loop. Original controls
// observe the real physics API; precision fixtures instrument a test-only copy
// of the game closure. No hooks are shipped or production state accessed.
const physicsSource = readFileSync(new URL("../assets/christmas-preview/flight-physics.js", import.meta.url), "utf8");
const rulesSource = readFileSync(new URL("../assets/christmas-preview/rules.js", import.meta.url), "utf8");
const gameSource = readFileSync(new URL("../assets/christmas-preview/tournee.js", import.meta.url), "utf8");
const initialPosition = { x: 295, y: 143 };
let checks = 0;

function check(condition, label) {
  assert.ok(condition, label);
  checks += 1;
}

function near(actual, expected, label, tolerance = 1e-7) {
  check(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function createHarness({ width = 800, height = 400, coarse = false, standalone = false } = {}) {
  let now = 0;
  let scheduledFrame = null;
  const samples = [];
  const launches = [];
  const messages = [];
  const bounds = { left: 30, top: 20, width, height };
  const captured = new Set();
  const elements = new Map();
  const documentState = { activeElement: null };

  function fire(target, type, properties = {}) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, properties);
    Object.defineProperty(event, "target", { value: target });
    for (let current = target; current; current = current.parentElement) {
      current.dispatchEvent(event);
      if (event.cancelBubble) break;
    }
    return event;
  }

  class Element extends EventTarget {
    constructor() {
      super();
      this.textContent = "";
      this.style = {};
      this.attributes = new Map();
      this.classList = { toggle() {}, add() {}, remove() {} };
      this.parentElement = null;
      this.firstElementChild = { style: {} };
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    removeAttribute(name) { this.attributes.delete(name); }
    focus() {
      const previous = documentState.activeElement;
      documentState.activeElement = this;
      if (previous && previous !== this) fire(previous, "focusout", { relatedTarget: this });
    }
    contains(element) {
      for (let current = element; current; current = current.parentElement) {
        if (current === this) return true;
      }
      return false;
    }
    getBoundingClientRect() { return bounds; }
  }

  const context = new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === "createLinearGradient" || key === "createRadialGradient") {
        return () => ({ addColorStop() {} });
      }
      if (key === "measureText") return () => ({ width: 10 });
      return () => {};
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  const browserWindow = new Element();
  const root = new Element();
  root.parentElement = browserWindow;
  const canvas = new Element();
  canvas.parentElement = root;
  canvas.width = 1200;
  canvas.height = 600;
  canvas.getContext = () => context;
  canvas.setPointerCapture = id => captured.add(id);
  canvas.hasPointerCapture = id => captured.has(id);
  canvas.releasePointerCapture = id => {
    if (captured.delete(id)) fire(canvas, "lostpointercapture", { pointerId: id });
  };
  root.querySelector = selector => {
    if (selector === "canvas") return canvas;
    if (!elements.has(selector)) {
      const element = new Element();
      element.parentElement = root;
      elements.set(selector, element);
    }
    return elements.get(selector);
  };
  const primary = root.querySelector("[data-drop]");
  const shell = new Element();
  const document = new Element();
  document.getElementById = () => root;
  document.querySelector = () => shell;
  Object.defineProperty(document, "activeElement", { get: () => documentState.activeElement });
  browserWindow.location = { origin: "https://preview.example.invalid" };
  browserWindow.parent = standalone ? browserWindow : { postMessage: message => messages.push(plain(message)) };
  const media = new Element();
  media.matches = false;
  const coarseMedia = new Element();
  coarseMedia.matches = coarse;

  const scope = vm.createContext({
    window: browserWindow,
    document,
    performance: { now: () => now },
    matchMedia: query => query === "(pointer: coarse)" ? coarseMedia : media,
    getComputedStyle: () => ({ colorScheme: "light" }),
    requestAnimationFrame(callback) { scheduledFrame = callback; return 1; },
    cancelAnimationFrame() { scheduledFrame = null; },
  });
  vm.runInContext(rulesSource, scope, { filename: "rules.js" });
  vm.runInContext(physicsSource, scope, { filename: "flight-physics.js" });
  const physics = scope.ChristmasFlightPhysics;
  scope.ChristmasFlightPhysics = {
    ...physics,
    updateSleigh(sleigh, tug, elapsed) {
      const result = physics.updateSleigh(sleigh, tug, elapsed);
      samples.push({ tug: plain(tug), sleigh: plain(sleigh) });
      return result;
    },
    createParcel(sleigh, options) {
      assert.deepEqual(Object.keys(options).sort(), ["courseSpeed", "distance", "wind"], "Game launch never supplies a pointer aim");
      const parcel = physics.createParcel(sleigh, options);
      // The target guide also predicts parcels. Only a real throw assigns
      // its landing before putting the parcel into the running simulation.
      return new Proxy(parcel, {
        set(target, key, value) {
          if (key === "landing") launches.push({ options: plain(options), parcel: plain(target), sleigh: plain(sleigh) });
          return Reflect.set(target, key, value);
        },
      });
    },
  };
  // Test-only observation of closure state. No hooks are shipped in the game.
  const observedSource = gameSource.replace(/\}\)\(\);\s*$/, `
    globalThis.__flightQA = { state: () => game, launchState, findLanding, releaseParcel, precisionTargetX, draw };
  })();`);
  assert.notEqual(observedSource, gameSource, "Locate the shipped game's closure for isolated observations");
  vm.runInContext(observedSource, scope, { filename: "tournee.js" });
  fire(browserWindow, "load");

  function advance(milliseconds) {
    const until = now + milliseconds;
    while (now < until) {
      now = Math.min(until, now + 1000 / 60);
      const callback = scheduledFrame;
      scheduledFrame = null;
      if (callback) callback(now);
    }
  }

  function pointer(type, {
    id = 1, kind = "touch", x = 130, y = 80, target = canvas, button = 0,
  } = {}) {
    const event = fire(target, type, {
      pointerId: id, pointerType: kind, button,
      buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1,
      clientX: x, clientY: y, isPrimary: id === 1,
    });
    // Browsers implicitly release capture after up or cancellation.
    if (type === "pointerup" || type === "pointercancel") canvas.releasePointerCapture(id);
    return event;
  }

  function key(type, code, { repeat = false, target = primary } = {}) {
    return fire(target, type, { code, key: code === "Space" ? " " : code, repeat });
  }

  function space({ repeat = false } = {}) {
    const down = key("keydown", "Space", { repeat });
    const up = key("keyup", "Space");
    // Model the browser's default activation of a focused button on keyup.
    if (!down.defaultPrevented && !up.defaultPrevented) fire(primary, "click", { detail: 0 });
    return down;
  }

  function start() { fire(primary, "click", { detail: 1 }); }
  function latest() { return samples[samples.length - 1]; }
  function loseCapture(id = 1) { canvas.releasePointerCapture(id); }
  const autoDrop = root.querySelector("[data-auto-drop]");
  function setAutomatic(checked) { autoDrop.checked = checked; fire(autoDrop, "change"); }
  function parentMessage(data, extras = {}) {
    return fire(browserWindow, "message", {
      source: browserWindow.parent, origin: browserWindow.location.origin, data, ...extras,
    });
  }
  function stock(available, prepared = false) {
    parentMessage({ type: "noel:tournee-lunette", available, prepared });
  }
  function grant(active = true, extras = {}) {
    const run = messages.findLast(message => message.type === "noel:tournee-demarree");
    parentMessage({ type: "noel:tournee-lunette", available: 0, active, runId: run?.runId, ...extras });
  }
  return {
    advance, pointer, key, space, start, latest, loseCapture, fire, setAutomatic, autoDrop, parentMessage, stock, grant,
    primary, canvas, root, browserWindow, bounds, captured,
    samples, launches, messages, physics, rules: scope.noelRules, qa: scope.__flightQA,
    element: selector => root.querySelector(selector),
    elapsed: () => now,
  };
}

function dragRun({ kind = "touch", width = 800, height = 400 } = {}) {
  const harness = createHarness({ width, height });
  harness.start();
  harness.pointer("pointerdown", { kind, x: 130, y: 80 });
  harness.pointer("pointermove", { kind, x: 130 + width / 10, y: 80 + height / 10 });
  harness.advance(120);
  return harness;
}

// The physics API also ignores a stale aim supplied by an older caller.
{
  const { physics } = createHarness();
  const sleigh = physics.createSleigh({ ...initialPosition, vx: 0, vy: 0 });
  const options = { distance: 100, courseSpeed: 236, wind: 0 };
  const first = physics.createParcel(sleigh, { ...options, aim: { x: 0, y: 390 } });
  const second = physics.createParcel(sleigh, { ...options, aim: { x: 800, y: 220 } });
  assert.deepEqual(plain(first), plain(second), "Physics ignores obsolete pointer aim");
  checks += 1;
}

// Keyboard motion works in both axes and stops on release.
for (const [code, axis, sign] of [
  ["ArrowRight", "x", 1], ["ArrowLeft", "x", -1],
  ["ArrowDown", "y", 1], ["ArrowUp", "y", -1],
]) {
  const harness = createHarness();
  harness.start();
  check(harness.key("keydown", code).defaultPrevented, `${code} cancels scrolling`);
  harness.advance(100);
  const moving = harness.latest().tug;
  check((moving[axis] - initialPosition[axis]) * sign > 0, `${code} moves in its direction`);
  harness.key("keyup", code);
  harness.advance(100);
  near(harness.latest().tug[axis], moving[axis], `${code} release stops movement`);
  near(harness.latest().tug.vx, 0, `${code} release clears horizontal command`);
  near(harness.latest().tug.vy, 0, `${code} release clears vertical command`);
}

// Mouse and touch share the same steering and CSS-to-game conversion.
{
  const mouse = dragRun({ kind: "mouse" });
  const touch = dragRun();
  const small = dragRun({ width: 400, height: 200 });
  for (const [label, harness] of [["mouse", mouse], ["touch", touch], ["scaled touch", small]]) {
    check(harness.captured.has(1), `${label} captures its steering pointer`);
    check(harness.latest().tug.x > initialPosition.x && harness.latest().tug.y > initialPosition.y, `${label} steers in two axes`);
    check(harness.launches.length === 0, `${label} drag never throws`);
    near(harness.latest().tug.x, touch.latest().tug.x, `${label} horizontal parity`);
    near(harness.latest().tug.y, touch.latest().tug.y, `${label} vertical parity`);
  }
}

// Releasing control stops the tug, while its spring-driven sleigh keeps moving.
for (const termination of ["pointerup", "pointercancel", "lostpointercapture"]) {
  const harness = dragRun();
  const before = harness.latest();
  if (termination === "lostpointercapture") harness.loseCapture();
  else harness.pointer(termination, { x: 210, y: 120 });
  harness.advance(100);
  const after = harness.latest();
  near(after.tug.x, before.tug.x, `${termination} holds horizontal position`);
  near(after.tug.y, before.tug.y, `${termination} holds vertical position`);
  near(after.tug.vx, 0, `${termination} clears horizontal command`);
  near(after.tug.vy, 0, `${termination} clears vertical command`);
  check(Math.hypot(after.sleigh.x - before.sleigh.x, after.sleigh.y - before.sleigh.y) > .01, `${termination} preserves sleigh inertia`);
}

// A tap/click on the scene steers only. Pointer hover cannot aim a throw.
for (const kind of ["mouse", "touch"]) {
  const harness = createHarness();
  harness.start();
  harness.pointer("pointermove", { kind, x: 700, y: 350 });
  harness.pointer("pointerdown", { kind });
  harness.pointer("pointerup", { kind });
  harness.advance(50);
  check(harness.launches.length === 0, `${kind} tap never throws`);
  near(harness.latest().tug.x, initialPosition.x, `${kind} tap does not move horizontally`);
  near(harness.latest().tug.y, initialPosition.y, `${kind} tap does not move vertically`);
  harness.fire(harness.primary, "click", { detail: 1 });
  check(harness.launches.length === 1, `${kind} uses the common throw button`);
}

// A second finger on the scene is ignored; a second finger on the button works.
{
  const harness = dragRun();
  harness.pointer("pointerdown", { id: 2, x: 750, y: 350 });
  harness.pointer("pointermove", { id: 2, x: 30, y: 20 });
  harness.pointer("pointerup", { id: 2, x: 30, y: 20 });
  check(harness.captured.has(1) && !harness.captured.has(2), "Second scene finger cannot take steering capture");
  const before = harness.latest().tug.x;
  harness.pointer("pointerdown", { id: 2, target: harness.primary });
  harness.pointer("pointerup", { id: 2, target: harness.primary });
  harness.fire(harness.primary, "click", { detail: 1 });
  check(harness.launches.length === 1, "Second finger activates the common throw button");
  check(harness.captured.has(1), "Throw button leaves steering capture active");
  harness.advance(50);
  check(harness.latest().tug.x > before, "First finger continues steering during the throw");
}

// Arrow input takes over from a pointer target, including pending pointer moves.
{
  const harness = dragRun();
  const before = harness.latest().tug;
  harness.key("keydown", "ArrowLeft");
  harness.pointer("pointermove", { x: 600, y: 350 });
  harness.advance(80);
  check(harness.latest().tug.x < before.x, "Arrow key takes over horizontal steering");
  near(harness.latest().tug.y, before.y, "Stale pointer no longer pulls vertically");
  harness.key("keyup", "ArrowLeft");
  harness.advance(50);
  near(harness.latest().tug.vx, 0, "Key takeover stops on keyup");
}

// Blur clears both input sources; a temporarily hidden canvas never divides by zero.
{
  const harness = dragRun();
  harness.key("keydown", "ArrowDown");
  harness.fire(harness.browserWindow, "blur");
  const before = harness.latest().tug;
  harness.advance(100);
  near(harness.latest().tug.x, before.x, "Blur stops horizontal steering");
  near(harness.latest().tug.y, before.y, "Blur stops vertical steering");
}
{
  const harness = createHarness();
  harness.start();
  harness.pointer("pointerdown");
  harness.bounds.width = 0;
  harness.bounds.height = 0;
  harness.pointer("pointermove", { x: 600, y: 350 });
  harness.advance(50);
  check(Object.values(harness.latest().tug).every(Number.isFinite), "Zero-sized scene retains finite tug state");
  near(harness.latest().tug.x, initialPosition.x, "Zero-sized scene ignores horizontal drag");
  near(harness.latest().tug.y, initialPosition.y, "Zero-sized scene ignores vertical drag");
}

// Space cancels native button activation, never repeats, and works at both ends.
{
  const harness = createHarness();
  check(harness.space({ repeat: true }).defaultPrevented, "Ready-state repeated Space cancels button default");
  check(harness.messages.filter(message => message.type === "noel:tournee-demarree").length === 0, "Repeated Space never starts a run");
  check(harness.space().defaultPrevented, "Start Space cancels button default");
  check(harness.messages.filter(message => message.type === "noel:tournee-demarree").length === 1, "Space starts exactly one run");
  check(harness.launches.length === 0, "Starting Space does not also throw on keyup");
  harness.advance(50);
  check(harness.space().defaultPrevented, "Playing Space cancels button default");
  check(harness.launches.length === 1, "Playing Space throws exactly once");
  harness.advance(1250);
  check(harness.space({ repeat: true }).defaultPrevented, "Held Space always cancels button default");
  check(harness.launches.length === 1, "Held Space cannot throw another parcel after the first lands");
  harness.advance(28000);
  check(harness.messages.some(message => message.type === "noel:tournee-terminee"), "Real animation loop finishes the run");
  check(harness.space({ repeat: true }).defaultPrevented, "Finished-state repeated Space cancels button default");
  check(harness.messages.filter(message => message.type === "noel:tournee-demarree").length === 1, "Held Space never restarts a finished run");
  check(harness.space().defaultPrevented, "Restart Space cancels button default");
  check(harness.messages.filter(message => message.type === "noel:tournee-demarree").length === 2, "Fresh Space restarts exactly once");
  check(harness.launches.length === 1, "Restart does not immediately throw a second parcel");
}

function traceObstacleRun({ waypoints = [], kind = "touch", width = 800, height = 400, automatic = false } = {}) {
  const harness = createHarness({ width, height });
  if (automatic) harness.stock(1);
  harness.setAutomatic(automatic);
  const collisions = [];
  let previousLock = false;
  let nextWaypoint = 0;
  harness.start();
  if (automatic) harness.grant();
  harness.pointer("pointerdown", { kind, x: harness.bounds.left + width / 2, y: harness.bounds.top + height / 2 });
  for (let frame = 0; frame < 1800; frame += 1) {
    if (nextWaypoint < waypoints.length && harness.elapsed() / 1000 >= waypoints[nextWaypoint][0]) {
      const [, targetY] = waypoints[nextWaypoint++];
      harness.pointer("pointermove", {
        kind,
        x: harness.bounds.left + width / 2,
        y: harness.bounds.top + height / 2 + (targetY - initialPosition.y) * height / 400,
      });
    }
    harness.advance(1000 / 60);
    const locked = harness.primary.textContent.startsWith("Lancer bloqué");
    if (locked && !previousLock) collisions.push(harness.elapsed() / 1000);
    previousLock = locked;
  }
  return { harness, collisions };
}

// Obstacles prevent parking in one flight lane, without ending or stalling a run.
for (const [label, waypoints] of [["centre", []], ["top", [[0, 72]]], ["bottom", [[0, 211]]]]) {
  const { harness, collisions } = traceObstacleRun({ waypoints });
  check(collisions.length > 0, `Parking at the ${label} encounters an obstacle`);
  const results = harness.messages.filter(message => message.type === "noel:tournee-terminee");
  check(results.length === 1, `Repeated collisions at the ${label} still finish exactly once`);
  check(results[0].deliveries === 0 && Number.isSafeInteger(results[0].score), `${label} collision run has a valid result`);
}

// A collision briefly disables a new release, consumes no gift, then recovers.
{
  const harness = createHarness();
  harness.start();
  for (let frame = 0; frame < 480 && !harness.primary.textContent.startsWith("Lancer bloqué"); frame += 1) {
    harness.advance(1000 / 60);
  }
  check(harness.primary.textContent.startsWith("Lancer bloqué"), "Real convoy collision activates the release lock");
  const giftsBefore = harness.element("[data-gifts]").textContent;
  harness.fire(harness.primary, "click", { detail: 1 });
  check(harness.launches.length === 0, "Blocked release does not create a parcel");
  check(harness.element("[data-gifts]").textContent === giftsBefore, "Blocked release consumes no gift");
  harness.advance(1300);
  check(!harness.primary.textContent.startsWith("Lancer bloqué"), "Collision lock clears after its short 1.2-second penalty");
  harness.fire(harness.primary, "click", { detail: 1 });
  check(harness.launches.length === 1, "Throwing works again after collision recovery");
}

// A visible, deliberately simple altitude route avoids every obstacle. Exercise
// the shipped handlers at desktop and phone sizes rather than replacing collision
// rules with a second implementation in the test.
{
  const waypoints = [[0, 72], [11.5, 175], [17.4, 72]];
  const runs = [
    ["mouse", traceObstacleRun({ waypoints, kind: "mouse" })],
    ["touch", traceObstacleRun({ waypoints })],
    ["phone touch", traceObstacleRun({ waypoints, width: 400, height: 200 })],
  ];
  for (const [label, { harness, collisions }] of runs) {
    check(collisions.length === 0, `${label} can fly the complete avoidance route without a collision`);
    check(harness.messages.filter(message => message.type === "noel:tournee-terminee").length === 1, `${label} avoidance route finishes exactly once`);
    check(harness.samples.every(({ tug, sleigh }) => Object.values(tug).every(Number.isFinite)
      && Object.values(sleigh).every(Number.isFinite)), `${label} avoidance route retains finite physics`);
    assert.deepEqual(harness.samples, runs[0][1].harness.samples, `${label} has identical avoidance physics`);
    checks += 1;
  }
}

// Manual releases are the same default on phones, desktop and hybrid devices.
// Pointer type can change the instructions, never unlock a paid consumable.
{
  const desktop = createHarness();
  check(desktop.autoDrop.checked === false, "Desktop starts with manual releases");
  const phone = createHarness({ width: 400, height: 200, coarse: true });
  check(phone.autoDrop.checked === false, "Phone also starts with manual releases before takeoff");
  check(desktop.autoDrop.disabled && phone.autoDrop.disabled, "No owned scope means no selectable automatic option");
  check(desktop.element("[data-sniper-control]").hidden && phone.element("[data-sniper-control]").hidden, "Automatic option is hidden without a scope");
  desktop.start();
  desktop.pointer("pointerdown");
  check(desktop.autoDrop.checked === false, "Actual touch never enables free assistance on a hybrid device");
  desktop.pointer("pointerup");
  desktop.setAutomatic(true);
  check(desktop.autoDrop.checked === false, "A programmatic toggle cannot unlock assistance without an item");
  desktop.pointer("pointerdown");
  check(desktop.autoDrop.checked === false, "Subsequent touch retains manual release");
  desktop.pointer("pointerup");
  desktop.key("keydown", "ArrowLeft");
  check(desktop.autoDrop.checked === false, "Keyboard takeover also retains manual release");
}

// Possession reveals a choice, not a free or permanent preference. The parent
// must authorize exactly the requested run after consuming one owned scope.
{
  const harness = createHarness();
  check(harness.messages.some(message => message.type === "noel:tournee-prete"), "The ready frame asks its parent for owned scope stock");
  harness.stock(2);
  check(!harness.element("[data-sniper-control]").hidden && !harness.autoDrop.disabled, "Owned scopes reveal the optional control before departure");
  check(harness.autoDrop.checked === false, "Owning scopes alone leaves manual mode selected");
  check(!harness.key("keydown", "Space", { target: harness.autoDrop }).defaultPrevented, "Space on the scope checkbox retains its native selection behaviour");
  check(!harness.messages.some(message => message.type === "noel:tournee-demarree"), "Selecting the scope checkbox never starts a run");
  harness.stock(2, true);
  check(harness.autoDrop.checked === true, "Preparing an owned scope selects it for the next departure");
  harness.setAutomatic(false);
  check(harness.messages.findLast(message => message.type === "noel:tournee-lunette-choix")?.prepared === false, "Unchecking before departure tells the parent to clear its saved preparation");
  harness.stock(2, false);
  check(harness.autoDrop.checked === false, "The parent's refreshed saved choice preserves manual mode");
  harness.setAutomatic(true);
  check(harness.messages.findLast(message => message.type === "noel:tournee-lunette-choix")?.prepared === true, "Checking before departure prepares one owned scope through the parent");
  harness.start();
  const run = harness.messages.findLast(message => message.type === "noel:tournee-demarree");
  check(run.sniper === true, "The departure captures the prepared choice before resetting its run state");
  harness.stock(1, false);
  check(harness.autoDrop.checked === false, "A pending request still waits for consumption authorization");
  harness.grant(true, { available: 1 });
  check(harness.autoDrop.checked === true && !harness.autoDrop.disabled, "Matching parent authorization activates this run even after stock changed");
  harness.stock(0, false);
  check(harness.autoDrop.checked === true && !harness.element("[data-sniper-control]").hidden, "A consumed last scope stays active for its own run");
  harness.setAutomatic(false);
  check(harness.autoDrop.checked === false, "A paid run may temporarily disable automatic release");
  harness.grant();
  check(harness.autoDrop.checked === false, "Duplicate authorization preserves a paid run's explicit manual choice");
  harness.setAutomatic(true);
  check(harness.autoDrop.checked === true, "The same paid run may re-enable its existing authorization");
  harness.advance(30000);
  check(harness.autoDrop.checked === false && harness.autoDrop.disabled, "Finishing clears the run authorization and selection");
  check(harness.element("[data-sniper-control]").hidden, "The depleted automatic control disappears after the run");
  harness.start();
  check(harness.messages.findLast(message => message.type === "noel:tournee-demarree").sniper === false, "The following departure cannot reuse the consumed scope");
  harness.parentMessage({ type: "noel:tournee-lunette", available: 0, active: true, runId: run.runId });
  check(harness.autoDrop.checked === false, "A late authorization from the previous run cannot enable the new run");
}

// A forged checkbox, an unrequested grant, stale grants and untrusted windows
// never bypass the frame's explicit one-run permission.
{
  const harness = createHarness();
  harness.autoDrop.checked = true;
  harness.start();
  check(harness.messages.findLast(message => message.type === "noel:tournee-demarree").sniper === false, "A forged checkbox with no stock never requests a scope");
  harness.grant();
  check(harness.autoDrop.checked === false, "Unrequested parent authorization cannot activate a manual run");
  harness.advance(30000);
  check(harness.launches.length === 0, "A manual run never produces automatic throws");
}
for (const tamper of ["source", "origin", "run", "denied", "missing"]) {
  const harness = createHarness();
  harness.stock(1, true);
  harness.start();
  const run = harness.messages.findLast(message => message.type === "noel:tournee-demarree");
  const payload = { type: "noel:tournee-lunette", available: 0, active: true, runId: run.runId };
  if (tamper === "run") payload.runId = "stale-run";
  if (tamper === "denied") payload.active = false;
  if (tamper !== "missing") harness.parentMessage(payload,
    tamper === "source" ? { source: {} } : tamper === "origin" ? { origin: "https://untrusted.example.test" } : {});
  harness.advance(30000);
  check(harness.launches.length === 0, `${tamper}: no automatic throw without a valid current-run grant`);
}
{
  const standalone = createHarness({ coarse: true, standalone: true });
  standalone.stock(1, true);
  check(standalone.autoDrop.checked === false && standalone.autoDrop.disabled, "Opening the standalone game never grants a free scope");
}

// The real loop chooses only a genuine aligned throw and honours obstacle locks.
// The same single-finger avoidance route earns exactly the same result at phone
// size and at desktop size, without any manual click or Space release.
{
  const waypoints = [[0, 72], [11.5, 175], [17.4, 72]];
  const runs = [
    ["desktop assisted", traceObstacleRun({ waypoints, kind: "mouse", automatic: true })],
    ["phone assisted", traceObstacleRun({ waypoints, width: 400, height: 200, automatic: true })],
  ];
  let reference;
  for (const [label, { harness, collisions }] of runs) {
    const results = harness.messages.filter(message => message.type === "noel:tournee-terminee");
    check(results.length === 1, `${label} finishes exactly once`);
    const result = { score: results[0].score, deliveries: results[0].deliveries, qualities: results[0].qualities };
    check(result.deliveries >= 10, `${label} delivers most of the village using one steering gesture`);
    check(collisions.length === 0, `${label} retains the same obstacle avoidance challenge`);
    check(harness.launches.length <= 14, `${label} never spends more than the gift allowance`);
    if (reference) {
      assert.deepEqual(result, reference, "Phone and desktop assistance earn identical score and deliveries");
      checks += 1;
    }
    reference = result;
    for (const launch of harness.launches) {
      assert.deepEqual(launch.parcel, plain(harness.physics.createParcel(launch.sleigh, launch.options)));
    }
  }
}

// The precision target moves inside the opening while the actual ballistic
// forecast remains untouched. Samples use the shipped rule and game helper.
{
  const harness = createHarness();
  const chimney = harness.qa.state().chimneys[0];
  const positions = [0, .275, .55, .825, 1.1].map(time => harness.qa.precisionTargetX(chimney, time));
  check(Math.max(...positions) - Math.min(...positions) > 1, "The anchored precision marker visibly oscillates");
  near(positions[0], positions.at(-1), "The precision marker has a stable period");
  check(positions.every(x => Math.abs(x - chimney.x) <= Math.min(8, (chimney.size / 2 - 5) * .65) + 1e-7), "Precision movement stays small and inside the opening");
}

function preparePrecisionThrow(harness, error) {
  harness.start();
  const state = harness.qa.state();
  state.time = 1.375;
  state.distance = 300;
  const chimney = state.chimneys[0];
  const parcel = harness.qa.launchState();
  const time = harness.physics.fallTime(parcel, chimney.y);
  const forecastX = harness.physics.parcelAt(parcel, time).x;
  const precisionX = harness.qa.precisionTargetX(chimney);
  const shift = precisionX + error - forecastX;
  state.sleigh.x += shift;
  state.player.x += shift;
  harness.qa.draw();
  return { state, chimney, precisionX };
}

// Identical mouse/keyboard/touch releases grade the same true trajectory.
// The target may subsequently move, but an accepted parcel never changes grade.
for (const [quality, error, label, expectedScore] of [
  ["perfect", 0, "Parfait", 150],
  ["super", 7.2, "Super", 130],
  ["successful", 20.4, "Réussi", 110],
]) {
  let reference;
  for (const [device, options] of [["desktop", {}], ["touch", { width: 400, height: 200, coarse: true }]]) {
    const harness = createHarness(options);
    const { state, precisionX } = preparePrecisionThrow(harness, error);
    const predicted = harness.qa.launchState();
    if (device === "desktop") harness.space();
    else harness.fire(harness.primary, "click", { detail: 1 });
    const accepted = state.parcel?.landing;
    check(accepted?.quality === quality, `${device} captures the ${quality} tier at release`);
    near(accepted.precisionX, precisionX, `${device} captures the moving target position`);
    const frozen = plain(accepted);
    assert.deepEqual(plain(state.parcel).x, predicted.x, "Quality never changes the physical launch origin");
    near(state.parcel.vx, predicted.vx, "Quality never changes physical horizontal speed");
    near(state.parcel.vy, predicted.vy, "Quality never changes physical vertical speed");
    harness.advance(180);
    check(state.parcel?.landing.quality === quality, `${device} retains the release tier while airborne`);
    near(state.parcel.landing.precisionX, frozen.precisionX, `${device} retains the release target while airborne`);
    harness.advance(700);
    check(state.qualities[quality] === 1 && Object.values(state.qualities).reduce((sum, count) => sum + count, 0) === 1,
      `${device} counts exactly one ${quality} delivery`);
    check(state.score === expectedScore && state.deliveries === 1, `${device} awards the ${quality} points once`);
    check(harness.element("[data-status]").textContent.includes(label), `${device} announces ${label} feedback`);
    const result = { qualities: plain(state.qualities), score: state.score, deliveries: state.deliveries };
    if (reference) { assert.deepEqual(result, reference, `${quality} has identical desktop and touch rewards`); checks++; }
    reference = result;
  }
}

// Full assisted results carry all grades through the real message boundary.
{
  const { harness } = traceObstacleRun({ waypoints: [[0, 72], [11.5, 175], [17.4, 72]], automatic: true });
  const result = harness.messages.find(message => message.type === "noel:tournee-terminee");
  check(result && Object.keys(result.qualities).sort().join(",") === "perfect,successful,super", "The completion message includes exactly the three quality counters");
  check(Object.values(result.qualities).every(Number.isSafeInteger)
    && Object.values(result.qualities).reduce((sum, count) => sum + count, 0) === result.deliveries,
    "Completion qualities match real successful deliveries");
  check(result.qualities.perfect < result.deliveries, "A scope does not turn all assisted launches into perfect throws");
}

console.log(`Passed ${checks} Christmas flight controls, obstacle recovery, quality, assistance and parity checks.`);
