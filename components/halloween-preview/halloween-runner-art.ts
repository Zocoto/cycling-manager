import { RUNNER_GROUND, RUNNER_HEIGHT, RUNNER_PLAYER_X, RUNNER_WIDTH, type RunnerState } from "@/lib/game/halloween-runner-preview";

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
function cyclist(ctx: Brush, x: number, y: number, demon: boolean, phase: number) {
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
  stroke(ctx, demon ? "#ad633b" : "#59786b", 4, [-37, -22, -15, -54, 3, -22, -37, -22]);
  stroke(ctx, demon ? "#ad633b" : "#59786b", 4, [-15, -54, 27, -54, 3, -22]);
  stroke(ctx, "#333d36", 4, [38, -22, 25, -61, 33, -66, 40, -64]);
  stroke(ctx, "#333d36", 4, [-22, -58, -10, -58]);
  stroke(ctx, demon ? "#34312f" : "#b88664", 8, [-11, -68, 9, -48, 3 + Math.sin(phase) * 12, -24]);
  stroke(ctx, demon ? "#34312f" : "#e3af88", 8, [-10, -68, -21, -43, 4 - Math.sin(phase) * 12, -24]);
  stroke(ctx, demon ? "#493938" : "#c57e45", 20, [-10, -71, 7, -92]);
  stroke(ctx, demon ? "#34312f" : "#e3af88", 7, [4, -90, 17, -68, 34, -65]);
  if (demon) {
    ellipse(ctx, 14, -111, 20, 18, "#d68238");
    stroke(ctx, "#9b542a", 1.5, [5, -127, 1, -111, 5, -95]);
    stroke(ctx, "#9b542a", 1.5, [22, -127, 26, -111, 22, -95]);
    stroke(ctx, "#7b7b4d", 4, [13, -128, 16, -133]);
    ctx.fillStyle = "#382824"; ctx.beginPath(); ctx.moveTo(4, -116); ctx.lineTo(11, -111); ctx.lineTo(2, -111); ctx.fill();
    ctx.beginPath(); ctx.moveTo(23, -117); ctx.lineTo(25, -111); ctx.lineTo(16, -111); ctx.fill();
    stroke(ctx, "#382824", 3, [4, -103, 9, -100, 14, -103, 20, -100, 24, -105]);
  } else {
    ellipse(ctx, 15, -111, 12, 15, "#e3af88");
    ellipse(ctx, 28, -109, 3, 3, "#e3af88");
    ellipse(ctx, 21, -114, 1.6, 1.6, "#3c332b");
    stroke(ctx, "#6d4c38", 1.5, [21, -104, 25, -105]);
    ctx.fillStyle = "#eee4d2"; ctx.beginPath(); ctx.ellipse(14, -121, 16, 8, -.2, Math.PI, Math.PI * 2); ctx.fill();
    stroke(ctx, "#637b6d", 3, [2, -125, 24, -128]);
  }
  ctx.restore();
}

export function drawRunnerPreview(ctx: Brush, state: RunnerState, ready: boolean) {
  ctx.clearRect(0, 0, RUNNER_WIDTH, RUNNER_HEIGHT);
  ctx.fillStyle = "#f1e8da"; ctx.fillRect(0, 0, RUNNER_WIDTH, RUNNER_HEIGHT);
  ellipse(ctx, 805, 75, 33, 33, "#e0c7a0"); ellipse(ctx, 817, 68, 28, 28, "#f1e8da");
  // Sparse silhouettes, with calm parallax rather than a detailed Halloween background.
  const scroll = state.distance * 12;
  for (let i = 0; i < 7; i++) {
    const x = ((i * 185 - scroll * .18) % 1295 + 1295) % 1295 - 150;
    stroke(ctx, "#d0c7b9", 8, [x, 316, x, 184 + i % 3 * 19]);
    stroke(ctx, "#d0c7b9", 5, [x, 235, x - 25, 208]);
    stroke(ctx, "#d0c7b9", 5, [x, 220, x + 23, 195]);
  }
  ctx.fillStyle = "#dad7c9"; ctx.beginPath(); ctx.moveTo(0, 309); ctx.quadraticCurveTo(210, 263, 470, 313); ctx.quadraticCurveTo(770, 278, 960, 314); ctx.lineTo(960, 350); ctx.lineTo(0, 350); ctx.fill();
  ctx.fillStyle = "#d4c0a4"; ctx.fillRect(0, RUNNER_GROUND, RUNNER_WIDTH, 86);
  stroke(ctx, "#a79276", 3, [0, RUNNER_GROUND, RUNNER_WIDTH, RUNNER_GROUND]);
  for (let i = 0; i < 10; i++) {
    const x = ((i * 110 - scroll) % 1100 + 1100) % 1100 - 70;
    stroke(ctx, "#bba687", 3, [x, 376, x + 30, 376]);
  }
  const objects = ready ? [
    { x: 530, height: 120, kind: "coin" }, { x: 610, height: 120, kind: "coin" },
    { x: 570, height: 42, kind: "log" }, { x: 860, height: 48, kind: "stone" },
  ] : state.objects.filter((object) => !object.used);
  for (const object of objects) {
    if (object.kind === "coin") {
      ellipse(ctx, object.x, RUNNER_GROUND - object.height, 12, 12, "#c99239");
      ellipse(ctx, object.x, RUNNER_GROUND - object.height, 8, 8, "#e8c273");
      stroke(ctx, "#ab7b32", 1.5, [object.x, RUNNER_GROUND - object.height - 5, object.x, RUNNER_GROUND - object.height + 5]);
    } else if (object.kind === "log") {
      ctx.fillStyle = "#99775b"; ctx.fillRect(object.x - 25, RUNNER_GROUND - object.height, 50, object.height);
      ellipse(ctx, object.x + 25, RUNNER_GROUND - object.height / 2, 9, object.height / 2, "#c3a27c");
      stroke(ctx, "#755943", 2, [object.x - 21, RUNNER_GROUND - 12, object.x + 17, RUNNER_GROUND - 15]);
    } else {
      ctx.fillStyle = "#89918a"; ctx.beginPath(); ctx.moveTo(object.x - 27, RUNNER_GROUND); ctx.lineTo(object.x - 17, RUNNER_GROUND - object.height * .85); ctx.lineTo(object.x + 7, RUNNER_GROUND - object.height); ctx.lineTo(object.x + 26, RUNNER_GROUND - 15); ctx.lineTo(object.x + 25, RUNNER_GROUND); ctx.fill();
    }
  }
  cyclist(ctx, RUNNER_PLAYER_X - Math.max(85, state.lead), RUNNER_GROUND, true, scroll / 25);
  if (state.elapsed >= state.invulnerableUntil || state.tick % 12 < 8) cyclist(ctx, RUNNER_PLAYER_X, RUNNER_GROUND - state.height, false, scroll / 25);
}
