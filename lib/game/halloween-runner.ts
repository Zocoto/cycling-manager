/** Isolated design prototype: no accounts, persistence, currency grants or trusted scores. */
export const RUNNER_TITLE = "Cycling Hollow : la légende de l’équipier sans tête";
export const RUNNER_TAGLINE = "Échappez à l’équipier sans tête";
export const RUNNER_STEP = 1 / 60;
export const RUNNER_WIDTH = 960;
export const RUNNER_HEIGHT = 420;
export const RUNNER_GROUND = 334;
export const RUNNER_PLAYER_X = 300;
/** Centre-to-centre gap at which the pursuer's front wheel reaches the player's bike. */
export const RUNNER_CATCH_DISTANCE = 75;
export const RUNNER_DAILY_PODIUM = [15, 10, 5] as const;

export type RunnerObjectKind = "skull" | "pumpkin" | "gravestone" | "zombie-hand" | "bat" | "web" | "cemetery-arch" | "coin" | "stake";
export type RunnerObject = { id: number; x: number; height: number; width: number; kind: RunnerObjectKind; bottom?: number; used: boolean };
export const RUNNER_EXAMPLE_SCORES = [
  { name: "Maillot cuivré", score: 3940, distance: 2240, coins: 68 },
  { name: "Roue de minuit", score: 3310, distance: 1860, coins: 58 },
  { name: "Échappée fantôme", score: 2950, distance: 1700, coins: 50 },
] as const;
export function isRunnerOverhead(kind: RunnerObjectKind) { return kind === "bat" || kind === "web" || kind === "cemetery-arch"; }
export function isRunnerHazard(kind: RunnerObjectKind) { return kind !== "coin" && kind !== "stake"; }
type HazardShape = Pick<RunnerObject, "kind" | "width" | "height" | "bottom">;
type Encounter = { hazards: HazardShape[]; breathingRoom: number };
type Pattern = "single" | "long-stone" | "tunnel" | "double-ground" | "ground-air" | "air-ground";
export type RunnerState = {
  tick: number; elapsed: number; distance: number; coins: number; hits: number;
  height: number; verticalSpeed: number; speed: number; lead: number; ducking: boolean; stakes: number; slowedUntil: number;
  invulnerableUntil: number; stumbleUntil: number; nextObstacleAt: number; random: number; nextId: number;
  lastPattern: Pattern | null; pendingEncounter: Encounter | null; tailHazard: (HazardShape & { x: number }) | null;
  objects: RunnerObject[]; ended: boolean;
};

export function createRunnerPreview(seed = 20261031): RunnerState {
  return { tick: 0, elapsed: 0, distance: 0, coins: 0, hits: 0, height: 0, verticalSpeed: 0,
    speed: 240, lead: 260, ducking: false, stakes: 0, slowedUntil: 0, invulnerableUntil: 0, stumbleUntil: 0,
    lastPattern: null, pendingEncounter: null, tailHazard: null, nextObstacleAt: .65,
    random: seed >>> 0, nextId: 0, objects: [], ended: false };
}

export function runnerScore(distance: number, coins: number) {
  return Math.floor(distance) + coins * 25;
}

export function runnerSnapshot(state: RunnerState) {
  return { distance: Math.floor(state.distance), coins: state.coins, score: runnerScore(state.distance, state.coins),
    hits: state.hits, elapsed: Math.floor(state.elapsed), lead: Math.max(0, Math.round(state.lead - RUNNER_CATCH_DISTANCE)),
    speed: Math.round(state.speed / 240 * 100) / 100, ducking: state.ducking, stakes: state.stakes,
    slowed: state.elapsed < state.slowedUntil, stumbling: state.elapsed < state.stumbleUntil, ended: state.ended };
}
export type RunnerSnapshot = ReturnType<typeof runnerSnapshot>;

function random(state: RunnerState) {
  state.random = (Math.imul(state.random, 1664525) + 1013904223) >>> 0;
  return state.random / 4294967296;
}

/** Shared cruising speed: quick difficulty ramp, still increasing after 95 seconds.
 * A smooth asymptote bounds movement per physics step, not the duration of an attempt. */
