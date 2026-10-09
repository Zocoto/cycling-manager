import { isRunnerHazard, RUNNER_GROUND, RUNNER_HEIGHT, RUNNER_PLAYER_X, RUNNER_WIDTH, type RunnerState, type RunnerObject } from "@/lib/game/halloween-runner";
import { DEMONIC_WHEEL_COLORS as wheelColors, DEMONIC_WHEEL_SPOKES } from "@/lib/game/halloween-wheel-art";
import { halloweenRunnerViewport } from "@/lib/game/halloween-runner-controls";

type Brush = CanvasRenderingContext2D;
function stroke(ctx: Brush, color: string, width: number, points: number[]) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.stroke();
}
function ellipse(ctx: Brush, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

/** Flat, code-native illustration. No downloaded images, textures, audio or per-frame allocations of assets. */
function cyclist(ctx: Brush, x: number, y: number, demon: boolean, phase: number, ducking = false) {
  ctx.save(); ctx.translate(x, y);
  if (demon) {
    ctx.fillStyle = "#704943"; ctx.beginPath(); ctx.moveTo(-12, -81); ctx.lineTo(-67, -42); ctx.lineTo(-35, -44); ctx.lineTo(-27, -30); ctx.lineTo(15, -65); ctx.fill();
  }
  for (const wheelX of [-37, 38]) {
    ellipse(ctx, wheelX, -22, 24, 24, "#262b28"); ellipse(ctx, wheelX, -22, 19, 19, "#eee4d2");
    for (let spoke = 0; spoke < 4; spoke++) {
      const angle = phase + spoke * Math.PI / 2;
      stroke(ctx, "#b7ab98", 1.4, [wheelX, -22, wheelX + Math.cos(angle) * 17, -22 + Math.sin(angle) * 17]);
    }
    ellipse(ctx, wheelX, -22, 3, 3, "#5c5951");
  }
  stroke(ctx, demon ? "#ad633b" : "#d2ac78", 4, [-37, -22, -15, -54, 3, -22, -37, -22]);
  stroke(ctx, demon ? "#ad633b" : "#d2ac78", 4, [-15, -54, 27, -54, 3, -22]);
  stroke(ctx, "#333d36", 4, [38, -22, 25, -61, 33, -66, 40, -64]);
  stroke(ctx, "#333d36", 4, [-22, -58, -10, -58]);
  stroke(ctx, demon ? "#34312f" : "#b88664", 8, [-11, -68, 9, -48, 3 + Math.sin(phase) * 12, -24]);
  stroke(ctx, demon ? "#34312f" : "#e3af88", 8, [-10, -68, -21, -43, 4 - Math.sin(phase) * 12, -24]);
  stroke(ctx, demon ? "#493938" : "#df8c49", ducking ? 13 : 20, ducking ? [-12, -64, 11, -62] : [-10, -71, 7, -92]);
  stroke(ctx, demon ? "#34312f" : "#e3af88", 7, ducking ? [11, -61, 22, -52, 34, -65] : [4, -90, 17, -68, 34, -65]);
  if (demon) {
    ellipse(ctx, 14, -111, 20, 18, "#d68238");
    stroke(ctx, "#9b542a", 1.5, [5, -127, 1, -111, 5, -95]);
    stroke(ctx, "#9b542a", 1.5, [22, -127, 26, -111, 22, -95]);
    stroke(ctx, "#7b7b4d", 4, [13, -128, 16, -133]);
    ctx.fillStyle = "#382824"; ctx.beginPath(); ctx.moveTo(4, -116); ctx.lineTo(11, -111); ctx.lineTo(2, -111); ctx.fill();
    ctx.beginPath(); ctx.moveTo(23, -117); ctx.lineTo(25, -111); ctx.lineTo(16, -111); ctx.fill();
    stroke(ctx, "#382824", 3, [4, -103, 9, -100, 14, -103, 20, -100, 24, -105]);
  } else {
    if (ducking) { ctx.translate(7, 48); ctx.scale(1, .95); }
    ellipse(ctx, 15, -111, 12, 15, "#e3af88");
    ellipse(ctx, 28, -109, 3, 3, "#e3af88");
    ellipse(ctx, 21, -114, 1.6, 1.6, "#3c332b");
    stroke(ctx, "#6d4c38", 1.5, [21, -104, 25, -105]);
    ctx.fillStyle = "#eee4d2"; ctx.beginPath(); ctx.ellipse(14, -121, 16, 8, -.2, Math.PI, Math.PI * 2); ctx.fill();
    stroke(ctx, "#ac6b3f", 3, [2, -125, 24, -128]);
  }
  ctx.restore();
}

function obstacle(ctx: Brush, object: Pick<RunnerObject, "x" | "height" | "width" | "kind" | "bottom">) {
  ctx.save(); ctx.translate(object.x, RUNNER_GROUND);
  const h = object.height, w = object.width;
  if (object.kind === "coin") {
    ctx.fillStyle = wheelColors.rim;
    ctx.beginPath(); ctx.moveTo(-9, -h - 7); ctx.lineTo(-11, -h - 13); ctx.lineTo(-5, -h - 10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(9, -h - 7); ctx.lineTo(11, -h - 13); ctx.lineTo(5, -h - 10); ctx.fill();
    ellipse(ctx, 0, -h, 12, 12, wheelColors.tire);
    ellipse(ctx, 0, -h, 9.4, 9.4, wheelColors.center);
    ctx.strokeStyle = wheelColors.rim; ctx.lineWidth = 1.8; ctx.stroke();
    for (const [x, y] of DEMONIC_WHEEL_SPOKES) stroke(ctx, wheelColors.spoke, .9, [x * 2, -h + y * 2, x * 8.5, -h + y * 8.5]);
    ellipse(ctx, 0, -h, 2.2, 2.2, wheelColors.rim);
  } else if (object.kind === "stake") {
    ellipse(ctx, 0, -h, 22, 22, "#392f30"); ctx.fillStyle = "#e6ba80";
    ctx.beginPath(); ctx.moveTo(-5, -h + 16); ctx.lineTo(-5, -h - 10); ctx.lineTo(0, -h - 23); ctx.lineTo(5, -h - 10); ctx.lineTo(5, -h + 16); ctx.fill();
    stroke(ctx, "#986d44", 2, [-3, -h + 9, 3, -h + 5]);
    ctx.fillStyle = "#efbd81"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.fillText("PIEU · REPOUSSE", 0, -h - 30);
  } else if (object.kind === "pumpkin" || object.kind === "skull") {
    ellipse(ctx, 0, -h / 2, w / 2, h / 2, object.kind === "pumpkin" ? "#d67b37" : "#d4cbb4");
    ellipse(ctx, -w * .18, -h * .58, w * .09, h * .12, "#29222a"); ellipse(ctx, w * .18, -h * .58, w * .09, h * .12, "#29222a");
    stroke(ctx, "#29222a", 3, [-w * .22, -h * .25, 0, -h * .2, w * .22, -h * .25]);
    if (object.kind === "pumpkin") stroke(ctx, "#877454", 4, [0, -h, 3, -h - 4]);
    else for (let i = -1; i <= 1; i++) stroke(ctx, "#29222a", 2, [i * 5, -h * .28, i * 5, -h * .13]);
  } else if (object.kind === "gravestone") {
    ctx.fillStyle = "#817e83"; ctx.beginPath(); ctx.roundRect(-w / 2, -h, w, h, [Math.min(w / 2, h * .4), Math.min(w / 2, h * .4), 0, 0]); ctx.fill();
    if (w > 100) {
      ctx.fillStyle = "#5e5a64"; ctx.fillRect(-w / 2 + 6, -h + 8, w - 12, 5);
      stroke(ctx, "#b7abb0", 2, [-w * .32, -h * .68, -w * .15, -h * .4, -w * .22, -4]);
      ctx.fillStyle = "#d8cbb8"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.fillText("R. I. P.", w * .18, -h * .32);
    } else {
      stroke(ctx, "#38343d", 3, [0, -h * .8, 0, -h * .45]); stroke(ctx, "#38343d", 3, [-w * .15, -h * .64, w * .15, -h * .64]);
    }
  } else if (object.kind === "zombie-hand") {
    stroke(ctx, "#789079", w * .4, [0, -4, -2, -h * .55]);
    for (let i = -2; i <= 2; i++) stroke(ctx, "#789079", 6, [-2, -h * .48, i * w * .14, -h * (.84 + (2 - Math.abs(i)) * .08)]);
    stroke(ctx, "#3a473c", 2, [-5, -h * .25, 4, -h * .28]);
  } else {
    const bottom = object.bottom ?? 86;
    ctx.translate(0, -bottom - h / 2);
    if (object.kind === "bat") {
      ctx.fillStyle = "#ab949f"; ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(-w / 2, -h / 2); ctx.lineTo(-w * .3, 10); ctx.lineTo(-w * .13, 0); ctx.lineTo(0, 15); ctx.lineTo(w * .13, 0); ctx.lineTo(w * .3, 10); ctx.lineTo(w / 2, -h / 2); ctx.closePath(); ctx.fill();
      ellipse(ctx, 0, 0, 10, 15, "#6b5867"); ellipse(ctx, -4, -3, 2, 2, "#f4bc76"); ellipse(ctx, 4, -3, 2, 2, "#f4bc76");
    } else if (object.kind === "web") {
      for (let i = -2; i <= 2; i++) stroke(ctx, "#c1b1b3", 1.5, [0, -h * .4, i * w * .24, h * .5]);
      for (const offset of [0, 14, 28]) stroke(ctx, "#c1b1b3", 1.5, [-w * .45, offset - 13, -w * .22, offset - 7, 0, offset - 13, w * .22, offset - 7, w * .45, offset - 13]);
      stroke(ctx, "#c1b1b3", 1, [0, -h * .4, 0, -180]);
    } else {
      stroke(ctx, "#99888d", 6, [-w / 2, bottom + h / 2, -w / 2, -h / 2, w / 2, -h / 2, w / 2, bottom + h / 2]);
      ctx.fillStyle = "#675761"; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = "#ead0b3"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"; ctx.fillText("CIMETIÈRE", 0, 3);
    }
    ctx.fillStyle = "#efbd81"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.fillText("↓ BAISSEZ-VOUS", 0, -h / 2 - 12);
  }
  ctx.restore();
}

export function drawRunnerPreview(ctx: Brush, state: RunnerState, ready: boolean, viewport?: { width: number; height: number }) {
  if (viewport) {
    const { scale, x, y } = halloweenRunnerViewport(viewport.width, viewport.height);
    ctx.clearRect(0, 0, viewport.width, viewport.height);
    ctx.fillStyle = "#121019";
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    // Extend the road/sky, not the sprites. Keep both bikes and all approaching
    // obstacles in view without stretching the illustration or changing physics.
    ctx.fillStyle = "#3a2b2b";
    ctx.fillRect(0, y + RUNNER_GROUND * scale, viewport.width, viewport.height);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    drawRunnerPreview(ctx, state, ready);
    ctx.restore();
    return;
  }
  ctx.clearRect(0, 0, RUNNER_WIDTH, RUNNER_HEIGHT);
  ctx.fillStyle = "#121019"; ctx.fillRect(0, 0, RUNNER_WIDTH, RUNNER_HEIGHT);
  ellipse(ctx, 805, 75, 35, 35, "#eee2c7"); ellipse(ctx, 797, 63, 8, 6, "#d3c7b1"); ellipse(ctx, 816, 87, 10, 8, "#d3c7b1");
  for (let i = 0; i < 12; i++) ellipse(ctx, (i * 179 + 70) % 940, (i * 43) % 155 + 20, 1, 1, "#b9a99f");
  // Sparse silhouettes, with calm parallax rather than a detailed Halloween background.
  const scroll = state.distance * 12;
  for (let i = 0; i < 7; i++) {
    const x = ((i * 185 - scroll * .18) % 1295 + 1295) % 1295 - 150;
    stroke(ctx, "#302732", 8, [x, 316, x, 184 + i % 3 * 19]);
    stroke(ctx, "#302732", 5, [x, 235, x - 25, 208]);
    stroke(ctx, "#302732", 5, [x, 220, x + 23, 195]);
  }
  ctx.fillStyle = "#25212a"; ctx.beginPath(); ctx.moveTo(0, 309); ctx.quadraticCurveTo(210, 263, 470, 313); ctx.quadraticCurveTo(770, 278, 960, 314); ctx.lineTo(960, 350); ctx.lineTo(0, 350); ctx.fill();
  ctx.fillStyle = "#3a2b2b"; ctx.fillRect(0, RUNNER_GROUND, RUNNER_WIDTH, 86);
  stroke(ctx, "#98715a", 3, [0, RUNNER_GROUND, RUNNER_WIDTH, RUNNER_GROUND]);
  for (let i = 0; i < 10; i++) {
    const x = ((i * 110 - scroll) % 1100 + 1100) % 1100 - 70;
    stroke(ctx, "#211e23", 2, [x, 369, x + 13, 381, x + 34, 377, x + 40, 394]);
  }
  const objects = ready ? [
    { x: 530, height: 132, width: 18, kind: "coin" as const }, { x: 610, height: 132, width: 18, kind: "coin" as const },
    { x: 600, height: 42, width: 360, kind: "gravestone" as const }, { x: 950, height: 68, width: 160, bottom: 86, kind: "web" as const },
    { x: 920, height: 44, width: 22, kind: "stake" as const },
  ] : state.objects.filter((object) => isRunnerHazard(object.kind) || !object.used);
  for (const object of objects) obstacle(ctx, object);
  cyclist(ctx, RUNNER_PLAYER_X - state.lead, RUNNER_GROUND, true, (scroll - state.lead) / 25);
  if (state.elapsed < state.slowedUntil) { ctx.fillStyle = "#efbd81"; ctx.font = "bold 13px sans-serif"; ctx.fillText("PIEU ! POURSUIVANT REPOUSSÉ", 24, 30); }
  if (state.ended || state.elapsed >= state.invulnerableUntil || state.tick % 12 < 8) cyclist(ctx, RUNNER_PLAYER_X, RUNNER_GROUND - state.height, false, scroll / 25, state.ducking);
}
