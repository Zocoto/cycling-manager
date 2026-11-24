// Actual private-preview HTML, canvas and scripts in isolated Chromium. Assets
// are served from memory; no account, network, database or live game state is used.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const [modulePath, executablePath, artifactDirectory] = process.argv.slice(2);
assert(modulePath && executablePath, "Supply installed playwright-core and Chromium paths");
const { chromium } = await import(pathToFileURL(modulePath).href);
const base = join(process.cwd(), "assets/christmas-preview");
const files = new Map(["tournee.html", "rules.js", "flight-physics.js", "tournee.js"].map(name => [name, readFileSync(join(base, name), "utf8")]));
files.set("wrapper.html", `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}body{margin:0;background:#112c29}iframe{display:block;width:100%;height:900px;border:0}</style></head><body>
<iframe id="flight" title="Tournée de Noël" src="tournee.html"></iframe><script src="rules.js"></script><script>
const frame=document.getElementById('flight');
window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||event.origin!==location.origin)return;
  const data=event.data;
  if(data.type==='noel:tournee-hauteur'&&Number.isFinite(data.height))frame.style.height=Math.max(310,Math.min(1000,data.height+3))+'px';
  if(data.type==='noel:tournee-terminee'){
    const result=noelRules.settleFlight(null,data.score,data.deliveries,false,data.runId,data.qualities);
    if(result)frame.contentWindow.postMessage({type:'noel:tournee-bilan',runId:data.runId,grelots:result.grelots,lights:result.lights,practice:false,improved:true},location.origin);
  }
});</script></body></html>`);
const originalGame = files.get("tournee.js");
files.set("tournee.js", originalGame.replace(/\}\)\(\);\s*$/, `
  globalThis.__flightQA = { state: () => game, launchState, findLanding, releaseParcel, precisionTargetX, draw };
})();`));
assert.notEqual(files.get("tournee.js"), originalGame, "Instrument the test copy only, never the shipped game");
if (artifactDirectory) mkdirSync(artifactDirectory, { recursive: true });
let checks = 0;
const measurements = [];
const check = (condition, label) => { assert(condition, label); checks++; };
const browser = await chromium.launch({ executablePath, headless: true });
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 });
    const unexpectedRequests = [];
    const errors = [];
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      const name = url.pathname.split("/").at(-1);
      if (url.hostname === "christmas-flight.invalid" && files.has(name)) {
        await route.fulfill({ status: 200, contentType: name.endsWith("html") ? "text/html" : "text/javascript", body: files.get(name) });
      } else {
        unexpectedRequests.push(url.href);
        await route.abort();
      }
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      let now = 0;
      let serial = 0;
      let frames = new Map();
      Object.defineProperty(performance, "now", { configurable: true, value: () => now });
      window.requestAnimationFrame = callback => { frames.set(++serial, callback); return serial; };
      window.cancelAnimationFrame = id => frames.delete(id);
      window.__advanceFlight = milliseconds => {
        const end = now + milliseconds;
        while (now < end) {
          now = Math.min(end, now + 1000 / 60);
          const callbacks = frames;
          frames = new Map();
          for (const callback of callbacks.values()) callback(now);
        }
      };
    });
    await page.goto("https://christmas-flight.invalid/wrapper.html");
    await page.waitForFunction(() => !!document.querySelector("iframe")?.contentWindow?.__flightQA, null, { polling: 10, timeout: 5000 });
    const view = page.frames().find(frame => frame.url().endsWith("/tournee.html"));
    check(!!view, `${width}: the actual game runs inside a same-origin iframe`);
    const grades = [];
    for (const [quality, error, label, expectedScore, expectedLights] of [
      ["successful", 20.4, "Réussi", 110, 1],
      ["super", 7.2, "Super", 130, 2],
      ["perfect", 0, "Parfait", 150, 3],
    ]) {
      const prepared = await view.evaluate(({ error }) => {
        const qa = window.__flightQA;
        qa.state().mode = "finished";
        document.querySelector("[data-drop]").click();
        const state = qa.state();
        state.time = 1.375;
        state.distance = 300;
        const chimney = state.chimneys[0];
        const parcel = qa.launchState();
        const time = window.ChristmasFlightPhysics.fallTime(parcel, chimney.y);
        const forecastX = window.ChristmasFlightPhysics.parcelAt(parcel, time).x;
        const precisionX = qa.precisionTargetX(chimney);
        const shift = precisionX + error - forecastX;
        state.sleigh.x += shift;
        state.player.x += shift;
        qa.draw();
        const positions = [state.time, state.time + .275, state.time + .55, state.time + .825]
          .map(t => qa.precisionTargetX(chimney, t));
        return { label: document.querySelector("[data-target]").textContent, positions, chimneyX: chimney.x };
      }, { error });
      check(prepared.label.includes(label), `${width}/${quality}: actual guide announces the current precision tier`);
      check(Math.max(...prepared.positions) - Math.min(...prepared.positions) > 1, `${width}: the precision target moves gently`);
      check(prepared.positions.every(x => Math.abs(x - prepared.chimneyX) <= 8), `${width}: target remains inside the physical chimney opening`);
      if (width < 768) await view.locator("[data-drop]").tap();
      else await page.keyboard.press("Space");
      const released = await view.evaluate(() => {
        const state = window.__flightQA.state();
        return { quality: state.parcel?.landing?.quality, precisionX: state.parcel?.landing?.precisionX, available: state.available };
      });
      check(released.quality === quality && released.available === 13, `${width}: one real input freezes the ${quality} delivery`);
      await view.evaluate(() => window.__advanceFlight(180));
      const airborne = await view.evaluate(() => ({ ...window.__flightQA.state().parcel?.landing }));
      check(airborne.quality === quality && airborne.precisionX === released.precisionX, `${width}: airborne quality is immutable`);
      await view.evaluate(() => window.__advanceFlight(700));
      const delivered = await view.evaluate(() => {
        const state = window.__flightQA.state();
        const reward = window.noelRules.settleFlight(null, state.score, state.deliveries, false, state.runId, state.qualities);
        return { score: state.score, deliveries: state.deliveries, qualities: { ...state.qualities }, reward,
          feedback: document.querySelector("[data-status]").textContent,
          hud: document.querySelector("[data-score]")?.textContent,
          scrollWidth: document.documentElement.scrollWidth };
      });
      check(delivered.score === expectedScore && delivered.deliveries === 1, `${width}: ${quality} earns the expected real score`);
      check(delivered.qualities[quality] === 1 && Object.values(delivered.qualities).reduce((sum, count) => sum + count, 0) === 1,
        `${width}: delivery is counted exactly once in its grade`);
      check(delivered.feedback.includes(label) && delivered.feedback.includes(String(expectedScore)), `${width}: visible feedback names the grade and gained points`);
      check(delivered.hud?.includes(String(expectedScore)), `${width}: the score is visible in the real HUD`);
      check(delivered.reward?.lights === expectedLights, `${width}: the grade drives ${expectedLights} lights through the shared rules`);
      check(delivered.scrollWidth <= width, `${width}: no horizontal overflow`);
      grades.push({ quality, score: delivered.score, lights: delivered.reward.lights });
      if (artifactDirectory) await page.screenshot({ path: join(artifactDirectory, `throw-quality-${width}-${quality}.png`), fullPage: true });
      await view.evaluate(() => {
        const state = window.__flightQA.state();
        state.distance = 6539;
        window.__advanceFlight(30);
      });
      await view.waitForFunction(() => !document.querySelector("[data-summary-values]").hidden, null, { polling: 10, timeout: 5000 });
      const summary = await view.locator("[data-summary-qualities]").textContent();
      check(summary.includes(`${label} : 1`), `${width}: final summary keeps the real grade breakdown`);
      const overlay = await view.locator("[data-flight-summary]").evaluate(element => {
        const rect=element.getBoundingClientRect(), stage=element.parentElement.getBoundingClientRect(), styles=getComputedStyle(element);
        return {top:rect.top,stageTop:stage.top,height:rect.height,stageHeight:stage.height,clientHeight:element.clientHeight,
          titleTop:element.querySelector('h2').getBoundingClientRect().top,scrollTop:element.scrollTop,
          scrollHeight:element.scrollHeight,overflowY:styles.overflowY,lights:document.querySelector('[data-summary-lights]').textContent};
      });
      check(overlay.top >= overlay.stageTop-1 && overlay.height <= overlay.stageHeight+1, `${width}: summary stays inside the game stage`);
      check(overlay.scrollHeight <= overlay.clientHeight+1 || ['auto','scroll'].includes(overlay.overflowY), `${width}: any extra summary content remains scrollable`);
      check(overlay.scrollTop===0 && overlay.titleTop >= overlay.top-1, `${width}: every new result reopens at its visible heading`);
      check(Number(overlay.lights) === expectedLights, `${width}: the actual iframe displays the parent's quality-aware lights`);
      if (artifactDirectory && quality==='perfect') await page.screenshot({ path: join(artifactDirectory, `throw-quality-${width}-summary.png`), fullPage: true });
      const bottom = await view.locator("[data-flight-summary]").evaluate(element => {
        element.scrollTop=element.scrollHeight;
        const note=element.querySelector('[data-summary-note]').getBoundingClientRect(), box=element.getBoundingClientRect();
        return {noteBottom:note.bottom,boxBottom:box.bottom,scrollTop:element.scrollTop,overflow:element.scrollHeight-element.clientHeight};
      });
      check(bottom.noteBottom <= bottom.boxBottom+1, `${width}: the entire end-of-run note can be reached by scrolling`);
      check(bottom.overflow <= 1 || bottom.scrollTop>0, `${width}: overflowing results actually accept scrolling`);
    }
    check(errors.length === 0, `${width}: no browser errors (${errors})`);
    check(unexpectedRequests.length === 0, `${width}: no external network or server action requests (${unexpectedRequests})`);
    measurements.push({ width, grades, unexpectedRequests, errors });
    await context.close();
  }
} finally {
  await browser.close();
}
for (const measurement of measurements.slice(1)) {
  assert.deepEqual(measurements[0].grades, measurement.grades, "Touch and keyboard produce the same grades, points and lights");
  checks++;
}
const result = { checks, measurements };
if (artifactDirectory) writeFileSync(join(artifactDirectory, "throw-quality-ui-checks.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