export function runnerSpeedAt(elapsed: number) {
  return 240 + 1560 * (1 - Math.exp(-Math.max(0, elapsed) / 70));
}

function choose<T>(state: RunnerState, values: readonly T[]): T { return values[Math.floor(random(state) * values.length)]; }
function between(state: RunnerState, min: number, max: number) { return min + random(state) * (max - min); }

function groundShape(state: RunnerState, long = false): HazardShape {
  const kind = long ? "gravestone" : choose(state, ["skull", "pumpkin", "gravestone", "zombie-hand"] as const);
  const height = Math.floor(between(state, long ? 28 : 30, long ? 47 : 68));
  // Width fits the usable part of the jump at the *current* speed. Arrival is faster.
  // Reserve 120 ms for fixed-step rounding and the 44 px bike collision box.
  // Broad tomb slabs approach the safe jump window instead of being capped at
  // 260 px. At speed they can reach 600 px, requiring a well-timed whole jump.
  const airWindow = 2 * Math.sqrt(570 ** 2 - 2 * 1450 * height) / 1450 - .12;
  const maximumWidth = Math.max(30, Math.min(600, state.speed * airWindow - 44));
  const width = Math.floor(long ? maximumWidth * between(state, .88, 1) : Math.min(maximumWidth, between(state, 32, 80)));
  return { kind, height, width, bottom: 0 };
}

function airShape(state: RunnerState, long = false): HazardShape {
  const kind = choose(state, long ? ["web", "cemetery-arch"] as const : ["bat", "web", "cemetery-arch"] as const);
  return { kind, height: Math.floor(between(state, 58, 85)), bottom: Math.floor(between(state, 86, 102)),
    width: Math.floor(long ? between(state, 180, 340) : between(state, 60, 155)) };
}

function planEncounter(state: RunnerState): Encounter {
  const options: Pattern[] = state.elapsed < 5 ? ["single"] : state.elapsed < 12
    ? ["single", "long-stone", "tunnel"]
    : ["single", "long-stone", "tunnel", "double-ground", "ground-air", "air-ground"];
  const alternatives = options.filter((pattern) => pattern !== state.lastPattern);
  const pattern = choose(state, alternatives.length ? alternatives : options);
  state.lastPattern = pattern;
  const hazards = pattern === "long-stone" ? [groundShape(state, true)]
    : pattern === "tunnel" ? [airShape(state, true)]
    : pattern === "double-ground" ? [groundShape(state), groundShape(state, random(state) < .45)]
    : pattern === "ground-air" ? [groundShape(state), airShape(state)]
    : pattern === "air-ground" ? [airShape(state, random(state) < .4), groundShape(state)]
    : [state.elapsed > 5 && random(state) < .4 ? airShape(state) : groundShape(state)];
  return { hazards, breathingRoom: between(state, .05, .95) * (1 - Math.min(1, state.elapsed / 45) * .65) };
}

/** Independent of random rhythm: never require ducking before a jump can land,
 * or another jump before the first is over. Lookahead also covers acceleration. */
function hazardSpacing(previous: HazardShape, next: HazardShape, speed: number) {
  const beforeAir = isRunnerOverhead(previous.kind), afterAir = isRunnerOverhead(next.kind);
  if (!beforeAir && !afterAir) return speed * .86 + Math.abs(previous.width - next.width) / 2 + 50;
  return (previous.width + next.width) / 2 + 44 + speed * (!beforeAir ? .64 : !afterAir ? .32 : .16);
}

