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
const parcelOptions = { distance: 900, courseSpeed: 236, wind: 0 };

{
  for (const distance of [0, 625, 1010, 1430, 1470]) {
    near(physics.getCourseWind(distance), 0, 0, "The first three chimneys are sheltered");
  }
  let bounded = true;
  let smooth = true;
  let previous = physics.getCourseWind(0);
  for (let distance = 1; distance <= 6540; distance++) {
    const wind = physics.getCourseWind(distance);
    bounded &&= Number.isFinite(wind) && wind >= -210 && wind <= 235;
    smooth &&= Math.abs(wind - previous) < 1.2;
    previous = wind;
  }
  check(bounded, "Gradual gusts stay within the planned strength");
  check(smooth, "Wind never jumps at a course transition");
  check(physics.getCourseWind(2400) > 0 && physics.getCourseWind(3900) < 0,
    "The visible wind changes direction across the village");
  const sleigh = physics.createSleigh(stillTug());
  const parcel = physics.createParcel(sleigh, { ...parcelOptions, wind: physics.getCourseWind(2800) });
  const beforeGust = physics.parcelAt(parcel, .6);
  check(Math.abs(physics.getCourseWind(3400) - parcel.wind) > 100, "The test crosses a material wind change");
  assert.deepEqual(physics.parcelAt(parcel, .6), beforeGust, "An airborne parcel retains its accepted landing through a gust");
  checks += 1;
}

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
  const tilted = physics.createParcel({ ...sleigh, angle: .22 }, parcelOptions);
  check(Math.abs(tilted.vx - resting.vx) > 6, "Pitch alters the throw");
  const rotating = physics.createParcel({ ...sleigh, angularVelocity: .5 }, parcelOptions);
  near(rotating.vx - resting.vx, -3.5, 1e-9, "Angular motion contributes horizontal hatch velocity");
  near(rotating.vy - resting.vy, 2.5, 1e-9, "Angular motion contributes vertical hatch velocity");
  const rightWind = physics.createParcel(sleigh, { ...parcelOptions, wind: 210 });
  const leftWind = physics.createParcel(sleigh, { ...parcelOptions, wind: -165 });
  near(rightWind.vx, leftWind.vx, 1e-9, "Release never silently compensates wind");
  check(physics.parcelAt(rightWind, .6).x - physics.parcelAt(leftWind, .6).x > 60,
    "Opposite winds visibly change landing");
  const targetTime = physics.fallTime(resting, 300);
  near(physics.parcelAt(resting, targetTime).y, 300, 1e-9, "Fall time matches real ballistics");
  check(Number.isFinite(physics.fallTime(moving, 300)), "Rising parcels still land");
  check(physics.fallTime(resting, resting.y - 3) === 0, "Targets above the release do not yield NaN");
}

// Old pointer fields must have no effect, even if a stale caller supplies one.
for (const wind of [0, -165, 210]) {
  const sleigh = { ...physics.createSleigh(stillTug()), vx: 65, vy: -30, angle: .18, angularVelocity: -.2 };
  const options = { ...parcelOptions, wind };
  const release = physics.createParcel(sleigh, options);
  for (const aim of [undefined, null, false, true, { x: 0, y: 0 }, { x: 800, y: 400 }, { x: NaN, y: Infinity }]) {
    assert.deepEqual(physics.createParcel(sleigh, { ...options, aim }), release,
      "Pointer position and presence never alter release physics");
    checks += 1;
  }
  Object.defineProperty(options, "aim", { get() { throw new Error("The obsolete aim field must never be read"); } });
  assert.deepEqual(physics.createParcel(sleigh, options), release);
  checks += 1;
}

// Aim with the convoy's position and release timing. At the real 120 Hz tick,
// a settled sleigh can hit even a 24 px opening under every course wind.
for (const wind of [0, 125, -210, 235]) {
  for (const targetY of [276, 320]) {
    for (const tugY of [72, 143, 211]) {
      const sleigh = physics.createSleigh({ ...stillTug(), y: tugY });
      const targetX = 850;
      let bestError = Infinity;
      let screenTarget = 0;
      for (let tick = 0; tick < 420; tick++) {
        const distance = tick * step * 236;
        const parcel = physics.createParcel(sleigh, { distance, courseSpeed: 236, wind });
        const error = Math.abs(physics.parcelAt(parcel, physics.fallTime(parcel, targetY)).x - targetX);
        if (error < bestError) {
          bestError = error;
          screenTarget = targetX - distance;
        }
      }
      check(bestError < 1.1, `Narrow chimney height ${targetY}, convoy height ${tugY}, wind ${wind} can be hit by timing`);
      check(screenTarget > 150 && screenTarget < 470, "The release window stays within the visible play area");
    }
  }
}

console.log(`Passed ${checks} isolated Christmas flight physics checks.`);
