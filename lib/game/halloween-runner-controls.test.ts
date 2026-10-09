import { describe, expect, it } from "vitest";
import { createHalloweenRunnerControls, halloweenRunnerViewport } from "./halloween-runner-controls";
import { createRunnerPreview, runnerSnapshot, stepRunnerPreview } from "./halloween-runner";
import { validateHalloweenRun, type HalloweenCommand } from "./halloween-event";

describe("commandes tactiles de Cycling Hollow", () => {
  it("déclenche le saut au toucher une seule fois, pas à chaque frame", () => {
    const input = createHalloweenRunnerControls();
    input.jump(); input.jump();
    expect(input.read()).toEqual({ jump: true, duck: false });
    input.consumeJump();
    expect(input.read()).toEqual({ jump: false, duck: false });
  });
  it("gère plusieurs doigts et le clavier sans relever le coureur prématurément", () => {
    const input = createHalloweenRunnerControls();
    input.pressPointer(1); input.pressPointer(2); input.pressKey("ArrowDown");
    input.releasePointer(1); input.releasePointer(2);
    expect(input.read().duck).toBe(true);
    input.releaseKey("ArrowDown");
    expect(input.read().duck).toBe(false);
    input.pressPointer(3); input.pressKey("Enter"); input.jump(); input.clear();
    expect(input.read()).toEqual({ jump: false, duck: false });
  });
  it("un doigt annulé ne bloque pas la position baissée", () => {
    const input = createHalloweenRunnerControls();
    input.pressPointer(12); input.releasePointer(12); input.releasePointer(12);
    expect(input.read().duck).toBe(false);
  });
  for (const seed of [1, 42, 20261009, 4294967295]) it(`conserve une preuve de score identique validée côté serveur, seed ${seed}`, () => {
    const input = createHalloweenRunnerControls();
    const run = createRunnerPreview(seed);
    const proof: HalloweenCommand[] = [];
    let previousDuck = false;
    while (!run.ended && run.tick < 100000) {
      if (run.tick % 90 === 0) input.jump();
      if (run.tick % 240 === 181) input.pressPointer(1);
      if (run.tick % 240 === 0) input.releasePointer(1);
      const command = input.read();
      if (command.jump || command.duck !== previousDuck) proof.push({ tick: run.tick, ...(command.jump ? { jump: true } : {}), ...(command.duck !== previousDuck ? { duck: command.duck } : {}) });
      previousDuck = command.duck;
      stepRunnerPreview(run, command.jump, command.duck); input.consumeJump();
    }
    expect(run.ended).toBe(true);
    expect(validateHalloweenRun(seed, { ticks: run.tick, commands: proof }, run.tick / 60 + 1)).toEqual(runnerSnapshot(run));
  });
});

describe("cadrage sans déplacement latéral", () => {
  for (const [width, height] of [[320, 280], [390, 410], [430, 500], [560, 190], [1440, 600], [2536, 700], [844, 220]]) it(`garde les vélos, le sol et les obstacles visibles sur ${width}×${height}`, () => {
    const camera = halloweenRunnerViewport(width, height);
    const screenX = (x: number) => camera.x + x * camera.scale;
    expect(screenX(-68)).toBeGreaterThanOrEqual(0); // pursuer at maximum lead, including cape/wheel
    expect(screenX(362)).toBeLessThan(width); // front edge of player's bike
    expect(screenX(960)).toBeLessThanOrEqual(width + .000001);
    expect(camera.y + 334 * camera.scale).toBeLessThan(height);
    expect(camera.y + 420 * camera.scale).toBeLessThanOrEqual(height + .000001);
    expect(camera.y).toBeGreaterThanOrEqual(0);
  });
});
