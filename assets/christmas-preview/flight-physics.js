(() => {
  "use strict";

  const gravity = 670;
  const hitch = { x: -122, y: 21 };
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

  function createSleigh(tug) {
    return {
      x: tug.x + hitch.x, y: tug.y + hitch.y,
      vx: 0, vy: 0, angle: 0, angularVelocity: 0,
    };
  }

  function updateSleigh(sleigh, tug, elapsed) {
    // The game uses 120 Hz. Substeps also keep this spring stable at 30 Hz.
    let remaining = Math.min(Math.max(elapsed, 0), .1);
    while (remaining > 0) {
      const dt = Math.min(remaining, 1 / 120);
      const targetX = tug.x + hitch.x;
      const targetY = tug.y + hitch.y;
      sleigh.vx += ((targetX - sleigh.x) * 48 - (sleigh.vx - tug.vx) * 7.8) * dt;
      sleigh.vy += ((targetY - sleigh.y) * 42 - (sleigh.vy - tug.vy) * 7.2) * dt;
      sleigh.x += sleigh.vx * dt;
      sleigh.y += sleigh.vy * dt;

      // A short harness keeps sharp reversals readable near the screen edges.
      if (Math.abs(sleigh.x - targetX) > 31) {
        sleigh.x = targetX + clamp(sleigh.x - targetX, -31, 31);
        sleigh.vx = tug.vx;
      }
      if (Math.abs(sleigh.y - targetY) > 26) {
        sleigh.y = targetY + clamp(sleigh.y - targetY, -26, 26);
        sleigh.vy = tug.vy;
      }
      const targetAngle = clamp(
        (targetY - sleigh.y) * .011 - (tug.vx - sleigh.vx) * .00055,
        -.30, .30,
      );
      sleigh.angularVelocity += ((targetAngle - sleigh.angle) * 46 - sleigh.angularVelocity * 7.6) * dt;
      sleigh.angle += sleigh.angularVelocity * dt;
      remaining -= dt;
    }
    return sleigh;
  }

  function getSleighOutlet(sleigh) {
    const localX = 5;
    const localY = 7;
    const cosine = Math.cos(sleigh.angle);
    const sine = Math.sin(sleigh.angle);
    const offsetX = localX * cosine - localY * sine;
    const offsetY = localX * sine + localY * cosine;
    return {
      x: sleigh.x + offsetX,
      y: sleigh.y + offsetY,
      vx: sleigh.vx - sleigh.angularVelocity * offsetY,
      vy: sleigh.vy + sleigh.angularVelocity * offsetX,
    };
  }

  function createParcel(sleigh, { distance, courseSpeed, wind }) {
    const outlet = getSleighOutlet(sleigh);
    const throwSpeed = 42;
    return {
      x: distance + outlet.x,
      y: outlet.y,
      // The gift keeps the sleigh's motion at release, including rotation at
      // the hatch. Every input device releases with the same fixed impulse.
      vx: courseSpeed + outlet.vx + Math.sin(sleigh.angle) * throwSpeed,
      vy: outlet.vy + Math.cos(sleigh.angle) * throwSpeed,
      wind,
      age: 0,
    };
  }

  function parcelAt(parcel, time) {
    return {
      x: parcel.x + parcel.vx * time + parcel.wind * time * time / 2,
      y: parcel.y + parcel.vy * time + gravity * time * time / 2,
    };
  }

  function fallTime(parcel, targetY) {
    if (targetY <= parcel.y) return 0;
    return (Math.sqrt(parcel.vy ** 2 + 2 * gravity * (targetY - parcel.y)) - parcel.vy) / gravity;
  }

  globalThis.ChristmasFlightPhysics = Object.freeze({
    createSleigh, updateSleigh, getSleighOutlet, createParcel, parcelAt, fallTime,
  });
})();
