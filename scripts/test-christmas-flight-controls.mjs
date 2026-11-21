import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Exercise the shipped browser handlers and animation loop. Observations come
// from calls to the real physics API, without exposing or changing game state.
const physicsSource = readFileSync(new URL("../assets/christmas-preview/flight-physics.js", import.meta.url), "utf8");
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

function createHarness({ width = 800, height = 400, coarse = false } = {}) {
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
  browserWindow.parent = { postMessage: message => messages.push(plain(message)) };
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
  vm.runInContext(gameSource, scope, { filename: "tournee.js" });
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
  return {
    advance, pointer, key, space, start, latest, loseCapture, fire, setAutomatic, autoDrop,
    primary, canvas, root, browserWindow, bounds, captured,
    samples, launches, messages, physics,
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
  harness.setAutomatic(automatic);
  const collisions = [];
  let previousLock = false;
  let nextWaypoint = 0;
  harness.start();
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

// Touch assistance removes the second simultaneous gesture. It remains a user
// preference, so choosing manual once survives every later touch or keyboard use.
{
  const desktop = createHarness();
  check(desktop.autoDrop.checked === false, "Desktop starts with manual releases");
  const phone = createHarness({ width: 400, height: 200, coarse: true });
  check(phone.autoDrop.checked === true, "Phone starts with assisted releases before takeoff");
  desktop.start();
  desktop.pointer("pointerdown");
  check(desktop.autoDrop.checked === true, "Actual touch enables assistance on a hybrid device");
  desktop.pointer("pointerup");
  desktop.setAutomatic(false);
  desktop.pointer("pointerdown");
  check(desktop.autoDrop.checked === false, "Touch respects the explicit manual choice");
  desktop.pointer("pointerup");
  desktop.key("keydown", "ArrowLeft");
  check(desktop.autoDrop.checked === false, "Keyboard takeover respects the explicit manual choice");
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
    const result = { score: results[0].score, deliveries: results[0].deliveries };
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

console.log(`Passed ${checks} Christmas flight controls, obstacle recovery, assistance and parity checks.`);
