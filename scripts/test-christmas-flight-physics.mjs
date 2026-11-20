import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

// Run the exact browser physics in isolation, without a DOM or game account.
const scope = {};
runInNewContext(await readFile(new URL("../assets/christmas-preview/flight-physics.js", import.meta.url), "utf8"), scope);
const physics = scope.ChristmasFlightPhysics;
const step = 1 / 120;
let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  checks += 1;
}
function near(actual, expected, tolerance, label) {
  check(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
}
const stillTug = () => ({ x: 295, y: 143, vx: 0, vy: 0 });
const parcelOptions = { distance: 900, courseSpeed: 236, wind: 0, aim: { x: 390, y: 300 } };

for (const [vx, vy] of [[320, 0], [-320, 0], [0, 320], [0, -320]]) {
  const tug = stillTug();
  const sleigh = physics.createSleigh(tug);
  const restX = sleigh.x - tug.x;
  const restY = sleigh.y - tug.y;
  let maximumLag = 0;
  let maximumAngle = 0;
  let allFinite = true;
  for (let index = 0; index < 48; index++) {
    tug.vx = vx;
    tug.vy = vy;
    tug.x += vx * step;
    tug.y += vy * step;
    physics.updateSleigh(sleigh, tug, step);
    maximumLag = Math.max(maximumLag, Math.hypot(sleigh.x - tug.x - restX, sleigh.y - tug.y - restY));
    maximumAngle = Math.max(maximumAngle, Math.abs(sleigh.angle));
    allFinite &&= Object.values(sleigh).every(Number.isFinite);
  }
  check(allFinite, `Finite spring state in direction ${vx},${vy}`);
  check(maximumLag > 4 && maximumLag < 44, `Visible bounded inertia in direction ${vx},${vy}`);
  check(maximumAngle > .01 && maximumAngle < .4, `Sleigh pitches in direction ${vx},${vy}`);
  tug.vx = 0;
  tug.vy = 0;
  for (let index = 0; index < 600; index++) physics.updateSleigh(sleigh, tug, step);
  near(sleigh.x, tug.x + restX, .1, "Horizontal spring settles");
  near(sleigh.y, tug.y + restY, .1, "Vertical spring settles");
  near(sleigh.vx, 0, .2, "Horizontal motion damps out");
  near(sleigh.vy, 0, .2, "Vertical motion damps out");
  near(sleigh.angle, 0, .002, "Pitch returns to rest");
}

// Repeated reversals must remain bounded for an entire run.
{
  const tug = stillTug();
  const sleigh = physics.createSleigh(tug);
  let maximumAngle = 0;
  let allFinite = true;
  for (let index = 0; index < 3600; index++) {
    const angle = Math.floor(index / 24) % 4 * Math.PI / 2;
    tug.vx = Math.cos(angle) * 320;
    tug.vy = Math.sin(angle) * 320;
    tug.x += tug.vx * step;
    tug.y += tug.vy * step;
    physics.updateSleigh(sleigh, tug, step);
    allFinite &&= Object.values(sleigh).every(Number.isFinite);
    maximumAngle = Math.max(maximumAngle, Math.abs(sleigh.angle));
  }
  check(allFinite, "Repeated changes retain finite state");
  check(maximumAngle < .4, "Repeated reversals never overturn the sleigh");
}

{
  const tug = stillTug();
  const sleigh = physics.createSleigh(tug);
  const resting = physics.createParcel(sleigh, parcelOptions);
  const outlet = physics.getSleighOutlet(sleigh);
  near(resting.x, parcelOptions.distance + outlet.x, 1e-9, "Gift starts at the visible sleigh hatch");
  near(resting.y, outlet.y, 1e-9, "Gift starts at the hatch height");
  const moving = physics.createParcel({ ...sleigh, vx: 180, vy: -95 }, parcelOptions);
  near(moving.vx - resting.vx, 180, 1e-9, "Gift inherits horizontal sleigh velocity");
  near(moving.vy - resting.vy, -95, 1e-9, "Gift inherits vertical sleigh velocity");
  const tilted = physics.createParcel({ ...sleigh, angle: .22, angularVelocity: .5 }, parcelOptions);
  check(Math.abs(tilted.vx - resting.vx) > 6, "Pitch and angular velocity alter the throw");
  const rightWind = physics.createParcel(sleigh, { ...parcelOptions, wind: 210 });
  const leftWind = physics.createParcel(sleigh, { ...parcelOptions, wind: -165 });
  near(rightWind.vx, leftWind.vx, 1e-9, "Aiming never silently compensates wind");
  check(physics.parcelAt(rightWind, .6).x - physics.parcelAt(leftWind, .6).x > 60,
    "Opposite winds visibly change landing");
  const targetTime = physics.fallTime(resting, 300);
  near(physics.parcelAt(resting, targetTime).y, 300, 1e-9, "Fall time matches real ballistics");
  check(Number.isFinite(physics.fallTime(moving, 300)), "Rising parcels still land");
  check(physics.fallTime(resting, resting.y - 3) === 0, "Targets above the release do not yield NaN");
}

// Even the narrow final openings are reachable with a settled sleigh. The
// control remains timing-based: the pointer adds a capped impulse, not a hit.
for (const wind of [0, 125, -165, 210]) {
  for (const targetY of [276, 320]) {
    const sleigh = physics.createSleigh(stillTug());
    let bestError = Infinity;
    let bestDistance = 0;
    for (let targetX = 220; targetX <= 600; targetX += .25) {
      const parcel = physics.createParcel(sleigh, {
        distance: 0, courseSpeed: 236, wind, aim: { x: targetX, y: targetY },
      });
      const error = Math.abs(physics.parcelAt(parcel, physics.fallTime(parcel, targetY)).x - targetX);
      if (error < bestError) {
        bestError = error;
        bestDistance = targetX;
      }
    }
    check(bestError < 1, `Narrow chimney at height ${targetY}, wind ${wind} can be hit`);
    check(bestDistance > 240 && bestDistance < 460, "Launch timing fits the visible play area");
  }
}

console.log(`Passed ${checks} isolated Christmas flight physics checks.`);