function spawnEncounter(state: RunnerState) {
  if (state.elapsed < state.nextObstacleAt) return;
  const encounter = state.pendingEncounter ?? (state.pendingEncounter = planEncounter(state));
  const forecastSpeed = runnerSpeedAt(state.elapsed + 6);
  // Keep one tiny spacing anchor after its sprite is culled off-screen. At high
  // speed a safe jump gap can exceed the viewport: culling must not erase it.
  const previous = state.tailHazard;
  const first = encounter.hazards[0];
  if (previous && previous.x > 1030 - hazardSpacing(previous, first, forecastSpeed) - encounter.breathingRoom * forecastSpeed) return;
  let x = 1030;
  let last: HazardShape | undefined;
  for (const shape of encounter.hazards) {
    if (last) x += hazardSpacing(last, shape, forecastSpeed) + between(state, .04, .25) * forecastSpeed;
    state.objects.push({ ...shape, id: state.nextId++, x, used: false });
    state.tailHazard = { ...shape, x };
    // No fixed two-coin motif: some obstacles have no coins, others a small cluster.
    const count = random(state) < .2 ? 0 : 1 + Math.floor(random(state) * 3);
    for (let i = 0; i < count; i++) state.objects.push({ id: state.nextId++, x: x + (i - (count - 1) / 2) * 32,
      height: isRunnerOverhead(shape.kind) ? 42 : Math.floor(between(state, 124, 142)), width: 18, kind: "coin", used: false });
    last = shape;
  }
  // Rare and irregular; never a guaranteed periodic rescue or an extra coin.
  if (random(state) < .12) state.objects.push({ id: state.nextId++, x: x + (last?.width ?? 0) / 2 + forecastSpeed * .45,
    height: 44, width: 22, kind: "stake", used: false });
  state.pendingEncounter = null;
  state.nextObstacleAt = state.elapsed + .1;
}

/** Mutates a bounded, fixed-step simulation; identical seed and tick inputs give identical runs. */
export function stepRunnerPreview(state: RunnerState, jump = false, duck = false) {
  if (state.ended) return;
  state.tick += 1;
  state.elapsed = state.tick * RUNNER_STEP;
  state.speed = runnerSpeedAt(state.elapsed);
  const playerSpeed = state.speed - (state.elapsed < state.stumbleUntil ? 120 : 0);
  const pursuerSpeed = state.speed - (state.elapsed < state.slowedUntil ? 22 : 0);
  state.distance += playerSpeed * RUNNER_STEP / 12;
  // Equal speed in normal play. A hit slows the player for .6 s; a stake slows
  // the pursuer for 3 s. No timer, score threshold or unexplained gap loss.
  state.lead = Math.min(300, state.lead + (playerSpeed - pursuerSpeed) * RUNNER_STEP);
  state.ducking = duck && state.height === 0 && state.verticalSpeed === 0;
  if (jump && !duck && state.height === 0) state.verticalSpeed = 570;
  if (state.height > 0 || state.verticalSpeed > 0) {
    state.verticalSpeed -= 1450 * RUNNER_STEP;
    state.height = Math.max(0, state.height + state.verticalSpeed * RUNNER_STEP);
    if (state.height === 0) state.verticalSpeed = 0;
  }

  spawnEncounter(state);
  if (state.tailHazard) state.tailHazard.x -= playerSpeed * RUNNER_STEP;
  for (const object of state.objects) {
    object.x -= playerSpeed * RUNNER_STEP;
    if (object.used || Math.abs(object.x - RUNNER_PLAYER_X) > (object.kind === "coin" || object.kind === "stake" ? 28 : 22 + object.width / 2)) continue;
    if (object.kind === "coin" || object.kind === "stake") {
      if (Math.abs(state.height + 46 - object.height) < 35) {
        object.used = true;
        if (object.kind === "coin") state.coins += 1;
        else { state.stakes += 1; state.slowedUntil = state.elapsed + 3; }
      }
    } else if ((isRunnerOverhead(object.kind)
      ? state.height + (state.ducking ? 76 : 132) > (object.bottom ?? 86) && state.height < (object.bottom ?? 86) + object.height
      : state.height < object.height) && state.elapsed >= state.invulnerableUntil) {
      object.used = true;
      state.hits += 1;
      state.stumbleUntil = state.elapsed + .6;
      state.invulnerableUntil = state.elapsed + .7;
    }
  }
  state.objects = state.objects.filter((object) => object.x + object.width / 2 > -80);
  if (state.lead <= RUNNER_CATCH_DISTANCE) { state.lead = RUNNER_CATCH_DISTANCE; state.ended = true; }
}
