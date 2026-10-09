import { createRunnerPreview, stepRunnerPreview, runnerSnapshot } from "./halloween-runner";

export const HALLOWEEN_EDITION = "halloween-2026";
export const HALLOWEEN_START = "2026-10-08T22:00:00.000Z";
export const HALLOWEEN_END = "2026-11-02T23:00:00.000Z";
export const HALLOWEEN_SHOP_END = "2026-11-09T23:00:00.000Z";
export const MAX_RUN_TICKS = 108000;
export const MAX_RUN_COMMANDS = 12000;
export type HalloweenCommand = { tick: number; jump?: boolean; duck?: boolean };
export type HalloweenProof = { ticks: number; commands: HalloweenCommand[] };

/** Recompute all rewards. Client distance, coins and score are never accepted. */
export function validateHalloweenRun(seed: number, proof: unknown, wallSeconds: number) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isFinite(wallSeconds) || wallSeconds < 0) throw new Error("Session invalide.");
  if (!proof || typeof proof !== "object") throw new Error("Preuve de partie manquante.");
  const { ticks, commands } = proof as HalloweenProof;
  if (!Number.isSafeInteger(ticks) || ticks < 1 || ticks > MAX_RUN_TICKS || ticks / 60 > wallSeconds + .25) throw new Error("Durée de partie invalide.");
  if (!Array.isArray(commands) || commands.length > MAX_RUN_COMMANDS) throw new Error("Commandes invalides.");
  let previous = -1;
  for (const command of commands) {
    if (!command || typeof command !== "object" || !Number.isSafeInteger(command.tick) || command.tick <= previous || command.tick >= ticks || (command.jump !== undefined && command.jump !== true) || (command.duck !== undefined && typeof command.duck !== "boolean") || (command.jump !== true && command.duck === undefined) || Object.keys(command).some(key => !["tick", "jump", "duck"].includes(key))) throw new Error("Commandes invalides.");
    previous = command.tick;
  }
  const state = createRunnerPreview(seed);
  let index = 0, duck = false;
  for (let tick = 0; tick < ticks; tick++) {
    if (state.ended) throw new Error("La preuve dépasse la fin de partie.");
    const command = commands[index]?.tick === tick ? commands[index++] : undefined;
    if (command?.duck !== undefined) duck = command.duck;
    stepRunnerPreview(state, command?.jump === true, duck);
  }
  if (!state.ended && ticks !== MAX_RUN_TICKS) throw new Error("La poursuite n’est pas terminée.");
  return runnerSnapshot(state);
}

export function halloweenParisDay(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export type HalloweenState = {
  state: "scheduled" | "open" | "shop" | "archived" | "paused";
  avatarKey?: string | null;
  startsAt: string; endsAt: string; shopEndsAt: string; joined: boolean;
  coins: number; tickets: number; inventory: Record<string, number>; obtained: Record<string, number>;
  cosmetics: Record<string, string>; purchases: Record<string, number>; curse: { kind: string; expiresAt: string; sender: string; id: string } | null;
  pendingGift: Record<string, unknown> | null; bandages: number;
  attempts: number; replayAvailable?: boolean; drawn: boolean; activeRun: { id: string; seed: number; startedAt: string; expiresAt: string } | null;
  ranking: { name: string; userId: string; score: number; distance: number; coins: number }[];
  dailyRanking: { name: string; userId: string; score: number; distance: number; coins: number }[];
  riders: { id: string; name: string }[]; targets: { id: string; name: string }[]; projects: { id: string; name: string }[];
};
