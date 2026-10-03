/** Isolated design prototype: no accounts, persistence, currency grants or trusted scores. */
export const RUNNER_TITLE = "La Légende du Cycliste sans tête";
export const RUNNER_STEP = 1 / 60;
export const RUNNER_WIDTH = 960;
export const RUNNER_HEIGHT = 420;
export const RUNNER_GROUND = 334;
export const RUNNER_PLAYER_X = 300;
export const RUNNER_MAX_SECONDS = 95;
export const RUNNER_DAILY_PODIUM = [15, 10, 5] as const;

export type RunnerObject = { id: number; x: number; height: number; width: number; kind: "log" | "stone" | "coin"; used: boolean };
export type RunnerState = {
  tick: number; elapsed: number; distance: number; coins: number; hits: number;
  height: number; verticalSpeed: number; speed: number; lead: number;
  invulnerableUntil: number; nextObstacleAt: number; random: number; nextId: number;
  objects: RunnerObject[]; ended: boolean;
};

export function createRunnerPreview(seed = 20261031): RunnerState {
  return { tick: 0, elapsed: 0, distance: 0, coins: 0, hits: 0, height: 0, verticalSpeed: 0,
    speed: 240, lead: 190, invulnerableUntil: 0, nextObstacleAt: 1.5,
    random: seed >>> 0, nextId: 0, objects: [], ended: false };
}

export function runnerScore(distance: number, coins: number) {
  return Math.floor(distance) + coins * 25;
}

export function runnerSnapshot(state: RunnerState) {
  return { distance: Math.floor(state.distance), coins: state.coins, score: runnerScore(state.distance, state.coins),
    hits: state.hits, elapsed: Math.floor(state.elapsed), lead: Math.max(0, Math.round(state.lead)), ended: state.ended };
}
export type RunnerSnapshot = ReturnType<typeof runnerSnapshot>;

function random(state: RunnerState) {
  state.random = (Math.imul(state.random, 1664525) + 1013904223) >>> 0;
  return state.random / 4294967296;
}

/** Mutates a bounded, fixed-step simulation; identical seed and tick inputs give identical runs. */
export function stepRunnerPreview(state: RunnerState, jump = false) {
  if (state.ended) return;
  state.tick += 1;
  state.elapsed = state.tick * RUNNER_STEP;
  state.speed = Math.min(440, 240 + state.elapsed * 2.5);
  state.distance += state.speed * RUNNER_STEP / 12;
  state.lead -= (1.35 + state.elapsed * .009) * RUNNER_STEP;
  if (jump && state.height === 0) state.verticalSpeed = 570;
  if (state.height > 0 || state.verticalSpeed > 0) {
    state.verticalSpeed -= 1450 * RUNNER_STEP;
    state.height = Math.max(0, state.height + state.verticalSpeed * RUNNER_STEP);
    if (state.height === 0) state.verticalSpeed = 0;
  }

  if (state.elapsed >= state.nextObstacleAt) {
    const kind = random(state) < .55 ? "log" : "stone";
    const height = 34 + Math.floor(random(state) * 17);
    state.objects.push({ id: state.nextId++, x: 1030, height, width: 42, kind, used: false });
    for (const offset of [-40, 40]) {
      state.objects.push({ id: state.nextId++, x: 1030 + offset, height: 120, width: 18, kind: "coin", used: false });
    }
    // Even at maximum speed, two obstacles are separated by more than a complete jump.
    state.nextObstacleAt = state.elapsed + Math.max(1.35, 2.5 - state.elapsed * .015) + random(state) * .3;
  }
  for (const object of state.objects) {
    object.x -= state.speed * RUNNER_STEP;
    if (object.used || Math.abs(object.x - RUNNER_PLAYER_X) > (object.kind === "coin" ? 28 : 22 + object.width / 2)) continue;
    if (object.kind === "coin") {
      if (Math.abs(state.height + 46 - object.height) < 35) {
        object.used = true;
        state.coins += 1;
      }
    } else if (state.height < object.height && state.elapsed >= state.invulnerableUntil) {
      object.used = true;
      state.hits += 1;
      state.lead = Math.max(0, state.lead - 52);
      state.invulnerableUntil = state.elapsed + 1;
    }
  }
  state.objects = state.objects.filter((object) => object.x > -80);
  // The pursuer always catches up; the preview does not permit an infinite farming run.
  if (state.lead <= 0 || state.elapsed >= RUNNER_MAX_SECONDS) { state.lead = 0; state.ended = true; }
}
