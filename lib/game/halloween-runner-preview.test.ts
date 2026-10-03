import { describe, expect, it } from "vitest";
import { createRunnerPreview, runnerScore, runnerSnapshot, RUNNER_MAX_SECONDS, RUNNER_PLAYER_X, RUNNER_STEP, stepRunnerPreview, type RunnerState } from "./halloween-runner-preview";

function autoJump(state: RunnerState) {
  const obstacle = state.objects.find((object) => object.kind !== "coin" && !object.used && object.x > RUNNER_PLAYER_X - 43);
  return !!obstacle && state.height === 0 && obstacle.x - RUNNER_PLAYER_X <= state.speed * .23 + 43;
}
function finish(state: RunnerState, automatic: boolean) {
  while (!state.ended && state.tick < 6000) stepRunnerPreview(state, automatic && autoJump(state));
  return runnerSnapshot(state);
}

describe("poursuite Halloween · moteur de prototype isolé", () => {
  it("commence sans pièces, obstacles ou malus", () => {
    const state = createRunnerPreview();
    expect(state.coins).toBe(0); expect(state.hits).toBe(0); expect(state.height).toBe(0);
    expect(state.objects).toEqual([]); expect(state.lead).toBeGreaterThan(0);
  });
  it("compose explicitement le score avec mètres et pièces", () => {
    expect(runnerScore(123.8, 4)).toBe(223);
    expect(runnerScore(0, 0)).toBe(0);
  });
  it("donne exactement le même parcours et résultat pour la même graine et les mêmes commandes", () => {
    const a = createRunnerPreview(42), b = createRunnerPreview(42);
    for (let tick = 0; tick < 3000; tick++) { stepRunnerPreview(a, tick % 90 === 0); stepRunnerPreview(b, tick % 90 === 0); }
    expect(a).toEqual(b);
    const c = createRunnerPreview(43);
    for (let tick = 0; tick < 180; tick++) stepRunnerPreview(c);
    expect(c.random).not.toBe(createRunnerPreview(42).random);
  });
  it("change le parcours avec la graine quotidienne", () => {
    const a = createRunnerPreview(42), b = createRunnerPreview(43);
    for (let tick = 0; tick < 300; tick++) { stepRunnerPreview(a); stepRunnerPreview(b); }
    expect(a.objects).not.toEqual(b.objects);
  });
  it("ne permet ni double saut ni envol infini", () => {
    const state = createRunnerPreview();
    stepRunnerPreview(state, true);
    expect(state.height).toBeGreaterThan(0);
    const initial = state.verticalSpeed;
    stepRunnerPreview(state, true);
    expect(state.verticalSpeed).toBeLessThan(initial);
    for (let tick = 0; tick < 60; tick++) stepRunnerPreview(state);
    expect(state.height).toBe(0); expect(state.verticalSpeed).toBe(0);
  });
  it("laisse assez de temps pour voir arriver et sauter chaque obstacle à toute vitesse", () => {
    for (let seed = 0; seed < 20; seed++) {
      const state = createRunnerPreview(seed);
      const result = finish(state, true);
      expect(result.hits, `seed ${seed}`).toBe(0);
      expect(result.coins).toBeGreaterThan(20);
      expect(result.elapsed).toBeGreaterThanOrEqual(90);
      expect(result.ended).toBe(true);
    }
  });
  it("rattrape un joueur inactif et ne compte pas plusieurs chocs sur le même obstacle", () => {
    const state = createRunnerPreview();
    const result = finish(state, false);
    expect(result.hits).toBeLessThanOrEqual(4); expect(result.elapsed).toBeLessThan(30);
    expect(result.ended).toBe(true); expect(result.coins).toBe(0);
  });
  it("ne retire jamais les pièces déjà collectées après un choc", () => {
    const state = createRunnerPreview(); state.coins = 8;
    state.objects = [{ id: 1, x: RUNNER_PLAYER_X, height: 45, width: 42, kind: "log", used: false }];
    stepRunnerPreview(state);
    expect(state.hits).toBe(1); expect(state.coins).toBe(8);
    for (let i = 0; i < 30; i++) stepRunnerPreview(state);
    expect(state.hits).toBe(1);
  });
  it("accélère, borne les objets actifs et termine même une course parfaite", () => {
    const state = createRunnerPreview(); let maximum = 0;
    while (!state.ended) { stepRunnerPreview(state, autoJump(state)); maximum = Math.max(maximum, state.objects.length); }
    expect(state.speed).toBe(440); expect(maximum).toBeLessThan(20);
    expect(state.elapsed).toBeLessThanOrEqual(RUNNER_MAX_SECONDS + RUNNER_STEP);
    const end = structuredClone(state); stepRunnerPreview(state, true); expect(state).toEqual(end);
  });
  it("recommence un essai neuf sans conserver pièces et collisions", () => {
    const previous = createRunnerPreview(); finish(previous, true);
    expect(createRunnerPreview()).toEqual(createRunnerPreview());
    expect(createRunnerPreview().coins).toBe(0); expect(previous.coins).toBeGreaterThan(0);
  });
});
