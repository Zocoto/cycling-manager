import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Script, createContext } from "node:vm";

export const CHRISTMAS_MAX_PROOF_TICKS = 4_000;
export const CHRISTMAS_MAX_PROOF_COMMANDS = 5_000;
type Input = { tick: number; kind: "input"; keys: string[]; pointer: [number, number] | null; automatic: boolean; granted: boolean };
type Drop = { tick: number; kind: "drop" };
export type ChristmasFlightProof = { version: 1; ticks: number; commands: (Input | Drop)[] };
export type ChristmasFlightVerdict = {
  score: number; deliveries: number; qualities: { successful: number; super: number; perfect: number };
};

const movementKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS"]);
const REPLAY_PAST_FINISH_MESSAGE = "La preuve dépasse la fin de tournée.";
const REPLAY_UNFINISHED_MESSAGE = "La tournée n’est pas terminée.";
let compiledGame: Script | undefined;
function replayScript() {
  if (compiledGame) return compiledGame;
  const base = join(process.cwd(), "assets", "christmas-preview");
  const game = readFileSync(join(base, "tournee.js"), "utf8");
  const hook = `
    globalThis.__christmasReplay = {
      start() { game = newFlight(); game.mode = "playing"; },
      input(command) {
        keys.clear(); for (const key of command.keys) keys.add(key);
        pointer = command.pointer ? { x: command.pointer[0], y: command.pointer[1] } : null;
        game.sniperGranted = command.granted; autoDrop.checked = command.automatic;
      },
      drop() { if (canRelease()) releaseParcel(launchState()); },
      tick,
      finished() { return game.mode === "finished"; },
      result() { return JSON.stringify({score:game.score,deliveries:game.deliveries,qualities:game.qualities}); }
    };
  })();`;
  if (!/\}\)\(\);\s*$/.test(game)) throw new Error("Christmas flight source is unavailable.");
  const source = ["rules.js", "flight-physics.js"].map(file => readFileSync(join(base, file), "utf8")).join("\n")
    + "\n" + game.replace(/\}\)\(\);\s*$/, hook);
  compiledGame = new Script(source, { filename: "christmas-trusted-flight.js" });
  return compiledGame;
}

function headlessEnvironment() {
  const nodes = new Map<string, Element>();
  const drawing = new Proxy<Record<string, unknown>>({}, {
    get: (_target, key) => key === "createLinearGradient" || key === "createRadialGradient"
      ? () => ({ addColorStop() {} }) : key === "measureText" ? () => ({ width: 10 }) : () => {},
    set: (target, key, value) => { target[String(key)] = value; return true; },
  });
  class Element {
    textContent = ""; hidden = false; checked = false; disabled = false; width = 1_200; height = 600;
    style = {}; scrollTop = 0; firstElementChild = { style: {} };
    classList = { toggle() {}, add() {}, remove() {} };
    attributes = new Map<string, string>();
    addEventListener() {} focus() {} contains() { return false; }
    setAttribute(key: string, value: string) { this.attributes.set(key, String(value)); }
    hasAttribute(key: string) { return this.attributes.has(key); }
    getAttribute(key: string) { return this.attributes.get(key) ?? null; }
    removeAttribute(key: string) { this.attributes.delete(key); }
    getBoundingClientRect() { return { width: 800, height: 400, left: 0, top: 0 }; }
    getContext() { return drawing; }
    setPointerCapture() {} hasPointerCapture() { return false; } releasePointerCapture() {}
    querySelector(selector: string): Element {
      if (!nodes.has(selector)) nodes.set(selector, new Element());
      return nodes.get(selector)!;
    }
  }
  const root = new Element();
  const window = { location: { origin: "https://replay.invalid" }, parent: { postMessage() {} }, addEventListener() {} };
  return {
    window, document: { getElementById: () => root, querySelector: () => root, activeElement: null },
    performance: { now: () => 0 }, matchMedia: () => ({ matches: false, addEventListener() {} }),
    getComputedStyle: () => ({ colorScheme: "light" }), requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  };
}

function validateProof(value: unknown, wallSeconds: number, sniper: boolean): ChristmasFlightProof {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some(key => !["version", "ticks", "commands"].includes(key))) throw new Error("Preuve de tournée invalide.");
  const proof = value as ChristmasFlightProof;
  if (proof.version !== 1 || !Number.isSafeInteger(proof.ticks) || proof.ticks < 1 || proof.ticks > CHRISTMAS_MAX_PROOF_TICKS
    || !Number.isFinite(wallSeconds) || wallSeconds < 0 || proof.ticks / 120 > wallSeconds + .5
    || !Array.isArray(proof.commands) || proof.commands.length > CHRISTMAS_MAX_PROOF_COMMANDS) throw new Error("Durée ou commandes de tournée invalides.");
  let previous = -1;
  let lastDrop = -1;
  for (const command of proof.commands) {
    if (!command || typeof command !== "object" || Array.isArray(command)
      || !Number.isSafeInteger(command.tick) || command.tick < previous || command.tick < 0 || command.tick >= proof.ticks) throw new Error("Commandes de tournée invalides.");
    previous = command.tick;
    if (command.kind === "drop") {
      if (command.tick === lastDrop || Object.keys(command).some(key => !["tick", "kind"].includes(key))) throw new Error("Commandes de tournée invalides.");
      lastDrop = command.tick;
    } else if (command.kind === "input") {
      if (Object.keys(command).some(key => !["tick", "kind", "keys", "pointer", "automatic", "granted"].includes(key))
        || !Array.isArray(command.keys) || command.keys.length > 8 || new Set(command.keys).size !== command.keys.length
        || command.keys.some(key => !movementKeys.has(key)) || typeof command.automatic !== "boolean" || typeof command.granted !== "boolean"
        || (command.granted && !sniper)
        || (command.pointer !== null && (!Array.isArray(command.pointer) || command.pointer.length !== 2
          || command.pointer.some(position => !Number.isFinite(position)) || command.pointer[0] < 190 || command.pointer[0] > 708
          || command.pointer[1] < 72 || command.pointer[1] > 211))) throw new Error("Commandes de tournée invalides.");
    } else throw new Error("Commandes de tournée invalides.");
  }
  return proof;
}

/** Replays the validated game's actual physics; browser scores never choose a reward. */
export function validateChristmasFlight(value: unknown, wallSeconds: number, sniper = false): ChristmasFlightVerdict {
  const proof = validateProof(value, wallSeconds, sniper);
  const context = createContext({ ...headlessEnvironment(), __proof: proof });
  replayScript().runInContext(context, { timeout: 500 });
  new Script(`
    __christmasReplay.start();
    let cursor = 0;
    for (let tick = 0; tick < __proof.ticks; tick++) {
      if (__christmasReplay.finished()) throw Error(${JSON.stringify(REPLAY_PAST_FINISH_MESSAGE)});
      while (cursor < __proof.commands.length && __proof.commands[cursor].tick === tick) {
        const command = __proof.commands[cursor++];
        if (command.kind === "input") __christmasReplay.input(command); else __christmasReplay.drop();
      }
      __christmasReplay.tick();
    }
    if (!__christmasReplay.finished()) throw Error(${JSON.stringify(REPLAY_UNFINISHED_MESSAGE)});
    globalThis.__result = __christmasReplay.result();
  `).runInContext(context, { timeout: 750 });
  return JSON.parse(context.__result as string) as ChristmasFlightVerdict;
}
